import { api } from "@/server/http/api";
import { replayService } from "@/server/application/replay-service";
export async function GET(request: Request, context: { params: Promise<{ episodeId: string }> }) {
  return api(request, async actor => ({ data: await replayService.data(actor, (await context.params).episodeId) }), ["ENGINEER", "REVIEWER"]);
}
