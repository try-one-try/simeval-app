// 概览用例：先验证访问者，再把仓储记录整理为页面可用的数据结构。
import "server-only";
import { requireViewer } from "@/server/auth/require-viewer";
import { overviewRepository } from "@/server/repositories/overview-repository";

export async function getOverview() {
  await requireViewer();
  const record = await overviewRepository.getDemoProject();
  if (!record) return null;

  const dataset = record.datasets[0] ?? null;
  const candidate = record.runs.find((run) => run.baselineRunId);
  const baseline = record.runs.find((run) => run.id === candidate?.baselineRunId);
  // 只在同口径的已完成任务中生成判断，缺结果不使用固定演示文案兜底。
  const comparable = candidate && baseline && candidate.status === "SUCCEEDED" && baseline.status === "SUCCEEDED"
    && candidate.datasetVersionId === baseline.datasetVersionId && candidate.benchmarkId === baseline.benchmarkId
    && candidate.episodeCount === baseline.episodeCount && candidate.simulationSeed === baseline.simulationSeed;
  const metric = (run: typeof candidate, key: string, scenario: string) => run?.metricResults.find((result) => result.metricDefinition.key === key && result.scenarioKey === scenario);
  const candidateSuccess = metric(candidate, "success_rate", "__overall__");
  const baselineSuccess = metric(baseline, "success_rate", "__overall__");
  const candidateCollision = metric(candidate, "collision_rate", "occlusion");
  const baselineCollision = metric(baseline, "collision_rate", "occlusion");
  const complete = comparable && candidateSuccess && baselineSuccess && candidateCollision && baselineCollision
    && candidateSuccess.sampleCount === baselineSuccess.sampleCount && candidateCollision.sampleCount === baselineCollision.sampleCount;
  const conclusion = complete
    ? Number(candidateSuccess.value) > Number(baselineSuccess.value) && Number(candidateCollision.value) > Number(baselineCollision.value)
      ? "总体表现提升，遮挡场景仍需处理。" : "评测结果已准备，需结合指标与异常证据判断。"
    : "评测证据尚不完整，暂不作版本判断。";
  const samples = candidate?.anomalies ?? [];
  return {
    project: { id: record.id, name: record.name, description: record.description },
    dataset: dataset && {
      id: dataset.id,
      name: dataset.name,
      version: dataset.version,
      sampleCount: dataset.sampleCount,
      qualityStatus: dataset.qualityStatus,
      checks: dataset.checks,
    },
    runs: record.runs.map((run) => ({
      id: run.id,
      status: run.status,
      modelName: run.modelVersion.name,
      modelVersion: run.modelVersion.version,
      createdAt: run.createdAt.toISOString(),
    })),
    summary: {
      conclusion,
      versions: baseline && candidate ? `${baseline.modelVersion.name} ${baseline.modelVersion.version} → ${candidate.modelVersion.version}` : null,
      episodeCount: candidate?.episodeCount ?? null,
      completedRuns: record.runs.filter((run) => run.status === "SUCCEEDED").length,
      warnings: dataset?.checks.filter((check) => check.status === "WARNING") ?? [],
      sampleCount: samples.length,
      resolvedCount: samples.filter((sample) => sample.status === "RESOLVED").length,
      dataIssues: samples.filter((sample) => sample.reviewCategory === "DATA_ISSUE").length,
      modelIssues: samples.filter((sample) => sample.reviewCategory === "MODEL_ISSUE").length,
      pendingBackfills: samples.flatMap((sample) => sample.backfills).filter((task) => task.status !== "COMPLETED").length,
      confirmedBy: candidate?.reports[0]?.confirmedBy?.name ?? null,
    },
  };
}

export type OverviewData = NonNullable<Awaited<ReturnType<typeof getOverview>>>;
