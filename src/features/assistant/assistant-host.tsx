"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { AssistantAvatar } from "./assistant-avatar";
import { ASSISTANT_RESET_EVENT } from "./content";
import { assistantAppearance as motion } from "./appearance";
import styles from "./assistant.module.css";
import type { DemoRole } from "@/lib/demo-identity";

// 点开以后才下载面板代码。挂在已登录的工作台布局上，工作台内换页保留小助手。
const AssistantPanel = dynamic(() => import("./assistant-panel"), {
  ssr: false,
  loading: () => <div className={styles.loading} role="status">正在打开助手…</div>,
});

export function AssistantHost({ role }: { role: DemoRole }) {
  const [opened, setOpened] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [bouncing, setBouncing] = useState(false);
  const [busy, setBusy] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const reset = () => { setOpened(false); setMounted(false); setGeneration(value => value + 1); };
    window.addEventListener(ASSISTANT_RESET_EVENT, reset);
    return () => window.removeEventListener(ASSISTANT_RESET_EVENT, reset);
  }, []);

  function close() {
    setOpened(false);
    requestAnimationFrame(() => trigger.current?.focus());
  }

  function followPointer(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
    event.currentTarget.style.setProperty("--look-x", `${x * motion.hoverTravelPx}px`);
    event.currentTarget.style.setProperty("--look-tilt", `${x * motion.hoverTiltDegrees}deg`);
  }

  const motionStyle = {
    "--idle-travel": `${motion.idleTravelPx}px`,
    "--idle-seconds": `${motion.idleSeconds}s`,
    "--click-jump": `${motion.clickJumpPx}px`,
  } as CSSProperties;

  return <div className={styles.host} style={motionStyle} data-assistant-root>
    {mounted && <AssistantPanel key={generation} opened={opened} onClose={close} role={role} onActivity={setBusy} />}
    <button ref={trigger} type="button" className={styles.launcher} data-open={opened} data-busy={busy}
      aria-label={opened ? "收起 SimEval 助手" : "打开 SimEval 助手"}
      aria-haspopup="dialog" aria-expanded={opened} aria-controls={mounted ? "simeval-assistant" : undefined}
      onPointerMove={followPointer}
      onPointerLeave={event => { event.currentTarget.style.setProperty("--look-x", "0px"); event.currentTarget.style.setProperty("--look-tilt", "0deg"); }}
      onClick={() => { setBouncing(true); if (opened) close(); else { setMounted(true); setOpened(true); } }}>
      <span className={styles.launcherLabel}>{busy ? "正在调查…" : "一起看评测"} <span>{busy ? "点击查看进展" : "AI 助手 ↗"}</span></span>
      <span className={styles.avatarStage}><span className={styles.avatarFloat}><span className={styles.avatarTilt}>
        <span className={styles.avatarPress} data-bounce={bouncing} onAnimationEnd={event => { if (event.target === event.currentTarget) setBouncing(false); }}><AssistantAvatar /></span>
      </span></span><span className={styles.groundShadow} /></span>
    </button>
  </div>;
}
