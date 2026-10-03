// 页面共用任务入口与查询；后续功能保持选定任务上下文，不能展示另一任务的固定结果。
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/require-viewer";
import { evaluationService } from "@/server/application/evaluation";
import { AppError, idSchema } from "@/domain/evaluation";
import { TaskSelector, type TaskModule } from "./task-selector";
import { RunContext } from "./run-context";
import { comparisonReviewService } from "@/server/application/comparison-review";
import { sampleQuerySchema } from "@/domain/comparison-review";
import { ComparisonView } from "@/features/review/comparison-view";
import { AnomalyList } from "@/features/review/anomaly-list";
import { WorkspaceNotice } from "@/components/workspace-notice";
import { TASK_SELECTION_PAGE_SIZE } from "@/lib/evaluation-dto";
import { TaskFlowBackLink } from "./task-flow-back-link";
import { evidenceHref, resultsHref, type EvidenceContext } from "@/lib/review-links";
import { reportService } from "@/server/application/report";
import { ReportList } from "@/features/assistant/report-list";
const names = { evaluations: "评测任务", comparisons: "模型对比", anomalies: "异常复核", reports: "报告" };
export type ModuleParams = Promise<Record<string, string | string[] | undefined>>;
export async function ModuleEntry({ module, searchParams }: { module: TaskModule; searchParams: ModuleParams }) {
  const viewer = await requireViewer();
  if (module === "comparisons" && viewer.role !== "ENGINEER") return <WorkspaceNotice denied title="当前身份无法使用模型对比" description="模型对比由算法工程师操作；评测人员负责样本复核与报告确认。" />;
  const params = await searchParams;
  const runId = params.runId;
  if (runId === undefined) return <TaskSelector initial={await evaluationService.list(viewer, { page: 1, pageSize: TASK_SELECTION_PAGE_SIZE })} actor={viewer} module={module} />;
  if (typeof runId !== "string" || !idSchema.safeParse(runId).success) notFound();
  let run;
  try { run = await evaluationService.get(viewer, runId); } catch (error) { if (error instanceof AppError && error.status === 404) notFound(); throw error; }
  if (run.status !== "SUCCEEDED") return <main className="content workflow-content"><RunContext run={run} href={"/" + module} /><h1>任务结果尚不可用</h1><p className="muted">当前状态：{run.status}。任务完成后才能进入{names[module]}。</p><Link className="primary-button" href={"/evaluations/" + run.id}>查看当前任务 →</Link></main>;
  if (module === "comparisons") {
    const baseline = params.baselineRunId === undefined ? run.baselineRunId : params.baselineRunId;
    if (baseline !== null && (typeof baseline !== "string" || baseline !== "" && !idSchema.safeParse(baseline).success)) notFound();
    if (params.scenarioKey !== undefined && (typeof params.scenarioKey !== "string" || !params.scenarioKey.trim() || params.scenarioKey.length > 120)) notFound();
    let data, incompatibleMessage;
    try { data = await comparisonReviewService.comparison(viewer, run.id, baseline || null, params.scenarioKey as string | undefined); }
    catch (error) { if (error instanceof AppError && error.code === "INCOMPATIBLE_CONFIGURATION") incompatibleMessage=error.message; else {if (error instanceof AppError && error.status === 404) notFound(); throw error;} }
    if (!data) return <main className="content state-content"><RunContext run={run} href="/comparisons" /><h1>这两个任务不能直接比较</h1><p className="muted">{incompatibleMessage}</p><Link className="primary-button" href={"/comparisons?runId="+run.id+"&baselineRunId="}>重新选择基线 →</Link></main>;
    return <ComparisonView data={data} />;
  }
  if (module === "anomalies") {
    const input = sampleQuerySchema.safeParse({ runId, ...Object.fromEntries(["metricKey", "scenarioKey", "reviewState", "status", "page", "pageSize"].filter(key => params[key] !== undefined).map(key => [key, params[key]])) });
    if (!input.success || params.baselineRunId !== undefined && typeof params.baselineRunId !== "string") notFound();
    return <AnomalyList data={await comparisonReviewService.list(viewer, input.data)} query={input.data} actor={viewer} baselineRunId={params.baselineRunId as string | undefined} />;
  }
  let reportContext: EvidenceContext = {};
  if (module === "reports") {
    const input = sampleQuerySchema.safeParse({ runId, ...Object.fromEntries(["metricKey", "scenarioKey", "reviewState"].filter(key => params[key] !== undefined).map(key => [key, params[key]])) });
    const baselineRunId = params.baselineRunId;
    if (!input.success || baselineRunId !== undefined && (typeof baselineRunId !== "string" || baselineRunId !== "" && !idSchema.safeParse(baselineRunId).success)) notFound();
    reportContext = { metricKey: input.data.metricKey, scenarioKey: input.data.scenarioKey, reviewState: input.data.reviewState, baselineRunId };
  }
  const reports = await reportService.list(viewer, run.id);
  return <main className="content workflow-content selected-module-view">
    <RunContext run={run} href={"/" + module} /><div className="page-context task-flow-header"><TaskFlowBackLink href={module === "reports" ? evidenceHref(run.id,reportContext) : resultsHref(run.id)} label={module === "reports" ? "返回异常复核" : run.status === "SUCCEEDED" ? "返回评测结果" : "返回任务状态"}/><span>{names[module]} / 当前任务</span></div>
    <div className="overview-heading"><div><h1>{names[module]}</h1><p className="muted">{run.modelName} {run.modelVersion} · {run.datasetName} {run.datasetVersion} · {run.status}</p></div></div>
    <ReportList key={`${run.id}:${reports[0]?.updatedAt || "empty"}:${reports[0]?.isStale ? "stale" : "current"}`} initial={reports} role={viewer.role} runId={run.id} />
    <div className="workflow-actions"><Link className="primary-button" href={module === "reports" ? evidenceHref(run.id,reportContext) : run.status === "SUCCEEDED" ? (viewer.role === "ENGINEER" ? "/comparisons" : "/anomalies") + "?runId=" + run.id : resultsHref(run.id)}>{module === "reports" ? "← 返回异常复核" : run.status === "SUCCEEDED" ? viewer.role === "ENGINEER" ? "查看模型对比 →" : "查看异常复核 →" : "查看当前任务 →"}</Link>{module === "reports" && <Link className="text-action" href={resultsHref(run.id,reportContext.baselineRunId)}>查看评测结果 ↗</Link>}{viewer.role === "ENGINEER" && <Link className="text-action" href="/evaluations/new">创建新评测 ＋</Link>}</div>
    <p className="fine-print">合成数据 · 模拟执行 · 不代表真实模型表现</p>
  </main>;
}
