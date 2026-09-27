// 已有环境只更新目录；不重复恢复 Seed 的固定演示故事。
import { existsSync } from "node:fs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import { parseDatabaseUrl } from "../src/lib/database-url";
import { seedCatalog } from "./catalog";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = new PrismaClient({ adapter: new PrismaMariaDb({ ...parseDatabaseUrl(process.env.DATABASE_URL), connectionLimit: 2 }) });
try { await seedCatalog(db); console.log("Evaluation catalog updated; existing tasks preserved."); }
finally { await db.$disconnect(); }
