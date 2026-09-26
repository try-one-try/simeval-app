// 阶段 3 先提供共享任务读取；完整选择上下文、总览与删除留阶段 4。
import Link from "next/link";
import { requireViewer } from "@/server/auth/require-viewer";
import { evaluationService } from "@/server/application/evaluation";
const statusNames = { QUEUED: "排队中", RUNNING: "运行中", SUCCEEDED: "已完成", FAILED: "失败", CANCELLED: "已取消" } as const;
export default async function EvaluationsPage() {
  const viewer = await requireViewer();
  const result = await evaluationService.list(viewer, { page: 1, pageSize: 20 });
  return <main className="content workflow-content">
    <p className="page-context">评测任务 / 已有记录</p>
    <div className="overview-heading"><div><h1>评测任务</h1><p className="muted">查看已有任务与执行状态。合成示例和新建记录分别标注。</p></div>
      {viewer.role === "ENGINEER" && <div><Link href="/evaluations/new" className="text-action inline-link">创建新评测 ↗</Link></div>}
    </div>
    <p className="fine-print">共 {result.total} 条 · 显示最近 {result.data.length} 条</p>
    {result.data.length ? <ul className="task-list">{result.data.map((run) =>
      <li key={run.id}><Link href={"/evaluations/" + encodeURIComponent(run.id)}>
        <span><strong>{run.name}</strong><small>{run.isDemoFixture ? "预置合成示例" : "新建模拟任务"} · {run.modelName} {run.modelVersion}<br />{run.id}</small></span>
        <span className="task-list-state">{statusNames[run.status]} <span aria-hidden="true">→</span></span>
      </Link></li>
    )}</ul> : <p className="task-list-empty">暂无评测任务。{viewer.role === "ENGINEER" ? "可以创建一次模拟评测。" : "等待算法工程师创建评测。"}</p>}
  </main>;
}
