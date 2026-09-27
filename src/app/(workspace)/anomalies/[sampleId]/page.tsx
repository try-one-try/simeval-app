// 路由只组合详情：服务端核对身份、样本归属和可见性。
import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/require-viewer";
import { comparisonReviewService } from "@/server/application/comparison-review";
import { AppError,idSchema } from "@/domain/evaluation";
import { SampleDetail } from "@/features/review/sample-detail";
import type { EvidenceContext } from "@/lib/review-links";
export default async function SamplePage({params,searchParams}:{params:Promise<{sampleId:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const actor=await requireViewer(),id=(await params).sampleId,query=await searchParams;
  if(!idSchema.safeParse(id).success||query.runId!==undefined&&(typeof query.runId!=="string"||!idSchema.safeParse(query.runId).success))notFound();
  const context:EvidenceContext={};
  for(const key of ["metricKey","scenarioKey","reviewState","baselineRunId"] as const){const value=query[key];if(typeof value==="string"&&value.length<=120)context[key]=value;else if(value!==undefined)notFound();}
  let initial;
  try{initial=await comparisonReviewService.detail(actor,id,query.runId as string|undefined);}
  catch(error){if(error instanceof AppError&&error.status===404)notFound();throw error;}
  return <SampleDetail key={actor.id+id} initial={initial} actor={actor} context={context}/>;
}
