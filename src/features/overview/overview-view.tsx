// 总览展示只消费应用层 DTO；详细业务操作随后续切片开放。
import type { OverviewData } from "@/server/application/get-overview";
const qualityLabels = { PASSED: "已通过", WARNING: "需关注", FAILED: "未通过" } as const;
export function OverviewView({ overview }: { overview: OverviewData | null }) {
  if (!overview) return <main className="content state-content"><p className="breadcrumb">总览 / 当前演示项目</p><h1>演示数据尚未准备</h1><p className="muted">请按 README 准备数据库迁移与 Seed，再刷新查看。这里不会展示虚构的项目或统计。</p><a href="/overview" className="secondary-button">刷新总览 ↻</a></main>;
  const { project, dataset, summary } = overview;
  return <main className="content">
    <div className="page-context"><p>总览 / 项目概况</p><span>总览 / 当前演示项目</span></div>
    <div className="overview-heading"><div><h1>{project.name}</h1><p className="muted">{dataset ? `${dataset.name} · ${dataset.version} · ${dataset.sampleCount.toLocaleString("zh-CN")} 条合成样本` : "尚无数据集"}</p></div><div className="overview-status"><strong>{dataset ? qualityLabels[dataset.qualityStatus] : "待准备"}</strong><p className="muted">合成数据 · 模拟评测</p></div></div>
    <section className="conclusion" aria-labelledby="conclusion-label"><p id="conclusion-label">当前判断</p><h2>{summary.conclusion}</h2><p className="muted">按同一条件比较版本，再查看异常证据与已确认报告。</p></section>
    <div className="overview-columns">
      <section aria-labelledby="context-title"><h2 id="context-title">评测上下文</h2><dl className="facts">
        <div><dt>基线与候选</dt><dd>{summary.versions ?? "尚无可比较版本"}</dd></div>
        <div><dt>评测条件</dt><dd>{dataset ? `${dataset.name}-${dataset.version}` : "待准备"} · {summary.episodeCount === null ? "规模待确认" : `${summary.episodeCount} Episode`}</dd></div>
        <div><dt>已完成评测</dt><dd className="log-strip">{summary.completedRuns} 次已完成 · 模拟评测</dd></div>
      </dl><p className="fine-print">合成演示数据 · 不运行真实仿真器</p>
      <details className="quality-details"><summary>展开质量检查与任务记录</summary><div>{dataset?.checks.map((check) => <p key={check.id}><strong>{check.name} · {qualityLabels[check.status]}</strong><span>{check.message}</span></p>)}{overview.runs.map((run) => <p key={run.id}><strong>{run.modelName} {run.modelVersion}</strong><span>{run.status} · {run.id}</span></p>)}</div></details></section>
      <section aria-labelledby="progress-title"><h2 id="progress-title">当前工作进展</h2><dl className="facts">
        <div><dt>数据质量</dt><dd className={summary.warnings.length ? "risk-text" : ""}>{summary.warnings.length ? summary.warnings.map((check) => <span className="warning-line" key={check.id}>{check.affectedCount} 条 · {check.name}警告</span>) : "暂无质量警告"}</dd></div>
        <div><dt>异常复核</dt><dd>{summary.resolvedCount} / {summary.sampleCount} 已复核 · {summary.dataIssues} 条数据问题、{summary.modelIssues} 条模型问题</dd></div>
        <div><dt>报告记录</dt><dd>{summary.confirmedBy ? `已确认 · ${summary.confirmedBy}` : "尚无已确认报告"}</dd></div>
        <div className="pending-fact"><dt>待处理事项</dt><dd>{summary.pendingBackfills} 条回补任务 · 尚待处理</dd></div>
      </dl></section>
    </div>
    <dl className="facts mobile-overview-facts">
      <div><dt>版本</dt><dd>{summary.versions ?? "尚无可比较版本"}</dd></div>
      <div><dt>评测规模</dt><dd>{summary.episodeCount === null ? "待确认" : `每次 ${summary.episodeCount} Episode`}</dd></div>
      <div><dt>质量</dt><dd>{summary.warnings.length ? summary.warnings.map((check) => <span className="warning-line" key={check.id}>{check.affectedCount} 条 · {check.name}警告</span>) : "暂无质量警告"}</dd></div>
      <div><dt>复核</dt><dd>{summary.resolvedCount} / {summary.sampleCount} 已复核；{summary.pendingBackfills} 条待处理回补</dd></div>
      <div><dt>报告</dt><dd>{summary.confirmedBy ? `已确认 · ${summary.confirmedBy}` : "尚无已确认报告"}</dd></div>
    </dl>
    <div className="overview-actions"><button className="primary-button" disabled type="button">查看模型对比 →</button><span className="fine-print">详情操作将在后续阶段开放，当前总览为只读。</span></div>
  </main>;
}
