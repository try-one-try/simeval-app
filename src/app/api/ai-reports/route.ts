import { z } from "zod";
import { assistantApi } from "@/server/http/assistant-api";
import { jsonBody, parse } from "@/server/http/api";
import { idSchema } from "@/domain/evaluation";
import { reportService } from "@/server/application/report";
const createSchema = z.object({ sessionId: idSchema, turnId: idSchema }).strict();
export function GET(request: Request) { return assistantApi(request, actor => reportService.list(actor, parse(idSchema, new URL(request.url).searchParams.get("runId")))); }
export function POST(request: Request) { return assistantApi(request, async actor => {
  const input = parse(createSchema, await jsonBody(request)); return reportService.create(actor, input.sessionId, input.turnId);
}); }
