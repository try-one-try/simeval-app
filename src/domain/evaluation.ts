// 输入与评测规则不依赖数据库，便于独立验证质量、配置和状态边界。
import { z } from "zod";
export type RunStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
export type Role = "ENGINEER" | "REVIEWER" | "ADMIN";
export type Actor = { id: string; role: Role; requestId?: string };
export class AppError extends Error {
  constructor(public code: string, message: string, public status = 422, public fieldErrors: Record<string, string[]> | null = null) { super(message); }
}
export const idSchema = z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/);
export const keySchema = z.string().trim().min(1).max(128);
export const RUN_NAME_MAX_LENGTH = 120;
export const runNameSchema = z.string().trim().min(1, "请填写任务名称").max(RUN_NAME_MAX_LENGTH);
export const prepareRunNameSchema = z.object({
  modelVersionId: idSchema,
  name: runNameSchema,
  mode: z.enum(["check", "suggest"]).default("check"),
}).strict();
export type PrepareRunNameInput = z.infer<typeof prepareRunNameSchema>;
export const createRunSchema = z.object({
  name: runNameSchema,
  modelVersionId: idSchema, datasetVersionId: idSchema, benchmarkId: idSchema, baselineRunId: idSchema.nullable().optional(),
  targetSuccessRate: z.union([z.literal(.8), z.literal(.85)]).nullable().optional(),
  episodeCount: z.number().int().min(1).max(10000), simulationSeed: z.number().int().min(0).max(2147483647),
  acceptQualityWarning: z.boolean(), mockFailure: z.boolean().default(false),
}).strict();
export const listRunSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  projectId: idSchema.optional(),
  status: z.enum(["QUEUED","RUNNING","SUCCEEDED","FAILED","CANCELLED"]).optional(),
}).strict();
export type CreateRunInput = z.infer<typeof createRunSchema>;
function occupiedRunNames(names: readonly (string | null)[]) {
  return new Set(names.flatMap(value => value === null ? [] : [value.trim().toLowerCase()]));
}
function nameWithSuffix(base: string, suffix: string) {
  // 给编号留出长度，避免把 emoji 等双码元字符截成一半。
  return base.slice(0, RUN_NAME_MAX_LENGTH - suffix.length).replace(/[\uD800-\uDBFF]$/, "").trimEnd() + suffix;
}
// 模板名称已被使用时，跳过占用的编号；填表本身不会预留名称。
export function suggestRunName(name: string, existingNames: readonly (string | null)[]) {
  const base = name.trim(), occupied = occupiedRunNames(existingNames);
  if (!occupied.has(base.toLowerCase())) return base;
  for (let number = 2; ; number++) {
    const candidate = nameWithSuffix(base, ` (${number})`);
    if (!occupied.has(candidate.toLowerCase())) return candidate;
  }
}
// 同项目的可见任务不能重名；旧名称也去两端空格、忽略大小写。
// 重试会另建任务，用未占用的编号区分，不让原失败任务挡住重试。
export function resolveRunName(name: string, existingNames: readonly (string | null)[], retry: boolean) {
  const base = name.trim();
  const occupied = occupiedRunNames(existingNames);
  if (!retry) {
    if (occupied.has(base.toLowerCase())) {
      const message = "已存在同名任务，请换一个任务名称";
      throw new AppError("RUN_NAME_CONFLICT", message, 409, { name: [message] });
    }
    return base;
  }
  for (let number = 1; ; number++) {
    const suffix = ` · 重试 ${number}`;
    const candidate = nameWithSuffix(base, suffix);
    if (!occupied.has(candidate.toLowerCase())) return candidate;
  }
}
export function assertRole(actor: Actor, roles: readonly Role[]) {
  if (!roles.includes(actor.role)) throw new AppError("FORBIDDEN", "当前角色无权执行此操作", 403);
}
export function assertQuality(status: string, accepted: boolean) {
  if (status === "FAILED") throw new AppError("DATASET_QUALITY_BLOCKED", "数据集质量未通过，不能创建评测");
  if (status === "WARNING" && !accepted) throw new AppError("QUALITY_WARNING_NOT_ACCEPTED", "请先确认数据集质量警告", 422, { acceptQualityWarning: ["必须明确接受质量警告"] });
}
type Configuration = { projectId: string; datasetVersionId: string; benchmarkId: string; episodeCount: number; simulationSeed: number };
export function assertConfiguration(input: CreateRunInput, projectIds: string[], baseline: (Configuration & { status: string; modelVersionId: string }) | null) {
  if (!projectIds.length || !projectIds.every(id => id === projectIds[0])) throw new AppError("INCOMPATIBLE_CONFIGURATION", "模型、数据和基准必须属于同一项目");
  if (!baseline) return;
  if (!projectIds.every((id) => id === baseline.projectId) || baseline.status !== "SUCCEEDED"
    || input.datasetVersionId !== baseline.datasetVersionId || input.benchmarkId !== baseline.benchmarkId
    || input.episodeCount !== baseline.episodeCount || input.simulationSeed !== baseline.simulationSeed
    || input.modelVersionId === baseline.modelVersionId) {
    throw new AppError("INCOMPATIBLE_CONFIGURATION", "模型、数据集与基准必须属于同一项目，并与成功基线保持相同评测口径");
  }
}
export function assertMutable(actor: Actor, run: { createdById: string; isDemoFixture: boolean; status: RunStatus }, operation: "cancel" | "retry" | "delete") {
  assertRole(actor, ["ENGINEER"]);
  if (actor.id !== run.createdById) throw new AppError("FORBIDDEN", "只能操作自己创建的任务", 403);
  const allowed = operation === "cancel" ? ["QUEUED", "RUNNING"] : operation === "delete" ? ["SUCCEEDED", "FAILED", "CANCELLED"] : ["FAILED"];
  if (run.isDemoFixture || !allowed.includes(run.status)) throw new AppError("STATE_CONFLICT", operation === "cancel" ? "当前任务不能取消" : "只有失败的非固定任务可以重试", 409);
}
export function isActive(status: RunStatus) { return status === "QUEUED" || status === "RUNNING"; }
