"use client";
// 各板块复用单选任务入口；删除需确认，服务端决定权限与可删除状态。
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Actor } from "@/domain/evaluation";
import { isActive } from "@/domain/evaluation";
import type { RunData } from "@/lib/evaluation-dto";
import { apiRequest, ClientError, errorText } from "@/lib/api-client";
const labels = { QUEUED: "排队中", RUNNING: "运行中", SUCCEEDED: "已完成", FAILED: "失败", CANCELLED: "已取消" };
export type TaskModule = "evaluations" | "comparisons" | "anomalies" | "reports" | "overview";
export const moduleLabels = { evaluations: "评测任务", comparisons: "模型对比", anomalies: "异常复核", reports: "报告", overview: "总览" };
export function taskHref(module: TaskModule, id: string) { return module === "evaluations" ? "/evaluations/" + encodeURIComponent(id) : "/" + module + "?runId=" + encodeURIComponent(id); }
export function TaskSelector({ initial, actor, module }: { initial: { data: RunData[]; total: number }; actor: Actor; module: TaskModule }) {
  const router = useRouter();
  const [list, setList] = useState(initial);
  const [selectedId, setSelectedId] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const deleteTrigger = useRef<HTMLButtonElement>(null);
  const safeAction = useRef<HTMLButtonElement>(null);
  const selected = list.data.find(r => r.id === selectedId);
  const resultsOnly = !["evaluations", "overview"].includes(module);
  const canDelete = selected && actor.role === "ENGINEER" && actor.id === selected.createdById && !selected.isDemoFixture && !isActive(selected.status);
  async function reload(nextPage: number): Promise<void> {
    // 分页读取含 meta 的统一响应，删除后重新查询，避免用旧列表猜测数据库状态。
    const response = await fetch("/api/evaluation-runs?page=" + nextPage + "&pageSize=20", { cache: "no-store" });
    const body: { data: RunData[]; meta: { total: number }; error?: { message: string; requestId?: string } } = await response.json();
    if (!response.ok) throw new ClientError(body.error?.message ?? "任务读取失败", response.status, body.error?.requestId);
    if (!body.data.length && nextPage > 1) return reload(nextPage - 1);
    setList({ data: body.data, total: body.meta.total }); setPage(nextPage); setSelectedId("");
  }
  async function remove() {
    if (!selected || !canDelete || busy) return;
    setBusy(true); setError("");
    try { await apiRequest("/api/evaluation-runs/" + selected.id, { method: "DELETE" }); await reload(page); dialog.current?.close(); router.refresh(); }
    catch (failure) { setError(errorText(failure)); }
    finally { setBusy(false); }
  }
  async function changePage(next: number) {
    setBusy(true); setError("");
    try { await reload(next); } catch (failure) { setError(errorText(failure)); } finally { setBusy(false); }
  }
  return <main className="content workflow-content selector-view">
    <p className="page-context">{moduleLabels[module]} / 01 选择评测任务</p>
    <div className="overview-heading"><div><h1>选择评测任务</h1><p className="muted">{resultsOnly ? "选择已完成的任务，查看本次" + moduleLabels[module] + "。" : "先选择任务，再查看执行状态与评测结果。"}</p></div></div>
    <fieldset className="task-selection" disabled={busy}><legend className="sr-only">{moduleLabels[module]}的评测任务</legend>
      <div className="task-selection-head" aria-hidden="true"><span>任务</span><span>模型 / 数据集</span><span>状态</span></div>
      {list.data.map(run => { const disabled = resultsOnly && run.status !== "SUCCEEDED"; return <label key={run.id} className={"task-selection-row" + (selectedId === run.id ? " is-selected" : "") + (disabled ? " is-unavailable" : "")}>
        <input type="radio" name="runId" value={run.id} checked={selectedId === run.id} onChange={() => setSelectedId(run.id)} />
        <span><strong>{run.name}</strong><small>{run.id} · {run.isDemoFixture ? "预置合成示例" : "新建模拟任务"}</small><small>{new Date(run.createdAt).toLocaleString("zh-CN")}</small></span>
        <span>{run.modelName} {run.modelVersion}<small>{run.datasetName} {run.datasetVersion}</small></span>
        <span>{labels[run.status]}{run.pendingReviewCount > 0 && <small className="risk-text">{run.pendingReviewCount} 条待复核 · 需评测人员复核</small>}{disabled && <small>结果尚不可用</small>}</span>
      </label>; })}
    </fieldset>
    {!list.data.length && <p className="task-list-empty">暂无任务。{actor.role === "ENGINEER" ? "可以先创建评测。" : "等待算法工程师创建评测。"}</p>}
    <p className="fine-print">共 {list.total} 条 · 第 {page} 页{list.total > 20 && <>　<button className="text-action" disabled={busy || page === 1} onClick={() => changePage(page - 1)}>上一页</button>　<button className="text-action" disabled={busy || page * 20 >= list.total} onClick={() => changePage(page + 1)}>下一页</button></>}</p>
    <div className="selection-toolbar"><p className="selection-summary" aria-live="polite">{selected ? "当前任务：" + selected.name : "尚未选择任务"}</p>
    {selected && resultsOnly && selected.status !== "SUCCEEDED" && <Link className="inline-link" href={"/evaluations/" + selected.id}>查看当前任务状态 ↗</Link>}
    {error && <p className="request-error" role="alert">{error}</p>}
    <div className="workflow-actions"><button className="primary-button" disabled={!selected || busy || resultsOnly && selected.status !== "SUCCEEDED"} onClick={() => selected && router.push(taskHref(module, selected.id))}>{!selected ? "请选择任务" : resultsOnly && selected.status !== "SUCCEEDED" ? "任务结果尚不可用" : "进入" + moduleLabels[module] + " →"}</button>
      {actor.role === "ENGINEER" && <><Link className="text-action" href="/evaluations/new">创建新评测 ＋</Link><button className="text-action risk-text" ref={deleteTrigger} disabled={!canDelete || busy} onClick={() => { dialog.current?.showModal(); safeAction.current?.focus(); }}>删除所选任务</button></>}</div>
    </div>
    {actor.role === "ENGINEER" && <p className="fine-print">仅能删除自己已结束的任务；进行中任务需先取消，预置示例受保护。</p>}
    <p className="fine-print">合成数据与模拟执行 · 侧栏进入板块时重新选择，正文下一步保留当前任务。</p>
    <dialog ref={dialog} className="confirm-dialog" aria-labelledby="delete-task-title" onCancel={e => { if (busy) e.preventDefault(); }} onClose={() => deleteTrigger.current?.focus()}>
      <h2 id="delete-task-title">删除这个任务？</h2><p>{selected?.name}</p><p className="muted">删除后从工作台隐藏。保留结果、复核、报告引用和审计；目前没有恢复入口。</p>
      <div className="workflow-actions"><button className="primary-button" disabled={busy} onClick={remove}>{busy ? "正在删除…" : "确认删除"}</button><button className="text-action" ref={safeAction} disabled={busy} onClick={() => dialog.current?.close()}>保留任务</button></div>{error && <p className="risk-text" role="alert">{error}</p>}
    </dialog>
  </main>;
}
