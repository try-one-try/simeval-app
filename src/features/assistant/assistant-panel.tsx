"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Maximize2, Minimize2, Minus, Plus, History, ArrowRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AssistantAvatar } from "./assistant-avatar";
import { Conversation } from "./conversation";
import { assistantRequest } from "./api-client";
import { assistantContent as content } from "./content";
import type { SessionView, TurnView } from "@/domain/assistant";
import type { RunData, RunSummaryData } from "@/lib/evaluation-dto";
import type { DemoRole } from "@/lib/demo-identity";
import styles from "./assistant.module.css";

type ConversationData = { session: SessionView; turns: TurnView[] };
export default function AssistantPanel({ opened, onClose, role, onActivity }: { opened: boolean; onClose: () => void; role: DemoRole; onActivity: (busy: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [expanded, setExpanded] = useState(false), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [sessions, setSessions] = useState<SessionView[]>([]), [conversation, setConversation] = useState<ConversationData | null>(null), [showHistory, setShowHistory] = useState(false);
  const [runs, setRuns] = useState<RunSummaryData[]>([]), [chosenRun, setChosenRun] = useState("");
  const pathname = usePathname(), params = useSearchParams();
  const pathRun = /^\/evaluations\/([^/]+)$/.exec(pathname)?.[1];
  const pageRunId = params.get("runId") || (pathRun && pathRun !== "new" ? pathRun : null);
  const pageSampleId = /^\/anomalies\/([^/]+)$/.exec(pathname)?.[1] || null;
  const selectedRun = runs.find(r => r.id === pageRunId);
  // 普通证据页没有基线参数时继续原上下文；显式“不比较”才清空基线。
  const baselineRunId = role === "ENGINEER" ? params.has("baselineRunId") ? params.get("baselineRunId") || null : (pathname === "/comparisons" || !!pathRun) ? selectedRun?.baselineRunId || null : conversation?.session.runId === pageRunId ? conversation.session.baselineRunId : null : null;
  const pageChanged = !!conversation && !!pageRunId && (conversation.session.runId !== pageRunId || conversation.session.baselineRunId !== baselineRunId);
  const activity = useCallback((value: boolean) => { setBusy(value); onActivity(value); }, [onActivity]);
  const refreshSessions = useCallback(() => { void assistantRequest<SessionView[]>("/api/assistant/sessions").then(setSessions).catch(() => {}); }, []);

  useEffect(() => {
    const element = dialog.current; if (!element) return;
    const media = window.matchMedia("(max-width: 600px)");
    const sync = () => { element.close(); if (opened) { if (media.matches || expanded) element.showModal(); else element.show(); } };
    sync(); media.addEventListener("change", sync);
    return () => { media.removeEventListener("change", sync); element.close(); };
  }, [opened, expanded]);
  useEffect(() => {
    const abort = new AbortController();
    void Promise.all([assistantRequest<SessionView[]>("/api/assistant/sessions", undefined, abort.signal), assistantRequest<RunSummaryData[]>("/api/evaluation-runs?status=SUCCEEDED&pageSize=100", undefined, abort.signal)])
      .then(async ([history, tasks]) => { setSessions(history); setRuns(tasks); if (history[0]) setConversation(await assistantRequest<ConversationData>(`/api/assistant/sessions/${history[0].id}`, undefined, abort.signal)); })
      .catch(e => { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : "助手加载失败"); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    if (!opened || !pageRunId) return;
    // 收起时不跟着切页查库；打开后再读当前任务，兼顾页面速度和最新任务状态。
    const abort = new AbortController();
    void assistantRequest<RunData>(`/api/evaluation-runs/${encodeURIComponent(pageRunId)}`, undefined, abort.signal)
      .then(run => { if (run.status === "SUCCEEDED") setRuns(items => [run, ...items.filter(r => r.id !== run.id)]); })
      .catch(() => {});
    return () => abort.abort();
  }, [opened, pageRunId]);
  async function create(runId: string, baseline: string | null) {
    if (!runId || busy) return; setLoading(true); setError("");
    try { const session = await assistantRequest<SessionView>("/api/assistant/sessions", { runId, baselineRunId: baseline }); setConversation({ session, turns: [] }); setShowHistory(false); refreshSessions(); }
    catch (e) { setError(e instanceof Error ? e.message : "创建失败"); } finally { setLoading(false); }
  }
  async function restore(id: string) {
    if (busy) return; setLoading(true); setError("");
    try { setConversation(await assistantRequest<ConversationData>(`/api/assistant/sessions/${id}`)); setShowHistory(false); }
    catch (e) { setError(e instanceof Error ? e.message : "历史读取失败"); } finally { setLoading(false); }
  }
  return <dialog ref={dialog} id="simeval-assistant" className={styles.panel} data-expanded={expanded} aria-labelledby="assistant-title"
    onCancel={e => { e.preventDefault(); onClose(); }} onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); onClose(); } }}>
    <header className={styles.panelHeader}>
      <div className={styles.identity}><span className={styles.miniAvatar}><AssistantAvatar compact /></span><div><h2 id="assistant-title">{content.name}</h2><p><span className={styles.statusDot} />{busy ? "正在调查证据…" : "评测调查 · 有据可查"}</p></div></div>
      <div className={styles.headerActions}>
        <button type="button" title="聊天历史" aria-label="聊天历史" disabled={busy || loading} onClick={() => { if (showHistory && conversation) void restore(conversation.session.id); else setShowHistory(!showHistory); refreshSessions(); }}><History size={17} /></button>
        <button type="button" title="新建对话" aria-label="新建对话" disabled={busy} onClick={() => { setConversation(null); setShowHistory(false); setError(""); }}><Plus size={18} /></button>
        <button type="button" title="调整窗口大小" aria-label={expanded ? "恢复小窗口" : "放大助手"} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
        <button type="button" aria-label="收起助手" onClick={onClose} autoFocus><Minus size={20} /></button>
      </div>
    </header>
    {conversation && <div className={styles.boundContext}><strong>{conversation.session.runName}</strong><span>{conversation.session.baselineName ? `基线：${conversation.session.baselineName}` : "独立分析 · 未绑定比较基线"}</span></div>}
    {pageChanged && <div className={styles.contextNotice}><span>页面已切换，当前聊天仍保留原任务。</span><button type="button" disabled={busy || loading} onClick={() => void create(pageRunId!, baselineRunId)}>分析本页 ↗</button></div>}
    {error && <div className={styles.errorBox} role="alert"><p>{error}</p><Link href="/login">重新进入工作台 ↗</Link></div>}
    {showHistory ? <div className={styles.chatBody}><h3 className={styles.sectionTitle}>本次登录的对话</h3>{!sessions.length && <p className={styles.empty}>还没有对话。</p>}{sessions.map(s => <button className={styles.historyItem} key={s.id} type="button" disabled={loading} onClick={() => void restore(s.id)}><strong>{s.title}</strong><span>{s.runName}</span><small>{new Date(s.updatedAt).toLocaleString("zh-CN")}</small></button>)}</div>
      : loading ? <div className={styles.empty} role="status">正在读取对话…</div>
      : conversation ? <Conversation key={conversation.session.id + conversation.turns.length} session={conversation.session} turns={conversation.turns} sampleId={pageRunId === conversation.session.runId ? pageSampleId : null} onActivity={activity} onSaved={refreshSessions} />
      : <div className={styles.panelBody}><section className={styles.welcome}><div className={styles.welcomeAvatar}><AssistantAvatar compact /></div><p className={styles.eyebrow}>A LITTLE HELP, MORE CLARITY</p><h3>{content.greeting}</h3><p className={styles.introduction}>先选一项已完成的评测，我会带着证据回答。</p></section>
        {selectedRun && <button type="button" className={styles.analyzePage} onClick={() => void create(selectedRun.id, baselineRunId)}>分析本页：{selectedRun.name}<ArrowRight size={17} /></button>}
        <label className={styles.taskLabel}>或选择一个任务<select value={chosenRun} onChange={e => setChosenRun(e.target.value)}><option value="">选择评测任务</option>{runs.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        <button type="button" className={styles.beginButton} disabled={!chosenRun} onClick={() => void create(chosenRun, null)}>开始调查 <ArrowRight size={15} /></button>
        <p className={styles.empty}>比较分析请先到模型对比页选好基线，再点击“分析本页”。聊天只在当前登录期间可恢复。</p>
      </div>}
  </dialog>;
}
