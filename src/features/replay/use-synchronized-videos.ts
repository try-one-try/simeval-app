"use client";
import { useEffect, useRef, useState } from "react";

/** 头部视频是主时钟；任一路缓冲就暂停整组，用户拖动后停在选定时刻。 */
export function useSynchronizedVideos(duration: number) {
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const controller = useRef<{ play: () => void; pause: () => void; seek: (time: number) => void; retry: () => void }>({ play: () => {}, pause: () => {}, seek: () => {}, retry: () => {} });
  const [time, setTime] = useState(0), [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState("正在加载三路视频"), [error, setError] = useState("");
  const [rate, setRate] = useState(1), [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [readyCount, setReadyCount] = useState(0), [initialized, setInitialized] = useState(false);
  useEffect(() => {
    const list = videos.current.filter((v): v is HTMLVideoElement => v !== null);
    let intent = false, disposed = false, starting = false, raf = 0, failed = false;
    const allReady = () => list.length === 3 && list.every(v => v.readyState >= 3 && !v.seeking && !v.error);
    const stopFrames = () => { cancelAnimationFrame(raf); raf = 0; };
    const pauseAll = () => { list.forEach(v => v.pause()); stopFrames(); setPlaying(false); };
    const tick = () => {
      if (disposed || !intent) return;
      const head = list[0];
      setTime(head.currentTime);
      for (const follower of list.slice(1)) {
        if (!follower.seeking && Math.abs(follower.currentTime - head.currentTime) > .08) follower.currentTime = head.currentTime;
      }
      raf = requestAnimationFrame(tick);
    };
    const resume = async () => {
      if (disposed || failed) return;
      const available = allReady(); setReady(available); setLoaded(list.length === 3 && list.every(v => v.readyState >= 1));
      setReadyCount(list.filter(v => v.readyState >= 3 && !v.seeking && !v.error).length);
      if (available) setInitialized(true);
      if (!available) { if (intent) setStatus("正在同步／缓冲三路画面…"); return; }
      if (!intent) { setStatus("已暂停 · 拖动时间轴或选择片段"); return; }
      if (starting || list.every(v => !v.paused)) return;
      starting = true;
      try {
        await Promise.all(list.map(v => v.play()));
        if (disposed || !intent || !allReady()) { pauseAll(); return; }
        setPlaying(true); setStatus("三路同步回放中"); stopFrames(); raf = requestAnimationFrame(tick);
      } catch {
        if (!disposed && intent) { intent = false; pauseAll(); setError("播放未能启动，请点击播放重试；若仍失败，请重新加载视频。"); }
      } finally { starting = false; }
    };
    const waiting = () => { pauseAll(); setReady(false); setStatus("正在同步／缓冲三路画面…"); };
    const onReady = () => { void resume(); };
    const onError = () => { failed = true; intent = false; pauseAll(); setReady(false); setError("有一路视频加载失败，已停止同步播放。请检查网络或登录状态后重试。"); };
    const ended = () => { intent = false; pauseAll(); setTime(Math.min(list[0].currentTime, duration)); setStatus("回放结束"); };
    controller.current = {
      play: () => { if (failed) return; setError(""); intent = true; if (list[0]?.ended) list.forEach(v => { v.currentTime = 0; }); void resume(); },
      pause: () => { intent = false; pauseAll(); setStatus("已暂停"); },
      seek: value => {
        intent = false; pauseAll();
        const next = Math.max(0, Math.min(duration - 1 / 30, value));
        setTime(next); setStatus("正在定位对应画面…");
        list.forEach(v => { if (v.readyState >= 1) v.currentTime = next; });
      },
      retry: () => { intent = false; failed = false; pauseAll(); setError(""); setTime(0); setReady(false); setStatus("正在重新加载三路视频…"); list.forEach(v => v.load()); },
    };
    for (const video of list) {
      video.addEventListener("waiting", waiting); video.addEventListener("seeking", waiting);
      video.addEventListener("canplay", onReady); video.addEventListener("seeked", onReady); video.addEventListener("error", onError);
    }
    list[0]?.addEventListener("ended", ended);
    const hidden = () => { if (document.hidden) controller.current.pause(); };
    document.addEventListener("visibilitychange", hidden);
    void resume();
    return () => {
      disposed = true; intent = false; stopFrames(); list.forEach(v => v.pause());
      for (const video of list) {
        video.removeEventListener("waiting", waiting); video.removeEventListener("seeking", waiting);
        video.removeEventListener("canplay", onReady); video.removeEventListener("seeked", onReady); video.removeEventListener("error", onError);
      }
      list[0]?.removeEventListener("ended", ended); document.removeEventListener("visibilitychange", hidden);
    };
  }, [duration]);
  function changeRate(value: number) { setRate(value); videos.current.forEach(v => { if (v) { v.defaultPlaybackRate = value; v.playbackRate = value; } }); }
  return { videos, time, playing, ready, loaded, readyCount, initialized, status, error, rate, changeRate,
    play: () => controller.current.play(), pause: () => controller.current.pause(),
    seek: (value: number) => controller.current.seek(value), retry: () => controller.current.retry() };
}
