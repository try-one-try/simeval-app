import { api, parse } from "@/server/http/api";
import { idSchema } from "@/domain/evaluation";
import { reportService } from "@/server/application/report";
export function GET(request: Request, context: { params: Promise<{ reportId: string }> }) { return api(request, async actor => ({ data: await reportService.get(actor, parse(idSchema, (await context.params).reportId)) }), ["ENGINEER", "REVIEWER"]); }
