// 共享访问密码只准入两种演示身份；数据库账号仍负责角色真实性。
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), gate: vi.fn(), isBlocked: vi.fn(), fail: vi.fn(), clear: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/repositories/user-repository", () => ({ userRepository: { findByEmail: mocks.user } }));
vi.mock("@/server/auth/access-attempts", () => ({ accessAttemptGate: mocks.gate }));
import { authenticateDemo } from "@/server/auth/authenticate-demo";
const accessPassword = "unit-only-access-password";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("ACCESS_PASSWORD", accessPassword);
  vi.stubEnv("AUTH_SECRET", "unit-auth-secret");
  mocks.gate.mockResolvedValue({ isBlocked: mocks.isBlocked, fail: mocks.fail, clear: mocks.clear });
  mocks.isBlocked.mockResolvedValue(false);
});
afterEach(() => vi.unstubAllEnvs());
it.each(["ENGINEER", "REVIEWER"])("有效 %s 身份返回安全用户对象", async (role) => {
  const email = role.toLowerCase() + "@demo.simeval.local";
  mocks.user.mockResolvedValue({ id: "demo-user", name: "演示用户", email, role, isDemo: true, passwordHash: null });
  expect(await authenticateDemo({ role, accessPassword })).toEqual({ id: "demo-user", name: "演示用户", email });
  expect(mocks.user).toHaveBeenCalledWith(email);
});
it("非法身份或错误访问密码不会查库", async () => {
  expect(await authenticateDemo({ role: "ADMIN", accessPassword })).toBeNull();
  expect(await authenticateDemo({ role: "REVIEWER", accessPassword: "wrong-password" })).toBeNull();
  expect(await authenticateDemo({ role: "ENGINEER", accessPassword: "" })).toBeNull();
  expect(mocks.user).not.toHaveBeenCalled();
});
it("未配置足够长度的访问密码时拒绝", async () => {
  vi.stubEnv("ACCESS_PASSWORD", "12345");
  expect(await authenticateDemo({ role: "ENGINEER", accessPassword: "12345" })).toBeNull();
  expect(mocks.user).not.toHaveBeenCalled();
});
it("六位访问密码可用；连续输错被阻止时不再查账号", async () => {
  vi.stubEnv("ACCESS_PASSWORD", "demo42");
  const request = new Request("http://localhost/api/auth/callback/credentials");
  expect(await authenticateDemo({ role: "ENGINEER", accessPassword: "wrongpass" }, request)).toBeNull();
  expect(mocks.fail).toHaveBeenCalledOnce();
  mocks.isBlocked.mockResolvedValue(true);
  expect(await authenticateDemo({ role: "ENGINEER", accessPassword: "demo42" }, request)).toBeNull();
  expect(mocks.user).not.toHaveBeenCalled();
});
it("六位访问密码通过后继续核对演示账号", async () => {
  vi.stubEnv("ACCESS_PASSWORD", "demo42");
  mocks.user.mockResolvedValue({ id: "demo-user", name: "演示用户", email: "engineer@demo.simeval.local", role: "ENGINEER", isDemo: true, passwordHash: null });
  expect(await authenticateDemo({ role: "ENGINEER", accessPassword: "demo42" })).toMatchObject({ id: "demo-user" });
});
it("数据库角色变化、非演示账号和缺失用户均拒绝", async () => {
  const credentials = { role: "ENGINEER", email: "engineer@demo.simeval.local" };
  for (const user of [
    null,
    { ...credentials, role: "REVIEWER", isDemo: true },
    { ...credentials, isDemo: false },
    { ...credentials, email: "other@demo.simeval.local", isDemo: true },
  ]) {
    mocks.user.mockResolvedValue(user);
    expect(await authenticateDemo({ role: "ENGINEER", accessPassword })).toBeNull();
  }
});
