// 质量页展示持久化的预置检查，警告统计不等同于实际异常记录数。
import Link from "next/link";
import type { QualityData } from "@/lib/evaluation-dto";
export function QualityView({ quality, canWrite }: { quality: QualityData; canWrite: boolean }) {
  const { dataset, checks } = quality;
  const warning = checks.filter((check) => check.status === "WARNING");
  const title = dataset.qualityStatus === "FAILED" ? "质量未通过，本次不能创建评测。" : warning.length ? "可以评测，但必须保留已知质量前提。" : "质量检查通过，可以创建评测。";
  return <section className="content workflow-content quality-view">
    <div className="page-context">数据质量 / {dataset.qualityStatus}<span>任务步骤　01 质量概况　02 创建评测</span></div>
    <div className="overview-heading"><div><h1>数据质量</h1><p className="muted">{dataset.name} {dataset.version} · {dataset.sampleCount.toLocaleString("zh-CN")} 条合成样本</p></div><div className="overview-status"><strong>{dataset.qualityStatus} · {dataset.qualityStatus === "WARNING" ? "需关注" : dataset.qualityStatus === "FAILED" ? "禁止评测" : "通过"}</strong><p className="muted">预置检查报告 · 非实时扫描</p></div></div>
    <div className="conclusion"><p>质量判断</p><h2>{title}</h2><p className="muted">{dataset.sampleCount.toLocaleString("zh-CN")} 条合成样本；{checks.length} 项预置检查。警告统计描述数据集风险，实际异常记录另按评测任务保存。</p></div>
    <div className="quality-rows">{checks.length ? checks.map((check) => <div key={check.key} className="quality-row"><div><h2>{check.name}</h2><p className="fine-print">{check.message}</p></div><p className={check.status === "PASSED" ? "" : "risk-text"}>{check.status === "PASSED" ? "通过" : check.status === "WARNING" ? "需人工复核" : "未通过"}{check.affectedCount > 0 && <span> · {check.affectedCount} 条样本</span>}</p></div>) : <p className="muted">暂无预置检查记录。</p>}</div>
    <div className="workflow-actions">{quality.canStartEvaluation && canWrite ? <Link href="/evaluations/new" className="primary-button">继续创建模拟评测 →</Link> : <button disabled className="primary-button">{canWrite ? "质量未通过，不能创建" : "当前角色只能查看"}</button>}</div>
    <p className="fine-print">合成数据 · Mock Provider · 不运行真实仿真器</p>
  </section>;
}
