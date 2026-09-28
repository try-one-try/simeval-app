// Credentials 的实际校验：共享访问密码准入，数据库中的固定账号只表示演示角色。
import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { demoIdentities, demoRoles, isDemoAccount } from "@/lib/demo-identity";
import { userRepository } from "@/server/repositories/user-repository";
import { accessAttemptGate } from "@/server/auth/access-attempts";
const credentialsSchema = z.object({
  role: z.enum(demoRoles),
  accessPassword: z.string().min(1).max(256),
});

function matchesAccessPassword(input: string): boolean {
  const expected = process.env.ACCESS_PASSWORD;
  if (!expected || expected.length < 6) return false;
  const actualDigest = createHash("sha256").update(input).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

export async function authenticateDemo(raw: unknown, request?: Request) {
  const parsed = credentialsSchema.safeParse(raw);
  if (!parsed.success) return null;
  if (!process.env.AUTH_SECRET) return null;
  const { role, accessPassword } = parsed.data;
  const gate = request ? await accessAttemptGate(request) : null;
  if (gate && await gate.isBlocked()) return null;
  if (!matchesAccessPassword(accessPassword)) {
    if (gate) await gate.fail();
    return null;
  }
  const user = await userRepository.findByEmail(demoIdentities[role].email);
  if (!user || !isDemoAccount(user) || user.role !== role) return null;
  if (gate) await gate.clear();
  return { id: user.id, name: user.name, email: user.email };
}
