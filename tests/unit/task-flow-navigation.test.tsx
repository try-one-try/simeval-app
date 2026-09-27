// 验证真实易丢失的任务／基线／筛选上下文，以及结果页拒绝非法返回参数。
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { comparisonHref, evidenceHref, reportHref, resultsHref } from "@/lib/review-links";

const stubs = vi.hoisted(() => ({ viewer: vi.fn(), get: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not-found"); } }));
vi.mock("@/server/auth/require-viewer", () => ({ requireViewer: stubs.viewer }));
vi.mock("@/server/application/evaluation", () => ({ evaluationService: { get: stubs.get } }));
vi.mock("@/features/evaluation/task-status", () => ({ TaskStatus: ({ initialRun, baselineRunId }: { initialRun: { id: string }; baselineRunId?: string }) => <p>{initialRun.id}:{baselineRunId ?? "default"}</p> }));
import EvaluationPage from "@/app/(workspace)/evaluations/[runId]/page";

describe("同任务双向流程导航", () => {
  beforeEach(() => { vi.resetAllMocks(); stubs.viewer.mockResolvedValue({ id: "engineer", role: "ENGINEER" }); stubs.get.mockResolvedValue({ id: "demo-run-candidate" }); });

  it("返回结果保留自选基线，并区分不比较和沿用原配置", () => {
    expect(resultsHref("demo-run-candidate", "demo-run-v21")).toBe("/evaluations/demo-run-candidate?baselineRunId=demo-run-v21");
    expect(resultsHref("demo-run-candidate", "")).toBe("/evaluations/demo-run-candidate?baselineRunId=");
    expect(resultsHref("demo-run-candidate")).toBe("/evaluations/demo-run-candidate");
    expect(comparisonHref("demo-run-candidate", "")).toBe("/comparisons?runId=demo-run-candidate&baselineRunId=");
  });

  it("报告与异常往返保留同一任务、基线和全部已知筛选", () => {
    const context = { baselineRunId: "demo-run-v21", metricKey: "collision_rate", scenarioKey: "occlusion", reviewState: "pending" };
    const report = new URL(reportHref("demo-run-candidate", context), "http://localhost");
    const evidence = new URL(evidenceHref("demo-run-candidate", context), "http://localhost");
    expect(Object.fromEntries(report.searchParams)).toEqual({ runId: "demo-run-candidate", ...context });
    expect(report.search).toBe(evidence.search);
    expect(report.pathname).toBe("/reports");
    expect(evidence.pathname).toBe("/anomalies");
  });

  it("结果页把显式基线交给下一步，而不替换成任务原始基线", async () => {
    for (const baselineRunId of ["demo-run-v21", ""]) {
      const page = await EvaluationPage({ params: Promise.resolve({ runId: "demo-run-candidate" }), searchParams: Promise.resolve({ baselineRunId }) });
      expect(renderToStaticMarkup(page)).toContain("demo-run-candidate:" + baselineRunId);
    }
    expect(stubs.get).toHaveBeenCalledWith(expect.objectContaining({ role: "ENGINEER" }), "demo-run-candidate");
  });

  it("非法或重复基线参数在读取任务前被拒绝", async () => {
    for (const baselineRunId of ["https://example.com", ["demo-run-v21", "demo-run-v22"]]) {
      await expect(EvaluationPage({ params: Promise.resolve({ runId: "demo-run-candidate" }), searchParams: Promise.resolve({ baselineRunId }) })).rejects.toThrow("not-found");
    }
    expect(stubs.get).not.toHaveBeenCalled();
  });
});
