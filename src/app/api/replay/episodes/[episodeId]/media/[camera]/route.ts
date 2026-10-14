import { replayAssetStream } from "@/server/providers/replay-storage";
import { randomUUID } from "node:crypto";
import { apiActor } from "@/server/http/api";
import { AppError, assertRole } from "@/domain/evaluation";
import { byteRange } from "@/domain/replay";
import { replayVideo } from "@/server/providers/replay-source";
export const runtime = "nodejs";
export const maxDuration = 120;
// 视频使用 HTTP Range；鉴权后才打开文件，拖动不必重新下载整段。
export async function GET(request: Request, context: { params: Promise<{ episodeId: string; camera: string }> }) {
  let size: number | undefined;
  try {
    assertRole(await apiActor(), ["ENGINEER", "REVIEWER"]);
    const { episodeId, camera } = await context.params;
    const video = await replayVideo(episodeId, camera); size = video.size;
    const range = byteRange(request.headers.get("range"), size);
    const start = range?.start ?? 0, end = range?.end ?? size - 1;
    const stream = await replayAssetStream(video, range, request.signal);
    return new Response(stream, {
      status: range ? 206 : 200, headers: { "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Content-Length": String(end-start+1),
        "Cache-Control": "private, no-store", ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}) },
    });
  } catch (error) {
    const failure = error instanceof AppError ? error : new AppError("INTERNAL_ERROR", "视频暂时无法读取", 500);
    return Response.json({ error: { code: failure.code, message: failure.message, fieldErrors: null, requestId: randomUUID() } }, {
      status: failure.status, headers: { "Cache-Control": "no-store", ...(failure.status === 416 && size !== undefined ? { "Content-Range": `bytes */${size}` } : {}) },
    });
  }
}
