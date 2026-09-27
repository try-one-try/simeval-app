// 网页运行时的数据库入口：把经校验的连接参数交给 Prisma；每个服务进程复用客户端和连接池。
import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getDatabaseConnection } from "@/server/env";

const globalForPrisma = globalThis as typeof globalThis & { simevalPrisma?: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaPg(getDatabaseConnection());
  return new PrismaClient({ adapter });
}

export function getDb() {
  const db = globalForPrisma.simevalPrisma ?? createPrismaClient();
  globalForPrisma.simevalPrisma = db;
  return db;
}
