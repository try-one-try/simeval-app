// 旧总览地址仅做兼容跳转；身份与任务存在性仍由服务端确认。
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/domain/evaluation";
const stubs = vi.hoisted(() => ({ viewer: vi.fn(), get: vi.fn(), redirect: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: stubs.redirect }));
vi.mock("@/server/auth/require-viewer", () => ({ requireViewer: stubs.viewer }));
vi.mock("@/server/application/evaluation", () => ({ evaluationService: { get: stubs.get } }));
import LegacyOverviewPage from "@/app/(workspace)/overview/page";

describe("旧总览地址兼容跳转", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    stubs.viewer.mockResolvedValue({ id: "viewer", role: "REVIEWER" });
    stubs.redirect.mockImplementation((href: string) => { throw new Error("redirect:" + href); });
  });

  it("先认证，再确认任务并打开评测结果", async () => {
    stubs.get.mockResolvedValue({ id: "run-1" });
    await expect(LegacyOverviewPage({ searchParams: Promise.resolve({ runId: "run-1" }) })).rejects.toThrow("redirect:/evaluations/run-1");
    expect(stubs.get).toHaveBeenCalledWith({ id: "viewer", role: "REVIEWER" }, "run-1");
    expect(stubs.viewer.mock.invocationCallOrder[0]).toBeLessThan(stubs.get.mock.invocationCallOrder[0]);
  });

  it.each([{ runId: undefined }, { runId: "../private" }, { runId: ["run-1", "run-2"] }])("任务编号 $runId 不合法时打开列表", async ({ runId }) => {
    await expect(LegacyOverviewPage({ searchParams: Promise.resolve({ runId }) })).rejects.toThrow("redirect:/evaluations");
    expect(stubs.viewer).toHaveBeenCalledOnce();
    expect(stubs.get).not.toHaveBeenCalled();
  });

  it("任务不存在或已隐藏时打开列表", async () => {
    stubs.get.mockRejectedValue(new AppError("NOT_FOUND", "评测任务不存在", 404));
    await expect(LegacyOverviewPage({ searchParams: Promise.resolve({ runId: "run-1" }) })).rejects.toThrow("redirect:/evaluations");
  });

  it("查询失败仍交给错误边界，不误跳列表", async () => {
    stubs.get.mockRejectedValue(new Error("database unavailable"));
    await expect(LegacyOverviewPage({ searchParams: Promise.resolve({ runId: "run-1" }) })).rejects.toThrow("database unavailable");
    expect(stubs.redirect).not.toHaveBeenCalled();
  });

  it("认证失败时不查询任务", async () => {
    stubs.viewer.mockRejectedValue(new Error("unauthorized"));
    await expect(LegacyOverviewPage({ searchParams: Promise.resolve({ runId: "run-1" }) })).rejects.toThrow("unauthorized");
    expect(stubs.get).not.toHaveBeenCalled();
    expect(stubs.redirect).not.toHaveBeenCalled();
  });
});
