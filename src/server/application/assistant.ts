// 编排一个完整轮次；HTTP 只负责传输，Agent 不直接掌握会话归属和费用账本。
import "server-only";
import { AppError } from "@/domain/evaluation";
import type { AssistantActor, AssistantEvent, Evidence, ToolTrace } from "@/domain/assistant";
import { evaluationService } from "./evaluation";
import { comparisonReviewService } from "./comparison-review";
import { assistantRepository, jsonValue } from "@/server/repositories/assistant-repository";
import { runInvestigation } from "@/server/agent/agent";
import { usageMicros } from "@/server/agent/config";

const processState = globalThis as typeof globalThis & { assistantControllers?: Map<string, AbortController> };
const controllers = processState.assistantControllers ??= new Map();
export const assistantService = {
  async create(actor: AssistantActor, runId: string, baselineRunId: string | null) {
    const run = await evaluationService.get(actor, runId);
    if (run.status !== "SUCCEEDED") throw new AppError("STATE_CONFLICT", "请选择已经完成的评测任务", 409);
    if (baselineRunId) await comparisonReviewService.comparison(actor, runId, baselineRunId);
    return assistantRepository.create(actor, runId, baselineRunId);
  },
  list: assistantRepository.list,
  detail: assistantRepository.detail,
  begin: assistantRepository.begin,
  async stop(actor: AssistantActor, sessionId: string, turnId: string) {
    await assistantRepository.stop(actor, sessionId, turnId);
    controllers.get(turnId)?.abort();
    return { stopped: true };
  },
  async execute(actor: AssistantActor, started: Awaited<ReturnType<typeof assistantRepository.begin>>, sampleId: string | null, emit: (event: AssistantEvent) => void, connectionSignal: AbortSignal) {
    const { session, turn } = started;
    const controller = new AbortController(); controllers.set(turn.id, controller);
    const timeout = setTimeout(() => controller.abort(new Error("TIMEOUT")), Math.max(1, turn.deadlineAt.getTime() - Date.now()));
    const disconnect = () => controller.abort(new Error("DISCONNECTED"));
    connectionSignal.addEventListener("abort", disconnect, { once: true });
    if (connectionSignal.aborted) disconnect();
    const signal = controller.signal;
    // 停止请求可能由另一实例处理；轮询只持续当前请求，不建立后台任务。
    let checking = false;
    const poll = setInterval(() => {
      if (checking) return; checking = true;
      void assistantRepository.running(turn.id).then(active => { if (!active) controller.abort(); }).catch(() => controller.abort()).finally(() => { checking = false; });
    }, 2000);
    const accounting = { calls: 0, completed: 0, input: 0, output: 0, known: true };
    const traces: ToolTrace[] = [];
    const emitTracked = (event: AssistantEvent) => {
      if (event.type === "trace") { const i = traces.findIndex(t => t.id === event.trace.id); if (i < 0) traces.push(event.trace); else traces[i] = event.trace; }
      emit(event);
    };
    try {
      emit({ type: "start", turnId: turn.id });
      const result = await runInvestigation({ actor, sessionId: session.id, turnId: turn.id, runId: session.runId, baselineRunId: session.baselineRunId,
        question: turn.question, sampleId, createdAt: turn.createdAt, signal, emit: emitTracked, accounting });
      const saved = await assistantRepository.finish(turn.id, { status: "SUCCEEDED", answer: result.answer, messages: jsonValue(result.messages), evidence: jsonValue(result.evidence), traces: jsonValue(result.traces), modelCalls: accounting.calls,
        inputTokens: accounting.known ? accounting.input : null, outputTokens: accounting.known ? accounting.output : null }, result.charge);
      emit({ type: "done", turn: saved });
    } catch (error) {
      // 只记录错误类别和状态码，不记录请求、聊天或 SDK 对象中的密钥。
      console.warn("assistant_run_failed", { turnId: turn.id, name: error instanceof Error ? error.name : "Unknown", code: error instanceof AppError ? error.code : undefined,
        status: error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : undefined });
      const timedOut = Date.now() >= turn.deadlineAt.getTime();
      const failure = error instanceof AppError ? error : new AppError(timedOut ? "TIMEOUT" : signal.aborted ? "CANCELLED" : "MODEL_ERROR",
        timedOut ? "本轮分析超时，请缩小问题范围后重试" : signal.aborted ? "本轮已停止" : "模型服务暂时不可用，请检查网络、账户额度或稍后重试", 502);
      const charge = accounting.known && accounting.calls === accounting.completed ? usageMicros(accounting.input, accounting.output) : null;
      const saved = await assistantRepository.finish(turn.id, { status: timedOut ? "TIMED_OUT" : signal.aborted ? "CANCELLED" : "FAILED", errorCode: failure.code, errorMessage: failure.message,
        traces: jsonValue(traces), evidence: jsonValue([] as Evidence[]), modelCalls: accounting.calls,
        inputTokens: accounting.known && accounting.completed === accounting.calls ? accounting.input : null, outputTokens: accounting.known && accounting.completed === accounting.calls ? accounting.output : null }, charge);
      emit({ type: "done", turn: saved });
    } finally {
      clearTimeout(timeout); clearInterval(poll); connectionSignal.removeEventListener("abort", disconnect); controllers.delete(turn.id);
    }
  },
};
