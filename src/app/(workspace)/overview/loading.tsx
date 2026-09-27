// 加载与空数据分开表达，不提前显示统计数字。
export default function OverviewLoading() {
  return <main className="content state-content" aria-busy="true"><p className="breadcrumb">总览 / 评测任务</p><h1>正在读取任务数据…</h1><p role="status" className="muted">正在确认会话并读取保存的任务记录。</p><div className="skeleton" aria-hidden="true" /><div className="skeleton short" aria-hidden="true" /></main>;
}