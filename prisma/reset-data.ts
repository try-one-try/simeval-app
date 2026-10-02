// 仅供负责人维护专用演示库；清理与重建同一事务提交，失败保留原数据和表结构。
import type { PrismaClient } from "../src/generated/prisma/client";
import { seedDefaultData } from "./seed-data";

export async function resetDemoData(db: PrismaClient) {
  await db.$transaction(async tx => {
    const projects = await tx.project.findMany({ select: { slug: true } });
    const users = await tx.user.findMany({ select: { isDemo: true } });
    if (projects.length !== 1 || projects[0].slug !== "warehouse-manipulation" || users.some(user => !user.isDemo)) {
      throw new Error("恢复只允许专用 SimEval 演示库，不能包含其他项目或真实用户。");
    }
    // 先删除引用方，再删除父记录；任务自关联先解除，不使用 DROP／TRUNCATE CASCADE。
    // 恢复会清理聊天，但保留累计费用账本，避免恢复演示数据变相补充 AI 额度。
    if (await tx.assistantTurn.count({ where: { status: "RUNNING", deadlineAt: { gt: new Date() } } })) {
      throw new Error("请先停止进行中的助手分析，再恢复演示库。");
    }
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
    await seedDefaultData(tx);
  }, { timeout: 60_000 });
}
