import { api, jsonBody, parse } from "@/server/http/api";
import { replaySaveSchema } from "@/domain/replay";
import { replayService } from "@/server/application/replay-service";
type Context = { params: Promise<{ episodeId: string }> };
export async function GET(request: Request, context: Context) {
  return api(request, async actor => ({ data: await replayService.annotations(actor, (await context.params).episodeId) }), ["ENGINEER", "REVIEWER"]);
}
export async function PUT(request: Request, context: Context) {
  return api(request, async actor => ({ data: await replayService.save(actor, (await context.params).episodeId, parse(replaySaveSchema, await jsonBody(request))) }), ["ENGINEER", "REVIEWER"]);
}
