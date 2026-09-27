// 客户端复核契约只包含公开证据、内容与版本；不传账号密钥或数据库实体。
import type { ComparisonMetric } from "@/domain/comparison-review";
import type { RunData } from "./evaluation-dto";
export type ComparisonData = { candidate:RunData; baseline:RunData|null; baselines:RunData[]; metrics:ComparisonMetric[]; anomalyCount:number; pendingReviewCount:number };
export type SampleData = {
  id:string;runId:string;sampleNumber:string;scenarioKey:string;metricKey:string;anomalyType:string;status:string;version:number;
  title:string;logExcerpt:string|null;mediaPath:string|null;conclusion:string|null;draftConclusion:string|null;
  draftUpdatedBy:{id:string;name:string}|null;draftUpdatedAt:string|null;confirmedBy:{id:string;name:string}|null;confirmedAt:string|null;confirmedRevision:number;
  pendingReview:boolean;
};
export type ReviewHistory = { id:string;mode:string;conclusion:string|null;actor:{id:string;name:string;role:string};createdAt:string;fromVersion:number|null;toVersion:number|null;confirmedRevision:number|null };
export type SampleDetailData = { sample:SampleData;run:RunData;history:ReviewHistory[];staleReportCount:number };
export type SampleListData = { data:SampleData[];total:number;run:RunData;pendingCount:number;sampleCount:number;scenarios:string[];metricKeys:string[] };
