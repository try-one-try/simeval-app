// 记录任务与样本的来源版本，供聊天引用和系统报告核对；不依赖模型或聊天归属。
import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";

export const jsonValue = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export async function sourceSnapshot(db: Prisma.TransactionClient, runId: string, baselineRunId: string | null) {
  const runs = await db.evaluationRun.findMany({ where: { id: { in: [runId, ...(baselineRunId ? [baselineRunId] : [])] } }, orderBy: { id: "asc" },
    select: { id: true, status: true, deletedAt: true, resultsGeneratedAt: true,
      metricResults: { orderBy: { id: "asc" }, select: { id: true, value: true, sampleCount: true } },
      anomalies: { orderBy: { id: "asc" }, select: { id: true, version: true, confirmedRevision: true, status: true } },
    } });
  return { hash: createHash("sha256").update(JSON.stringify(runs)).digest("hex"), runId, baselineRunId };
}
export function snapshotHash(value: unknown) { return z.object({ hash: z.string() }).safeParse(value).data?.hash; }
