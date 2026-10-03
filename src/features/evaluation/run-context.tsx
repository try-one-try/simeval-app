// 正文导航携带任务 ID；侧栏保留模块入口，避免悄悄沿用上一任务。
import Link from "next/link";
import type { RunData } from "@/lib/evaluation-dto";
export function RunContext({ run, href }: { run: RunData; href: string }) {
  return <div className="run-context"><Link href={href} className="inline-link">更换任务</Link><strong>{run.name}</strong><span className="fine-print">{run.id}</span></div>;
}
export function RunResults({ run }: { run: RunData }) {
  const success = run.metrics.find(m => m.key === "success_rate" && m.scenarioKey === "__overall__");
  return <>
    {run.status === "SUCCEEDED" && <><div className="result-metrics">{run.metrics.map(metric => <div key={metric.key + metric.scenarioKey}><p className="eyebrow">{metric.name}{metric.scenarioKey !== "__overall__" ? " · 遮挡场景" : ""}</p><strong>{metric.value}{metric.unit}</strong><p className="fine-print">{metric.sampleCount} 个 Episode</p></div>)}</div>
      <p className="goal-result">{run.targetSuccessRate === null ? "未设置达标目标；这些指标不代表发布结论。" : success ? (success.value >= run.targetSuccessRate * 100 ? "达到" : "未达到") + "本次成功率目标 " + run.targetSuccessRate * 100 + "%；仍需核对碰撞风险与异常证据。" : "成功率指标缺失，无法判断达标。"}</p></>}
  </>;
}
