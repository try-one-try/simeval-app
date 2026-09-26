// 读取预置质量报告，不执行扫描或写入。
import { api, parse } from "@/server/http/api";
import { idSchema } from "@/domain/evaluation";
import { evaluationService } from "@/server/application/evaluation";
export function GET(request: Request, context: { params: Promise<{ datasetId: string }> }) {
  return api(request, async (actor) => ({ data: await evaluationService.quality(actor, parse(idSchema, (await context.params).datasetId)) }));
}