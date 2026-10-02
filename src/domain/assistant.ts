// 浏览器与服务端共用的输入和显示格式；不包含数据库、密钥或模型实现。
import { z } from "zod";
import { idSchema, type Actor } from "./evaluation";

export type AssistantActor = Actor & { accessId: string };
export const createSessionSchema = z.object({ runId: idSchema, baselineRunId: idSchema.nullable().default(null) }).strict();
export const sendMessageSchema = z.object({
  question: z.string().trim().min(1).max(2000), requestKey: z.string().uuid(),
  sampleId: idSchema.nullable().default(null),
}).strict();
export const evidenceSchema = z.object({
  id: z.string(), title: z.string(), href: z.string(), kind: z.enum(["summary", "comparison", "samples", "sample"]),
  summary: z.string(), capturedAt: z.string(),
  snapshot: z.unknown().optional(),
});
export const traceSchema = z.object({
  id: z.string(), tool: z.string(), label: z.string(), input: z.string(),
  status: z.enum(["running", "success", "error"]), durationMs: z.number(), summary: z.string(),
});
export type Evidence = z.infer<typeof evidenceSchema>;
export type ToolTrace = z.infer<typeof traceSchema>;
export type SessionView = { id: string; title: string; runId: string; runName: string; baselineRunId: string | null; baselineName: string | null; updatedAt: string };
export type TurnView = {
  id: string; requestKey: string; question: string; answer: string | null;
  status: string; errorMessage: string | null; evidence: Evidence[]; traces: ToolTrace[];
  createdAt: string; model: string; inputTokens: number | null; outputTokens: number | null;
  stale: boolean; reportId?: string;
};
export type AssistantEvent =
  | { type: "start"; turnId: string }
  | { type: "trace"; trace: ToolTrace }
  | { type: "text"; delta: string }
  | { type: "done"; turn: TurnView }
  | { type: "error"; code: string; message: string };

export const reportOutputSchema = z.object({
  version: z.literal(1), title: z.string(), summary: z.string(),
  metrics: z.array(z.object({ name: z.string(), scenario: z.string(), value: z.number(), unit: z.string() })),
  findings: z.array(z.object({ sampleId: z.string(), label: z.string(), conclusion: z.string(), confirmed: z.boolean() })),
  limitations: z.array(z.string()), sourceTurnId: z.string(),
});
export type ReportView = {
  id: string; runId: string; status: string; isStale: boolean; createdAt: string;
  confirmedAt: string | null; output: z.infer<typeof reportOutputSchema>; model: string | null;
};
