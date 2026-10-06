// 仅供负责人维护专用演示库；清理与重建同一事务提交，失败保留原数据和表结构。
import type { PrismaClient } from "../src/generated/prisma/client";
import { DemoResetGuardError } from "../src/lib/demo-reset";
import { seedDefaultData } from "./seed-data";

export type DemoResetStage = "校验演示库" | "清理业务记录" | "重建默认 Seed";

export async function resetDemoData(db: PrismaClient, onStage?: (stage: DemoResetStage) => void) {
  await db.$transaction(async tx => {
    onStage?.("校验演示库");
    const projects = await tx.project.findMany({ select: { slug: true } });
    const users = await tx.user.findMany({ select: { isDemo: true } });
    if (projects.length !== 1 || projects[0].slug !== "warehouse-manipulation" || users.some(user => !user.isDemo)) {
      throw new DemoResetGuardError("NOT_DEMO_DATABASE");
    }
    // 先删除引用方，再删除父记录；任务自关联先解除，不使用 DROP／TRUNCATE CASCADE。
    // 恢复会清理聊天，但保留累计费用账本，避免恢复演示数据变相补充 AI 额度。
    if (await tx.assistantTurn.count({ where: { status: "RUNNING", deadlineAt: { gt: new Date() } } })) {
      throw new DemoResetGuardError("ACTIVE_ASSISTANT");
    }
    onStage?.("清理业务记录");
    await tx.assistantTurn.deleteMany();
    await tx.assistantSession.deleteMany();
    await tx.accessAttempt.deleteMany();
    await tx.auditLog.deleteMany();
    await tx.aIReport.deleteMany();
    await tx.backfillTask.deleteMany();
    await tx.reviewRecord.deleteMany();
    await tx.metricResult.deleteMany();
    await tx.anomalySample.deleteMany();
    await tx.evaluationRun.updateMany({ data: { baselineRunId: null, retryOfRunId: null } });
    await tx.evaluationRun.deleteMany();
    await tx.dataQualityCheck.deleteMany();
    await tx.metricDefinition.deleteMany();
    await tx.benchmark.deleteMany();
    await tx.datasetVersion.deleteMany();
    await tx.modelVersion.deleteMany();
    await tx.project.deleteMany();
    await tx.user.deleteMany();
    onStage?.("重建默认 Seed");
    await seedDefaultData(tx);
  // 远程建连可能超过 Prisma 默认的 2 秒；默认数据要顺序写入，1 分钟也可能不够。
  // 这里只放宽手动维护的上限：等待事务最多 15 秒，执行最多 3 分钟，失败仍整批回滚。
  }, { maxWait: 15_000, timeout: 180_000 });
}
