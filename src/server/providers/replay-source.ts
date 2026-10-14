import "server-only";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { AppError } from "@/domain/evaluation";
import { REPLAY_EPISODE_ID } from "@/domain/replay";
import type { ReplayData, ReplayManifest, ReplayFrame } from "@/lib/replay-dto";

// 仅读取离线导入的固定数据源；请求不能指定磁盘路径。
const directory = path.join(process.cwd(), "assets", "embodied-replay", REPLAY_EPISODE_ID);
export function assertReplayId(id: string) {
  if (id !== REPLAY_EPISODE_ID) throw new AppError("NOT_FOUND", "执行记录不存在", 404);
}
let cached: Promise<ReplayData> | undefined;
export async function replaySource(id: string): Promise<ReplayData> {
  assertReplayId(id);
  cached ??= Promise.all([readFile(path.join(directory, "manifest.json"), "utf8"), readFile(path.join(directory, "frames.json"), "utf8")])
    .then(([meta, data]) => {
      // 文件由导入脚本校验并生成；这里再次检查数量及时间对应，避免部署混用素材版本。
      const manifest = JSON.parse(meta) as ReplayManifest, frames = JSON.parse(data) as ReplayFrame[];
      if (manifest.id !== id || frames.length !== manifest.frameCount || !frames.length ||
          frames.some((f, i) => !Number.isFinite(f.timestamp) || (i > 0 && f.timestamp <= frames[i-1].timestamp) ||
            f.state.length !== manifest.fields.length || f.action.length !== manifest.fields.length))
        throw new Error("Invalid replay source");
      return { manifest, frames };
    }).catch(() => { cached = undefined; throw new AppError("REPLAY_NOT_READY", "回放素材尚未准备好，请完成数据导入后重试", 503); });
  return cached;
}
export async function replayVideo(id: string, camera: string) {
  assertReplayId(id);
  if (!["head", "left", "right"].includes(camera)) throw new AppError("NOT_FOUND", "摄像头不存在", 404);
  const file = path.join(directory, `${camera}.mp4`);
  try { return { file, size: (await stat(file)).size }; }
  catch { throw new AppError("REPLAY_NOT_READY", "该视角视频尚未准备好", 503); }
}
