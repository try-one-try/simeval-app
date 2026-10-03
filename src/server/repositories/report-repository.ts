// 系统报告与聊天独立：每任务一份，来源变化更新原记录，更新和确认均锁任务并留审计。
import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/server/db";
import { AppError, assertRole, type Actor } from "@/domain/evaluation";
import { reportOutputSchema, type ReportView } from "@/domain/assistant";
import { jsonValue, sourceSnapshot, snapshotHash } from "./evaluation-snapshot";
import { includeRun } from "./evaluation-repository";
import type { AIReport, Prisma } from "@/generated/prisma/client";

const provider = "system-evidence-v1";
function view(report: AIReport): ReportView {
  const result = reportOutputSchema.safeParse(report.output);
  if (!result.success) throw new AppError("LEGACY_REPORT", "报告格式已过期，请更新当前报告", 409);
  return { id: report.id, runId: report.runId, status: report.status, isStale: report.isStale,
    createdAt: report.createdAt.toISOString(), updatedAt: report.updatedAt.toISOString(),
    sourceHash: snapshotHash(report.inputSnapshot) || "", confirmedAt: report.confirmedAt?.toISOString() || null,
    output: result.data, model: null };
}
async function lockRun(tx: Prisma.TransactionClient, id: string) {
  // 人工复核和任务删除也锁这行；两个人同时点击不会生成两份，也不会确认更新中的内容。
  await tx.$queryRaw`SELECT id FROM "EvaluationRun" WHERE id = ${id} FOR UPDATE`;
  const run = await tx.evaluationRun.findFirst({ where: { id, deletedAt: null, status: "SUCCEEDED" }, include: includeRun });
  if (!run) throw new AppError("STATE_CONFLICT", "任务已隐藏或评测尚未完成，报告不可用", 409);
  return run;
}
export const reportRepository = {
  async list(actor: Actor, runId: string) {
    assertRole(actor, ["ENGINEER", "REVIEWER"]);
    const run = await getDb().evaluationRun.findFirst({ where: { id: runId, deletedAt: null, status: "SUCCEEDED" }, select: { id: true } });
    if (!run) throw new AppError("NOT_FOUND", "评测结果不存在", 404);
    const report = await getDb().aIReport.findUnique({ where: { currentForRunId: runId } });
    if (!report) return [];
    const current = await sourceSnapshot(getDb(), runId, null);
    return [view({ ...report, isStale: report.isStale || current.hash !== snapshotHash(report.inputSnapshot) })];
  },
  async get(actor: Actor, id: string) {
    assertRole(actor, ["ENGINEER", "REVIEWER"]);
    const report = await getDb().aIReport.findFirst({ where: { id, currentForRunId: { not: null }, provider, run: { deletedAt: null, status: "SUCCEEDED" } } });
    if (!report) throw new AppError("NOT_FOUND", "当前报告不存在", 404);
    const current = await sourceSnapshot(getDb(), report.runId, null);
    return view({ ...report, isStale: report.isStale || current.hash !== snapshotHash(report.inputSnapshot) });
  },
  async create(actor: Actor, runId: string) {
    assertRole(actor, ["ENGINEER", "REVIEWER"]);
    return getDb().$transaction(async tx => {
      const run = await lockRun(tx, runId);
      const current = await sourceSnapshot(tx, run.id, null);
      const previous = await tx.aIReport.findUnique({ where: { currentForRunId: run.id } });
      // 数据未变时保留正文、ID 和人工确认，不把重复点击变成新报告。
      if (previous && !previous.isStale && current.hash === snapshotHash(previous.inputSnapshot)) return view(previous);
      const samples = await tx.anomalySample.findMany({ where: { runId: run.id }, orderBy: [{ sampleNumber: "asc" }, { id: "asc" }], take: 50 });
      const pending = await tx.anomalySample.count({ where: { runId: run.id, OR: [{ status: { not: "RESOLVED" } }, { draftConclusion: { not: null } }] } });
      const output = reportOutputSchema.parse({ version: 1, title: `${run.name || "评测任务"} · 评测报告`,
        summary: `${run.modelVersion.name} ${run.modelVersion.version} 在 ${run.datasetVersion.name} ${run.datasetVersion.version} 上完成 ${run.episodeCount} 个模拟 Episode。系统依据当前指标和已确认的人工结论整理本报告，仍有 ${pending} 条样本待复核（最多展示 50 条样本）。`,
        metrics: run.metricResults.map(m => ({ name: m.metricDefinition.name, scenario: m.scenarioKey === "__overall__" ? "整体" : m.scenarioKey, value: Number(m.value), unit: m.metricDefinition.unit })),
        findings: samples.map(s => ({ sampleId: s.id, label: `${s.sampleNumber} · ${s.scenarioKey}`, conclusion: s.conclusion || "尚无人工确认结论", confirmed: !!s.conclusion && !!s.confirmedAt })),
        limitations: ["业务数据为合成演示，任务由模拟 Provider 执行，不代表真实模型表现。", "报告由系统模板整理，仅包含当前任务的指标和人工复核结论；AI 聊天不写入报告。", "确认前仍需人工核对指标、异常证据与尚未完成的复核，不据此直接决定模型发布。"] });
      const data = { baselineRunId: null, status: "READY" as const, isStale: false, staleAt: null, provider, model: null,
        inputSnapshot: jsonValue(current), output: jsonValue(output), requestedById: actor.id,
        confirmedById: null, confirmedAt: null, errorMessage: null, idempotencyKey: null };
      const report = previous ? await tx.aIReport.update({ where: { id: previous.id }, data })
        : await tx.aIReport.create({ data: { ...data, runId: run.id, currentForRunId: run.id } });
      await tx.auditLog.create({ data: { actorId: actor.id, requestId: actor.requestId || randomUUID(), action: previous ? "REPORT_UPDATED" : "REPORT_CREATED", entityType: "AIReport", entityId: report.id,
        metadata: jsonValue({ mode: "system-template", sourceHash: current.hash, previous: previous ? { output: previous.output, inputSnapshot: previous.inputSnapshot, status: previous.status, confirmedById: previous.confirmedById, confirmedAt: previous.confirmedAt } : null }) } });
      return view(report);
    }, { timeout: 15000, maxWait: 10000 });
  },
  async confirm(actor: Actor, id: string, expectedSourceHash: string) {
    assertRole(actor, ["REVIEWER"]);
    return getDb().$transaction(async tx => {
      const initial = await tx.aIReport.findFirst({ where: { id, currentForRunId: { not: null }, provider } });
      if (!initial) throw new AppError("NOT_FOUND", "当前报告不存在", 404);
      await lockRun(tx, initial.runId);
      const report = await tx.aIReport.findUniqueOrThrow({ where: { id } });
      const current = await sourceSnapshot(tx, report.runId, null);
      // 必须确认本人看到的那份内容，防止另一位访客更新后直接被旧页面确认。
      if (expectedSourceHash !== snapshotHash(report.inputSnapshot)) throw new AppError("VERSION_CONFLICT", "报告已被更新，请重新读取并核对后确认", 409);
      if (report.isStale || current.hash !== expectedSourceHash) throw new AppError("SOURCE_CHANGED", "来源已更新，请更新报告后重新确认", 409);
      if (report.status === "CONFIRMED") return view(report);
      if (report.status !== "READY") throw new AppError("STATE_CONFLICT", "报告当前不能确认", 409);
      const saved = await tx.aIReport.update({ where: { id }, data: { status: "CONFIRMED", confirmedById: actor.id, confirmedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: actor.id, requestId: actor.requestId || randomUUID(), action: "REPORT_CONFIRMED", entityType: "AIReport", entityId: id, metadata: { sourceHash: expectedSourceHash } } });
      return view(saved);
    }, { timeout: 15000, maxWait: 10000 });
  },
};
