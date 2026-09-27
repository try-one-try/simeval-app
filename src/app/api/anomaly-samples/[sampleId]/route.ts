import { z } from "zod";
import { comparisonReviewService } from "@/server/application/comparison-review";
import { api,parse } from "@/server/http/api";
import { idSchema } from "@/domain/evaluation";
export async function GET(request:Request,context:{params:Promise<{sampleId:string}>}) {
  return api(request,async actor=>{const id=parse(idSchema,(await context.params).sampleId);const query=parse(z.object({runId:idSchema.optional()}).strict(),Object.fromEntries(new URL(request.url).searchParams));return {data:await comparisonReviewService.detail(actor,id,query.runId)};},["ENGINEER","REVIEWER"]);
}
