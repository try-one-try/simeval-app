// 旧总览地址只用于兼容跳转，等待期间不展示另一份任务结果。
export default function OverviewLoading() {
  return <main className="content state-content" aria-busy="true"><p className="breadcrumb">评测任务</p><h1>正在打开评测结果…</h1><p role="status" className="muted">任务概况与指标已合并到评测结果页。</p></main>;
}
