// 会话门禁：按会话 ID 重新读取用户与角色，防止只依赖可能过期的令牌信息。
import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { userRepository } from "@/server/repositories/user-repository";
import { isDemoAccount, isDemoRole } from "@/lib/demo-identity";

export async function requireViewer() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect("/login");

  const user = await userRepository.findById(id);
  if (!user || !isDemoAccount(user) || !isDemoRole(user.role)) redirect("/login");

  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
