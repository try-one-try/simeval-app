// 检查身份职责、路由高亮和服务端页面拦截，避免只隐藏导航却仍展示创建表单。
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ viewer: vi.fn(), options: vi.fn() }));
vi.mock("@/server/auth/require-viewer", () => ({ requireViewer: mocks.viewer }));
vi.mock("@/server/application/evaluation", () => ({ evaluationService: { options: mocks.options } }));
import { workspaceItems, isCurrentItem } from "@/lib/workspace-navigation";
import NewEvaluationPage from "@/app/(workspace)/evaluations/new/page";
import ComparisonsPage from "@/app/(workspace)/comparisons/page";
beforeEach(() => { vi.clearAllMocks(); mocks.viewer.mockResolvedValue({ id: "reviewer", role: "REVIEWER" }); });
it("两身份导航顺序与职责不同，总览均置底", () => {
  expect(workspaceItems("ENGINEER").map((item) => item.label)).toEqual(["创建评测", "评测任务", "模型对比", "异常复核", "报告", "总览"]);
  expect(workspaceItems("REVIEWER").map((item) => item.label)).toEqual(["异常复核", "报告", "评测任务", "总览"]);
});
it("创建页不同时高亮评测任务，详情不高亮创建", () => {
  for (const path of ["/evaluations/new", "/evaluations/run-1", "/anomalies"]) {
    expect(workspaceItems("ENGINEER").filter((item) => isCurrentItem(path, item.href))).toHaveLength(1);
  }
});
it("评测人员直访创建或对比显示无权限，不查询创建配置", async () => {
  expect(renderToStaticMarkup(await NewEvaluationPage())).toContain("当前身份无法创建评测");
  expect(renderToStaticMarkup(await ComparisonsPage())).toContain("当前身份无法使用模型对比");
  expect(mocks.options).not.toHaveBeenCalled();
});
