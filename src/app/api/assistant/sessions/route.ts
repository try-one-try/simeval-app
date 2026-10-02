import { assistantApi } from "@/server/http/assistant-api";
import { jsonBody, parse } from "@/server/http/api";
import { createSessionSchema } from "@/domain/assistant";
import { assistantService } from "@/server/application/assistant";
export const runtime = "nodejs";
export function GET(request: Request) { return assistantApi(request, actor => assistantService.list(actor)); }
export function POST(request: Request) { return assistantApi(request, async actor => {
  const input = parse(createSessionSchema, await jsonBody(request));
  return assistantService.create(actor, input.runId, input.baselineRunId);
}); }
