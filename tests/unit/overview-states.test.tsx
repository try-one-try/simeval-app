// 概览状态测试：空数据和查询失败各有独立文案，不用零值代替读取错误。
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const stubs = vi.hoisted(() => ({ getOverview: vi.fn(),viewer:vi.fn(),list:vi.fn() }));
vi.mock("server-only",()=>({}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn(),refresh:vi.fn()}),notFound:()=>{throw new Error("not-found")}}));
vi.mock("@/server/auth/require-viewer",()=>({requireViewer:stubs.viewer}));
vi.mock("@/server/application/evaluation",()=>({evaluationService:{list:stubs.list}}));

import { ModuleEntry } from "@/features/evaluation/module-entry";
import OverviewError from "@/app/(workspace)/overview/error";

describe("概览展示状态", () => {
  beforeEach(() => {vi.resetAllMocks();stubs.viewer.mockResolvedValue({id:"viewer",role:"REVIEWER"});});

  it("没有任务时展示空列表，不展示固定故事统计", async () => {
    stubs.list.mockResolvedValue({data:[],total:0});
    const html = renderToStaticMarkup(await ModuleEntry({module:"overview",searchParams:Promise.resolve({})}));
    expect(html).toContain("暂无任务");
    expect(html).not.toContain("预置评测");
  });

  it("查询失败时交给错误边界，不显示空状态", async () => {
    stubs.list.mockRejectedValue(new Error("database unavailable"));
    await expect(ModuleEntry({module:"overview",searchParams:Promise.resolve({})})).rejects.toThrow("database unavailable");
    const html = renderToStaticMarkup(<OverviewError error={new Error("database unavailable")} retry={() => undefined} />);
    expect(html).toContain("暂时无法读取项目数据");
    expect(html).toContain("重试读取");
    expect(html).not.toContain("暂无任务");
  });
});
