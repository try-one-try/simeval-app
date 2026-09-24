// 概览页只负责呈现应用层返回的数据及空状态，不直接访问数据库。
import { getOverview } from "@/server/application/get-overview";

const qualityLabels = { PASSED: "已通过", WARNING: "需关注", FAILED: "未通过" } as const;
const runLabels = { QUEUED: "排队中", RUNNING: "运行中", SUCCEEDED: "已完成", FAILED: "失败", CANCELLED: "已取消" } as const;

export default async function OverviewPage() {
  const overview = await getOverview();

  return (
    <main className="content">
      <div className="eyebrow">Overview / 项目总览</div>
      <h1>从这里开始，读懂每次评测。</h1>
      <p className="content-intro">下方信息来自已保存的合成演示记录。本阶段只开放概览；其余业务流程将随功能切片逐步开放。</p>

      {!overview ? (
        <div className="panel empty-panel">
          <h2>演示数据尚未准备</h2>
          <p>管理员可以按 README 执行数据库迁移与 Seed，然后刷新此页。</p>
        </div>
      ) : (
        <>
          <div className="overview-grid">
            <div className="panel">
              <div className="panel-label">当前项目</div>
              <div className="panel-value">{overview.project.name}</div>
              <div className="panel-meta">{overview.project.description}</div>
            </div>
            <div className="panel">
              <div className="panel-label">数据集质量</div>
              <div className={`panel-value ${overview.dataset?.qualityStatus === "WARNING" ? "amber" : ""}`}>
                {overview.dataset ? qualityLabels[overview.dataset.qualityStatus] : "尚无数据集"}
              </div>
              <div className="panel-meta">{overview.dataset ? `${overview.dataset.name} · ${overview.dataset.version} · ${overview.dataset.sampleCount.toLocaleString("zh-CN")} 条样本` : "请先准备演示数据集"}</div>
            </div>
            <div className="panel">
              <div className="panel-label">预置评测</div>
              <div className="panel-value">{overview.runs.length} 条</div>
              <div className="panel-meta">从数据库读取的固定导览任务</div>
            </div>
          </div>

          <div className="section-title"><h2>质量信号</h2><span>数据集检查记录</span></div>
          <div className="panel">
            {overview.dataset?.checks.length ? overview.dataset.checks.map((check) => (
              <div className="run-row" key={check.id}>
                <div><strong>{check.name}</strong><small>{check.message}</small></div>
                <span className={check.status === "WARNING" ? "preview-pill" : "status-pill"}>{qualityLabels[check.status]} · {check.affectedCount} 条</span>
              </div>
            )) : <div className="empty-panel">当前没有质量检查记录。</div>}
          </div>

          <div className="section-title"><h2>已有评测</h2><span>固定故事 · 只读导览</span></div>
          <div className="panel">
            {overview.runs.length ? overview.runs.map((run) => (
              <div className="run-row" key={run.id}>
                <div><strong>{run.modelName} {run.modelVersion}</strong><small>任务 {run.id}</small></div>
                <span className="status-pill">{runLabels[run.status]}</span>
              </div>
            )) : <div className="empty-panel">当前没有预置评测。执行 Seed 后再刷新。</div>}
          </div>

          <div className="section-title"><h2>下一步</h2><span>按阶段开放</span></div>
          <div className="story-callout"><strong>继续沿证据链深入</strong><br />后续切片将依次开放质量详情、创建模拟评测、模型对比、异常复核和报告确认。当前概览已可以验证项目、质量和评测记录来自持久化数据。</div>
        </>
      )}
    </main>
  );
}
