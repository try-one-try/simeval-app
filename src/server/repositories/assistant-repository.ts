// 会话归属、请求去重、预算和终态统一落库；模型网络请求从不放在事务里。
import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/server/db";
import { AppError } from "@/domain/evaluation";
import { evidenceSchema, traceSchema, type AssistantActor, type SessionView, type TurnView } from "@/domain/assistant";
import { agentConfig, agentLimits, promptVersion } from "@/server/agent/config";
import { z } from "zod";
import { jsonValue, sourceSnapshot, snapshotHash } from "./evaluation-snapshot";
export { jsonValue, sourceSnapshot, snapshotHash } from "./evaluation-snapshot";

type Db = Prisma.TransactionClient;
const includeSession = { run: { select: { name: true, deletedAt: true, status: true } }, baseline: { select: { name: true } } } as const;
type SessionRecord = Prisma.AssistantSessionGetPayload<{ include: typeof includeSession }>;
export function sessionView(s: SessionRecord): SessionView {
  return { id: s.id, title: s.title, runId: s.runId, runName: s.run.name || s.runId, baselineRunId: s.baselineRunId, baselineName: s.baseline?.name || null, updatedAt: s.updatedAt.toISOString() };
}
export async function ownedSession(actor: AssistantActor, id: string, db: Db = getDb()) {
  const session = await db.assistantSession.findFirst({ where: { id, ownerId: actor.id, accessId: actor.accessId }, include: includeSession });
  if (!session) throw new AppError("NOT_FOUND", "对话不存在或不属于当前登录", 404);
  if (session.run.deletedAt || session.run.status !== "SUCCEEDED") throw new AppError("STATE_CONFLICT", "该任务已隐藏或结果不可用，请选择其他任务", 409);
  if (session.baselineRunId && actor.role !== "ENGINEER") throw new AppError("FORBIDDEN", "当前角色不能读取比较对话", 403);
  return session;
}
function expiredWhere() { return { status: "RUNNING", deadlineAt: { lt: new Date() } }; }
async function expire(db: Db) {
  // 未知供应商用量保留原预算预留，不能因进程退出而退回可能已消耗的额度。
  await db.assistantTurn.updateMany({ where: expiredWhere(), data: { status: "TIMED_OUT", finishedAt: new Date(), errorCode: "TIMEOUT", errorMessage: "本轮已超时，请重新发送问题" } });
}
export function turnView(t: Prisma.AssistantTurnGetPayload<object>, stale = false): TurnView {
  return { id: t.id, requestKey: t.requestKey, question: t.question, answer: t.answer, status: t.status, errorMessage: t.errorMessage,
    evidence: evidenceSchema.array().safeParse(t.evidence).data || [], traces: traceSchema.array().safeParse(t.traces).data || [],
    createdAt: t.createdAt.toISOString(), model: t.model, inputTokens: t.inputTokens, outputTokens: t.outputTokens, stale };
}
export const assistantRepository = {
  async create(actor: AssistantActor, runId: string, baselineRunId: string | null) {
    // 共用账号也不能无限创建聊天；短事务按访问标识串行。
    return getDb().$transaction(async tx => {
      // PostgreSQL 的锁函数返回 void，转成 text 才能由 Prisma 驱动读取。
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${actor.accessId}))::text`;
      if (await tx.assistantSession.count({ where: { accessId: actor.accessId, ownerId: actor.id } }) >= 40) throw new AppError("SESSION_LIMIT", "本次登录的对话数量已达上限，请继续已有对话", 429);
      const record = await tx.assistantSession.create({ data: { ownerId: actor.id, accessId: actor.accessId, runId, baselineRunId, title: "新的评测调查" }, include: includeSession });
      return sessionView(record);
    });
  },
  async list(actor: AssistantActor) {
    const sessions = await getDb().assistantSession.findMany({ where: { ownerId: actor.id, accessId: actor.accessId, run: { deletedAt: null } }, include: includeSession, orderBy: { updatedAt: "desc" }, take: 40 });
    return sessions.map(sessionView);
  },
  async detail(actor: AssistantActor, id: string) {
    const session = await ownedSession(actor, id);
    await expire(getDb());
    const snapshot = await sourceSnapshot(getDb(), session.runId, session.baselineRunId);
    const turns = await getDb().assistantTurn.findMany({ where: { sessionId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: agentLimits.sessionTurns });
    return { session: sessionView(session), turns: turns.map(t => turnView(t, !!t.sourceSnapshot && snapshotHash(t.sourceSnapshot) !== snapshot.hash)) };
  },
  async begin(actor: AssistantActor, sessionId: string, question: string, requestKey: string, sampleId: string | null = null) {
    const config = agentConfig();
    return getDb().$transaction(async tx => {
      await tx.assistantBudget.upsert({ where: { key: config.budgetKey }, create: { key: config.budgetKey }, update: {} });
      await tx.$queryRaw`SELECT key FROM "AssistantBudget" WHERE key = ${config.budgetKey} FOR UPDATE`;
      const session = await ownedSession(actor, sessionId, tx);
      const old = await tx.assistantTurn.findUnique({ where: { sessionId_requestKey: { sessionId, requestKey } } });
      if (old) {
        const oldSample = z.object({ requestSampleId: z.string().nullable().optional() }).safeParse(old.sourceSnapshot).data?.requestSampleId || null;
        if (old.question !== question || oldSample !== sampleId) throw new AppError("IDEMPOTENCY_CONFLICT", "同一请求标识不能用于不同问题或样本", 409);
        return { session, turn: old, replay: true };
      }
      await expire(tx);
      const active = await tx.assistantTurn.count({ where: { status: "RUNNING", session: { accessId: actor.accessId } } });
      if (active) throw new AppError("RUN_IN_PROGRESS", "当前登录已有问题正在分析，请先等待或停止", 409);
      if (await tx.assistantTurn.count({ where: { status: "RUNNING" } }) >= agentLimits.globalConcurrent) throw new AppError("RATE_LIMITED", "助手正在处理其他请求，请稍后重试", 429);
      if (await tx.assistantTurn.count({ where: { sessionId } }) >= agentLimits.sessionTurns) throw new AppError("CONTEXT_LIMIT", "这段对话已达到轮数上限，请新建对话", 409);
      if (await tx.assistantTurn.count({ where: { session: { accessId: actor.accessId }, createdAt: { gte: new Date(Date.now() - 3600000) } } }) >= agentLimits.turnsPerHour) throw new AppError("RATE_LIMITED", "本次登录提问较频繁，请稍后再试", 429);
      const budget = await tx.assistantBudget.findUniqueOrThrow({ where: { key: config.budgetKey } });
      if (budget.committedMicros + agentLimits.reserveMicros > config.budgetMicros) throw new AppError("BUDGET_EXHAUSTED", "AI 演示额度不足，已保存的历史仍可查看，请联系管理员", 429);
      await tx.assistantBudget.update({ where: { key: config.budgetKey }, data: { committedMicros: { increment: agentLimits.reserveMicros } } });
      const snapshot = await sourceSnapshot(tx, session.runId, session.baselineRunId);
      const turn = await tx.assistantTurn.create({ data: { id: randomUUID(), sessionId, requestKey, question, status: "RUNNING", model: config.model,
        promptVersion, budgetKey: config.budgetKey, reservedMicros: agentLimits.reserveMicros, deadlineAt: new Date(Date.now() + agentLimits.timeoutMs), sourceSnapshot: jsonValue({ ...snapshot, requestSampleId: sampleId }) } });
      await tx.assistantSession.update({ where: { id: sessionId }, data: { title: question.slice(0, 60), updatedAt: new Date() } });
      return { session, turn, replay: false };
    }, { timeout: 15000, maxWait: 10000 });
  },
  async history(sessionId: string, before: Date) {
    return getDb().assistantTurn.findMany({ where: { sessionId, status: "SUCCEEDED", createdAt: { lt: before } }, orderBy: { createdAt: "desc" }, take: agentLimits.historyTurns });
  },
  async running(turnId: string) {
    const turn = await getDb().assistantTurn.findUnique({ where: { id: turnId }, select: { status: true, deadlineAt: true } });
    return !!turn && turn.status === "RUNNING" && turn.deadlineAt.getTime() > Date.now();
  },
  async stop(actor: AssistantActor, sessionId: string, turnId: string) {
    await ownedSession(actor, sessionId);
    await getDb().assistantTurn.updateMany({ where: { id: turnId, sessionId, status: "RUNNING" }, data: { status: "CANCELLED", finishedAt: new Date(), errorCode: "CANCELLED", errorMessage: "本轮已停止" } });
  },
  async finish(turnId: string, data: Prisma.AssistantTurnUpdateManyMutationInput, charge: number | null) {
    return getDb().$transaction(async tx => {
      const initial = await tx.assistantTurn.findUniqueOrThrow({ where: { id: turnId } });
      await tx.$queryRaw`SELECT key FROM "AssistantBudget" WHERE key = ${initial.budgetKey} FOR UPDATE`;
      const turn = await tx.assistantTurn.findUniqueOrThrow({ where: { id: turnId } });
      // 先确定费用，再条件写状态；停止或超时的终态不能被晚到的成功覆盖。
      if (turn.chargedMicros === null && charge !== null) {
        const finalCharge = Math.max(0, Math.ceil(charge));
        await tx.assistantBudget.update({ where: { key: turn.budgetKey }, data: { committedMicros: { increment: finalCharge - turn.reservedMicros } } });
        await tx.assistantTurn.update({ where: { id: turnId }, data: { chargedMicros: finalCharge } });
      }
      await tx.assistantTurn.updateMany({ where: { id: turnId, status: "RUNNING" }, data: { ...data, finishedAt: new Date() } });
      return turnView(await tx.assistantTurn.findUniqueOrThrow({ where: { id: turnId } }));
    });
  },
};
