// 助手专用边界：除角色账号外，还必须检查当前登录的访客标识。
import "server-only";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { userRepository } from "@/server/repositories/user-repository";
import { isDemoAccount, isDemoRole } from "@/lib/demo-identity";
import { AppError } from "@/domain/evaluation";
import type { AssistantActor } from "@/domain/assistant";
import { assertOrigin } from "./api";

export async function assistantActor(): Promise<AssistantActor> {
  const session = await auth();
  if (!session?.user.id || !session.accessId) throw new AppError("UNAUTHENTICATED", "请重新输入密码进入工作台，以启用独立的聊天会话", 401);
  const user = await userRepository.findById(session.user.id);
  if (!user || !isDemoAccount(user) || !isDemoRole(user.role)) throw new AppError("UNAUTHENTICATED", "登录已失效，请重新进入", 401);
  return { id: user.id, role: user.role, accessId: session.accessId, requestId: randomUUID() };
}
export function assistantFailure(error: unknown) {
  const e = error instanceof AppError ? error : new AppError("INTERNAL_ERROR", "助手暂时无法完成请求，请稍后重试", 500);
  // 不把 SDK 错误对象或请求内容写入日志，避免泄露凭据和聊天。
  return Response.json({ error: { code: e.code, message: e.message, fieldErrors: e.fieldErrors, requestId: randomUUID() } }, { status: e.status, headers: { "Cache-Control": "no-store" } });
}
export async function assistantApi(request: Request, work: (actor: AssistantActor) => Promise<unknown>) {
  try {
    const actor = await assistantActor();
    if (request.method !== "GET") assertOrigin(request);
    return Response.json({ data: await work(actor), meta: { requestId: actor.requestId } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return assistantFailure(error); }
}
