// 仅在独立 PostgreSQL 测试库验证完整恢复、事务回滚和专用演示库限制。
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { databasePoolConfig, parseDatabaseUrl } from "../../src/lib/database-url";
import * as seed from "../../prisma/seed-data";
import { resetDemoData } from "../../prisma/reset-data";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (existsSync(".env.test.local")) process.loadEnvFile(".env.test.local");
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("完整演示恢复", () => {
  let db: PrismaClient;
  let password: string;
  beforeAll(async () => {
    if (!url || parseDatabaseUrl(url).database !== "simeval_test" || url === process.env.DATABASE_URL) throw new Error("必须使用独立 simeval_test");
    password = process.env.DEMO_PASSWORD ?? "";
    if (!password) throw new Error("DEMO_PASSWORD is required");
    execSync("npm run db:deploy", { env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url, DATABASE_URL_UNPOOLED: url }, stdio: "pipe", timeout: 60_000 });
    db = new PrismaClient({ adapter: new PrismaPg(databasePoolConfig(url, 2)) });
    await db.$transaction(tx => seed.seedDefaultData(tx, password), { timeout: 60_000 });
  }, 120_000);
  afterAll(async () => { if (db) await db.$disconnect(); });

  it("删除新增任务／证据／审计，恢复固定结论与删除状态，可重复执行", async () => {
    const fixture = await db.evaluationRun.findUniqueOrThrow({ where: { id: "demo-run-clean" } });
    const sample = await db.anomalySample.findUniqueOrThrow({ where: { id: "demo-run-evidence-review-sample-017" } });
    await db.evaluationRun.create({ data: { id: "test-reset-extra", name: "Reset Test", projectId: fixture.projectId, modelVersionId: fixture.modelVersionId,
      datasetVersionId: fixture.datasetVersionId, benchmarkId: fixture.benchmarkId, baselineRunId: fixture.id, createdById: fixture.createdById,
      provider: fixture.provider, episodeCount: 200, simulationSeed: 20260901, status: "CANCELLED" } });
    await db.auditLog.create({ data: { actorId: fixture.createdById, action: "RESET_TEST", entityType: "EvaluationRun", entityId: "test-reset-extra", requestId: "reset-test" } });
    await db.anomalySample.update({ where: { id: sample.id }, data: { conclusion: "人工改动", draftConclusion: "新草稿", version: 9 } });
    await db.evaluationRun.update({ where: { id: fixture.id }, data: { deletedAt: new Date(), deletedById: fixture.createdById } });
    for (let index = 0; index < 2; index++) {
      await resetDemoData(db, password);
      expect(await db.evaluationRun.count()).toBe(10);
      expect(await db.evaluationRun.count({ where: { isDemoFixture: false } })).toBe(0);
      expect(await db.evaluationRun.count({ where: { deletedAt: { not: null } } })).toBe(0);
      expect(await db.auditLog.count({ where: { requestId: "reset-test" } })).toBe(0);
      expect(await db.anomalySample.findUniqueOrThrow({ where: { id: sample.id } })).toMatchObject({ conclusion: sample.conclusion, draftConclusion: sample.draftConclusion, version: sample.version, confirmedRevision: 2 });
      expect(await db.aIReport.count()).toBe(1);
      expect(await db.user.count()).toBe(3);
    }
  }, 120_000);

  it("重建中失败时清理也回滚，不留下空库", async () => {
    const before = { runs: await db.evaluationRun.count(), samples: await db.anomalySample.count(), reviews: await db.reviewRecord.count(), audits: await db.auditLog.count() };
    const rebuild = vi.spyOn(seed, "seedDefaultData").mockRejectedValueOnce(new Error("TEST_REBUILD_FAILURE"));
    try { await expect(resetDemoData(db, password)).rejects.toThrow("TEST_REBUILD_FAILURE"); }
    finally { rebuild.mockRestore(); }
    expect({ runs: await db.evaluationRun.count(), samples: await db.anomalySample.count(), reviews: await db.reviewRecord.count(), audits: await db.auditLog.count() }).toEqual(before);
  });

  it("存在真实用户时拒绝清理", async () => {
    const account = await db.user.create({ data: { email: "reset-test@example.com", name: "Real User", role: "ENGINEER", passwordHash: "fake", isDemo: false } });
    try {
      await expect(resetDemoData(db, password)).rejects.toThrow("专用");
      expect(await db.user.findUnique({ where: { id: account.id } })).not.toBeNull();
      expect(await db.evaluationRun.count()).toBe(10);
    } finally { await db.user.delete({ where: { id: account.id } }); }
  });
});
