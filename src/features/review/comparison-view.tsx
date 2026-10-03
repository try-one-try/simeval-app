"use client";
// 对比页只改变查看条件；任务原配置不被改写，证据链接始终保留候选任务。
import Link from "next/link";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import type { ComparisonData } from "@/lib/review-dto";
import type { ComparisonMetric } from "@/domain/comparison-review";
import { comparisonHref,evidenceHref,resultsHref,scenarioLabel } from "@/lib/review-links";
import { RunContext } from "@/features/evaluation/run-context";
import { TaskFlowBackLink } from "@/features/evaluation/task-flow-back-link";
const verdictLabels={IMPROVEMENT:"改善",REGRESSION:"回退",UNCHANGED:"持平",NOT_COMPARABLE:"不可比",CURRENT_ONLY:"本次结果"};
function formatted(value:number|null,unit:string) {return value===null?"—":value+unit;}
function Delta({metric}:{metric:ComparisonMetric}) {return <span className={metric.verdict==="REGRESSION"?"risk-text":""}>{metric.delta===null?verdictLabels[metric.verdict]:(metric.delta>0?"+":"")+metric.delta+" "+metric.deltaUnit+" · "+verdictLabels[metric.verdict]}</span>;}
export function ComparisonView({data}:{data:ComparisonData}) {
  const router=useRouter(),run=data.candidate,metricsDetails=useRef<HTMLDetailsElement>(null);
  const risk=data.metrics.some(m=>m.verdict==="REGRESSION"),improved=data.metrics.some(m=>m.verdict==="IMPROVEMENT"),incomplete=data.metrics.some(m=>m.verdict==="NOT_COMPARABLE");
  const currentOnlyConclusion=data.baselines.length?"本次评测已完成，可选择历史基线比较。":"本次评测已完成，暂无同口径历史基线。";
  const conclusion=!data.baseline?currentOnlyConclusion:incomplete?"部分指标口径不一致，请分别核对。":risk&&improved?"改善伴随风险，需要核对异常证据。":risk?"存在指标回退，需要核对异常证据。":improved?"指标有所改善，仍需结合证据判断。":"可比指标保持一致。";
  const featured=[data.metrics.find(m=>m.key==="success_rate"&&m.scenarioKey==="__overall__"),data.metrics.find(m=>m.key==="collision_rate")].filter((m):m is ComparisonMetric=>!!m);
  const context={baselineRunId:data.baseline?.id??""};
  return <main className="content workflow-content comparison-view"><RunContext run={run} href="/comparisons"/>
    <div className="page-context task-flow-header"><TaskFlowBackLink href={resultsHref(run.id,context.baselineRunId)} label="返回评测结果"/><span>模型对比 / 02 版本指标</span></div>
    <div className="overview-heading"><div><h1>模型对比</h1><p className="muted">同口径历史结果对比；不选基线时仅查看本次指标。</p></div><div className="comparison-conditions"><p className="fine-print">统一评测条件</p><p>{run.datasetName} {run.datasetVersion}</p><p className="fine-print">{run.episodeCount} Episodes · Seed {run.simulationSeed}</p></div></div>
    <div className="conclusion"><p>关键结论</p><h2>{conclusion}</h2><p className="muted">这是指标判读，不是原因定论或发布建议；需由人工结合日志复核。</p></div>
    <label className="baseline-selector">比较基线 <span className="baseline-count">· {data.baselines.length} 个可选历史任务</span><select value={data.baseline?.id??""} onChange={e=>router.push(comparisonHref(run.id,e.target.value))}><option value="">不对比历史结果</option>{data.baseline&&!data.baselines.some(b=>b.id===data.baseline!.id)&&<option value={data.baseline.id}>{data.baseline.name} · 已隐藏的原引用</option>}{data.baselines.map(b=><option key={b.id} value={b.id}>{b.name} · {b.modelVersion}</option>)}</select><span className="fine-print">可不选。仅列同口径、不同模型的成功任务；选择只改变查看条件。</span></label>
    <h2 className="section-title">两个关键指标</h2><div className="comparison-highlights">{featured.map(metric=><section key={metric.key}><p className="muted">{metric.key==="collision_rate"?scenarioLabel(metric.scenarioKey)+"碰撞率":"总体成功率"}</p><div className="metric-comparison">{data.baseline&&<><span className="muted">{formatted(metric.baselineValue,metric.unit)}</span><span className="muted">→</span></>}<strong className={metric.verdict==="REGRESSION"?"risk-text":""}>{formatted(metric.candidateValue,metric.unit)}</strong></div><Delta metric={metric}/><p className="fine-print">{metric.direction==="HIGHER_IS_BETTER"?"越高越好":"越低越好"} · 本次 {metric.candidateSampleCount??"—"} 个样本{data.baseline&&" / 基线 "+(metric.baselineSampleCount??"—")}</p>{metric.reason&&<p className="risk-text">{metric.reason}</p>}{metric.evidenceCount>0&&<Link className="inline-link metric-evidence" href={evidenceHref(run.id,{...context,metricKey:metric.key,scenarioKey:metric.scenarioKey})}>查看 {metric.evidenceCount} 条关联证据 ↗</Link>}</section>)}</div>
    <div className="workflow-actions"><Link className="primary-button" href={evidenceHref(run.id,context)}>{data.anomalyCount?"查看 "+data.anomalyCount+" 条异常样本 →":"查看异常复核 →"}</Link><button className="text-action" onClick={()=>{if(metricsDetails.current){metricsDetails.current.open=true;metricsDetails.current.scrollIntoView({block:"start"});metricsDetails.current.querySelector("summary")?.focus();}}}>查看完整指标与口径 ↓</button></div>
    <details ref={metricsDetails} className="complete-metrics" id="complete-metrics"><summary>完整指标与口径</summary><div className="metric-table-wrap"><table><thead><tr><th>指标 / 场景</th><th>基线</th><th>本次</th><th>变化</th><th>样本数 / 证据</th></tr></thead><tbody>{data.metrics.map(metric=><tr key={metric.key+metric.scenarioKey}><th scope="row">{metric.name}<small>{scenarioLabel(metric.scenarioKey)} · {metric.direction==="HIGHER_IS_BETTER"?"越高越好":"越低越好"}</small></th><td>{formatted(metric.baselineValue,metric.unit)}</td><td>{formatted(metric.candidateValue,metric.unit)}</td><td><Delta metric={metric}/>{metric.reason&&<small>{metric.reason}</small>}</td><td>{metric.baselineSampleCount??"—"} / {metric.candidateSampleCount??"—"}{metric.evidenceCount>0&&<Link className="inline-link" href={evidenceHref(run.id,{...context,metricKey:metric.key,scenarioKey:metric.scenarioKey})}> · {metric.evidenceCount} 条证据</Link>}</td></tr>)}</tbody></table></div><p className="fine-print">变化为本次减基线；百分比指标使用百分点（pp）。合成样本不代表统计显著性；预置证据片段不是全部失败 Episode。</p></details>
    <p className="fine-print quality-caption">合成数据 · 模拟执行 · 不代表真实模型性能</p>
  </main>;
}
