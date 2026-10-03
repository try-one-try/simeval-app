import { api, jsonBody, parse } from "@/server/http/api";
import { idSchema } from "@/domain/evaluation";
import { confirmReportSchema } from "@/domain/assistant";
import { reportService } from "@/server/application/report";
export function POST(request: Request, context: { params: Promise<{ reportId: string }> }) { return api(request, async actor => {
  const input = parse(confirmReportSchema, await jsonBody(request));
  return { data: await reportService.confirm(actor, parse(idSchema, (await context.params).reportId), input.expectedSourceHash) };
}, ["REVIEWER"]); }
