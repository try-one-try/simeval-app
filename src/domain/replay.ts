// 时间定位、帧区间与标注规则；不依赖播放器或数据库。
import { z } from "zod";
import { AppError } from "./evaluation";
import type { ReplayAnnotation, ReplayFrame } from "@/lib/replay-dto";

export const REPLAY_EPISODE_ID = "agibot-2026-episode-0";
/** 人工时间分段模板，不冒充来源标注；保存后以用户修改为准。 */
export function replayPresetAnnotations(frameCount: number, fps: number): ReplayAnnotation[] {
  const bounds = [0, 10 * fps, 35 * fps, 55 * fps, frameCount];
  const labels = ["开始片段", "前段交互", "后段交互", "结束片段"];
  return labels.flatMap((label, index) => {
    const startFrame = Math.min(bounds[index], frameCount), endFrame = Math.min(bounds[index + 1], frameCount);
    return startFrame < endFrame ? [{ id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, label,
      startFrame, endFrame, note: "人工时间分段预设，待结合画面核对；非数据集原始阶段标注。" }] : [];
  });
}
/** 只描述相邻记录的数值变化，不推断机器人运动方向或动作是否成功。 */
export function replayValueChange(value: number, previous: number | undefined) {
  if (previous === undefined) return "首帧记录";
  const difference = value - previous;
  return Math.abs(difference) < 0.000005 ? "与上一帧一致" : difference > 0 ? "较上一帧增大" : "较上一帧减小";
}
export const replayAnnotationSchema = z.object({
  id: z.string().uuid(), label: z.string().trim().min(1).max(80), note: z.string().trim().max(1000),
  startFrame: z.number().int().min(0), endFrame: z.number().int().min(1),
}).strict();
export const replaySaveSchema = z.object({ expectedVersion: z.number().int().min(0), annotations: z.array(replayAnnotationSchema).max(100) }).strict();
export type ReplaySaveInput = z.infer<typeof replaySaveSchema>;
export function validateReplayAnnotations(input: ReplaySaveInput, frameCount: number) {
  const ids = new Set<string>();
  for (const item of input.annotations) {
    if (ids.has(item.id) || item.startFrame >= item.endFrame || item.endFrame > frameCount)
      throw new AppError("VALIDATION_ERROR", "标注编号不能重复，开始帧必须早于结束帧，且不能超出执行记录", 422);
    ids.add(item.id);
  }
}
export function nearestReplayFrame(frames: readonly ReplayFrame[], time: number) {
  if (!frames.length || !Number.isFinite(time)) return 0;
  let lo = 0, hi = frames.length - 1;
  while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (frames[mid].timestamp < time) lo = mid + 1; else hi = mid; }
  return lo > 0 && Math.abs(frames[lo - 1].timestamp - time) <= Math.abs(frames[lo].timestamp - time) ? lo - 1 : lo;
}
export function replayTime(seconds: number) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  return `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
}
export function byteRange(header: string | null, size: number): { start: number; end: number } | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) throw new AppError("INVALID_RANGE", "不支持该视频字节范围", 416);
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size)
    throw new AppError("INVALID_RANGE", "视频字节范围超出文件", 416);
  return { start, end };
}
