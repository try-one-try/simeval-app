"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ArrowUp, ChevronRight, Maximize2, Minimize2, Minus, PanelTop, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AssistantAvatar } from "./assistant-avatar";
import { assistantContent as content } from "./content";
import styles from "./assistant.module.css";

/** 入口预览只显示静态说明、保留问题草稿。真实对话稍后由独立运行层接入。 */
export default function AssistantPanel({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const pathname = usePathname();
  const publicPage = pathname === "/" || pathname === "/login";

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const media = window.matchMedia("(max-width: 600px)");
    // 桌面允许一边看任务一边聊天；手机与放大模式用原生模态框管理焦点。
    const sync = () => {
      element.close();
      if (opened) {
        if (media.matches || expanded) element.showModal();
        else element.show();
      }
    };
    sync();
    media.addEventListener("change", sync);
    return () => { media.removeEventListener("change", sync); element.close(); };
  }, [opened, expanded]);

  function chooseQuestion(question: string) {
    setDraft(question);
    input.current?.focus();
  }

  return <dialog ref={dialog} id="simeval-assistant" className={styles.panel} data-expanded={expanded}
    aria-labelledby="assistant-title" onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); onClose(); } }}>
    <header className={styles.panelHeader}>
      <div className={styles.identity}><span className={styles.miniAvatar}><AssistantAvatar compact /></span>
        <div><h2 id="assistant-title">{content.name}</h2><p><span className={styles.statusDot} />{content.status}</p></div>
      </div>
      <div className={styles.headerActions}>
        <button type="button" aria-label={expanded ? "恢复小窗口" : "放大助手"} title={expanded ? "恢复小窗口" : "放大助手"} onClick={() => setExpanded(value => !value)}>{expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
        <button type="button" aria-label="收起助手" title="收起助手（Esc）" onClick={onClose} autoFocus><Minus size={20} /></button>
      </div>
    </header>
    <div className={styles.context}><PanelTop size={14} aria-hidden="true" /><span>{publicPage ? "产品导览" : "工作台导览"}</span><span className={styles.contextLabel}>尚未绑定评测任务</span></div>
    <div className={styles.panelBody}>
      <section className={styles.welcome}>
        <div className={styles.welcomeAvatar}><AssistantAvatar compact /></div>
        <p className={styles.eyebrow}>A LITTLE HELP, MORE CLARITY</p>
        <h3>{content.greeting}</h3><p className={styles.introduction}>{content.introduction}</p>
      </section>
      <section className={styles.suggestions} aria-label="示例问题，点击填入输入框">
        {content.suggestions.map((item, index) => <button type="button" key={item.title} onClick={() => chooseQuestion(item.prompt)}>
          <span className={styles.questionNumber}>0{index + 1}</span><span><strong>{item.title}</strong><small>{item.description}</small></span><ChevronRight size={16} aria-hidden="true" />
        </button>)}
      </section>
      <details className={styles.guide}><summary>这个项目怎样使用？<span>产品说明</span></summary><p>{content.guide}</p>
        <Link href={publicPage ? "/login" : "/evaluations"} onClick={onClose}>{publicPage ? "进入工作台" : "查看评测任务"}<ArrowRight size={14} aria-hidden="true" /></Link>
      </details>
    </div>
    <footer className={styles.composerArea}>
      <div className={styles.previewNote}><Sparkles size={14} aria-hidden="true" /><p>先看看布局。示例问题只填入输入框，不会发送。</p></div>
      <div className={styles.composer}>
        <textarea ref={input} aria-label="问题草稿，AI 分析接通后可发送" placeholder="你想了解这次评测的什么？" value={draft} maxLength={2000} rows={2} onChange={event => setDraft(event.target.value)} />
        <div className={styles.composerTools}><span>OpenAI · 待接入</span><button type="button" disabled aria-label="发送不可用：AI 分析尚未接通" title="AI 分析尚未接通"><ArrowUp size={19} /></button></div>
      </div>
      <p className={styles.disclosure}>合成演示数据 · 分析结论需人工核对</p>
    </footer>
  </dialog>;
}
