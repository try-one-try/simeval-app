"use client";

// assistant-ui 管理对话和中止状态；适配器只发送新问题，服务端自行组装可信历史。
import { AssistantRuntimeProvider, useLocalRuntime, useAuiState, useAui, type ChatModelAdapter, type ThreadMessageLike } from "@assistant-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { ArrowUp, Square, ChevronDown, ExternalLink } from "lucide-react";
import type { AssistantEvent, SessionView, ToolTrace, TurnView } from "@/domain/assistant";
import { assistantContent } from "./content";
import { getFollowUpSuggestions } from "./follow-up";
import styles from "./assistant.module.css";

export function Conversation({ session, turns, sampleId, onActivity, onSaved }: {
  session: SessionView; turns: TurnView[]; sampleId: string | null; onActivity: (busy: boolean) => void; onSaved: () => void;
}) {
  const latest = useRef({ sampleId, onSaved });
  useEffect(() => { latest.current = { sampleId, onSaved }; }, [sampleId, onSaved]);
  const activeRequest = useRef<AbortController | null>(null);
  useEffect(() => () => activeRequest.current?.abort(), []);
  const adapter = useMemo<ChatModelAdapter>(() => ({
    async *run({ messages, abortSignal }) {
      const question = messages.filter(m => m.role === "user").at(-1)?.content.filter(p => p.type === "text").map(p => p.text).join("\n") || "";
      const localAbort = new AbortController(); activeRequest.current = localAbort;
      const signal = AbortSignal.any([abortSignal, localAbort.signal]);
      let turnId: string | null = null, text = "";
      const traces: ToolTrace[] = [];
      const stop = () => { if (turnId) void fetch(`/api/assistant/sessions/${session.id}/turns/${turnId}/stop`, { method: "POST", keepalive: true }).catch(() => {}); };
      signal.addEventListener("abort", stop, { once: true });
      try {
        const response = await fetch(`/api/assistant/sessions/${session.id}/messages`, { method: "POST", signal, headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, sampleId: latest.current.sampleId, requestKey: crypto.randomUUID() }) });
        if (!response.ok) { const result = await response.json(); throw new Error(result.error?.message || "助手暂时不可用"); }
        if (!response.body) throw new Error("浏览器未收到响应，请重试");
        const reader = response.body.getReader(), decoder = new TextDecoder();
        let buffered = "", doneEvent = false;
        try {
          while (true) {
            const next = await reader.read();
            buffered += decoder.decode(next.value, { stream: !next.done });
            let newline: number;
            while ((newline = buffered.indexOf("\n")) >= 0) {
              const line = buffered.slice(0, newline); buffered = buffered.slice(newline + 1);
              if (!line) continue;
              const event = JSON.parse(line) as AssistantEvent;
              if (event.type === "start") turnId = event.turnId;
              if (event.type === "error") throw new Error(event.message);
              if (event.type === "trace") { const i = traces.findIndex(t => t.id === event.trace.id); if (i < 0) traces.push(event.trace); else traces[i] = event.trace; }
              if (event.type === "text") text += event.delta;
              if (event.type === "done") {
                doneEvent = true;
                const turn = event.turn;
                yield { content: [{ type: "text", text: turn.status === "SUCCEEDED" ? turn.answer || "" : turn.status === "RUNNING" ? "这条请求仍在处理中，请稍后从历史恢复。" : turn.errorMessage || "本轮未完成" }], metadata: { custom: { turn, traces: turn.traces } } };
              } else yield { content: [{ type: "text", text }], metadata: { custom: { traces: [...traces] } } };
            }
            if (next.done) break;
          }
          if (!doneEvent) throw new Error("连接提前结束，请从历史检查本轮状态");
        } finally { reader.releaseLock(); }
      } catch (error) {
        if (signal.aborted) throw error;
        yield { content: [{ type: "text", text: error instanceof Error ? error.message : "请求暂时失败，请稍后重试" }], metadata: { custom: { failed: true, traces } } };
      } finally {
        signal.removeEventListener("abort", stop); activeRequest.current = null; latest.current.onSaved();
      }
    },
  }), [session.id]);
  const initialMessages = useMemo<ThreadMessageLike[]>(() => turns.flatMap(turn => [
    { id: `${turn.id}-q`, role: "user", content: [{ type: "text", text: turn.question }] },
    { id: turn.id, role: "assistant", content: [{ type: "text", text: turn.answer || turn.errorMessage || "这一轮尚未完成，请稍后刷新历史" }], metadata: { custom: { turn, traces: turn.traces } } },
  ]), [turns]);
  const runtime = useLocalRuntime(adapter, { initialMessages, maxSteps: 1 });
  return <AssistantRuntimeProvider runtime={runtime}><ConversationBody session={session} onActivity={onActivity} /></AssistantRuntimeProvider>;
}

