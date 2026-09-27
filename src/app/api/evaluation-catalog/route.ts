// 目录 DTO 与网页共用应用查询；不输出模型参数或数据库实体。
import { api } from "@/server/http/api";
import { evaluationService } from "@/server/application/evaluation";
export function GET(request: Request) {
  return api(request, async actor => ({ data: await evaluationService.options(actor) }));
}
