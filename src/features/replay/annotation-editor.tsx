"use client";
import { useRef, useState } from "react";
import type { ReplayAnnotation, ReplayAnnotations, ReplayManifest } from "@/lib/replay-dto";
import { apiRequest, ClientError, errorText } from "@/lib/api-client";
import { replaySaveSchema, validateReplayAnnotations, replayTime, replayPresetAnnotations } from "@/domain/replay";
import styles from "./replay.module.css";

// 编辑草稿与已保存记录分开；发生冲突后先展示最新版本，再由用户决定是否继续保存。
export function AnnotationEditor({ manifest, currentFrame, saved, onSaved, onOpen }: {
  manifest: ReplayManifest; currentFrame: number; saved: ReplayAnnotations; onSaved: (value: ReplayAnnotations) => void; onOpen: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState<ReplayAnnotation[]>([]), [version, setVersion] = useState(saved.version);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [conflict, setConflict] = useState(false);
  const [latest, setLatest] = useState<ReplayAnnotations | null>(null), [reviewed, setReviewed] = useState(false), [message, setMessage] = useState("");
  const endpoint = `/api/replay/episodes/${manifest.id}/annotations`;
  function open() { onOpen(); setDraft(saved.annotations.map(a => ({ ...a }))); setVersion(saved.version); setError(""); setConflict(false); setLatest(null); setReviewed(false); dialog.current?.showModal(); }
  function add() { setDraft(items => [...items, { id: crypto.randomUUID(), label: "", note: "", startFrame: currentFrame, endFrame: Math.min(manifest.frameCount, currentFrame + manifest.fps * 3) }]); }
  function update(id: string, values: Partial<ReplayAnnotation>) { setDraft(items => items.map(item => item.id === id ? { ...item, ...values } : item)); }
  async function save() {
    if (busy) return;
    setError("");
    const parsed = replaySaveSchema.safeParse({ expectedVersion: version, annotations: draft });
    if (!parsed.success) { setError("请填写阶段名称，使用整数帧编号；说明不超过 1000 字，最多 100 个阶段。"); return; }
    try { validateReplayAnnotations(parsed.data, manifest.frameCount); }
    catch (e) { setError(e instanceof Error ? e.message : "请检查帧范围"); return; }
    setBusy(true);
    try {
      const result = await apiRequest<ReplayAnnotations>(endpoint, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      onSaved(result); setMessage("人工标注已保存，修改记录已保留。"); dialog.current?.close();
    } catch (e) { setError(errorText(e)); if (e instanceof ClientError && e.status === 409) { setConflict(true); setLatest(null); setReviewed(false); } }
    finally { setBusy(false); }
  }
  async function loadLatest() {
    setBusy(true);
    try { const data = await apiRequest<ReplayAnnotations>(endpoint); setLatest(data); onSaved(data); setVersion(data.version); setReviewed(false); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <>
    <button ref={trigger} className={styles.smallButton} onClick={open}>修改标注</button>
    {message && <span className={styles.srOnly} role="status">{message}</span>}
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="annotation-title" onClose={() => trigger.current?.focus()} onCancel={e => { if (busy) e.preventDefault(); }}>
      <header><div><h2 id="annotation-title">编辑人工阶段标注</h2><p>原始数据保持只读 · 当前保存版本 {version}</p></div><button className={styles.smallButton} disabled={busy} onClick={() => dialog.current?.close()}>关闭 ×</button></header>
      <p className={styles.hint}>按帧定位：开始帧包含、结束帧不包含。范围 0–{manifest.frameCount}，每秒 {manifest.fps} 帧；允许阶段重叠。</p>
      <fieldset disabled={busy} className={styles.editorFields}>
        {draft.length === 0 && <p className={styles.empty}>尚未添加人工标注，可从当前时间创建一个阶段。</p>}
        {draft.map((item, index) => <section className={styles.editRow} key={item.id}>
          <div className={styles.editHeading}><strong>阶段 {index + 1}</strong><button type="button" className="text-action" onClick={() => setDraft(items => items.filter(a => a.id !== item.id))}>移除此段</button></div>
          <label>阶段名称<input value={item.label} maxLength={80} onChange={e => update(item.id, { label: e.target.value })} placeholder="根据画面填写，不预设机器人动作" /></label>
          <div className={styles.frameFields}><label>开始帧<input type="number" min={0} max={manifest.frameCount-1} step={1} value={Number.isNaN(item.startFrame) ? "" : item.startFrame} onChange={e => update(item.id, { startFrame: e.target.valueAsNumber })} /><span>{Number.isFinite(item.startFrame) ? replayTime(item.startFrame / manifest.fps) : "—"}</span></label>
          <label>结束帧<input type="number" min={1} max={manifest.frameCount} step={1} value={Number.isNaN(item.endFrame) ? "" : item.endFrame} onChange={e => update(item.id, { endFrame: e.target.valueAsNumber })} /><span>{Number.isFinite(item.endFrame) ? replayTime(item.endFrame / manifest.fps) : "—"}</span></label></div>
          <label>标注说明<textarea rows={2} maxLength={1000} value={item.note} onChange={e => update(item.id, { note: e.target.value })} /></label>
        </section>)}
        <button className={styles.smallButton} type="button" disabled={draft.length >= 100} onClick={add}>＋ 从当前帧添加阶段</button>
        {draft.length === 0 && <button className={styles.smallButton} type="button" onClick={() => setDraft(replayPresetAnnotations(manifest.frameCount, manifest.fps))}>载入四段预设</button>}
      </fieldset>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {conflict && <button disabled={busy} className={styles.smallButton} onClick={loadLatest}>读取最新标注，保留我的草稿</button>}
      {latest && <div className={styles.conflict}><strong>最新版本 {latest.version}</strong>{latest.annotations.length ? latest.annotations.map(a => <p key={a.id}>{a.label} · {a.startFrame}–{a.endFrame} 帧<br />{a.note}</p>) : <p>最新版本暂无人工标注</p>}
        <label><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />我已核对，上方草稿将替换这组人工标注</label></div>}
      <footer><button className="primary-button" disabled={busy || (conflict && (!latest || !reviewed))} onClick={save}>{busy ? "正在保存…" : "保存标注"}</button><button className={styles.smallButton} disabled={busy} onClick={() => dialog.current?.close()}>取消</button></footer>
    </dialog>
  </>;
}
