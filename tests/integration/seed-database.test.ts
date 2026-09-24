// 独立测试库验收：真实迁移和两次 Seed 后，固定故事的标识、数量与关系保持稳定。
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { compare } from "bcryptjs";
import { PrismaClient } from "../../src/generated/prisma/client";
import { describe, expect, it, vi } from "vitest";
import { parseDatabaseUrl } from "../../src/lib/database-url";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (existsSync(".env.test.local")) process.loadEnvFile(".env.test.local");

const testUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testUrl)("独立 MySQL 测试库", () => {
  it("应用已有迁移并重复 Seed，不复制预置故事", async () => {
    if (!testUrl) throw new Error("TEST_DATABASE_URL is required");
    const testConnection = parseDatabaseUrl(testUrl);
    if (testConnection.database !== "simeval_test" || testUrl === process.env.DATABASE_URL) {
      throw new Error("集成测试只能连接独立的 simeval_test，不能连接开发库");
    }
    if (!process.env.DEMO_PASSWORD) throw new Error("DEMO_PASSWORD is required for Seed");

    const environment = { ...process.env, DATABASE_URL: testUrl };
    execSync("npm run db:deploy", { env: environment, stdio: "pipe", timeout: 60_000 });

    const db = new PrismaClient({ adapter: new PrismaMariaDb({ ...testConnection, connectionLimit: 2 }) });
    const originalDatabaseUrl = process.env.DATABASE_URL;
    try {
      const snapshot = async () => ({
        users: await db.user.findMany({ where: { isDemo: true }, select: { id: true, role: true }, orderBy: { id: "asc" } }),
        project: await db.project.findUnique({ where: { slug: "warehouse-manipulation" }, select: { id: true } }),
        runs: await db.evaluationRun.findMany({ where: { isDemoFixture: true }, select: { id: true, modelVersionId: true, datasetVersionId: true }, orderBy: { id: "asc" } }),
        samples: await db.anomalySample.findMany({ where: { runId: "demo-run-candidate" }, select: { id: true, runId: true }, orderBy: { id: "asc" } }),
        report: await db.aIReport.findUnique({ where: { id: "demo-report-confirmed" }, select: { id: true, runId: true, baselineRunId: true } }),
      });

      // 直接导入同一个 Seed 文件，避开受限终端中 tsx 子进程的 os.userInfo() 错误。
      process.env.DATABASE_URL = testUrl;
      vi.resetModules();
      await import("../../prisma/seed");
      const first = await snapshot();
      vi.resetModules();
      await import("../../prisma/seed");
      const second = await snapshot();

      expect(second).toEqual(first);
      expect(second.users).toHaveLength(3);
      expect(second.project?.id).toBe("demo-project-warehouse");
      expect(second.runs).toHaveLength(2);
      expect(second.samples).toHaveLength(2);
      expect(second.report).toEqual({ id: "demo-report-confirmed", runId: "demo-run-candidate", baselineRunId: "demo-run-baseline" });
      const engineer = await db.user.findUnique({ where: { id: "demo-user-engineer" }, select: { passwordHash: true } });
      const demoPassword = process.env.DEMO_PASSWORD;
      if (!engineer || !demoPassword) throw new Error("Seed engineer or demo password missing");
      expect(await compare(demoPassword, engineer.passwordHash)).toBe(true);
    } finally {
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDatabaseUrl;
      await db.$disconnect();
    }
  }, 180_000);
});
