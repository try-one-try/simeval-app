// 初始化固定合成故事；使用 CLI 直连，失败会回滚，不会清理已有用户任务。
import { existsSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { databasePoolConfig, getMaintenanceDatabaseUrl } from "../src/lib/database-url";
import { seedDefaultData } from "./seed-data";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const demoPassword = process.env.DEMO_PASSWORD;
if (!demoPassword) throw new Error("DEMO_PASSWORD is required for Seed");
const db = new PrismaClient({ adapter: new PrismaPg(databasePoolConfig(getMaintenanceDatabaseUrl(process.env), 2)) });
try {
  await db.$transaction(tx => seedDefaultData(tx, demoPassword), { timeout: 60_000 });
  console.info("Synthetic Seed ready: " + await db.evaluationRun.count({ where: { isDemoFixture: true } }) + " fixture runs.");
} finally { await db.$disconnect(); }
