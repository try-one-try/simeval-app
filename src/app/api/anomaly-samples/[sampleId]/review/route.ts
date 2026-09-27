import { comparisonReviewService } from "@/server/application/comparison-review";
import { api,parse,jsonBody } from "@/server/http/api";
import { idSchema } from "@/domain/evaluation";
import { reviewSchema } from "@/domain/comparison-review";
export async function PATCH(request:Request,context:{params:Promise<{sampleId:string}>}) {
  return api(request,async actor=>({data:await comparisonReviewService.review(actor,parse(idSchema,(await context.params).sampleId),parse(reviewSchema,await jsonBody(request)))}),["ENGINEER","REVIEWER"]);
}
