// sync 的 HTTP 入口；身份、输入与状态检查由共享边界和应用服务完成。
import { api, parse } from "@/server/http/api";
import { idSchema } from "@/domain/evaluation";
import { evaluationService } from "@/server/application/evaluation";
export function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  return api(request, async (actor) => {
    const id = parse(idSchema, (await context.params).runId);
    return { data: await evaluationService.sync(actor, id) };
  });
}