// 使用单个 HTTP 流传输增量文本与实际工具事件，不引入 WebSocket 或任务队列。
import { assistantActor, assistantFailure } from "@/server/http/assistant-api";
import { assertOrigin, jsonBody, parse } from "@/server/http/api";
import { AppError, idSchema } from "@/domain/evaluation";
import { sendMessageSchema, type AssistantEvent } from "@/domain/assistant";
import { assistantService } from "@/server/application/assistant";
import { turnView } from "@/server/repositories/assistant-repository";
export const runtime = "nodejs";
export const maxDuration = 90;
export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const actor = await assistantActor(); assertOrigin(request);
    if (Number(request.headers.get("content-length") || 0) > 16000) throw new AppError("VALIDATION_ERROR", "问题内容过长", 413);
    const input = parse(sendMessageSchema, await jsonBody(request));
    const id = parse(idSchema, (await context.params).sessionId);
    const started = await assistantService.begin(actor, id, input.question, input.requestKey, input.sampleId);
    const encoder = new TextEncoder(), controller = new AbortController();
    const signal = AbortSignal.any([request.signal, controller.signal]);
    const stream = new ReadableStream<Uint8Array>({
      async start(output) {
        let closed = false;
        const emit = (event: AssistantEvent) => { if (!closed) { try { output.enqueue(encoder.encode(JSON.stringify(event) + "\n")); } catch { closed = true; controller.abort(); } } };
        try {
          if (started.replay) emit({ type: "done", turn: turnView(started.turn) });
          else await assistantService.execute(actor, started, input.sampleId, emit, signal);
        } catch { emit({ type: "error", code: "SAVE_FAILED", message: "本轮保存暂时失败，请刷新历史确认状态；重新发送会开始新一轮" }); }
        finally { if (!closed) { try { output.close(); } catch { /* 浏览器已关闭连接。 */ } } }
      }, cancel() { controller.abort(); },
    });
    return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
  } catch (error) { return assistantFailure(error); }
}
