-- 演示账号改用共享访问密码；历史口令列保留为可空，避免删除非演示账号资料。
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- 登录失败窗口跨 Vercel 实例共享，只记录来源摘要，不记录 IP 或口令。
CREATE TABLE "AccessAttempt" (
  "keyHash" VARCHAR(64) NOT NULL,
  "failures" INTEGER NOT NULL DEFAULT 0,
  "windowStartedAt" TIMESTAMP(3) NOT NULL,
  "blockedUntil" TIMESTAMP(3),
  CONSTRAINT "AccessAttempt_pkey" PRIMARY KEY ("keyHash")
);
