// 会话角色重新查库：令牌不能提升权限，旧管理员和非演示账号不可继续。
import { beforeEach, describe, expect, it, vi } from "vitest";
const stubs = vi.hoisted(() => ({ auth: vi.fn(), findById: vi.fn(), redirect: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: stubs.auth }));
vi.mock("@/server/repositories/user-repository", () => ({ userRepository: { findById: stubs.findById } }));
vi.mock("next/navigation", () => ({ redirect: stubs.redirect }));
import { requireViewer } from "@/server/auth/require-viewer";
describe("requireViewer", () => {
  beforeEach(() => { vi.resetAllMocks(); stubs.redirect.mockImplementation((path: string) => { throw new Error("redirect:" + path); }); });
  it("无会话返回登录且不查库", async () => {
    stubs.auth.mockResolvedValue(null);
    await expect(requireViewer()).rejects.toThrow("redirect:/login");
    expect(stubs.findById).not.toHaveBeenCalled();
  });
  it("账号删除则会话失效", async () => {
    stubs.auth.mockResolvedValue({ user: { id: "missing" } });
    stubs.findById.mockResolvedValue(null);
    await expect(requireViewer()).rejects.toThrow("redirect:/login");
  });
  it.each(["ENGINEER", "REVIEWER"])("%s 角色以数据库为准", async (role) => {
    stubs.auth.mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } });
    const user = { id: "user-1", name: "演示用户", email: role.toLowerCase() + "@demo.simeval.local", role, isDemo: true };
    stubs.findById.mockResolvedValue(user);
    await expect(requireViewer()).resolves.toEqual({ id: user.id, name: user.name, email: user.email, role });
  });
  it.each([
    { role: "ADMIN", email: "admin@demo.simeval.local", isDemo: true },
    { role: "ENGINEER", email: "engineer@demo.simeval.local", isDemo: false },
    { role: "REVIEWER", email: "engineer@demo.simeval.local", isDemo: true },
  ])("不接受不匹配账号 $role / $email", async (account) => {
    stubs.auth.mockResolvedValue({ user: { id: "user-1" } });
    stubs.findById.mockResolvedValue({ id: "user-1", ...account });
    await expect(requireViewer()).rejects.toThrow("redirect:/login");
  });
});
