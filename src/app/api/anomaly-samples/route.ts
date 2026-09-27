import { comparisonReviewService } from "@/server/application/comparison-review";
import { api,parse } from "@/server/http/api";
import { sampleQuerySchema } from "@/domain/comparison-review";
export async function GET(request:Request) {
  return api(request,async actor=>{const input=parse(sampleQuerySchema,Object.fromEntries(new URL(request.url).searchParams));const result=await comparisonReviewService.list(actor,input);return {data:result.data,meta:{total:result.total,page:input.page,pageSize:input.pageSize}};},["ENGINEER","REVIEWER"]);
}
