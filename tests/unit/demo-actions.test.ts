// 验证真实身份选择、切换前的会话门禁，以及失败不会先退出原账号。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError, CredentialsSignin } from "next-auth";
const stubs = vi.hoisted(() => ({ signIn: vi.fn(), signOut: vi.fn(), viewer: vi.fn(), redirect: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/auth", () => ({ signIn: stubs.signIn, signOut: stubs.signOut }));
vi.mock("@/server/auth/require-viewer", () => ({ requireViewer: stubs.viewer }));
vi.mock("next/cache", () => ({ revalidatePath: stubs.revalidate }));
vi.mock("next/navigation", () => ({ redirect: stubs.redirect }));
vi.mock("next-auth", async () => ({
  AuthError: (await import("@auth/core/errors")).AuthError,
  CredentialsSignin: (await import("@auth/core/errors")).CredentialsSignin,
}));
import { enterDemo, switchDemo } from "@/server/auth/actions";
function choice(role: string, password = "unit-only-access-password") { const data = new FormData(); data.set("role", role); data.set("accessPassword", password); return data; }
describe("演示身份入口", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("ACCESS_PASSWORD", "unit-only-access-password");
    vi.stubEnv("AUTH_SECRET", "test-only-secret");
    stubs.viewer.mockResolvedValue({ id: "engineer", role: "ENGINEER" });
    stubs.redirect.mockImplementation((url: string) => { throw new Error("redirect:" + url); });
  });
  afterEach(() => vi.unstubAllEnvs());
  it.each([
    ["ENGINEER", "/evaluations/new"],
    ["REVIEWER", "/anomalies"],
  ])("选择 %s 使用访问密码和默认入口", async (role, redirectTo) => {
    await expect(enterDemo({ error: null }, choice(role))).rejects.toThrow("redirect:" + redirectTo);
    expect(stubs.signIn).toHaveBeenCalledWith("credentials", { role, accessPassword: "unit-only-access-password", redirect: false });
    expect(stubs.revalidate).toHaveBeenCalledWith("/", "layout");
  });
  it.each(["ADMIN", "", "owner"])("非法身份 %s 不触发认证", async (role) => {
    expect(await enterDemo({ error: null }, choice(role))).toEqual({ error: "role" });
    expect(stubs.signIn).not.toHaveBeenCalled();
  });
  it("缺配置返回所选身份的提示", async () => {
    vi.stubEnv("ACCESS_PASSWORD", "");
    expect(await enterDemo({ error: null }, choice("REVIEWER"))).toEqual({ error: "setup" });
    expect(stubs.signIn).not.toHaveBeenCalled();
  });
  it("空访问密码不给会话", async () => {
    expect(await enterDemo({ error: null }, choice("ENGINEER", ""))).toEqual({ error: "password" });
    expect(stubs.signIn).not.toHaveBeenCalled();
  });
  it("认证失败保留选择，成功的 Next 重定向原样传播", async () => {
    stubs.signIn.mockRejectedValueOnce(new CredentialsSignin("wrong password"));
    expect(await enterDemo({ error: null }, choice("REVIEWER"))).toEqual({ error: "password" });
    stubs.signIn.mockRejectedValueOnce(new AuthError("unavailable"));
    expect(await enterDemo({ error: null }, choice("REVIEWER"))).toEqual({ error: "signin" });
    const navigation = new Error("NEXT_REDIRECT");
    stubs.signIn.mockRejectedValueOnce(navigation);
    await expect(enterDemo({ error: null }, choice("ENGINEER"))).rejects.toBe(navigation);
  });
  it("未登录不能调用身份切换", async () => {
    stubs.viewer.mockRejectedValue(new Error("redirect:/login"));
    await expect(switchDemo(choice("REVIEWER"))).rejects.toThrow("redirect:/login");
    expect(stubs.signIn).not.toHaveBeenCalled();
  });
  it("切换到另一身份建立新会话，不预先退出", async () => {
    await expect(switchDemo(choice("REVIEWER"))).rejects.toThrow("redirect:/anomalies");
    expect(stubs.viewer).toHaveBeenCalledOnce();
    expect(stubs.revalidate).toHaveBeenCalledWith("/", "layout");
    expect(stubs.signIn).toHaveBeenCalledWith("credentials", { role: "REVIEWER", accessPassword: "unit-only-access-password", redirect: false });
    expect(stubs.signOut).not.toHaveBeenCalled();
  });
  it("切换认证失败也不先退出原会话", async () => {
    stubs.signIn.mockRejectedValue(new AuthError("unavailable"));
    await expect(switchDemo(choice("REVIEWER"))).rejects.toThrow("error=signin");
    expect(stubs.revalidate).not.toHaveBeenCalled();
    expect(stubs.signOut).not.toHaveBeenCalled();
  });
  it("选择同一身份仅回到其默认页", async () => {
    await expect(switchDemo(choice("ENGINEER"))).rejects.toThrow("redirect:/evaluations/new");
    expect(stubs.signIn).not.toHaveBeenCalled();
  });
});
