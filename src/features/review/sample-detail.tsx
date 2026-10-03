"use client";
// 详情先展示当前判断，再展开日志和历史；保存后的 DTO 立即更新进度与结论。
import Link from "next/link";
import { useState } from "react";
import type { Actor } from "@/domain/evaluation";
import type { SampleDetailData } from "@/lib/review-dto";
import { evidenceHref,reportHref,scenarioLabel,type EvidenceContext } from "@/lib/review-links";
import { RunContext } from "@/features/evaluation/run-context";
import { TaskFlowBackLink } from "@/features/evaluation/task-flow-back-link";
import { ReviewEditor } from "./review-editor";
function when(value:string|null) {return value?new Date(value).toLocaleString("zh-CN"):"历史记录";}
export function SampleDetail({initial,actor,context}:{initial:SampleDetailData;actor:Actor;context:EvidenceContext}) {
  const [detail,setDetail]=useState(initial),{sample,run}=detail;
  return <main className="content workflow-content sample-detail"><RunContext run={run} href="/anomalies"/>
    <div className="page-context task-flow-header"><TaskFlowBackLink href={evidenceHref(run.id,context)} label="返回异常样本"/><span>异常复核 / 03 样本详情</span></div>
    <div className="overview-heading"><div><h1>{sample.sampleNumber}</h1><p className="muted">合成异常证据 · 与当前评测关联 · {sample.title}</p></div><p className={sample.pendingReview?"risk-text review-status":"muted review-status"}>{sample.pendingReview?<a className="review-entry-link" href="#review-conclusion">● {sample.status==="RESOLVED"?"新草稿待确认":"待复核"} · 去编辑/复核结论 ↗</a>:"已确认"}</p></div>
    {detail.history.some(item=>item.mode==="legacy")&&sample.conclusion?.includes("回补")&&<p className="fine-print">历史示例保留当时的回补记录；当前版本只记录处理建议，不提供回补任务管理。</p>}
    <div className="conclusion"><p>人工结论</p><h2>{sample.conclusion??"尚未确认，请核对日志并记录判断。"}</h2><p className="muted">{sample.confirmedRevision?"确认修订 "+sample.confirmedRevision+" · "+(sample.confirmedBy?.name??"历史确认")+" · "+when(sample.confirmedAt):"工程师可先填写草稿，评测人员负责最终确认。"}</p></div>
    <div className="sample-columns"><section><h2>证据与来源</h2><dl className="facts"><div><dt>关联评测</dt><dd>{run.name}<small>{run.id}</small></dd></div><div><dt>场景与指标</dt><dd>{scenarioLabel(sample.scenarioKey)} · {sample.metricKey==="collision_rate"?"碰撞率":sample.metricKey}</dd></div><div><dt>日志片段</dt><dd><pre className="evidence-log">{sample.logExcerpt??"本样本没有提供日志片段。"}</pre></dd></div></dl><p className="fine-print">本演示只展示合成日志和人工记录，没有真实仿真媒体。</p></section>
      {/* 红色待复核链接直接定位此处；窄屏下不需要继续寻找编辑入口。 */}
      <section className="review-workspace" id="review-conclusion" tabIndex={-1} aria-labelledby="review-conclusion-title"><h2 id="review-conclusion-title">结论编辑与复核</h2><ReviewEditor detail={detail} actor={actor} onSaved={setDetail}/><div className="review-conclusions"><p className="fine-print">已确认结论</p><p>{sample.conclusion??"尚未确认"}</p><p className="fine-print">待确认草稿</p><p>{sample.draftConclusion??"暂无待确认草稿"}</p>{sample.draftConclusion&&<p className="fine-print">{sample.draftUpdatedBy?.name??"未知编辑者"} · {when(sample.draftUpdatedAt)}</p>}</div>{detail.staleReportCount>0&&<p className="risk-text report-stale">相关旧报告的结论依据已更新，需更新当前报告并重新确认。</p>}</section></div>
    <details className="review-history"><summary>查看修改历史 · {detail.history.length} 条</summary><ol>{detail.history.map(item=><li key={item.id}><div><strong>{item.mode==="draft"?"保存草稿":item.mode==="confirm"?"确认最终结论":"历史复核记录"}</strong><span className="fine-print">{item.actor.name} · {when(item.createdAt)}{item.toVersion!==null&&" · 编辑版本 "+item.toVersion}{item.confirmedRevision!==null&&" · 确认修订 "+item.confirmedRevision}</span></div><p>{item.conclusion??"历史记录未保存结论文本"}</p></li>)}</ol></details>
    <div className="workflow-actions"><Link className="primary-button" href={evidenceHref(run.id,context)}>← 返回异常样本</Link><Link className="text-action" href={reportHref(run.id,context)}>查看本次报告 ↗</Link>{run.pendingReviewCount>0?<Link className="review-entry-link" href={evidenceHref(run.id,{...context,reviewState:"pending"})}>{run.pendingReviewCount} 条待复核 · 去复核 ↗</Link>:<span className="fine-print">0 条待复核</span>}</div>
  </main>;
}
