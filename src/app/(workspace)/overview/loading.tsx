// 概览读取期间的占位状态，避免把尚未返回的数据误呈现为空记录。
export default function OverviewLoading() {
  return <main className="content" aria-busy="true"><div className="eyebrow">Overview / 项目总览</div><h1>正在读取演示数据…</h1><p className="content-intro">正在确认会话并读取保存的项目记录。</p><div className="overview-grid"><div className="panel" style={{ minHeight: 140 }} /><div className="panel" style={{ minHeight: 140 }} /><div className="panel" style={{ minHeight: 140 }} /></div></main>;
}
