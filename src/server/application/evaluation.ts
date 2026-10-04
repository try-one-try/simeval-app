// 应用层把仓储实体整理为公开 DTO；读操作不推进任务状态。
import "server-only";
import { evaluationRepository, type StoredRun, type StoredRunSummary } from "@/server/repositories/evaluation-repository";
import { AppError, assertRole, isActive, type Actor, type CreateRunInput } from "@/domain/evaluation";
import type { RunData, RunSummaryData, QualityData, EvaluationOptions } from "@/lib/evaluation-dto";
import { ACTIVE_TASK_LIMIT, benchmarks, models, metricCatalog, snapshotSchema } from "@/domain/evaluation-catalog";
const readers = ["ENGINEER", "REVIEWER", "ADMIN"] as const;
// 列表有独立的返回类型，避免用空指标冒充完整任务详情。
function runSummaryDto(run: StoredRunSummary): RunSummaryData {
  return {
    id: run.id, name: run.name ?? `${run.modelVersion.name} ${run.modelVersion.version} Evaluation`,
    projectId: run.projectId, status: run.status, baselineRunId: run.baselineRunId,
    createdAt: run.createdAt.toISOString(), createdById: run.createdById, isDemoFixture: run.isDemoFixture,
    modelName: run.modelVersion.name, modelVersion: run.modelVersion.version,
    datasetName: run.datasetVersion.name, datasetVersion: run.datasetVersion.version,
    // 这次查询的 anomalies 计数已在仓储里限定为待复核，不是全部异常数。
    pendingReviewCount: run._count.anomalies,
  };
}
export function runDto(run: StoredRun): RunData {
  return { id: run.id, name: run.name ?? `${run.modelVersion.name} ${run.modelVersion.version} Evaluation`,
    projectId: run.projectId, status: run.status, modelVersionId: run.modelVersionId, datasetVersionId: run.datasetVersionId,
    benchmarkId: run.benchmarkId, baselineRunId: run.baselineRunId, retryOfRunId: run.retryOfRunId,
    episodeCount: run.episodeCount, simulationSeed: run.simulationSeed, provider: run.provider,
    createdAt: run.createdAt.toISOString(), startedAt: run.startedAt?.toISOString() ?? null, finishedAt: run.finishedAt?.toISOString() ?? null,
    errorCode: run.errorCode, errorMessage: run.errorMessage, anomalyCount: run._count.anomalies,
    modelName: run.modelVersion.name, modelVersion: run.modelVersion.version, datasetName: run.datasetVersion.name,
    datasetVersion: run.datasetVersion.version, benchmarkName: run.benchmark.name, benchmarkVersion: run.benchmark.version,
    createdById: run.createdById, isDemoFixture: run.isDemoFixture,
    targetSuccessRate: run.targetSuccessRate === null ? null : Number(run.targetSuccessRate),
    pendingReviewCount: run.anomalies.filter(sample => sample.status !== "RESOLVED" || !!sample.draftConclusion).length,
    successRule: snapshotSchema.safeParse(run.configurationSnapshot).data?.successRule ?? benchmarks.find(b => b.id === run.benchmarkId)?.successRule ?? "历史评测口径",
    metrics: [...run.metricResults].sort((a,b) => metricCatalog.findIndex(m => m.key === a.metricDefinition.key) - metricCatalog.findIndex(m => m.key === b.metricDefinition.key)).map(metric => ({ key: metric.metricDefinition.key, name: metric.metricDefinition.name, unit: metric.metricDefinition.unit, scenarioKey: metric.scenarioKey, value: Number(metric.value), sampleCount: metric.sampleCount })) };
}
type DatasetRecord = NonNullable<Awaited<ReturnType<typeof evaluationRepository.quality>>>;
function qualityDto(dataset: DatasetRecord): QualityData {
  return { dataset: { id: dataset.id, name: dataset.name, version: dataset.version, sampleCount: dataset.sampleCount, qualityStatus: dataset.qualityStatus },
    checks: dataset.checks.map((check) => ({ key: check.checkKey, name: check.name, status: check.status, affectedCount: check.affectedCount, message: check.message })),
    canStartEvaluation: dataset.qualityStatus !== "FAILED" };
}
export function statusDto(run: RunData) {
  return { runId: run.id, status: run.status, progress: run.status === "SUCCEEDED" ? 1 : null,
    startedAt: run.startedAt, finishedAt: run.finishedAt, pollAfterMs: isActive(run.status) ? 1500 : 0 };
}
export const evaluationService = {
  async options(actor: Actor): Promise<EvaluationOptions> {
    assertRole(actor, readers);
    const { project, recent } = await evaluationRepository.options(actor);
    return { project: project && { id: project.id, name: project.name }, models: project?.models.filter(m => models.some(profile => profile.id === m.id && profile.selectable)).map(({ id, name, version }) => ({ id, name, version })) ?? [],
      datasets: project?.datasets.map(qualityDto) ?? [], benchmarks: benchmarks.filter(b => project?.benchmarks.some(record => record.id === b.id)).map(b => ({ id: b.id, name: b.name, version: b.version, successRule: b.successRule, datasetIds: b.datasetIds, modelIds: b.modelIds, minEpisodes: b.minEpisodes, maxEpisodes: b.maxEpisodes })),
      baselines: project?.runs.map(runDto) ?? [], recent: recent.map(runDto), activeTaskLimit: ACTIVE_TASK_LIMIT };
  },
  async quality(actor: Actor, id: string) {
    assertRole(actor, readers);
    const dataset = await evaluationRepository.quality(id);
    if (!dataset) throw new AppError("NOT_FOUND", "数据集不存在", 404);
    return qualityDto(dataset);
  },
  async get(actor: Actor, id: string) {
    assertRole(actor, readers);
    const run = await evaluationRepository.get(id);
    if (!run) throw new AppError("NOT_FOUND", "评测任务不存在", 404);
    return runDto(run);
  },
  async list(actor: Actor, input: Parameters<typeof evaluationRepository.list>[0]) {
    assertRole(actor, readers);
    const result = await evaluationRepository.list(input);
    return { data: result.runs.map(runSummaryDto), total: result.total };
  },
  async create(actor: Actor, input: CreateRunInput, key: string) {
    const result = await evaluationRepository.create(actor, input, key);
    return { data: runDto(result.run), replay: result.replay };
  },
  async retry(actor: Actor, id: string, key: string) {
    const result = await evaluationRepository.retry(actor, id, key);
    return { data: runDto(result.run), replay: result.replay };
  },
  async cancel(actor: Actor, id: string) { return runDto(await evaluationRepository.cancel(actor, id)); },
  async remove(actor: Actor, id: string) { return evaluationRepository.remove(actor, id); },
  async sync(actor: Actor, id: string) {
    assertRole(actor, readers);
    return statusDto(runDto(await evaluationRepository.sync(actor, id)));
  },
};
