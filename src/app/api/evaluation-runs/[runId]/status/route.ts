// GET 状态严格只读；模拟推进需要显式 POST sync。
import { api, parse } from "@/server/http/api";
import { idSchema } from "@/domain/evaluation";
import { evaluationService, statusDto } from "@/server/application/evaluation";
export function GET(request: Request, context: { params: Promise<{ runId: string }> }) {
  return api(request, async (actor) => ({ data: statusDto(await evaluationService.get(actor, parse(idSchema, (await context.params).runId))) }));
}