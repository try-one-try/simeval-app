// 概览用例：先验证访问者，再把仓储记录整理为页面可用的数据结构。
import "server-only";
import { requireViewer } from "@/server/auth/require-viewer";
import { overviewRepository } from "@/server/repositories/overview-repository";

export async function getOverview() {
  await requireViewer();
  const record = await overviewRepository.getDemoProject();
  if (!record) return null;

  const dataset = record.datasets[0] ?? null;
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
  };
}
