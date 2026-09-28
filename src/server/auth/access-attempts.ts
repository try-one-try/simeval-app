import "server-only";

// 访问密码的失败次数按请求来源记录在数据库，多个无状态部署实例共用同一窗口。
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { getDb } from "@/server/db";

const windowMs = 15 * 60 * 1000;
const maxFailures = 5;

function sourceKey(request: Request): string {
  const header = request.headers.get("x-vercel-forwarded-for")
    ?? request.headers.get("x-forwarded-for")
    ?? request.headers.get("x-real-ip")
    ?? "";
  const address = header.split(",")[0]?.trim() ?? "";
  const source = isIP(address) ? address : "unknown";
  return createHmac("sha256", process.env.AUTH_SECRET ?? "")
    .update("access-attempt:" + source).digest("hex");
}

export async function accessAttemptGate(request: Request) {
  const keyHash = sourceKey(request);
  const db = getDb();
  return {
    async isBlocked(now = new Date()): Promise<boolean> {
      const row = await db.accessAttempt.findUnique({ where: { keyHash }, select: { blockedUntil: true } });
      return Boolean(row?.blockedUntil && row.blockedUntil > now);
    },
    async fail(now = new Date()): Promise<void> {
      const cutoff = new Date(now.getTime() - windowMs);
      const blockedUntil = new Date(now.getTime() + windowMs);
      // ON CONFLICT 让同一来源的并发失败计数在 PostgreSQL 内原子递增。
      await db.$executeRaw`
        INSERT INTO "AccessAttempt" ("keyHash", "failures", "windowStartedAt", "blockedUntil")
        VALUES (${keyHash}, 1, ${now}, NULL)
        ON CONFLICT ("keyHash") DO UPDATE SET
          "failures" = CASE WHEN "AccessAttempt"."windowStartedAt" <= ${cutoff} THEN 1 ELSE "AccessAttempt"."failures" + 1 END,
          "windowStartedAt" = CASE WHEN "AccessAttempt"."windowStartedAt" <= ${cutoff} THEN ${now} ELSE "AccessAttempt"."windowStartedAt" END,
          "blockedUntil" = CASE
            WHEN "AccessAttempt"."windowStartedAt" <= ${cutoff} THEN NULL
            WHEN "AccessAttempt"."failures" + 1 >= ${maxFailures} THEN ${blockedUntil}
            ELSE "AccessAttempt"."blockedUntil" END
      `;
    },
    async clear(): Promise<void> {
      await db.accessAttempt.deleteMany({ where: { keyHash } });
    },
  };
}
