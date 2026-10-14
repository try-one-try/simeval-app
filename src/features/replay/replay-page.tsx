"use client";
import { useEffect, useRef, useState } from "react";
import type { ReplayAnnotations, ReplayData } from "@/lib/replay-dto";
import { apiRequest, errorText } from "@/lib/api-client";
import { REPLAY_EPISODE_ID, nearestReplayFrame, replayTime, replayValueChange } from "@/domain/replay";
import { useSynchronizedVideos } from "./use-synchronized-videos";
import { AnnotationEditor } from "./annotation-editor";
import styles from "./replay.module.css";

// 页面入口只加载受保护数据；播放器挂载后独立维护视频生命周期。
export function ReplayPage() {
  const [data, setData] = useState<ReplayData | null>(null), [error, setError] = useState(""), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<ReplayData>(`/api/replay/episodes/${REPLAY_EPISODE_ID}`, { signal: controller.signal })
      .then(setData).catch(e => { if (!controller.signal.aborted) setError(errorText(e)); });
    return () => controller.abort();
  }, [attempt]);
  return <main className={styles.page}>
    <div className={styles.breadcrumb}>优化设计 <span>/</span> 真实执行记录</div>
    <header className={styles.heading}><div><h1>具身数据同步回放</h1><p>通过统一时间轴，对照多视角画面、机器人状态与控制动作。</p></div><span className={styles.badge}>真实数据 · 独立回放</span></header>
    {!data ? <section className={styles.loading} aria-live="polite">{error ? <><p role="alert">{error}</p><button className={styles.smallButton} onClick={() => { setError(""); setAttempt(a => a+1); }}>重新加载</button></> : <><p>正在读取执行记录…</p><progress aria-label="正在读取执行记录" /><small>进入此板块后才加载数据与视频</small></>}</section> : <ReplayViewer data={data} />}
  </main>;
}
function ReplayViewer({ data }: { data: ReplayData }) {
  const { manifest, frames } = data;
  const player = useSynchronizedVideos(manifest.duration);
  const frameIndex = nearestReplayFrame(frames, player.time), current = frames[frameIndex];
  const [saved, setSaved] = useState<ReplayAnnotations | null>(null), [annotationError, setAnnotationError] = useState(""), [refresh, setRefresh] = useState(0);
  const jointDialog = useRef<HTMLDialogElement>(null), instructionDialog = useRef<HTMLDialogElement>(null);
  const previous = frames[frameIndex - 1];
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<ReplayAnnotations>(`/api/replay/episodes/${manifest.id}/annotations`, { signal: controller.signal })
      .then(value => { setSaved(value); setAnnotationError(""); }).catch(e => { if (!controller.signal.aborted) setAnnotationError(errorText(e)); });
    return () => controller.abort();
  }, [manifest.id, refresh]);
  const annotations = saved?.annotations ?? [];

  const value = (n: number) => Number.isFinite(n) ? n.toFixed(5).replace(/\.?0+$/, "") || "0" : "—";
  return <div className={styles.viewer} data-loading={!player.initialized || undefined}>
    {!player.initialized && <section className={styles.loadOverlay} aria-live="polite"><h2>正在准备同步回放</h2><progress max={4} value={1 + player.readyCount} aria-label="执行记录与视频就绪进度" /><p>执行记录已读取 · 三路视频已就绪 {player.readyCount}/3</p><small>首次打开需要加载视频，完成后即可播放</small>{player.error && <><p role="alert">{player.error}</p><button className={styles.smallButton} onClick={player.retry}>重新加载视频</button></>}</section>}
    <div className={styles.summary}><span>{manifest.dataset}</span><span>Episode {String(manifest.episodeIndex).padStart(3, "0")}</span><span>{manifest.frameCount.toLocaleString()} 帧 · {manifest.fps} fps</span><span>{replayTime(manifest.duration)}</span></div>
    <div className={styles.layout}>
      <div className={styles.primaryColumn}>
        <div className={styles.cameras}>{manifest.cameras.map((camera, index) => <section key={camera.key} className={styles.camera}>
          <header><h2>{camera.label}</h2><span>{replayTime(player.time)}</span></header>
          <video ref={element => { player.videos.current[index] = element; }} src={`/api/replay/episodes/${manifest.id}/media/${camera.key}`} muted playsInline preload="auto" aria-label={camera.label} />
          <p>真实采集画面 <span>{camera.sourceChannel.replace("observation.images.", "")}</span></p>
        </section>)}</div>
        {player.error && <div className={styles.error} role="alert">{player.error}<button className={styles.smallButton} onClick={player.retry}>重新加载视频</button></div>}
        <section className={styles.statePanel}>
          <header className={styles.sectionHeader}><h2>当前时刻 · 状态与控制动作</h2><span>数据帧 {frameIndex} · {replayTime(current.timestamp)}</span></header>
          <div className={styles.tableScroll}><table><thead><tr><th>字段 / 单位</th><th>实际状态 · 反馈值</th><th>控制动作 · 数据集记录值</th></tr></thead><tbody>
            {manifest.fields.slice(0, 2).map((field, index) => <tr key={field.key}><th scope="row">{field.label}<small>{field.unit ?? "原始值 · 单位未注明"}</small></th><td><strong>反馈位置 {value(current.state[index])}</strong><small>{replayValueChange(current.state[index], previous?.state[index])}</small></td><td><strong>动作位置 {value(current.action[index])}</strong><small>{replayValueChange(current.action[index], previous?.action[index])}</small></td></tr>)}
          </tbody></table></div>
          <button className={styles.expand} aria-haspopup="dialog" onClick={() => { player.pause(); jointDialog.current?.showModal(); }}>查看14项关节位置 ↗</button>
          <p className={styles.hint}>文字描述相邻帧的数值变化；单位未注明，不据此判断开合方向或执行成功。</p>
        </section>
      </div>
      <aside className={styles.sideColumn}>
        <section className={styles.card}><h2>当前执行</h2><p className={styles.instruction}>{manifest.instructionZh.replace(/（原始指令译文）$/, "")}</p><button className={styles.translation} aria-haspopup="dialog" onClick={() => { player.pause(); instructionDialog.current?.showModal(); }}>原始指令译文 ↗</button><dl><dt>记录</dt><dd>Episode {String(manifest.episodeIndex).padStart(3, "0")} · {manifest.robot}</dd><dt>数据格式</dt><dd>{manifest.format}</dd></dl></section>
        <section className={styles.card}>
          <header className={styles.annotationHeader}><h2>任务阶段与标注</h2>{saved && <AnnotationEditor manifest={manifest} currentFrame={frameIndex} saved={saved} onSaved={setSaved} onOpen={player.pause} />}</header>
          <p className={styles.hint}>人工分段 · 预设可修改，非来源阶段标注</p>
          {annotationError ? <div role="alert" className={styles.error}>标注暂时无法读取。{annotationError}<button className={styles.smallButton} onClick={() => setRefresh(n => n+1)}>重试读取</button></div> : !saved ? <p className={styles.empty}>正在读取标注…</p> : annotations.length === 0 ? <div className={styles.empty}>尚未添加人工阶段。<br />可点击“修改标注”载入预设或自行添加。</div> : <div className={styles.annotations}>{annotations.map(a => <button key={a.id} title={a.note} className={styles.annotation} data-active={frameIndex >= a.startFrame && frameIndex < a.endFrame} onClick={() => player.seek(frames[a.startFrame].timestamp)}>
            <span>{replayTime(a.startFrame/manifest.fps).slice(0,5)}–{replayTime(a.endFrame/manifest.fps).slice(0,5)}</span><strong>{a.label}{frameIndex >= a.startFrame && frameIndex < a.endFrame && <em> · 当前</em>}</strong>
          </button>)}</div>}
          {saved && <p className={styles.hint}>点击阶段定位片段 · 两种身份共用编辑{saved.version > 0 ? ` · 已保存 v${saved.version}` : " · 预设待保存"}</p>}
        </section>
      </aside>
    </div>
    <section className={styles.timeline} aria-label="统一时间轴">
      <header className={styles.sectionHeader}><h2>统一时间轴</h2><span role="status">{player.status}</span></header>
      <div className={styles.timelineBody}><div className={styles.transport}>
        <div><button className={styles.play} disabled={!player.ready || !!player.error} onClick={player.playing ? player.pause : player.play}>{player.playing ? "暂停" : "播放"}</button>
          <button className={styles.smallButton} disabled={!player.ready || frameIndex === 0} onClick={() => player.seek(frames[Math.max(0, frameIndex-1)].timestamp)}>上一帧</button><button className={styles.smallButton} disabled={!player.ready || frameIndex === frames.length-1} onClick={() => player.seek(frames[Math.min(frames.length-1, frameIndex+1)].timestamp)}>下一帧</button>
          <label className={styles.speed}>倍速<select aria-label="播放速度" value={player.rate} onChange={e => player.changeRate(Number(e.target.value))}>{[.5,1,1.5,2].map(v => <option key={v} value={v}>{v}×</option>)}</select></label></div>
        <strong>{replayTime(player.time)} <span>/ {replayTime(manifest.duration)}</span></strong>
      </div><div className={styles.trackArea}>
        <div className={styles.segments}>{annotations.length ? annotations.map(a => <button key={a.id} title={`${a.label}（${a.startFrame}–${a.endFrame} 帧）`} onClick={() => player.seek(frames[a.startFrame].timestamp)} style={{ left: `${a.startFrame/manifest.frameCount*100}%`, width: `${(a.endFrame-a.startFrame)/manifest.frameCount*100}%` }}>{a.label}</button>) : <span>原始指令覆盖整个执行记录 · 尚无人工阶段</span>}</div>
        <input aria-label="回放时间轴" aria-valuetext={replayTime(current.timestamp)} type="range" min={0} max={manifest.frameCount-1} step={1} value={frameIndex} disabled={!player.loaded || !!player.error} onChange={e => player.seek(frames[Number(e.target.value)].timestamp)} />
        <div className={styles.ticks}>{[0,.25,.5,.75,1].map(f => <span key={f}>{(manifest.duration*f).toFixed(1)} s</span>)}</div>
      </div></div>
      <p className={styles.hint}>拖动或步进后暂停，便于核对数值。三路视频以头部画面为主时钟；缓冲时共同暂停。</p>
    </section>
    <footer className={styles.footer}>真实数据展示副本 · 人工时间分段预设可编辑 · 单位按来源说明 · 浏览回放不作科研级逐帧同步保证</footer>
    <dialog ref={jointDialog} className={`${styles.dialog} ${styles.jointDialog}`} aria-labelledby="joint-title">
      <header><div><h2 id="joint-title">14项关节位置</h2><p>数据帧 {frameIndex} · {replayTime(current.timestamp)} · 打开时暂停播放</p></div><button className={styles.smallButton} onClick={() => jointDialog.current?.close()}>关闭 ×</button></header>
      <div className={styles.statePanel}><div className={styles.tableScroll}><table><thead><tr><th>字段 / 原始单位</th><th>实际状态</th><th>控制动作</th></tr></thead><tbody>{manifest.fields.slice(2).map((field, offset) => { const index = offset + 2; return <tr key={field.key}><th>{field.label}<small>{field.unit ?? "单位未注明"}</small></th><td><strong>{value(current.state[index])}</strong><small>{field.stateField}</small></td><td><strong>{value(current.action[index])}</strong><small>{field.actionField}</small></td></tr>; })}</tbody></table></div></div>
    </dialog>
    <dialog ref={instructionDialog} className={styles.dialog} aria-labelledby="instruction-title"><header><h2 id="instruction-title">原始指令与译文</h2><button className={styles.smallButton} onClick={() => instructionDialog.current?.close()}>关闭 ×</button></header><p className={styles.instruction}>{manifest.instruction}</p><p>{manifest.instructionZh}</p><p className={styles.hint}>指令覆盖本次完整执行记录；右侧阶段是独立的人工时间分段。</p></dialog>
  </div>;
}
