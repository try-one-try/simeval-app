import "server-only";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { head } from "@vercel/blob";
import { REPLAY_EPISODE_ID } from "@/domain/replay";

const prefix = `embodied-replay/v1/${REPLAY_EPISODE_ID}`;
const directory = path.join(process.cwd(), "assets", "embodied-replay", REPLAY_EPISODE_ID);
type AssetName = "manifest.json" | "frames.json" | "head.mp4" | "left.mp4" | "right.mp4";
type Asset = { size: number; file: string } | { size: number; url: string };
const metadata = new Map<AssetName, { expires: number; value: Asset }>();

function usesBlob() {
  const mode = process.env.REPLAY_STORAGE ?? (process.env.VERCEL ? "blob" : "local");
  if (mode !== "blob" && mode !== "local") throw Error("Invalid replay storage");
  return mode === "blob";
}

function token() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw Error("Missing Blob credential");
  return process.env.BLOB_READ_WRITE_TOKEN;
}

export async function replayAsset(name: AssetName): Promise<Asset> {
  if (!usesBlob()) {
    const file = path.join(directory, name);
    return { file, size: (await stat(file)).size };
  }
  const previous = metadata.get(name);
  if (previous && previous.expires > Date.now()) return previous.value;
  const blob = await head(`${prefix}/${name}`, { token: token(), abortSignal: AbortSignal.timeout(30000) });
  const url = new URL(blob.url);
  // 只向 SDK 返回的私有 Blob 域名发送凭证，拒绝意外的公开存储或跳转。
  if (url.protocol !== "https:" || !url.hostname.endsWith(".private.blob.vercel-storage.com")) throw Error("Expected private Blob");
  const value = { size: blob.size, url: blob.url };
  metadata.set(name, { expires: Date.now() + 300000, value });
  return value;
}

async function fetchBlob(url: string, range: { start: number; end: number } | null, signal?: AbortSignal) {
  const waiting = new AbortController();
  const timer = setTimeout(() => waiting.abort(), 30000);
  try {
    return await fetch(url, {
      headers: { Authorization: `Bearer ${token()}`, ...(range ? { Range: `bytes=${range.start}-${range.end}` } : {}) },
      redirect: "error", cache: "no-store",
      signal: AbortSignal.any([waiting.signal, ...(signal ? [signal] : [])]),
    });
  } finally {
    // 超时只限制等待响应头；视频开始流式传输后，不能按总下载时间截断慢网播放。
    clearTimeout(timer);
  }
}

export async function replayAssetStream(asset: Asset, range: { start: number; end: number } | null, signal?: AbortSignal) {
  if ("file" in asset) {
    const stream = createReadStream(asset.file, { ...(range ?? {}), signal });
    return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
  }
  const response = await fetchBlob(asset.url, range, signal);
  const expectedLength = range ? range.end - range.start + 1 : asset.size;
  if (response.status !== (range ? 206 : 200) || !response.body ||
      Number(response.headers.get("content-length")) !== expectedLength ||
      (range && response.headers.get("content-range") !== `bytes ${range.start}-${range.end}/${asset.size}`)) {
    await response.body?.cancel();
    throw Error("Unexpected Blob media response");
  }
  return response.body;
}

export async function replayAssetText(name: "manifest.json" | "frames.json") {
  if (!usesBlob()) return readFile(path.join(directory, name), "utf8");
  const asset = await replayAsset(name);
  if (!("url" in asset)) throw Error("Expected Blob asset");
  const response = await fetchBlob(asset.url, null);
  if (response.status !== 200) { await response.body?.cancel(); throw Error("Unexpected Blob JSON response"); }
  // CDN 可以压缩 JSON 并省略 Content-Length；fetch 解压后再核对原始字节数。
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== asset.size) throw Error("Invalid Blob JSON length");
  return new TextDecoder().decode(bytes);
}
