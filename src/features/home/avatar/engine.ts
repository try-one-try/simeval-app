import { advanceFrame, clamp, type Direction } from "./controls";

export const AVATAR_BASE = "/avatar/v1";
export type LoadProgress = { percent: number; phase: "download" | "decode" };
type Manifest = {
  cell: { width: number; height: number }; columns: number; rows: number;
  frames: number; sheetsPerDirection: number; totalBytes: number;
  assets: { file: string; bytes: number }[];
};
type EngineOptions = {
  canvas: HTMLCanvasElement; poster: HTMLImageElement;
  onProgress: (value: LoadProgress) => void; onReady: () => void;
  onError: (duringInteraction: boolean) => void;
};

/** Canvas 序列帧引擎。
 * 继承已验收 Demo：全量下载压缩素材，最多驻留 6 张解码图集，提前准备后续两张。
 * 每帧只绘制 Canvas，不更新 React；换向必须经共同待机帧，避免两段视频直接拼接。
 * 每次挂载拥有独立实例；dispose 会取消下载、关闭位图，迟到的解码结果也立即释放。
 */
export function createAvatarEngine(options: EngineOptions) {
  const { canvas, poster, onProgress, onReady, onError } = options;
  const context = canvas.getContext("2d", { alpha: false, desynchronized: true });
  const controller = new AbortController();
  const compressed = new Map<string, Blob>();
  const decoded = new Map<string, ImageBitmap>();
  const pending = new Map<string, Promise<ImageBitmap>>();
  let protectedSheets = new Set<string>();
  let manifest: Manifest;
  let ready = false, disposed = false, visible = true, reduced = false;
  let active: Direction | null = null, requested: Direction | null = null;
  let progress = 0, wanted = 0, raf = 0, lastTime = 0, displayed = "idle";

  function alive() { if (disposed || controller.signal.aborted) throw new DOMException("Cancelled", "AbortError"); }
  function trimCache() {
    while (decoded.size > 6) {
      const oldest = [...decoded.keys()].find(key => !protectedSheets.has(key));
      if (!oldest) break;
      decoded.get(oldest)?.close(); decoded.delete(oldest);
    }
  }
  async function getSheet(direction: Direction, sheet: number): Promise<ImageBitmap> {
    const key = `${direction}-${sheet}`;
    const cached = decoded.get(key);
    if (cached) { decoded.delete(key); decoded.set(key, cached); return cached; }
    const existing = pending.get(key);
    if (existing) return existing;
    const job = (async () => {
      alive();
      const blob = compressed.get(key);
      if (!blob) throw new Error("Missing motion asset");
      const bitmap = await createImageBitmap(blob);
      if (disposed || controller.signal.aborted) { bitmap.close(); alive(); }
      decoded.set(key, bitmap); trimCache();
      return bitmap;
    })().finally(() => pending.delete(key));
    pending.set(key, job); return job;
  }
  function fail() {
    if (disposed || controller.signal.aborted) return;
    const duringInteraction = ready;
    ready = false; disposed = true; controller.abort();
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    for (const bitmap of decoded.values()) bitmap.close();
    decoded.clear(); compressed.clear();
    onError(duringInteraction);
  }
  function prepareFrames(direction: Direction, position: number, target: number) {
    const sheet = Math.floor(Math.round(position * (manifest.frames - 1)) / (manifest.columns * manifest.rows));
    const step = target > position ? 1 : -1;
    const sheets = [sheet, sheet + step, sheet + step * 2].filter(n => n >= 0 && n < manifest.sheetsPerDirection);
    protectedSheets = new Set(sheets.map(n => `${direction}-${n}`));
    if (requested && requested !== direction) protectedSheets.add(`${requested}-0`);
    for (const n of sheets) {
      if (!decoded.has(`${direction}-${n}`)) void getSheet(direction, n).then(schedule).catch(fail);
    }
  }
  function draw() {
    if (!context) return;
    if (!active || progress < .014) {
      canvas.hidden = true; poster.hidden = false; displayed = "idle";
      canvas.dataset.frame = displayed;
      return;
    }
    const index = Math.round(progress * (manifest.frames - 1));
    const key = `${active}:${index}`;
    if (key === displayed) return;
    const perSheet = manifest.columns * manifest.rows;
    const bitmap = decoded.get(`${active}-${Math.floor(index / perSheet)}`);
    if (!bitmap) return;
    const slot = index % perSheet;
    context.drawImage(bitmap, (slot % manifest.columns) * manifest.cell.width,
      Math.floor(slot / manifest.columns) * manifest.cell.height,
      manifest.cell.width, manifest.cell.height, 0, 0, canvas.width, canvas.height);
    canvas.hidden = false; poster.hidden = true; displayed = key;
    // 只读绘制标记便于排查跳帧，记录的是实际显示帧，而非仅记录目标进度。
    canvas.dataset.frame = displayed;
  }
  function schedule() {
    if (!raf && ready && !disposed && visible && !document.hidden) raf = requestAnimationFrame(tick);
  }
  function tick(time: number) {
    raf = 0;
    if (!ready || disposed) return;
    const dt = lastTime ? Math.min((time - lastTime) / 1000, .05) : 1 / 60;
    lastTime = time;
    if (progress === 0 && active !== requested) active = requested;
    const target = active === requested ? wanted : 0;
    if (active) {
      prepareFrames(active, progress, target);
      const next = reduced ? target : advanceFrame(progress, target, dt, manifest.frames);
      const sheet = Math.floor(Math.round(next * (manifest.frames - 1)) / (manifest.columns * manifest.rows));
      // 缺解码帧就保留当前画面；等待后仍从下一帧继续，不按墙钟时间补跳。
      if (next === 0 || decoded.has(`${active}-${sheet}`)) progress = next;
      prepareFrames(active, progress, target);
    } else progress = 0;
    draw();
    if (progress !== wanted || active !== requested) schedule(); else lastTime = 0;
  }
  function setTarget(direction: Direction | null, amount = 1) {
    if (!ready || disposed) return;
    requested = direction; wanted = direction ? clamp(amount, 0, 1) : 0;
    if (reduced) {
      active = direction; progress = wanted;
      if (active) prepareFrames(active, progress, progress);
    }
    schedule();
  }
  async function initialize() {
    try {
      if (!context || typeof createImageBitmap !== "function") throw new Error("Canvas unavailable");
      const response = await fetch(`${AVATAR_BASE}/motion.json`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      if (!response.ok) throw new Error("Manifest unavailable");
      manifest = await response.json() as Manifest;
      if (manifest.frames !== 56 || manifest.assets.length !== 57 || manifest.cell.width !== 1112 || manifest.cell.height !== 834) throw new Error("Invalid manifest");
      alive(); canvas.width = manifest.cell.width; canvas.height = manifest.cell.height;
      let next = 0, received = 0, lastPercent = -1;
      const report = (percent: number, phase: LoadProgress["phase"]) => {
        const rounded = Math.min(99, Math.floor(percent));
        if (rounded !== lastPercent) { lastPercent = rounded; onProgress({ percent: rounded, phase }); }
      };
      const worker = async () => {
        while (next < manifest.assets.length) {
          alive();
          const asset = manifest.assets[next++];
          const response = await fetch(`${AVATAR_BASE}/${asset.file}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]) });
          if (!response.ok || !response.body) throw new Error("Asset unavailable");
          const reader = response.body.getReader();
          const chunks: ArrayBuffer[] = []; let size = 0;
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            alive(); chunks.push(value.slice().buffer); size += value.byteLength; received += value.byteLength;
            report(received / manifest.totalBytes * 90, "download");
          }
          alive();
          if (size !== asset.bytes) throw new Error("Incomplete asset");
          compressed.set(asset.file.replace(".webp", ""), new Blob(chunks, { type: "image/webp" }));
        }
      };
      // 限制并发为 3，避免首次加载抢占所有连接；失败时停止同批请求。
      await Promise.all(Array.from({ length: 3 }, () => worker()));
      let checked = 0;
      for (const asset of manifest.assets) {
        alive();
        const blob = compressed.get(asset.file.replace(".webp", ""));
        if (!blob) throw new Error("Incomplete assets");
        const bitmap = await createImageBitmap(blob);
        const width = manifest.cell.width * (asset.file === "idle.webp" ? 1 : manifest.columns);
        const height = manifest.cell.height * (asset.file === "idle.webp" ? 1 : manifest.rows);
        const valid = bitmap.width === width && bitmap.height === height;
        bitmap.close(); alive();
        if (!valid) throw new Error("Invalid asset dimensions");
        report(90 + (++checked / manifest.assets.length) * 9, "decode");
      }
      await Promise.all((["left", "right", "up", "down"] as const).map(direction => getSheet(direction, 0)));
      await poster.decode();
      await document.fonts.ready;
      alive(); ready = true; draw(); onReady();
    } catch { fail(); }
  }
  return {
    initialize, setTarget,
    get requested() { return requested; },
    get isReady() { return ready && !disposed; },
    setReduced(value: boolean) { reduced = value; if (value) setTarget(null, 0); },
    setVisible(value: boolean) {
      visible = value; lastTime = 0;
      if (!value && raf) { cancelAnimationFrame(raf); raf = 0; }
      if (value) schedule();
    },
    dispose() {
      disposed = true; ready = false; controller.abort();
      if (raf) cancelAnimationFrame(raf);
      for (const bitmap of decoded.values()) bitmap.close();
      decoded.clear(); compressed.clear(); pending.clear();
    },
  };
}
