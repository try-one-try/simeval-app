// 业务 HTTP 的统一边界：会话、角色、同源写入、输入校验与可追踪错误。
import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { auth } from "@/auth";
import { userRepository } from "@/server/repositories/user-repository";
import { isDemoAccount, isDemoRole } from "@/lib/demo-identity";
import { AppError, assertRole, type Actor, type Role } from "@/domain/evaluation";
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError("VALIDATION_ERROR", "请检查请求参数", 422, z.flattenError(result.error).fieldErrors as Record<string, string[]>);
  return result.data;
}
export async function jsonBody(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new AppError("VALIDATION_ERROR", "请求需要 application/json");
  try { return await request.json(); } catch { throw new AppError("VALIDATION_ERROR", "请求 JSON 格式不正确"); }
}
export function assertOrigin(request: Request) {
  const url = new URL(request.url);
  // Next 的内部 URL 可能归一为 localhost；Host 是浏览器真正访问的目标，不信任任意 Forwarded 头。
  const expectedOrigin = request.headers.get("host") ? url.protocol + "//" + request.headers.get("host") : url.origin;
  if (request.headers.get("origin") !== expectedOrigin) throw new AppError("FORBIDDEN", "写操作必须来自当前站点", 403);
}
export async function apiActor(): Promise<Actor> {
  const session = await auth();
  if (!session?.user?.id) throw new AppError("UNAUTHENTICATED", "请先进入演示会话", 401);
  const user = await userRepository.findById(session.user.id);
  if (!user || !isDemoAccount(user) || !isDemoRole(user.role)) throw new AppError("UNAUTHENTICATED", "会话已失效，请重新进入", 401);
  return { id: user.id, role: user.role };
}
type ApiResult = { data: unknown; status?: number; meta?: Record<string, number> };
export async function api(request: Request, work: (actor: Actor) => Promise<ApiResult>, roles: readonly Role[] = ["ENGINEER", "REVIEWER", "ADMIN"]) {
  const requestId = randomUUID();
  try {
    const actor = { ...await apiActor(), requestId };
    assertRole(actor, roles);
    if (request.method !== "GET") assertOrigin(request);
    const result = await work(actor);
    return Response.json({ data: result.data, meta: { ...result.meta, requestId } }, { status: result.status ?? 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const failure = error instanceof AppError ? error : new AppError("INTERNAL_ERROR", "服务暂时不可用，请稍后重试", 500);
    if (!(error instanceof AppError)) console.error("API request failed", requestId, error instanceof Error ? error.name : "UnknownError");
    return Response.json({ error: { code: failure.code, message: failure.message, fieldErrors: failure.fieldErrors, requestId } }, { status: failure.status, headers: { "Cache-Control": "no-store" } });
  }
}
