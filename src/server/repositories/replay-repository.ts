import "server-only";
import { getDb } from "@/server/db";
import { AppError, assertRole, type Actor } from "@/domain/evaluation";
import { replayAnnotationSchema, validateReplayAnnotations, type ReplaySaveInput } from "@/domain/replay";
import type { ReplayAnnotations } from "@/lib/replay-dto";

const conflict = () => new AppError("VERSION_CONFLICT", "标注已被其他人修改，你的输入已保留。请读取最新标注并核对后再保存。", 409);
function dto(row: { version: number; annotations: unknown; updatedAt: Date; updatedBy: { name: string } } | null): ReplayAnnotations {
  return row ? { version: row.version, annotations: replayAnnotationSchema.array().parse(row.annotations), updatedAt: row.updatedAt.toISOString(), updatedBy: row.updatedBy.name }
    : { version: 0, annotations: [], updatedAt: null, updatedBy: null };
}
export const replayRepository = {
  async read(actor: Actor, episodeId: string) {
    assertRole(actor, ["ENGINEER", "REVIEWER"]);
    return dto(await getDb().replayAnnotationSet.findUnique({ where: { episodeId }, include: { updatedBy: { select: { name: true } } } }));
  },
  async save(actor: Actor, episodeId: string, input: ReplaySaveInput, frameCount: number) {
    assertRole(actor, ["ENGINEER", "REVIEWER"]);
    validateReplayAnnotations(input, frameCount);
    try {
      return await getDb().$transaction(async tx => {
        const before = await tx.replayAnnotationSet.findUnique({ where: { episodeId } });
        if ((before?.version ?? 0) !== input.expectedVersion) throw conflict();
        if (!before) {
          await tx.replayAnnotationSet.create({ data: { episodeId, annotations: input.annotations, updatedById: actor.id } });
        } else {
          const changed = await tx.replayAnnotationSet.updateMany({ where: { episodeId, version: input.expectedVersion },
            data: { annotations: input.annotations, version: { increment: 1 }, updatedById: actor.id } });
          if (changed.count !== 1) throw conflict();
        }
        await tx.auditLog.create({ data: { actorId: actor.id, action: "replay.annotations.save", entityType: "ReplayEpisode", entityId: episodeId,
          requestId: actor.requestId ?? "replay", metadata: { previousVersion: input.expectedVersion, version: input.expectedVersion + 1,
            before: before?.annotations ?? [], after: input.annotations } } });
        return dto(await tx.replayAnnotationSet.findUniqueOrThrow({ where: { episodeId }, include: { updatedBy: { select: { name: true } } } }));
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") throw conflict();
      throw error;
    }
  },
};
