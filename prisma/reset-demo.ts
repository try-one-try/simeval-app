// 手动恢复入口；普通构建、发布、登录不会调用它。
import { existsSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { databasePoolConfig } from "../src/lib/database-url";
import { describeDemoResetFailure, validateDemoReset } from "../src/lib/demo-reset";
import { resetDemoData } from "./reset-data";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const settings = validateDemoReset(process.env, process.argv.slice(2));
const db = new PrismaClient({ adapter: new PrismaPg(databasePoolConfig(settings.url, 2)) });
const startedAt = Date.now();
let stage = "等待数据库事务";
try {
  console.info("开始恢复：等待事务最多 15 秒，清理和重建最多 3 分钟。");
  await resetDemoData(db, nextStage => {
    stage = nextStage;
    console.info(`[${((Date.now() - startedAt) / 1000).toFixed(1)} 秒] ${stage}`);
  });
  console.info("演示库已恢复为默认 Seed，新增任务和人工改动已清理，表结构保留。");
} catch (error) {
  const failure = describeDemoResetFailure(error);
  console.error("恢复未完成，事务已回滚；请核对专用演示库、权限和连接。");
  console.error(`失败阶段：${stage}；耗时：${((Date.now() - startedAt) / 1000).toFixed(1)} 秒；错误代码：${failure.code}`);
  console.error(`原因：${failure.reason}`);
  process.exitCode = 1;
} finally { await db.$disconnect(); }
