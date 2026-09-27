// 页面共用任务入口与查询；后续功能保持选定任务上下文，不能展示另一任务的固定结果。
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/require-viewer";
import { evaluationService } from "@/server/application/evaluation";
import { AppError, idSchema } from "@/domain/evaluation";
import { TaskSelector, type TaskModule } from "./task-selector";
import { RunContext, RunResults } from "./run-context";
import { WorkspaceNotice } from "@/components/workspace-notice";
const names = { evaluations: "评测任务", comparisons: "模型对比", anomalies: "异常复核", reports: "报告", overview: "总览" };
export type ModuleParams = Promise<{ runId?: string | string[] }>;
export async function ModuleEntry({ module, searchParams }: { module: TaskModule; searchParams: ModuleParams }) {
  const viewer = await requireViewer();
  if (module === "comparisons" && viewer.role !== "ENGINEER") return <WorkspaceNotice denied title="当前身份无法使用模型对比" description="模型对比由算法工程师操作；评测人员负责样本复核与报告确认。" />;
  const runId = (await searchParams).runId;
  if (runId === undefined) return <TaskSelector initial={await evaluationService.list(viewer, { page: 1, pageSize: 20 })} actor={viewer} module={module} />;
  if (typeof runId !== "string" || !idSchema.safeParse(runId).success) notFound();
  let run;
  try { run = await evaluationService.get(viewer, runId); } catch (error) { if (error instanceof AppError && error.status === 404) notFound(); throw error; }
  if (module !== "overview" && run.status !== "SUCCEEDED") return <main className="content workflow-content"><RunContext run={run} href={"/" + module} /><h1>任务结果尚不可用</h1><p className="muted">当前状态：{run.status}。任务完成后才能进入{names[module]}。</p><Link className="primary-button" href={"/evaluations/" + run.id}>查看当前任务 →</Link></main>;
  return <main className="content workflow-content selected-module-view">
    <RunContext run={run} href={"/" + module} /><p className="page-context">{names[module]} / 当前任务</p>
    <div className="overview-heading"><div><h1>{module === "overview" ? "本次评测总览" : names[module]}</h1><p className="muted">{run.modelName} {run.modelVersion} · {run.datasetName} {run.datasetVersion} · {run.status}</p></div></div>
    {module === "overview" ? <><RunResults run={run} /><dl className="task-facts"><div><dt>Benchmark</dt><dd>{run.benchmarkName} {run.benchmarkVersion}</dd></div><div><dt>运行口径</dt><dd>{run.episodeCount} Episodes · Seed {run.simulationSeed}</dd></div><div><dt>历史基线</dt><dd>{run.baselineRunId ? "已指定比较对象" : "未指定；可独立执行"}</dd></div></dl><p className="quality-caption muted">{run.successRule}</p></> : <><p className="muted">{module === "comparisons" ? "同口径比较与指标下钻将在阶段 5 接通。" : module === "anomalies" ? "异常列表、证据详情与可编辑复核结论将在阶段 5 接通。" : "AI 草稿与人工确认将在阶段 6 接通。"}当前已保留所选任务，尚未开放的操作不会生成结果。</p>{run.pendingReviewCount > 0 && <p className="pending-review"><strong>{run.pendingReviewCount} 条待复核</strong><span>需评测人员复核</span></p>}</>}
    <div className="workflow-actions"><Link className="primary-button" href={module === "overview" && run.status === "SUCCEEDED" ? (viewer.role === "ENGINEER" ? "/comparisons" : "/anomalies") + "?runId=" + run.id : "/evaluations/" + run.id}>{module === "overview" && run.status === "SUCCEEDED" ? viewer.role === "ENGINEER" ? "查看模型对比 →" : "查看异常复核 →" : "查看当前任务 →"}</Link>{module !== "overview" && <Link className="text-action" href={"/overview?runId=" + run.id}>查看本次总览 ↗</Link>}{viewer.role === "ENGINEER" && <Link className="text-action" href="/evaluations/new">创建新评测 ＋</Link>}</div>
    <p className="fine-print">合成数据 · 模拟执行 · 不代表真实模型表现</p>
  </main>;
}
