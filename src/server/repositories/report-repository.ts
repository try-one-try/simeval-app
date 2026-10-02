// 报告是明确分享的业务产物。用系统指标组织内容，私聊和比较文本不自动流入共享报告。
import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/server/db";
import { AppError, assertRole, type Actor } from "@/domain/evaluation";
import { reportOutputSchema, type AssistantActor, type ReportView } from "@/domain/assistant";
import { jsonValue, ownedSession, sourceSnapshot, snapshotHash } from "./assistant-repository";
import { includeRun } from "./evaluation-repository";
import type { AIReport, Prisma } from "@/generated/prisma/client";

function view(report: AIReport): ReportView {
  const result = reportOutputSchema.safeParse(report.output);
  if (!result.success) throw new AppError("LEGACY_REPORT", "这是早期示例报告，请从助手重新生成当前格式的报告", 409);
  return { id: report.id, runId: report.runId, status: report.status, isStale: report.isStale, createdAt: report.createdAt.toISOString(), confirmedAt: report.confirmedAt?.toISOString() || null, output: result.data, model: report.model };
}
async function lockRuns(tx: Prisma.TransactionClient, ids: string[]) {
  // 和人工复核／任务删除取得相同行锁；按 ID 排序避免反向锁顺序。
  for (const id of [...new Set(ids)].sort()) await tx.$queryRaw`SELECT id FROM "EvaluationRun" WHERE id = ${id} FOR UPDATE`;
}
export const reportRepository = {
  async list(actor: Actor, runId: string) {
    assertRole(actor, ["ENGINEER", "REVIEWER"]);
    const run = await getDb().evaluationRun.findFirst({ where: { id: runId, deletedAt: null, status: "SUCCEEDED" } });
    if (!run) throw new AppError("NOT_FOUND", "评测结果不存在", 404);
    const reports = await getDb().aIReport.findMany({ where: { runId, provider: "agent-evidence-v1" }, orderBy: { createdAt: "desc" }, take: 30 });
    const current = await sourceSnapshot(getDb(), runId, null);
    return reports.map(report => view({ ...report, isStale: report.isStale || current.hash !== snapshotHash(report.inputSnapshot) }));
  },
  async get(actor: Actor, id: string) {
    assertRole(actor, ["ENGINEER", "REVIEWER"]);
    const report = await getDb().aIReport.findFirst({ where: { id, provider: "agent-evidence-v1", run: { deletedAt: null } } });
    if (!report) throw new AppError("NOT_FOUND", "报告不存在", 404);
    const current = await sourceSnapshot(getDb(), report.runId, null);
    return view({ ...report, isStale: report.isStale || current.hash !== snapshotHash(report.inputSnapshot) });
  },
  async create(actor: AssistantActor, sessionId: string, turnId: string) {
    const session = await ownedSession(actor, sessionId);
    return getDb().$transaction(async tx => {
      await lockRuns(tx, [session.runId, ...(session.baselineRunId ? [session.baselineRunId] : [])]);
      await ownedSession(actor, sessionId, tx);
      const turn = await tx.assistantTurn.findFirst({ where: { id: turnId, sessionId, status: "SUCCEEDED" } });
      if (!turn || !Array.isArray(turn.evidence) || !turn.evidence.length) throw new AppError("INVALID_ANALYSIS", "请先完成有证据引用的分析，再保存报告", 409);
      const old = await tx.aIReport.findUnique({ where: { requestedById_idempotencyKey: { requestedById: actor.id, idempotencyKey: `assistant:${turn.id}` } } });
      if (old) return view(old);
      const current = await sourceSnapshot(tx, session.runId, session.baselineRunId);
      if (current.hash !== snapshotHash(turn.sourceSnapshot)) throw new AppError("SOURCE_CHANGED", "来源已更新，请先重新分析再保存报告", 409);
      const run = await tx.evaluationRun.findUniqueOrThrow({ where: { id: session.runId }, include: includeRun });
      const samples = await tx.anomalySample.findMany({ where: { runId: run.id }, orderBy: { sampleNumber: "asc" }, take: 50 });
      const pending = await tx.anomalySample.count({ where: { runId: run.id, OR: [{ status: { not: "RESOLVED" } }, { draftConclusion: { not: null } }] } });
      const output = reportOutputSchema.parse({ version: 1, title: `${run.name || "评测任务"} · 证据报告`,
        summary: `${run.modelVersion.name} ${run.modelVersion.version} 在 ${run.datasetVersion.name} ${run.datasetVersion.version} 上完成 ${run.episodeCount} 个模拟 Episode。本报告依据当前指标和样本复核整理，仍有 ${pending} 条样本待复核（本报告最多列出 50 条）。`,
        metrics: run.metricResults.map(m => ({ name: m.metricDefinition.name, scenario: m.scenarioKey === "__overall__" ? "整体" : m.scenarioKey, value: Number(m.value), unit: m.metricDefinition.unit })),
        findings: samples.map(s => ({ sampleId: s.id, label: `${s.sampleNumber} · ${s.scenarioKey}`, conclusion: s.conclusion || "尚无人工确认结论", confirmed: !!s.conclusion && !!s.confirmedAt })),
        limitations: ["业务数据为合成演示，任务由模拟 Provider 执行，不代表真实模型表现。", "此报告聚焦当前任务，未复制私人聊天或比较结论；不据此直接决定模型发布。", "确认前仍需人工核对指标、异常证据与未完成的复核。"], sourceTurnId: turn.id });
      const report = await tx.aIReport.create({ data: { runId: run.id, baselineRunId: null, status: "READY", requestedById: actor.id, provider: "agent-evidence-v1", model: turn.model,
        idempotencyKey: `assistant:${turn.id}`, inputSnapshot: jsonValue(await sourceSnapshot(tx, run.id, null)), output: jsonValue(output) } });
      await tx.auditLog.create({ data: { actorId: actor.id, requestId: actor.requestId || randomUUID(), action: "AI_REPORT_CREATED", entityType: "AIReport", entityId: report.id, metadata: { sourceTurnId: turn.id, mode: "evidence-template" } } });
      return view(report);
    }, { timeout: 15000, maxWait: 10000 });
  },
  async confirm(actor: AssistantActor, id: string) {
    assertRole(actor, ["REVIEWER"]);
    return getDb().$transaction(async tx => {
      const initial = await tx.aIReport.findFirst({ where: { id, provider: "agent-evidence-v1" } });
      if (!initial) throw new AppError("NOT_FOUND", "报告不存在", 404);
      await lockRuns(tx, [initial.runId]);
      const report = await tx.aIReport.findUniqueOrThrow({ where: { id } });
      const run = await tx.evaluationRun.findUnique({ where: { id: report.runId } });
      if (!run || run.deletedAt || run.status !== "SUCCEEDED") throw new AppError("STATE_CONFLICT", "评测结果已不可用", 409);
      const current = await sourceSnapshot(tx, report.runId, null);
      if (report.isStale || current.hash !== snapshotHash(report.inputSnapshot)) throw new AppError("SOURCE_CHANGED", "来源已更新，请重新分析并生成报告", 409);
      if (report.status === "CONFIRMED") return view(report);
      if (report.status !== "READY") throw new AppError("STATE_CONFLICT", "报告当前不能确认", 409);
      const saved = await tx.aIReport.update({ where: { id }, data: { status: "CONFIRMED", confirmedById: actor.id, confirmedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: actor.id, requestId: actor.requestId || randomUUID(), action: "AI_REPORT_CONFIRMED", entityType: "AIReport", entityId: id } });
      return view(saved);
    }, { timeout: 15000, maxWait: 10000 });
  },
};
