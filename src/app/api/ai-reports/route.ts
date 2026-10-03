// 沿用历史 URL，业务已改为每任务唯一系统报告，不依赖聊天会话。
import { api, jsonBody, parse } from "@/server/http/api";
import { idSchema } from "@/domain/evaluation";
import { generateReportSchema } from "@/domain/assistant";
import { reportService } from "@/server/application/report";
export function GET(request: Request) { return api(request, async actor => ({ data: await reportService.list(actor, parse(idSchema, new URL(request.url).searchParams.get("runId"))) }), ["ENGINEER", "REVIEWER"]); }
export function POST(request: Request) { return api(request, async actor => {
  const input = parse(generateReportSchema, await jsonBody(request)); return { data: await reportService.create(actor, input.runId) };
}, ["ENGINEER", "REVIEWER"]); }
