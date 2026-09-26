// Credentials 的实际校验：选择身份、预设账号、数据库角色和密码必须一致。
import "server-only";
import { compare } from "bcryptjs";
import { z } from "zod";
import { demoIdentities, demoRoles, isDemoAccount } from "@/lib/demo-identity";
import { userRepository } from "@/server/repositories/user-repository";
const credentialsSchema = z.object({
  role: z.enum(demoRoles),
  email: z.email().max(191),
  password: z.string().min(1).max(200),
});
export async function authenticateDemo(raw: unknown) {
  const parsed = credentialsSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { role, email, password } = parsed.data;
  if (email !== demoIdentities[role].email) return null;
  const user = await userRepository.findByEmail(email);
  if (!user || !isDemoAccount(user) || user.role !== role || !(await compare(password, user.passwordHash))) return null;
  return { id: user.id, name: user.name, email: user.email };
}
