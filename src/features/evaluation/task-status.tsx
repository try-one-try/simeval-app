"use client";
// 状态由服务端同步并保存；页面刷新和导航恢复均读取同一任务，不伪造百分比。
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isActive, type Actor } from "@/domain/evaluation";
import type { RunData } from "@/lib/evaluation-dto";
import { apiRequest, ClientError, errorText } from "@/lib/api-client";
import { RunContext, RunResults } from "./run-context";
type StatusData = { status: RunData["status"] };
// Provider 不提供逐 Episode 进度：动效只表示活动，计时不推算完成百分比。
function ExecutionActivity({ run, paused, canCancel, onCancel, cancelRef, busy }: {
  run: RunData; paused: boolean; canCancel: boolean; onCancel: () => void;
  cancelRef: React.RefObject<HTMLButtonElement | null>; busy: boolean;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = now === null ? null : Math.max(0, Math.floor((now - Date.parse(run.createdAt)) / 1000));
  return <div className="execution-activity">
    <div className="execution-progress">
      <div className="execution-caption"><strong>{paused ? "状态同步已暂停" : run.status === "QUEUED" ? "等待模拟执行" : "正在模拟执行"}</strong><span>已用时间 · {seconds === null ? "计时中" : (seconds >= 60 ? Math.floor(seconds / 60) + " 分 " : "") + seconds % 60 + " 秒"}</span></div>
      <div className={"indeterminate-progress" + (paused ? " is-paused" : "")} role="progressbar" aria-label={paused ? "同步暂停，等待恢复" : "模拟任务尚未完成，暂无百分比进度"}><span /></div>
      <p className="fine-print">合成演示 · 自动同步状态；进度条不代表完成比例。</p>
    </div>
    {canCancel && <button ref={cancelRef} className="text-action" onClick={onCancel} disabled={busy}>取消任务</button>}
  </div>;
}
const labels = { QUEUED: "等待执行", RUNNING: "执行中", SUCCEEDED: "已完成", FAILED: "执行失败", CANCELLED: "已取消" };
export function TaskStatus({ initialRun, actor }: { initialRun: RunData; actor: Actor }) {
  const router = useRouter();
  const [run, setRun] = useState(initialRun);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  const retryKey = useRef<string | null>(null);
  const inFlight = useRef(false);
  const active = isActive(run.status);
  const canWrite = actor.role === "ENGINEER" && actor.id === run.createdById;
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await apiRequest<StatusData>("/api/evaluation-runs/" + initialRun.id + "/sync", { method: "POST", signal });
      const latest = await apiRequest<RunData>("/api/evaluation-runs/" + initialRun.id, { signal });
      setRun((current) => isActive(current.status) ? latest : current); setError("");
    } catch (failure) { if (!signal?.aborted) setError(errorText(failure)); }
    finally { inFlight.current = false; }
  }, [initialRun.id]);
  useEffect(() => {
    if (!active || error || confirming) return;
    const controller = new AbortController();
    const timer = setInterval(() => { void refresh(controller.signal); }, 1500);
    return () => { clearInterval(timer); controller.abort(); };
  }, [active, error, confirming, refresh]);
  async function cancel() {
    setBusy(true); setError("");
    try {
      setRun(await apiRequest<RunData>("/api/evaluation-runs/" + run.id + "/cancel", { method: "POST" }));
      dialog.current?.close();
    } catch (failure) {
      setError(errorText(failure));
      if (failure instanceof ClientError && failure.status === 409) {
        try { setRun(await apiRequest<RunData>("/api/evaluation-runs/" + run.id)); } catch { /* 保留原冲突信息，用户可重新连接。 */ }
        dialog.current?.close();
      }
    } finally { setBusy(false); }
  }
  async function retry() {
    setBusy(true); setError("");
    retryKey.current ??= crypto.randomUUID();
    try {
      const next = await apiRequest<RunData>("/api/evaluation-runs/" + run.id + "/retry", { method: "POST", headers: { "Idempotency-Key": retryKey.current } });
      router.push("/evaluations/" + next.id);
    } catch (failure) { setError(errorText(failure)); setBusy(false); }
  }
  const title = run.status === "QUEUED" ? "模拟评测等待执行" : active ? "模拟评测执行中" : run.status === "SUCCEEDED" ? "模拟评测已完成" : run.status === "FAILED" ? "模拟评测未完成" : "本次模拟评测已取消";
  const conclusion = active ? "任务尚未完成，结果暂不可用。" : run.status === "SUCCEEDED" ? "本次结果已保存，请核对达标情况与异常证据。" : run.status === "FAILED" ? "模拟执行失败，本次未生成结果。" : "任务已停止，本次没有可用于对比的结果。";
  return <section className="content workflow-content task-view">
    <RunContext run={run} href="/evaluations" /><div className="page-context">评测任务 / {run.status}<span>已保存的任务状态</span></div>
    <div className="overview-heading" aria-live="polite"><div><h1>{title}</h1><p className="muted">{run.modelName} {run.modelVersion} · {run.datasetName} {run.datasetVersion}</p></div><div className="overview-status"><strong>{run.status} · {labels[run.status]}</strong><p className="muted">Mock Provider · 合成数据</p></div></div>
    <div className="conclusion"><p>{run.status === "FAILED" ? "失败原因 · 故障演示" : "任务判断"}</p><h2>{conclusion}</h2><p className="muted">{run.errorMessage ?? (run.status === "SUCCEEDED" ? "指标与 " + run.anomalyCount + " 条异常记录已保存，可继续查看结果与异常证据。" : active ? "状态会自动同步；退出页面不会删除任务。" : "记录保留，如需再次评测，请重新配置。")}</p></div>
    {error && <div role="alert" className="request-error"><p>{error}</p>{active && <button className="text-action inline-link" disabled={busy} onClick={() => { void refresh(); }}>重新连接 ↗</button>}<Link href="/" className="inline-link">重新进入演示 ↗</Link></div>}
    {active && <ExecutionActivity run={run} paused={!!error || confirming} canCancel={canWrite && !run.isDemoFixture} cancelRef={cancelButton} busy={busy} onCancel={() => { dialog.current?.showModal(); setConfirming(true); continueButton.current?.focus(); }} />}
    <RunResults run={run} />
    <h2 className="section-title">任务进度</h2>
    <ol className="task-stages"><li aria-current={run.status === "QUEUED" ? "step" : undefined}><strong>01 QUEUED</strong><span>任务已保存</span></li><li aria-current={run.status === "RUNNING" ? "step" : undefined}><strong>02 RUNNING</strong><span>{run.startedAt ? "已开始执行" : "尚未执行"}</span></li><li aria-current={!active ? "step" : undefined}><strong>03 {active ? "结果" : run.status}</strong><span>{run.status === "SUCCEEDED" ? "结果已保存" : active ? "尚未生成结果" : "未生成本次结果"}</span></li></ol>
    <dl className="task-facts"><div><dt>Benchmark</dt><dd>{run.benchmarkName} {run.benchmarkVersion}</dd></div><div><dt>Episode 数量</dt><dd>{run.episodeCount}</dd></div><div><dt>模拟 Seed</dt><dd>{run.simulationSeed}</dd></div></dl>
    <dl className="facts mobile-task-facts">{active && <div><dt>模型</dt><dd>{run.modelName} {run.modelVersion}</dd></div>}<div><dt>Episode</dt><dd>{run.episodeCount}</dd></div>{!active && <div><dt>模拟 Seed</dt><dd>{run.simulationSeed}</dd></div>}<div><dt>进度</dt><dd>已排队 → {run.status === "QUEUED" ? "等待执行" : run.status === "RUNNING" ? "执行中" : run.status === "CANCELLED" ? "已取消" : run.status === "FAILED" ? "执行失败" : "已执行"} → {run.status === "SUCCEEDED" ? "已生成结果" : "无结果"}</dd></div></dl>
    <div className="workflow-actions">
      {!active && (run.status === "FAILED" && canWrite && !run.isDemoFixture ? <><button className="primary-button" onClick={retry} disabled={busy}>{busy ? "正在创建…" : "创建重试任务 →"}</button><Link className="text-action" href="/evaluations/new">重新配置 ↗</Link></>
        : run.status === "SUCCEEDED" ? <><Link className="primary-button" href={(actor.role === "ENGINEER" ? "/comparisons" : "/anomalies") + "?runId=" + run.id}>{actor.role === "ENGINEER" ? "进入模型对比 →" : "进入异常复核 →"}</Link>{actor.role === "ENGINEER" && <Link className="text-action" href="/evaluations/new">新建评测 ↗</Link>}</>
        : actor.role === "ENGINEER" ? <Link className="primary-button" href="/evaluations/new">重新配置评测 →</Link> : <Link className="primary-button" href="/evaluations">返回评测任务 →</Link>)}
    </div>
    {run.retryOfRunId && <p className="fine-print">这是独立的重试任务；<Link className="inline-link" href={"/evaluations/" + run.retryOfRunId}>查看原失败记录 ↗</Link></p>}
    <details className="recent-runs"><summary>任务记录</summary><p>{run.name}</p><p>创建时间：{new Date(run.createdAt).toLocaleString("zh-CN")}</p><p>任务编号：{run.id}</p><p>模型：{run.modelName} {run.modelVersion}；数据集：{run.datasetName} {run.datasetVersion}</p><p>Benchmark：{run.benchmarkName} {run.benchmarkVersion}；{run.episodeCount} Episode；Seed {run.simulationSeed}</p><p>合成数据 · {run.provider}</p></details>
    {/* 取消需确认；原生 dialog 管理焦点与 Escape，关闭后恢复原按钮焦点。 */}
    <dialog className="confirm-dialog" ref={dialog} aria-labelledby="cancel-title" onCancel={(event) => { if (busy) event.preventDefault(); }} onClose={() => { setConfirming(false); cancelButton.current?.focus(); }}>
      <p className="eyebrow">任务操作</p><h2 id="cancel-title">确认取消本次模拟评测？</h2><p className="muted">取消后保留任务记录，但不会生成本次结果。如果任务已完成，服务端会拒绝取消。</p><div className="workflow-actions"><button className="primary-button" disabled={busy} onClick={cancel}>{busy ? "正在取消…" : "确认取消"}</button><button ref={continueButton} autoFocus className="text-action" disabled={busy} onClick={() => dialog.current?.close()}>继续等待</button></div>{error && <p role="alert" className="risk-text">{error}</p>}
    </dialog>
  </section>;
}
