import { assistantApi } from "@/server/http/assistant-api";
import { parse } from "@/server/http/api";
import { idSchema } from "@/domain/evaluation";
import { assistantService } from "@/server/application/assistant";
export function GET(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  return assistantApi(request, async actor => assistantService.detail(actor, parse(idSchema, (await context.params).sessionId)));
}
