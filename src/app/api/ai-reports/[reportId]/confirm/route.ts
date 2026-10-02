import { assistantApi } from "@/server/http/assistant-api";
import { parse } from "@/server/http/api";
import { idSchema } from "@/domain/evaluation";
import { reportService } from "@/server/application/report";
export function POST(request: Request, context: { params: Promise<{ reportId: string }> }) { return assistantApi(request, async actor => reportService.confirm(actor, parse(idSchema, (await context.params).reportId))); }
