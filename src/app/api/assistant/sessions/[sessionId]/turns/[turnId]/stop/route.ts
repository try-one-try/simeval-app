import { assistantApi } from "@/server/http/assistant-api";
import { parse } from "@/server/http/api";
import { idSchema } from "@/domain/evaluation";
import { assistantService } from "@/server/application/assistant";
export function POST(request: Request, context: { params: Promise<{ sessionId: string; turnId: string }> }) {
  return assistantApi(request, async actor => {
    const params = await context.params;
    return assistantService.stop(actor, parse(idSchema, params.sessionId), parse(idSchema, params.turnId));
  });
}
