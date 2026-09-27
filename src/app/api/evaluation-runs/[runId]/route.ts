// 任务详情只读；不会因浏览器访问而自动推进执行。
import { api, parse } from "@/server/http/api";
import { idSchema } from "@/domain/evaluation";
import { evaluationService } from "@/server/application/evaluation";
export function GET(request: Request, context: { params: Promise<{ runId: string }> }) {
  return api(request, async (actor) => ({ data: await evaluationService.get(actor, parse(idSchema, (await context.params).runId)) }));
}
export function DELETE(request: Request, context: { params: Promise<{ runId: string }> }) {
  return api(request, async actor => ({ data: await evaluationService.remove(actor, parse(idSchema, (await context.params).runId)) }), ["ENGINEER"]);
}
