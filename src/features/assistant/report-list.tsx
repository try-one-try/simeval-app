"use client";

// 每个任务只展示一份报告；来源变化后更新原报告，聊天回答不进入这里。
import { useState } from "react";
import Link from "next/link";
import type { ReportView } from "@/domain/assistant";
import type { DemoRole } from "@/lib/demo-identity";
import { assistantRequest } from "./api-client";
import styles from "./report.module.css";

type ReportAction = "generate" | "update" | "confirm";

export function ReportList({ initial, role, runId }: { initial: ReportView[]; role: DemoRole; runId: string }) {
  const [report, setReport] = useState<ReportView | null>(initial[0] || null);
  const [action, setAction] = useState<ReportAction | null>(null);
  const [error, setError] = useState("");

  async function generate() {
    if (action) return;
    setAction(report ? "update" : "generate");
    setError("");
    try {
      // 后端锁定当前任务；重复提交会复用原报告，不产生第二份。
      setReport(await assistantRequest<ReportView>("/api/ai-reports", { runId }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败，请稍后重试");
    } finally {
      setAction(null);
    }
  }

  async function confirm() {
    if (!report || action) return;
    setAction("confirm");
    setError("");
    try {
      // 确认本人刚看到的内容；其他访客更新过报告时，服务端会拒绝这次确认。
      setReport(await assistantRequest<ReportView>(`/api/ai-reports/${report.id}/confirm`, { expectedSourceHash: report.sourceHash }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "确认失败，请稍后重试");
      try {
        const current = await assistantRequest<ReportView[]>(`/api/ai-reports?runId=${encodeURIComponent(runId)}`);
        setReport(current[0] || null);
      } catch {
        // 保留已读内容和原错误，避免二次读取失败掩盖确认结果。
      }
    } finally {
      setAction(null);
    }
  }

  if (!report) return <section className={styles.empty} aria-busy={action !== null}>
    <span>当前任务 · 系统评测报告</span>
    <h2>尚未生成评测报告</h2>
    <p>系统会根据当前任务的指标、样本复核结论和适用限制整理报告。每个任务保留一份当前报告，来源变化后更新这份报告。</p>
    <p>报告不调用 AI，也不包含你与助手的私人聊天。生成后由评测人员核对并确认。</p>
    <button type="button" className="primary-button" disabled={action !== null} onClick={() => void generate()}>{action === "generate" ? "正在整理评测记录…" : "生成评测报告"}</button>
    {error && <p role="alert" className={styles.warning}>{error}</p>}
  </section>;

  const confirmed = report.status === "CONFIRMED";
  return <section className={styles.layout} aria-busy={action !== null}>
    <article className={styles.report}>
      <header>
        <div className={styles.headerMeta}><span className={styles.label}>当前任务 · 系统评测报告</span><span className={styles.status}>{report.isStale ? "来源已更新 · 待更新" : confirmed ? "人工已确认" : "待人工确认"}</span></div>
        <h2>{report.output.title}</h2>
        <p>系统根据任务记录整理 · 不调用 AI · 不包含私人聊天</p>
      </header>
      {report.isStale && <div className={styles.warning}>
        <p>任务来源已变化，当前报告还未包含最新记录。更新后会替换这份报告的内容，并重新进入待确认状态。</p>
        <button type="button" className="primary-button" disabled={action !== null} onClick={() => void generate()}>{action === "update" ? "正在更新评测记录…" : "更新当前报告"}</button>
      </div>}
      <section><h3>评测概况</h3><p>{report.output.summary}</p></section>
      <section><h3>指标记录</h3><div className={styles.tableWrap}><table><thead><tr><th>指标</th><th>场景</th><th>结果</th></tr></thead><tbody>{report.output.metrics.map((m, i) => <tr key={i}><td>{m.name}</td><td>{m.scenario}</td><td>{m.value} {m.unit}</td></tr>)}</tbody></table></div></section>
      <section><h3>样本复核</h3>{!report.output.findings.length ? <p>当前没有异常样本记录。</p> : <ul className={styles.findings}>{report.output.findings.map(f => <li key={f.sampleId}><Link href={`/anomalies/${f.sampleId}?runId=${report.runId}`}>{f.label} ↗</Link><span>{f.confirmed ? "已有人工结论" : "待人工核对"}</span><p>{f.conclusion}</p></li>)}</ul>}</section>
      <section><h3>适用边界</h3><ul>{report.output.limitations.map(l => <li key={l}>{l}</li>)}</ul></section>
      <footer>
        <p>最近整理：{new Date(report.updatedAt).toLocaleString("zh-CN")}</p>
        {report.confirmedAt && <p>确认时间：{new Date(report.confirmedAt).toLocaleString("zh-CN")}</p>}
        {!confirmed && (role === "REVIEWER" ? <button type="button" className="primary-button" disabled={action !== null || report.isStale} onClick={() => void confirm()}>{action === "confirm" ? "正在核对来源…" : "已核对证据，确认报告"}</button> : <p>报告由评测人员核对并确认。</p>)}
        {error && <p role="alert" className={styles.warning}>{error}</p>}
      </footer>
    </article>
  </section>;
}
