import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ head: vi.fn() }));
vi.mock("@vercel/blob", () => ({ head: mocks.head }));

describe("私有回放素材传输", () => {
  beforeEach(() => {
    vi.resetModules(); vi.stubEnv("REPLAY_STORAGE", "blob"); vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-only-token");
    mocks.head.mockReset();
    mocks.head.mockResolvedValue({ url: "https://test.private.blob.vercel-storage.com/video.mp4", size: 10 });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("Range 原样请求并检查范围，凭证只发给私有 Blob", async () => {
    const request = vi.fn().mockResolvedValue(new Response(new Uint8Array([1,2,3]), { status: 206, headers: { "content-length": "3", "content-range": "bytes 2-4/10" } }));
    vi.stubGlobal("fetch", request);
    const { replayAsset, replayAssetStream } = await import("@/server/providers/replay-storage");
    const asset = await replayAsset("head.mp4");
    const body = await replayAssetStream(asset, { start: 2, end: 4 });
    expect(new Uint8Array(await new Response(body).arrayBuffer())).toEqual(new Uint8Array([1,2,3]));
    expect(request.mock.calls[0][1]).toMatchObject({ redirect: "error", cache: "no-store", headers: { Range: "bytes=2-4", Authorization: "Bearer test-only-token" } });
  });

  it("上游忽略 Range 时拒绝冒充 206", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array(10), { status: 200, headers: { "content-length": "10" } })));
    const { replayAsset, replayAssetStream } = await import("@/server/providers/replay-storage");
    await expect(replayAssetStream(await replayAsset("head.mp4"), { start: 2, end: 4 })).rejects.toThrow("Unexpected Blob");
  });

  it("JSON 经 CDN 压缩且省略长度时，核对解压后字节数", async () => {
    const json = '{"id":1}';
    mocks.head.mockResolvedValue({ url: "https://test.private.blob.vercel-storage.com/manifest.json", size: new TextEncoder().encode(json).length });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(json, { headers: { "content-encoding": "br" } })));
    const { replayAssetText } = await import("@/server/providers/replay-storage");
    expect(await replayAssetText("manifest.json")).toBe(json);
  });

  it("公开或任意外部地址不可接收私有凭证", async () => {
    mocks.head.mockResolvedValue({ url: "https://example.com/video.mp4", size: 10 });
    const request = vi.fn(); vi.stubGlobal("fetch", request);
    const { replayAsset } = await import("@/server/providers/replay-storage");
    await expect(replayAsset("head.mp4")).rejects.toThrow("Expected private Blob");
    expect(request).not.toHaveBeenCalled();
  });

  it("读取失败可重试，错误 Episode 与摄像头不读取云端", async () => {
    mocks.head.mockRejectedValue(Error("Unavailable"));
    const { replaySource, replayVideo } = await import("@/server/providers/replay-source");
    await expect(replaySource("agibot-2026-episode-0")).rejects.toMatchObject({ status: 503 });
    const calls = mocks.head.mock.calls.length;
    await expect(replaySource("agibot-2026-episode-0")).rejects.toMatchObject({ status: 503 });
    expect(mocks.head.mock.calls.length).toBeGreaterThan(calls);
    mocks.head.mockClear();
    await expect(replaySource("../other")).rejects.toMatchObject({ status: 404 });
    await expect(replayVideo("agibot-2026-episode-0", "../head")).rejects.toMatchObject({ status: 404 });
    expect(mocks.head).not.toHaveBeenCalled();
  });
});
