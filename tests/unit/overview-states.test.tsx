// 概览状态测试：空数据和查询失败各有独立文案，不用零值代替读取错误。
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const stubs = vi.hoisted(() => ({ getOverview: vi.fn() }));
vi.mock("@/server/application/get-overview", () => ({ getOverview: stubs.getOverview }));

import OverviewPage from "@/app/(workspace)/overview/page";
import OverviewError from "@/app/(workspace)/overview/error";

describe("概览展示状态", () => {
  beforeEach(() => vi.resetAllMocks());

  it("没有项目时提示准备 Seed，不展示虚构统计", async () => {
    stubs.getOverview.mockResolvedValue(null);
    const html = renderToStaticMarkup(await OverviewPage());
    expect(html).toContain("演示数据尚未准备");
    expect(html).not.toContain("预置评测");
  });

  it("查询失败时交给错误边界，不显示空状态", async () => {
    stubs.getOverview.mockRejectedValue(new Error("database unavailable"));
    await expect(OverviewPage()).rejects.toThrow("database unavailable");
    const html = renderToStaticMarkup(<OverviewError error={new Error("database unavailable")} retry={() => undefined} />);
    expect(html).toContain("暂时无法读取项目数据");
    expect(html).toContain("重试读取");
    expect(html).not.toContain("演示数据尚未准备");
  });
});
