import { assistantApi } from "@/server/http/assistant-api";
import { parse } from "@/server/http/api";
import { idSchema } from "@/domain/evaluation";
import { reportService } from "@/server/application/report";
export function GET(request: Request, context: { params: Promise<{ reportId: string }> }) { return assistantApi(request, async actor => reportService.get(actor, parse(idSchema, (await context.params).reportId))); }
