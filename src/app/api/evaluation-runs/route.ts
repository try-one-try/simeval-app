// 任务列表与创建的 HTTP 入口；规则和事务交给应用层。
import { api, parse, jsonBody } from "@/server/http/api";
import { createRunSchema, keySchema, listRunSchema } from "@/domain/evaluation";
import { evaluationService } from "@/server/application/evaluation";
export function GET(request: Request) {
  return api(request, async (actor) => {
    const input = parse(listRunSchema, Object.fromEntries(new URL(request.url).searchParams));
    const result = await evaluationService.list(actor, input);
    return { data: result.data, meta: { page: input.page, pageSize: input.pageSize, total: result.total } };
  });
}
export function POST(request: Request) {
  return api(request, async (actor) => {
    const input = parse(createRunSchema, await jsonBody(request));
    const key = parse(keySchema, request.headers.get("idempotency-key"));
    const result = await evaluationService.create(actor, input, key);
    return { data: result.data, status: result.replay ? 200 : 201 };
  }, ["ENGINEER", "ADMIN"]);
}