function ToolLog({ traces }: { traces: ToolTrace[] }) {
  if (!traces.length) return null;
  return <details className={styles.toolLog} open={traces.some(t => t.status === "running")}>
    <summary><span className={styles.toolDot} />{traces.some(t => t.status === "running") ? "正在查询证据" : `${traces.length} 次工具调用`}<ChevronDown size={13} /></summary>
    <ol>{traces.map(trace => <li key={trace.id}><div><strong>{trace.label}</strong><span>{trace.status === "running" ? "进行中" : trace.status === "error" ? "未成功" : `${trace.durationMs} ms`}</span></div><p>{trace.summary}</p><code>{trace.tool}({trace.input === "{}" ? "" : trace.input})</code></li>)}</ol>
  </details>;
}
function AnswerExtras({ turn }: { turn: TurnView }) {
  return <>
    {turn.stale && <p className={styles.warning}>来源已更新，这是历史回答；请重新提问核对当前记录。</p>}
    {turn.evidence.length > 0 && <div className={styles.evidenceList}>{turn.evidence.map(e => <Link key={e.id} href={e.href} className={styles.evidenceCard}><span>{e.id}</span><div><strong>{e.title}</strong><small>{e.summary}</small></div><ExternalLink size={12} /></Link>)}</div>}
    <p className={styles.usage}>{turn.model} · {turn.inputTokens === null ? "用量未返回" : `${turn.inputTokens + (turn.outputTokens || 0)} tokens`} · {new Date(turn.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</p>
  </>;
}
function FollowUpQuestions({ turn, session, disabled, onSelect }: {
  turn: TurnView; session: SessionView; disabled: boolean; onSelect: (prompt: string) => void;
}) {
  const suggestions = getFollowUpSuggestions(turn, session);
  if (!suggestions.length) return null;
  return <div className={styles.followUps} role="group" aria-label={assistantContent.followUpLabel}>
    <p className={styles.followUpLabel}>{assistantContent.followUpLabel}<span>{assistantContent.followUpHint}</span></p>
    <div className={styles.followUpButtons}>{suggestions.map(item => <button key={item.prompt} type="button" disabled={disabled}
      title={item.prompt} aria-label={`将问题填入输入框：${item.prompt}`} onClick={() => onSelect(item.prompt)}>{item.title}</button>)}</div>
  </div>;
}
function ConversationBody({ session, onActivity }: { session: SessionView; onActivity: (busy: boolean) => void }) {
  const messages = useAuiState(s => s.thread.messages), running = useAuiState(s => s.thread.isRunning);
  const runtime = useAui();
  const [draft, setDraft] = useState("");
  const viewport = useRef<HTMLDivElement>(null), follow = useRef(true), input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { onActivity(running); return () => onActivity(false); }, [running, onActivity]);
  useEffect(() => { if (follow.current && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight; }, [messages, running]);
  // 快捷问题只填进输入框；访客可以改写，再自行点击发送。
  function prefill(prompt: string) {
    if (running) return;
    setDraft(prompt); input.current?.focus({ preventScroll: true });
  }
  function send() {
    if (!draft.trim() || running) return;
    follow.current = true; runtime.thread.append({ role: "user", content: [{ type: "text", text: draft.trim() }] }); setDraft("");
  }
  return <>
    <div className={styles.chatBody} ref={viewport} onScroll={() => { const e = viewport.current; if (e) follow.current = e.scrollHeight - e.scrollTop - e.clientHeight < 100; }}>
      {!messages.length && <div className={styles.chatWelcome}><span className={styles.eyebrow}>LET’S INVESTIGATE</span><h3>从一个问题开始。</h3><p>围绕「{session.runName}」查询指标、异常与证据。</p><div className={styles.suggestions}>{assistantContent.suggestions.map(item => <button key={item.title} type="button" onClick={() => prefill(item.prompt)}><span><strong>{item.title}</strong><small>{item.description}</small></span><ArrowUp size={14} /></button>)}</div></div>}
      {messages.map(message => {
        const metadata = message.metadata.custom;
        const turn = metadata.turn as TurnView | undefined;
        const traces = (metadata.traces || []) as ToolTrace[];
        const text = message.content.filter(p => p.type === "text").map(p => p.text).join("");
        return <article key={message.id} className={message.role === "user" ? styles.userMessage : styles.assistantMessage}>
          <p className={styles.messageLabel}>{message.role === "user" ? "你" : "SIMEVAL 助手"}</p>
          {message.role === "assistant" && <ToolLog traces={traces} />}
          <div className={styles.markdown}><ReactMarkdown skipHtml components={{ a: ({ children }) => <span>{children}</span>, img: () => null }}>{text || (running ? "正在分析…" : "本轮已停止")}</ReactMarkdown></div>
          {message.role === "assistant" && !turn && <p className={styles.usage}>{running ? "生成中，引用尚待核对" : metadata.failed ? "未完成 · 可修改问题后重新发送" : "本轮未完整结束 · 可从历史核对"}</p>}
          {turn && <AnswerExtras turn={turn} />}
          {message.role === "assistant" && turn && <FollowUpQuestions turn={turn} session={session} disabled={running} onSelect={prefill} />}
        </article>;
      })}
    </div>
    <form className={styles.composerArea} onSubmit={e => { e.preventDefault(); send(); }}>
      <div className={styles.composer}>
        <textarea ref={input} aria-label="向评测助手提问" value={draft} rows={2} maxLength={2000} placeholder="这次评测有什么值得关注？" onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
        <div className={styles.composerTools}><span>{running ? "正在分析，可随时停止" : "Enter 发送 · Shift + Enter 换行"}</span>{running ? <button type="button" onClick={() => runtime.thread.cancelRun()} aria-label="停止分析"><Square size={14} /></button> : <button type="submit" disabled={!draft.trim()} aria-label="发送问题"><ArrowUp size={18} /></button>}</div>
      </div><p className={styles.disclosure}>合成演示数据 · AI 分析需人工核对 · 聊天仅当前登录可见</p>
    </form>
  </>;
}
