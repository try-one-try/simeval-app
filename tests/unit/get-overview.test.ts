// 概览用例测试：验证服务端身份门禁、空数据与查询失败不会被伪装成统计值。
import { beforeEach, describe, expect, it, vi } from "vitest";

const stubs = vi.hoisted(() => ({
  requireViewer: vi.fn(),
  getDemoProject: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/require-viewer", () => ({ requireViewer: stubs.requireViewer }));
vi.mock("@/server/repositories/overview-repository", () => ({
  overviewRepository: { getDemoProject: stubs.getDemoProject },
}));

import { getOverview } from "@/server/application/get-overview";

describe("getOverview", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    stubs.requireViewer.mockResolvedValue({ id: "viewer", role: "ENGINEER" });
  });

  it("先检查会话，再读取并整理持久化记录", async () => {
    stubs.getDemoProject.mockResolvedValue({
      id: "project-1",
      name: "仓储评测",
      description: "合成项目",
      datasets: [{
        id: "dataset-1", name: "场景集", version: "v3", sampleCount: 2400,
        qualityStatus: "WARNING", checks: [{ id: "check-1", name: "遮挡检查", status: "WARNING", affectedCount: 18, message: "待复核" }],
      }],
      runs: [{ id: "run-1", status: "SUCCEEDED", createdAt: new Date("2026-09-01T08:00:00.000Z"), modelVersion: { name: "PickPlace", version: "v2.4" } }],
    });

    const result = await getOverview();

    expect(stubs.requireViewer).toHaveBeenCalledOnce();
    expect(stubs.getDemoProject).toHaveBeenCalledOnce();
    expect(stubs.requireViewer.mock.invocationCallOrder[0]).toBeLessThan(stubs.getDemoProject.mock.invocationCallOrder[0]);
    expect(result).toMatchObject({
      project: { id: "project-1", name: "仓储评测" },
      dataset: { qualityStatus: "WARNING", sampleCount: 2400 },
      runs: [{ id: "run-1", modelVersion: "v2.4", createdAt: "2026-09-01T08:00:00.000Z" }],
    });
  });

  it("没有演示项目时返回空状态", async () => {
    stubs.getDemoProject.mockResolvedValue(null);
    await expect(getOverview()).resolves.toBeNull();
  });

  const fixture = () => ({
    id: "project", name: "仓储操作评测", description: "合成演示", datasets: [],
    runs: [
      { id: "baseline", baselineRunId: null, status: "SUCCEEDED", episodeCount: 200, simulationSeed: 1, datasetVersionId: "dataset", benchmarkId: "benchmark", createdAt: new Date(), modelVersion: { name: "PickPlace", version: "v2.3" }, metricResults: [
        { value: "76", sampleCount: 200, scenarioKey: "__overall__", metricDefinition: { key: "success_rate" } },
        { value: "8", sampleCount: 50, scenarioKey: "occlusion", metricDefinition: { key: "collision_rate" } },
      ], anomalies: [], reports: [] },
      { id: "candidate", baselineRunId: "baseline", status: "SUCCEEDED", episodeCount: 200, simulationSeed: 1, datasetVersionId: "dataset", benchmarkId: "benchmark", createdAt: new Date(), modelVersion: { name: "PickPlace", version: "v2.4" }, metricResults: [
        { value: "81", sampleCount: 200, scenarioKey: "__overall__", metricDefinition: { key: "success_rate" } },
        { value: "13", sampleCount: 50, scenarioKey: "occlusion", metricDefinition: { key: "collision_rate" } },
      ], anomalies: [{ status: "RESOLVED", reviewCategory: "DATA_ISSUE", backfills: [{ status: "OPEN" }] }], reports: [{ confirmedBy: { name: "陈复核" } }] },
    ],
  });

  it("同口径结果生成判断，复核与回补分别计数", async () => {
    stubs.getDemoProject.mockResolvedValue(fixture());
    const result = await getOverview();
    expect(result?.summary).toMatchObject({ conclusion: "总体表现提升，遮挡场景仍需处理。", completedRuns: 2, resolvedCount: 1, dataIssues: 1, pendingBackfills: 1, confirmedBy: "陈复核" });
  });

  it.each(["missing_metric", "different_dataset", "different_samples", "unfinished"])("%s 时不输出固定判断", async (reason) => {
    const data = fixture();
    if (reason === "missing_metric") data.runs[1].metricResults.pop();
    if (reason === "different_dataset") data.runs[1].datasetVersionId = "other";
    if (reason === "different_samples") data.runs[1].metricResults[1].sampleCount = 49;
    if (reason === "unfinished") data.runs[1].status = "RUNNING";
    stubs.getDemoProject.mockResolvedValue(data);
    expect((await getOverview())?.summary.conclusion).toContain("暂不作版本判断");
  });

  it("查询失败时传播错误，不能返回零值", async () => {
    stubs.getDemoProject.mockRejectedValue(new Error("database unavailable"));
    await expect(getOverview()).rejects.toThrow("database unavailable");
  });

  it("身份检查失败时不读取项目", async () => {
    stubs.requireViewer.mockRejectedValue(new Error("unauthorized"));
    await expect(getOverview()).rejects.toThrow("unauthorized");
    expect(stubs.getDemoProject).not.toHaveBeenCalled();
  });
});
