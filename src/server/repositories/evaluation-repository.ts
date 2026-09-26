// 所有评测写入集中在事务仓储：门禁、条件更新、唯一约束与审计共同保护持久化。
import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { getDb } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { AppError, assertRole, assertQuality, assertConfiguration, assertMutable, type Actor, type CreateRunInput } from "@/domain/evaluation";
import { evaluationProvider } from "@/server/providers/evaluation-provider";
type Tx = Prisma.TransactionClient;
const includeRun = { modelVersion: true, datasetVersion: true, benchmark: true, _count: { select: { anomalies: true } } } as const;
function hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function storageKey(operation: string, key: string) { return operation + ":" + hash(key); }
function codeOf(error: unknown) { return typeof error === "object" && error !== null && "code" in error ? String(error.code) : ""; }
async function transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await getDb().$transaction(work, { isolationLevel: "Serializable", timeout: 15000, maxWait: 10000 }); }
    catch (error) { if (attempt >= 3 || !["P2034", "P2002"].includes(codeOf(error))) throw error; }
  }
}
async function audit(tx: Tx, actor: Actor, id: string, action: string, metadata: Prisma.InputJsonValue = {}) {
  await tx.auditLog.create({ data: { actorId: actor.id, requestId: actor.requestId ?? randomUUID(), action, entityType: "EvaluationRun", entityId: id, metadata } });
}
async function checkedConfiguration(tx: Tx, input: CreateRunInput) {
  const [model, dataset, benchmark, baseline] = await Promise.all([
    tx.modelVersion.findUnique({ where: { id: input.modelVersionId } }),
    tx.datasetVersion.findUnique({ where: { id: input.datasetVersionId } }),
    tx.benchmark.findUnique({ where: { id: input.benchmarkId } }),
    tx.evaluationRun.findUnique({ where: { id: input.baselineRunId }, include: { metricResults: true } }),
  ]);
  if (!model || !dataset || !benchmark || !baseline) throw new AppError("NOT_FOUND", "评测配置记录不存在", 404);
  assertQuality(dataset.qualityStatus, input.acceptQualityWarning);
  assertConfiguration(input, [model.projectId, dataset.projectId, benchmark.projectId], baseline);
  if (!baseline.metricResults.length) throw new AppError("INCOMPATIBLE_CONFIGURATION", "基线缺少指标结果，不能创建本次模拟评测");
  return { model, dataset, baseline };
}
async function createInTransaction(tx: Tx, actor: Actor, input: CreateRunInput, key: string, operation: string, retryOfRunId: string | null) {
  const idempotencyKey = storageKey(operation, key);
  const requestFingerprint = hash({ input, retryOfRunId });
  const previous = await tx.evaluationRun.findUnique({ where: { createdById_idempotencyKey: { createdById: actor.id, idempotencyKey } }, include: includeRun });
  if (previous) {
    if (previous.requestFingerprint !== requestFingerprint) throw new AppError("IDEMPOTENCY_CONFLICT", "该幂等键已用于不同请求，请使用新的提交键", 409);
    return { run: previous, replay: true };
  }
  const { model } = await checkedConfiguration(tx, input);
  const run = await tx.evaluationRun.create({
    data: { name: input.name, projectId: model.projectId, modelVersionId: input.modelVersionId, datasetVersionId: input.datasetVersionId,
      benchmarkId: input.benchmarkId, baselineRunId: input.baselineRunId, retryOfRunId, status: "QUEUED", createdById: actor.id,
      provider: "MockEvaluationProvider", episodeCount: input.episodeCount, simulationSeed: input.simulationSeed,
      mockFailure: input.mockFailure, idempotencyKey, requestFingerprint },
    include: includeRun,
  });
  await audit(tx, actor, run.id, retryOfRunId ? "EVALUATION_RETRIED" : "EVALUATION_CREATED", { acceptQualityWarning: input.acceptQualityWarning, mockFailure: input.mockFailure, retryOfRunId });
  return { run, replay: false };
}
export const evaluationRepository = {
  async options(actor: Actor) {
    const project = await getDb().project.findUnique({
      where: { slug: "warehouse-manipulation" },
      include: { models: { orderBy: { version: "asc" } }, datasets: { include: { checks: { orderBy: { checkKey: "asc" } } } }, benchmarks: true,
        runs: { where: { isDemoFixture: true, status: "SUCCEEDED", baselineRunId: null }, orderBy: { createdAt: "asc" }, include: includeRun } },
    });
    const recent = await getDb().evaluationRun.findMany({ where: { createdById: actor.id, isDemoFixture: false }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 5, include: includeRun });
    return { project, recent };
  },
  quality(id: string) { return getDb().datasetVersion.findUnique({ where: { id }, include: { checks: { orderBy: { checkKey: "asc" } } } }); },
  get(id: string) { return getDb().evaluationRun.findUnique({ where: { id }, include: includeRun }); },
  async list(input: { page: number; pageSize: number; status?: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED"; projectId?: string }) {
    const where = { status: input.status, projectId: input.projectId };
    const [runs, total] = await getDb().$transaction([
      getDb().evaluationRun.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize, include: includeRun }),
      getDb().evaluationRun.count({ where }),
    ]);
    return { runs, total };
  },
  async create(actor: Actor, input: CreateRunInput, key: string) {
    assertRole(actor, ["ENGINEER", "ADMIN"]);
    return transaction((tx) => createInTransaction(tx, actor, input, key, "create", null));
  },
  retry(actor: Actor, id: string, key: string) {
    return transaction(async (tx) => {
      const original = await tx.evaluationRun.findUnique({ where: { id } });
      if (!original) throw new AppError("NOT_FOUND", "任务不存在", 404);
      assertMutable(actor, original, "retry");
      if (!original.baselineRunId) throw new AppError("INCOMPATIBLE_CONFIGURATION", "任务没有成功基线");
      const creationAudit = await tx.auditLog.findFirst({ where: { entityType: "EvaluationRun", entityId: id, action: { in: ["EVALUATION_CREATED", "EVALUATION_RETRIED"] } }, orderBy: { createdAt: "asc" } });
      const metadata = creationAudit?.metadata;
      const accepted = !!metadata && typeof metadata === "object" && !Array.isArray(metadata) && metadata.acceptQualityWarning === true;
      const input: CreateRunInput = { name: original.name ?? "模拟评测", modelVersionId: original.modelVersionId,
        datasetVersionId: original.datasetVersionId, benchmarkId: original.benchmarkId, baselineRunId: original.baselineRunId,
        episodeCount: original.episodeCount, simulationSeed: original.simulationSeed, acceptQualityWarning: accepted, mockFailure: false };
      // 沿用有审计证据的确认；原先未确认而质量变为 WARNING 时必须重新创建并确认。
      return createInTransaction(tx, actor, input, key, "retry", id);
    });
  },
  cancel(actor: Actor, id: string, now = new Date()) {
    return transaction(async (tx) => {
      const run = await tx.evaluationRun.findUnique({ where: { id } });
      if (!run) throw new AppError("NOT_FOUND", "任务不存在", 404);
      assertMutable(actor, run, "cancel");
      const updated = await tx.evaluationRun.updateMany({ where: { id, status: { in: ["QUEUED", "RUNNING"] } }, data: { status: "CANCELLED", finishedAt: now } });
      if (updated.count !== 1) throw new AppError("STATE_CONFLICT", "任务状态已变化，请刷新查看", 409);
      await audit(tx, actor, id, "EVALUATION_CANCELLED", { fromStatus: run.status });
      return tx.evaluationRun.findUniqueOrThrow({ where: { id }, include: includeRun });
    });
  },
  sync(actor: Actor, id: string, now = new Date()) {
    return transaction(async (tx) => {
      const run = await tx.evaluationRun.findUnique({ where: { id }, include: { baselineRun: { include: { metricResults: { include: { metricDefinition: true } } } } } });
      if (!run) throw new AppError("NOT_FOUND", "任务不存在", 404);
      if (run.isDemoFixture) return tx.evaluationRun.findUniqueOrThrow({ where: { id }, include: includeRun });
      const next = evaluationProvider.nextStatus(run, now);
      if (next === run.status) return tx.evaluationRun.findUniqueOrThrow({ where: { id }, include: includeRun });
      const error = next === "FAILED" ? { errorCode: "MOCK_EXECUTION_FAILED", errorMessage: "显式故障演示：模拟执行失败，可以创建新任务重试。" } : {};
      const changed = await tx.evaluationRun.updateMany({ where: { id, status: run.status }, data: { status: next,
        ...(next === "RUNNING" ? { startedAt: new Date(run.createdAt.getTime() + 2000) } : { finishedAt: now }),
        ...(next === "SUCCEEDED" ? { resultsGeneratedAt: now } : {}), ...error } });
      if (changed.count !== 1) return tx.evaluationRun.findUniqueOrThrow({ where: { id }, include: includeRun });
      if (next === "SUCCEEDED") {
        const baselineMetrics = run.baselineRun?.metricResults ?? [];
        if (!baselineMetrics.length) throw new AppError("EXTERNAL_SERVICE_ERROR", "基线结果不可用，稍后重试同步", 503);
        const results = evaluationProvider.results(baselineMetrics.map((metric) => ({ metricDefinitionId: metric.metricDefinitionId, key: metric.metricDefinition.key, scenarioKey: metric.scenarioKey, sampleCount: metric.sampleCount, value: Number(metric.value) })));
        await tx.metricResult.createMany({ data: results.map((result) => ({ metricDefinitionId: result.metricDefinitionId, scenarioKey: result.scenarioKey, value: result.value, sampleCount: result.sampleCount, runId: id })) });
        await tx.anomalySample.createMany({ data: [
          { runId: id, sampleNumber: "sample_017", scenarioKey: "occlusion", anomalyType: "collision_regression", metricKey: "collision_rate", status: "OPEN", logExcerpt: "occlusion_label_offset=true", metadata: { synthetic: true } },
          { runId: id, sampleNumber: "sample_018", scenarioKey: "occlusion", anomalyType: "collision_regression", metricKey: "collision_rate", status: "OPEN", logExcerpt: "collision_during_grasp=true", metadata: { synthetic: true } },
        ] });
      }
      await audit(tx, actor, id, "EVALUATION_" + next, { fromStatus: run.status, provider: run.provider });
      return tx.evaluationRun.findUniqueOrThrow({ where: { id }, include: includeRun });
    });
  },
};
export type StoredRun = NonNullable<Awaited<ReturnType<typeof evaluationRepository.get>>>;