// 独立测试库验收：真实迁移和两次 Seed 后，固定故事的标识、数量与关系保持稳定。
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { compare } from "bcryptjs";
import { PrismaClient } from "../../src/generated/prisma/client";
import { describe, expect, it, vi } from "vitest";
import { parseDatabaseUrl } from "../../src/lib/database-url";
import { isDemoAccount } from "../../src/lib/demo-identity";

vi.mock("server-only", () => ({}));

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
      expect(second.runs).toHaveLength(4);
      const { seedCatalog } = await import("../../prisma/catalog");
      const historicalId = "demo-run-v21";
      const historical = await db.evaluationRun.findUniqueOrThrow({ where: { id: historicalId }, include: { metricResults: true } });
      expect(historical.metricResults).toHaveLength(4);
      expect(historical.episodeCount).toBe(200);
      // 增量更新不能恢复已经修改的记录；完成后还原测试夹具以免影响其他用例。
      const result = historical.metricResults.find(metric => metric.id === historicalId + "-success")!;
      try {
        await db.evaluationRun.update({ where: { id: historicalId }, data: { name: "保留已有名称" } });
        await db.metricResult.update({ where: { id: result.id }, data: { value: 69 } });
        await seedCatalog(db);
        await seedCatalog(db);
        expect((await db.evaluationRun.findUniqueOrThrow({ where: { id: historicalId } })).name).toBe("保留已有名称");
        expect(Number((await db.metricResult.findUniqueOrThrow({ where: { id: result.id } })).value)).toBe(69);
        expect(await db.evaluationRun.count({ where: { isDemoFixture: true } })).toBe(4);
      } finally {
        await db.evaluationRun.update({ where: { id: historicalId }, data: { name: historical.name } });
        await db.metricResult.update({ where: { id: result.id }, data: { value: result.value } });
      }
      expect(second.samples).toHaveLength(2);
      expect(second.report).toEqual({ id: "demo-report-confirmed", runId: "demo-run-candidate", baselineRunId: "demo-run-baseline" });
      // 验证页面实际使用的关系查询，而不只检查表中存在固定 ID。
      const { overviewRepository } = await import("../../src/server/repositories/overview-repository");
      const { getDb } = await import("../../src/server/db");
      try {
        const project = await overviewRepository.getDemoProject();
        const candidate = project?.runs.find((run) => run.baselineRunId);
        expect(candidate?.episodeCount).toBe(200);
        expect(candidate?.metricResults).toHaveLength(4);
        expect(candidate?.anomalies.filter((sample) => sample.status === "RESOLVED")).toHaveLength(2);
        expect(candidate?.anomalies.flatMap((sample) => sample.backfills)).toHaveLength(1);
        expect(candidate?.reports[0].confirmedBy?.name).toBe("陈复核");
      } finally {
        await getDb().$disconnect();
      }
      const demoPassword = process.env.DEMO_PASSWORD;
      if (!demoPassword) throw new Error("Seed demo password missing");
      // 两个公开身份都能认证；历史管理员只保留数据，不成为第三个产品入口。
      for (const id of ["demo-user-engineer", "demo-user-reviewer"]) {
        const account = await db.user.findUnique({ where: { id } });
        if (!account) throw new Error("Seed demo account missing");
        expect(isDemoAccount(account)).toBe(true);
        expect(await compare(demoPassword, account.passwordHash)).toBe(true);
      }
      const administrator = await db.user.findUnique({ where: { id: "demo-user-admin" } });
      if (!administrator) throw new Error("Historical Seed administrator missing");
      expect(isDemoAccount(administrator)).toBe(false);
    } finally {
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDatabaseUrl;
      await db.$disconnect();
    }
  }, 180_000);
});
