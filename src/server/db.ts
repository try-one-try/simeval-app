// 网页运行时的数据库入口：把经校验的连接参数交给 Prisma；开发热更新时复用客户端。
import "server-only";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";
import { getDatabaseConnection } from "@/server/env";

const globalForPrisma = globalThis as typeof globalThis & { simevalPrisma?: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaMariaDb({ ...getDatabaseConnection(), connectionLimit: 5 });
  return new PrismaClient({ adapter });
}

export function getDb() {
  const db = globalForPrisma.simevalPrisma ?? createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.simevalPrisma = db;
  }
  return db;
}
