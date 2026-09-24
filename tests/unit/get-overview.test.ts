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
