"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { homeContent } from "./content";
import { AVATAR_BASE, createAvatarEngine, type LoadProgress } from "./avatar/engine";
import { pointerTarget, type Direction } from "./avatar/controls";
import styles from "./home.module.css";

type Status = "loading" | "ready" | "error" | "static";
type Props = { header: ReactNode; introduction: ReactNode; left: ReactNode; right: ReactNode; footer: ReactNode };

/** 只管理人物与加载生命周期；正文由服务端作为插槽传入。
 * 修改两侧文字不会重建动画；离开首页释放所有网络、事件与位图资源。
 */
export function InteractiveHome({ header, introduction, left, right, footer }: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const poster = useRef<HTMLImageElement>(null);
  const engine = useRef<ReturnType<typeof createAvatarEngine> | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [load, setLoad] = useState<LoadProgress>({ percent: 0, phase: "download" });
  const [showProgress, setShowProgress] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const revealed = status === "ready" || status === "static";

  useEffect(() => {
    if (!canvas.current || !poster.current || !frame.current) return;
    let mounted = true, inView = true;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const instance = createAvatarEngine({
      canvas: canvas.current, poster: poster.current,
      onProgress: value => { if (mounted) setLoad(value); },
      onReady: () => { if (mounted) { setLoad({ percent: 100, phase: "decode" }); setStatus("ready"); } },
      onError: duringInteraction => { if (mounted) { setStatus(duringInteraction ? "static" : "error"); if (poster.current) poster.current.hidden = false; if (canvas.current) canvas.current.hidden = true; } },
    });
    engine.current = instance; instance.setReduced(reduced.matches);
    const delay = window.setTimeout(() => { if (mounted) setShowProgress(true); }, 700);
    const onMove = (event: PointerEvent) => {
      if (!instance.isReady || event.pointerType !== "mouse" || reduced.matches || !inView || !frame.current) return;
      const box = frame.current.getBoundingClientRect();
      const target = pointerTarget(event.clientX, event.clientY, innerWidth, innerHeight,
        { x: box.left + box.width / 2, y: box.top + box.height * .47 }, instance.requested);
      instance.setTarget(target.direction, target.amount);
    };
    const reset = () => { instance.setTarget(null, 0); };
    const visibility = () => instance.setVisible(!document.hidden && inView);
    const motionPreference = () => { instance.setReduced(reduced.matches); reset(); };
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; visibility(); });
    observer.observe(frame.current);
    // window 上监听：导航、两侧卡片和页脚均可驱动人物，触摸滚动不被拦截。
    window.addEventListener("pointermove", onMove, { passive: true }); window.addEventListener("blur", reset);
    document.documentElement.addEventListener("pointerleave", reset);
    document.addEventListener("visibilitychange", visibility); reduced.addEventListener("change", motionPreference);
    void instance.initialize();
    return () => {
      mounted = false; window.clearTimeout(delay); observer.disconnect();
      window.removeEventListener("pointermove", onMove); window.removeEventListener("blur", reset);
      document.documentElement.removeEventListener("pointerleave", reset);
      document.removeEventListener("visibilitychange", visibility); reduced.removeEventListener("change", motionPreference);
      instance.dispose(); if (engine.current === instance) engine.current = null;
    };
  }, [attempt]);

  function select(direction: Direction | null) { engine.current?.setTarget(direction, direction ? 1 : 0); }
  function retry() {
    setStatus("loading"); setLoad({ percent: 0, phase: "download" }); setShowProgress(false);
    setAttempt(value => value + 1);
  }
  function browseStatic() {
    engine.current?.dispose();
    if (poster.current) poster.current.hidden = false;
    if (canvas.current) canvas.current.hidden = true;
    setStatus("static");
  }

  return <div className={styles.page} data-home-state={status}>
    {!revealed && <div className={`${styles.loading} home-loading`}>
      <div className={styles.loadingInner}>
        <div className={styles.loadingBrand}>{homeContent.brand}</div>
        <p className={styles.loadingCaption}>每一个细节，都在就位。</p>
        {(showProgress || status === "error") && <div className={styles.loadDetails}>
          <p role="status" aria-live="polite">{status === "error" ? "互动素材暂时未能加载" : load.phase === "download" ? "正在加载完整体验" : "正在准备高清画面"}</p>
          <div className={styles.progressRow}><progress max={100} value={load.percent} aria-label="完整体验加载进度" /><span>{load.percent}%</span></div>
          {status === "error" && <><p className={styles.loadHint}>请检查网络后重试，也可以先浏览页面。</p><button className={styles.retry} onClick={retry}>重新加载</button></>}
          <button className={styles.staticLink} onClick={browseStatic}>先浏览静态页面 ↗</button>
        </div>}
      </div>
    </div>}
    {/* visibility 隐藏的正文不会获焦；无 JS 时由 noscript 恢复可读页面与链接。 */}
    <div className={`${styles.experience} home-experience`} data-revealed={revealed}>
      <a href="#home-main" className={styles.skip}>跳到主要内容</a>
      {header}
      <main id="home-main" className={styles.main}>
        {introduction}
        <div className={styles.conversation}>
          {left}
          <section className={styles.portrait} aria-label="互动人物">
            <div className={styles.frame} ref={frame} tabIndex={0} role="group" aria-label="人物互动：鼠标向左扶镜、向右伸手、向上抬头、向下低头；聚焦后可用方向键，Escape 回到待机。"
              onKeyDown={event => {
                const directions: Record<string, Direction> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
                if (directions[event.key]) { event.preventDefault(); select(directions[event.key]); }
                else if (event.key === "Escape") select(null);
              }}>
              {/* 原图不经 Next Image 再压缩；Canvas 与待机图同尺寸，避免切换时位移。 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={poster} src={`${AVATAR_BASE}/idle.webp`} width={1112} height={834} alt="穿浅蓝衬衫、戴黑色墨镜的项目创作者，双手轻放胸前。" fetchPriority="high" />
              <canvas ref={canvas} width={1112} height={834} hidden aria-hidden="true" data-frame="idle" />
            </div>
            <p className={styles.portraitHint}>{homeContent.portrait.hint}</p>
            {status === "static" && <button className={styles.staticRetry} onClick={retry}>重新加载互动 ↻</button>}
          </section>
          {right}
        </div>
      </main>
      {footer}
    </div>
    <noscript><style>{".home-loading{display:none!important}.home-experience[data-revealed]{visibility:visible!important}"}</style></noscript>
  </div>;
}
