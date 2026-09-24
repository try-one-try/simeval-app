import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// 迁移和 Seed 由 Prisma CLI 启动；它不会自动读取 Next.js 的 .env.local。
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // CLI 用该连接执行迁移；网页运行时另经 src/server/db.ts 创建客户端。
    url: process.env.DATABASE_URL,
  },
});
