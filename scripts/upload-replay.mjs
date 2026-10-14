// 本地维护命令：只上传固定 Episode 的展示副本；不会上传原始目录、密钥或标注。
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { BlobNotFoundError, head, put } from "@vercel/blob";

process.loadEnvFile(".env.local");
if (process.env.REPLAY_UPLOAD_PROXY) {
  const { ProxyAgent, setGlobalDispatcher } = await import("undici");
  setGlobalDispatcher(new ProxyAgent(process.env.REPLAY_UPLOAD_PROXY));
}
const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) throw Error("请先在 .env.local 配置 BLOB_READ_WRITE_TOKEN");
const prefix = "embodied-replay/v1/agibot-2026-episode-0";
const source = new URL("../assets/embodied-replay/agibot-2026-episode-0/", import.meta.url);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const verifyOnly = process.argv.includes("--verify");

async function verify(url, bytes) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".private.blob.vercel-storage.com")) throw Error("目标不是 Private Blob");
  // 分片回读降低跨境连接中断的重传成本；仍检查整个文件，而非仅检查大小。
  const digest = createHash("sha256");
  const chunkSize = 64 * 1024;
  for (let offset = 0; offset < bytes.length; offset += chunkSize * 8) {
    const starts = Array.from({ length: 8 }, (_, i) => offset + i * chunkSize).filter(start => start < bytes.length);
    const parts = await Promise.all(starts.map(async start => {
      const end = Math.min(bytes.length - 1, start + chunkSize - 1);
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Range: `bytes=${start}-${end}` }, redirect: "error", signal: AbortSignal.timeout(30000) });
      if (response.status !== 206 || response.headers.get("content-range") !== `bytes ${start}-${end}/${bytes.length}`) throw Error("云端文件范围校验失败");
      const part = new Uint8Array(await response.arrayBuffer());
      if (part.length !== end - start + 1) throw Error("云端文件长度校验失败");
      return part;
    }));
    for (const part of parts) digest.update(part);
    console.log(`  校验 ${Math.min(100, Math.round((offset + chunkSize * 8) / bytes.length * 100))}%`);
  }
  if (digest.digest("hex") !== hash(bytes)) throw Error("云端文件内容校验失败");
}

try {
  // manifest 最后上传，首次上传中断时不会出现可用元数据指向未上传的视频。
  for (const name of ["head.mp4", "left.mp4", "right.mp4", "frames.json", "manifest.json"]) {
    const bytes = await readFile(fileURLToPath(new URL(name, source)));
    const pathname = `${prefix}/${name}`;
    console.log(`${name}: 检查云端文件…`);
    let existing;
    try { existing = await head(pathname, { token, abortSignal: AbortSignal.timeout(30000) }); }
    catch (error) { if (!(error instanceof BlobNotFoundError)) throw error; }
    if (existing) {
      await verify(existing.url, bytes);
      console.log(`${name}: 已存在，SHA-256 一致 (${bytes.length} bytes)`);
    } else {
      if (verifyOnly) throw Error(`缺少 ${name}`);
      const blob = await put(pathname, bytes, { access: "private", token, addRandomSuffix: false, allowOverwrite: false,
        contentType: name.endsWith(".mp4") ? "video/mp4" : "application/json", abortSignal: AbortSignal.timeout(120000) });
      await verify(blob.url, bytes);
      console.log(`${name}: 上传并校验成功 (${bytes.length} bytes)`);
    }
  }
  console.log("5 个文件全部校验通过。素材仍为私有访问。");
} catch (error) {
  // 不输出 SDK 请求对象，避免凭证出现在日志中。
  console.error(`上传或校验未完成 (${error instanceof Error ? error.name : "UnknownError"})；请检查连接、凭证和同名文件内容。`);
  process.exitCode = 1;
}
