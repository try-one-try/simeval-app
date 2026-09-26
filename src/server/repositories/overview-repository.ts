// 概览仓储只读取固定演示项目及其最新数据集、质检和预置评测。
import "server-only";
import { getDb } from "@/server/db";

export const overviewRepository = {
  getDemoProject() {
    return getDb().project.findUnique({
      where: { slug: "warehouse-manipulation" },
      select: {
        id: true,
        name: true,
        description: true,
        datasets: {
          orderBy: { version: "desc" },
          take: 1,
          select: {
            id: true,
            name: true,
            version: true,
            sampleCount: true,
            qualityStatus: true,
            checks: {
              orderBy: { checkKey: "asc" },
              select: { id: true, name: true, status: true, affectedCount: true, message: true },
            },
          },
        },
        runs: {
          where: { isDemoFixture: true },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            status: true,
            baselineRunId: true,
            episodeCount: true,
            datasetVersionId: true,
            benchmarkId: true,
            simulationSeed: true,
            createdAt: true,
            modelVersion: { select: { name: true, version: true } },
            metricResults: { select: { value: true, sampleCount: true, scenarioKey: true, metricDefinition: { select: { key: true } } } },
            anomalies: { select: { status: true, reviewCategory: true, backfills: { select: { status: true } } } },
            reports: { where: { status: "CONFIRMED" }, orderBy: { confirmedAt: "desc" }, take: 1, select: { confirmedBy: { select: { name: true } } } },
          },
        },
      },
    });
  },
};
