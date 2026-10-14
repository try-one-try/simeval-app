// 只在独立 simeval_test 中验证新表；测试记录使用随机键，清理限定本文件。
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Actor } from "@/domain/evaluation";
vi.mock("server-only", () => ({}));
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (existsSync(".env.test.local")) process.loadEnvFile(".env.test.local");
const testUrl = process.env.TEST_DATABASE_URL, original = process.env.DATABASE_URL;
describe.skipIf(!testUrl)("回放标注持久化", () => {
  let db: ReturnType<typeof import("@/server/db").getDb>;
  let repo: typeof import("@/server/repositories/replay-repository").replayRepository;
  const episode = `replay-test-${randomUUID()}`;
  const reviewer: Actor = { id: "demo-user-reviewer", role: "REVIEWER", requestId: "replay-integration" };
  const engineer: Actor = { id: "demo-user-engineer", role: "ENGINEER" };
  const first = { id: randomUUID(), label: "测试阶段", note: "仅用于独立测试库", startFrame: 0, endFrame: 30 };
  beforeAll(async () => {
    if (!testUrl || new URL(testUrl).pathname !== "/simeval_test" || testUrl === original) throw Error("需要独立测试库");
    execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy","--config","prisma7.config.ts"], {
      env: { ...process.env, DATABASE_URL: testUrl, DIRECT_URL: testUrl, DATABASE_URL_UNPOOLED: testUrl }, stdio: "pipe", timeout: 60000,
    });
    process.env.DATABASE_URL = testUrl; vi.resetModules();
    db = (await import("@/server/db")).getDb();
    const { seedDefaultData } = await import("../../prisma/seed-data");
    await db.$transaction(tx => seedDefaultData(tx), { timeout: 60000 });
    repo = (await import("@/server/repositories/replay-repository")).replayRepository;
  },120000);
  afterAll(async () => {
    if (db) { await db.auditLog.deleteMany({ where: { entityType: "ReplayEpisode", entityId: episode } }); await db.replayAnnotationSet.deleteMany({ where: { episodeId: episode } }); await db.$disconnect(); }
    if (original === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = original;
  });
  it("两种身份共同编辑；首次并发创建仅一个成功，冲突不追加审计", async () => {
    expect((await repo.read(engineer,episode)).version).toBe(0);
    const results = await Promise.allSettled([engineer,reviewer].map(actor => repo.save(actor,episode,{expectedVersion:0,annotations:[first]},2089)));
    expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
    expect(results.find(r=>r.status==="rejected")).toMatchObject({reason:{status:409}});
    expect((await repo.read(engineer,episode)).annotations).toEqual([first]);
    expect(await db.auditLog.count({where:{entityId:episode}})).toBe(1);
  });
  it("同版本并发更新仅一个成功，保存失败时标注与审计一起回滚", async () => {
    const results = await Promise.allSettled(["A","B"].map(label => repo.save(engineer,episode,{expectedVersion:1,annotations:[{...first,label}]},2089)));
    expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
    expect(results.find(r=>r.status==="rejected")).toMatchObject({reason:{status:409}});
    expect((await repo.read(engineer,episode)).version).toBe(2);
    await expect(repo.save({...reviewer,requestId:"x".repeat(129)},episode,{expectedVersion:2,annotations:[]},2089)).rejects.toThrow();
    expect((await repo.read(engineer,episode)).version).toBe(2);
    expect(await db.auditLog.count({where:{entityId:episode}})).toBe(2);
  });
});
