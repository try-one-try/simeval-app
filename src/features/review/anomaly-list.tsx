"use client";
// 列表查询由 URL 固定任务和筛选；详情及返回延续同一个对象。
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SampleListData } from "@/lib/review-dto";
import type { SampleQuery } from "@/domain/comparison-review";
import type { Actor } from "@/domain/evaluation";
import { evidenceHref,comparisonHref,scenarioLabel,type EvidenceContext } from "@/lib/review-links";
import { RunContext } from "@/features/evaluation/run-context";
export function AnomalyList({data,query,actor,baselineRunId}:{data:SampleListData;query:SampleQuery;actor:Actor;baselineRunId?:string}) {
  const router=useRouter(),context:EvidenceContext={metricKey:query.metricKey,scenarioKey:query.scenarioKey,reviewState:query.reviewState,baselineRunId};
  function change(key:"metricKey"|"scenarioKey"|"reviewState",value:string){const next={...context,[key]:value||undefined};router.push(evidenceHref(data.run.id,next));}
  function page(next:number){router.push(evidenceHref(data.run.id,context)+"&page="+next);}
  return <main className="content workflow-content anomaly-view"><RunContext run={data.run} href="/anomalies"/><p className="page-context"><span>异常复核 / 02 异常样本</span>{actor.role==="ENGINEER"&&<Link className="text-action" href={comparisonHref(data.run.id,baselineRunId)}>← 模型对比</Link>}</p>
    <div className="overview-heading"><div><h1>异常证据样本</h1><p className="muted">查看日志证据并填写结论，由评测人员完成最终复核。</p></div><div><p>复核进度</p><p className={data.pendingCount?"risk-text":"muted"}>{data.sampleCount-data.pendingCount} / {data.sampleCount} 已复核</p></div></div>
    <div className="conclusion"><p>证据判断</p><h2>{data.pendingCount?"有 "+data.pendingCount+" 条证据需要评测人员复核。":data.sampleCount?"现有证据已完成复核。":"本次任务没有预置异常证据。"}</h2><p className="muted">合成证据用于展示复核流程，不等于全部失败样本。</p></div>
    <div className="evidence-filters"><label>场景<select value={query.scenarioKey??""} onChange={e=>change("scenarioKey",e.target.value)}><option value="">全部场景</option>{[...new Set([...data.scenarios,...(query.scenarioKey?[query.scenarioKey]:[])])].map(s=><option key={s} value={s}>{scenarioLabel(s)}</option>)}</select></label><label>指标<select value={query.metricKey??""} onChange={e=>change("metricKey",e.target.value)}><option value="">全部指标</option>{[...new Set([...data.metricKeys,...(query.metricKey?[query.metricKey]:[])])].map(k=><option key={k} value={k}>{k==="collision_rate"?"碰撞率":k==="success_rate"?"成功率":k}</option>)}</select></label><label>复核状态<select value={query.reviewState??""} onChange={e=>change("reviewState",e.target.value)}><option value="">全部</option><option value="pending">待复核</option><option value="confirmed">已确认</option></select></label></div>
    <h2 className="section-title">{data.total} 条关联样本</h2>
    {!data.data.length?<p className="task-list-empty">当前筛选没有样本。<Link className="inline-link" href={evidenceHref(data.run.id,{baselineRunId})}>清除筛选 ↗</Link></p>:<div className="anomaly-rows">{data.data.map(sample=><article key={sample.id} className="anomaly-row"><div><p className="fine-print">{sample.sampleNumber} · {scenarioLabel(sample.scenarioKey)}</p><h2>{sample.title}</h2><p className="muted">{sample.logExcerpt?"日志片段已保存；请核对证据和人工结论。":"未提供日志片段，请结合已有记录判断。"}</p></div><div><p className={sample.pendingReview?"risk-text review-status":"muted review-status"}>{sample.pendingReview?"● "+(sample.status==="RESOLVED"?"新草稿待确认":"待复核")+" · 需评测人员复核":"已确认"}</p><Link className="primary-button" href={evidenceHref(data.run.id,context,sample.id)}>查看样本详情 →</Link></div></article>)}</div>}
    {data.total>query.pageSize&&<div className="workflow-actions"><button className="text-action" disabled={query.page===1} onClick={()=>page(query.page-1)}>上一页</button><span>第 {query.page} 页</span><button className="text-action" disabled={query.page*query.pageSize>=data.total} onClick={()=>page(query.page+1)}>下一页</button></div>}
    <div className="workflow-actions"><Link className="primary-button" href={"/reports?runId="+data.run.id}>查看本次报告 →</Link><span className="fine-print">报告功能暂未开放</span><Link className="text-action" href={"/overview?runId="+data.run.id}>本次总览 ↗</Link></div>
  </main>;
}
