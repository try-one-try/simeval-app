import { comparisonReviewService } from "@/server/application/comparison-review";
import { api,parse } from "@/server/http/api";
import { comparisonQuerySchema } from "@/domain/comparison-review";
export async function GET(request:Request) {
  return api(request,async actor=>{const input=parse(comparisonQuerySchema,Object.fromEntries(new URL(request.url).searchParams));return {data:await comparisonReviewService.comparison(actor,input.candidateRunId,input.baselineRunId??null,input.scenarioKey)};},["ENGINEER"]);
}
