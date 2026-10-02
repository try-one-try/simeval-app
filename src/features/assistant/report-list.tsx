"use client";

// 报告从服务端读取；确认时服务端会重新核对来源版本，前端状态不能代替权限检查。
import { useState } from "react";
import Link from "next/link";
import type { ReportView } from "@/domain/assistant";
import type { DemoRole } from "@/lib/demo-identity";
import { assistantRequest } from "./api-client";
import styles from "./report.module.css";

export function ReportList({ initial, role, selectedId }: { initial: ReportView[]; role: DemoRole; selectedId?: string }) {
  const [reports, setReports] = useState(initial), [selected, setSelected] = useState(selectedId || initial[0]?.id || "");
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  const report = reports.find(r => r.id === selected) || reports[0];
  async function confirm() {
    if (!report || saving) return;
    setSaving(true); setError("");
    try { const saved = await assistantRequest<ReportView>(`/api/ai-reports/${report.id}/confirm`, {}); setReports(items => items.map(r => r.id === saved.id ? saved : r)); }
    catch (e) { setError(e instanceof Error ? e.message : "确认失败"); } finally { setSaving(false); }
  }
  if (!report) return <section className={styles.empty}><span>尚未保存报告</span><h2>先调查，再留下可核对的结论。</h2><p>点击右下角助手，分析本次评测。完成有证据引用的回答后，点击“保存当前任务证据报告”，这里就会出现报告。</p><p>私聊不会自动公开；保存的报告包含当前任务指标和人工复核结论。</p></section>;
  return <section className={styles.layout}>
    <aside className={styles.list} aria-label="报告版本">{reports.map(r => <button key={r.id} type="button" aria-pressed={report.id === r.id} onClick={() => { setSelected(r.id); setError(""); }}><strong>{r.status === "CONFIRMED" ? "已确认" : "待确认"}{r.isStale ? " · 来源已更新" : ""}</strong><span>{new Date(r.createdAt).toLocaleString("zh-CN")}</span></button>)}</aside>
    <article className={styles.report}>
      <header><span className={styles.label}>当前任务 · 证据报告</span><h2>{report.output.title}</h2><p>AI 辅助调查后的结构化整理 · {report.status === "CONFIRMED" ? "人工已确认" : "待人工确认"}</p></header>
      {report.isStale && <p className={styles.warning}>来源记录已更新，这份报告只作历史参考。请重新分析并保存新报告。</p>}
      <section><h3>评测概况</h3><p>{report.output.summary}</p></section>
      <section><h3>指标记录</h3><div className={styles.tableWrap}><table><thead><tr><th>指标</th><th>场景</th><th>结果</th></tr></thead><tbody>{report.output.metrics.map((m, i) => <tr key={i}><td>{m.name}</td><td>{m.scenario}</td><td>{m.value} {m.unit}</td></tr>)}</tbody></table></div></section>
      <section><h3>样本复核</h3>{!report.output.findings.length ? <p>当前没有异常样本记录。</p> : <ul className={styles.findings}>{report.output.findings.map(f => <li key={f.sampleId}><Link href={`/anomalies/${f.sampleId}?runId=${report.runId}`}>{f.label} ↗</Link><span>{f.confirmed ? "已有人工结论" : "待人工核对"}</span><p>{f.conclusion}</p></li>)}</ul>}</section>
      <section><h3>适用边界</h3><ul>{report.output.limitations.map(l => <li key={l}>{l}</li>)}</ul></section>
      <footer>{report.confirmedAt ? <p>确认时间：{new Date(report.confirmedAt).toLocaleString("zh-CN")}</p> : role === "REVIEWER" ? <button type="button" className="primary-button" disabled={saving || report.isStale} onClick={() => void confirm()}>{saving ? "正在核对来源…" : "已核对证据，确认报告"}</button> : <p>报告由评测人员核对并确认。</p>}{error && <p role="alert" className={styles.warning}>{error}</p>}</footer>
    </article>
  </section>;
}
