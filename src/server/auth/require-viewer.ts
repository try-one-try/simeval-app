// 会话门禁：按会话 ID 重新读取用户与角色，防止只依赖可能过期的令牌信息。
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { userRepository } from "@/server/repositories/user-repository";
import { isDemoAccount, isDemoRole } from "@/lib/demo-identity";

// 同一次页面请求中，布局和正文共用一次身份读取；换页仍会重查，不跨访客共享。
export const requireViewer = cache(async () => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect("/login");

  const user = await userRepository.findById(id);
  if (!user || !isDemoAccount(user) || !isDemoRole(user.role)) redirect("/login");

  return { id: user.id, name: user.name, email: user.email, role: user.role };
});
