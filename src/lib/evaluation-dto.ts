// 浏览器可用的数据契约；不包含 Prisma 对象、密钥或密码摘要。
import type { RunStatus } from "@/domain/evaluation";
export type RunData = {
  id: string; name: string; projectId: string; status: RunStatus; modelVersionId: string;
  datasetVersionId: string; benchmarkId: string; baselineRunId: string | null; retryOfRunId: string | null;
  episodeCount: number; simulationSeed: number; provider: string; createdAt: string;
  startedAt: string | null; finishedAt: string | null; errorCode: string | null; errorMessage: string | null;
  anomalyCount: number; modelName: string; modelVersion: string; datasetName: string; datasetVersion: string;
  benchmarkName: string; benchmarkVersion: string; createdById: string; isDemoFixture: boolean;
};
export type QualityData = {
  dataset: { id: string; name: string; version: string; sampleCount: number; qualityStatus: "PASSED" | "WARNING" | "FAILED" };
  checks: { key: string; name: string; status: "PASSED" | "WARNING" | "FAILED"; affectedCount: number; message: string }[];
  canStartEvaluation: boolean;
};
export type EvaluationOptions = {
  project: { id: string; name: string } | null;
  models: { id: string; name: string; version: string }[];
  datasets: QualityData[];
  benchmarks: { id: string; name: string; version: string }[];
  baselines: RunData[];
  recent: RunData[];
};