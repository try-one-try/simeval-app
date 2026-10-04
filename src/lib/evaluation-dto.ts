// 浏览器可用的数据契约；不包含 Prisma 对象、密钥或密码摘要。
import type { RunStatus } from "@/domain/evaluation";
// 任务选择页的首屏和翻页共用数量；接口默认分页仍由领域查询规则定义。
export const TASK_SELECTION_PAGE_SIZE = 6;
export type RunData = {
  id: string; name: string; projectId: string; status: RunStatus; modelVersionId: string;
  datasetVersionId: string; benchmarkId: string; baselineRunId: string | null; retryOfRunId: string | null;
  episodeCount: number; simulationSeed: number; provider: string; createdAt: string;
  startedAt: string | null; finishedAt: string | null; errorCode: string | null; errorMessage: string | null;
  anomalyCount: number; modelName: string; modelVersion: string; datasetName: string; datasetVersion: string;
  benchmarkName: string; benchmarkVersion: string; createdById: string; isDemoFixture: boolean;
  targetSuccessRate: number | null; pendingReviewCount: number; successRule: string;
  metrics: { key: string; name: string; unit: string; scenarioKey: string; value: number; sampleCount: number }[];
};
// 任务选择只需这些展示信息；进入详情后再读取指标、配置和异常证据。
export type RunSummaryData = Pick<RunData,
  "id" | "name" | "projectId" | "status" | "baselineRunId" | "createdAt" |
  "modelName" | "modelVersion" | "datasetName" | "datasetVersion" |
  "createdById" | "isDemoFixture" | "pendingReviewCount"
>;
export type QualityData = {
  dataset: { id: string; name: string; version: string; sampleCount: number; qualityStatus: "PASSED" | "WARNING" | "FAILED" };
  checks: { key: string; name: string; status: "PASSED" | "WARNING" | "FAILED"; affectedCount: number; message: string }[];
  canStartEvaluation: boolean;
};
export type EvaluationOptions = {
  project: { id: string; name: string } | null;
  models: { id: string; name: string; version: string }[];
  datasets: QualityData[];
  benchmarks: { id: string; name: string; version: string; successRule: string; datasetIds: string[]; modelIds: string[]; minEpisodes: number; maxEpisodes: number }[];
  baselines: RunData[];
  recent: RunData[];
  activeTaskLimit: number;
};
