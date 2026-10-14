import "server-only";
import { assertRole, type Actor } from "@/domain/evaluation";
import { replayPresetAnnotations, type ReplaySaveInput } from "@/domain/replay";
import { replaySource } from "@/server/providers/replay-source";
import { replayRepository } from "@/server/repositories/replay-repository";

export const replayService = {
  async data(actor: Actor, id: string) { assertRole(actor, ["ENGINEER", "REVIEWER"]); return replaySource(id); },
  async annotations(actor: Actor, id: string) {
    const { manifest } = await replayService.data(actor, id);
    const saved = await replayRepository.read(actor, id);
    return saved.version === 0 ? { ...saved, annotations: replayPresetAnnotations(manifest.frameCount, manifest.fps) } : saved;
  },
  async save(actor: Actor, id: string, input: ReplaySaveInput) {
    assertRole(actor, ["ENGINEER", "REVIEWER"]);
    const { manifest } = await replayService.data(actor, id);
    return replayRepository.save(actor, id, input, manifest.frameCount);
  },
};
