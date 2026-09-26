// 用真实 bcrypt 与仓储替身检验凭据，覆盖身份伪造、错口令和旧管理员。
import { hashSync } from "bcryptjs";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/repositories/user-repository", () => ({ userRepository: { findByEmail: mocks.user } }));
import { authenticateDemo } from "@/server/auth/authenticate-demo";
const password = "unit-only-password";
const passwordHash = hashSync(password, 4);
beforeEach(() => vi.resetAllMocks());
it.each(["ENGINEER", "REVIEWER"])("有效 %s 身份返回安全用户对象", async (role) => {
  const email = role.toLowerCase() + "@demo.simeval.local";
  mocks.user.mockResolvedValue({ id: "demo-user", name: "演示用户", email, role, isDemo: true, passwordHash });
  expect(await authenticateDemo({ role, email, password })).toEqual({ id: "demo-user", name: "演示用户", email });
});
it("伪造角色或账号不会查库", async () => {
  expect(await authenticateDemo({ role: "ADMIN", email: "admin@demo.simeval.local", password })).toBeNull();
  expect(await authenticateDemo({ role: "REVIEWER", email: "engineer@demo.simeval.local", password })).toBeNull();
  expect(mocks.user).not.toHaveBeenCalled();
});
it("数据库角色变化、非演示账号、缺失用户和错口令均拒绝", async () => {
  const credentials = { role: "ENGINEER", email: "engineer@demo.simeval.local", password };
  for (const user of [
    null,
    { ...credentials, role: "REVIEWER", isDemo: true, passwordHash },
    { ...credentials, isDemo: false, passwordHash },
    { ...credentials, isDemo: true, passwordHash: hashSync("other-password", 4) },
  ]) {
    mocks.user.mockResolvedValue(user);
    expect(await authenticateDemo(credentials)).toBeNull();
  }
});
