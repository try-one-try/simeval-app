// 已有环境增量补目录与十条核心示例；保留已有结果、人工结论和删除状态。
import { existsSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { databasePoolConfig, getMaintenanceDatabaseUrl } from "../src/lib/database-url";
import { seedCatalog } from "./catalog";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = new PrismaClient({ adapter: new PrismaPg(databasePoolConfig(getMaintenanceDatabaseUrl(process.env), 2)) });
try { await seedCatalog(db); console.log("Catalog and missing core demo fixtures added; existing results and reviews preserved."); }
finally { await db.$disconnect(); }
