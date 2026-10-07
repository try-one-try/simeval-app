// 创建前检查名称，或为模板提供空闲名称；只读，不预留名称。
import { api, parse } from "@/server/http/api";
import { prepareRunNameSchema } from "@/domain/evaluation";
import { evaluationService } from "@/server/application/evaluation";

export function GET(request: Request) {
  return api(request, async actor => {
    const input = parse(prepareRunNameSchema, Object.fromEntries(new URL(request.url).searchParams));
    return { data: await evaluationService.prepareName(actor, input) };
  }, ["ENGINEER"]);
}
