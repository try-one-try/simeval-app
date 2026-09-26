// 认证失败给出恢复入口，但不能吞掉 Next.js 成功重定向。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "next-auth";
const stubs = vi.hoisted(() => ({ signIn: vi.fn(), signOut: vi.fn(), redirect: vi.fn() }));
vi.mock("@/auth", () => ({ signIn: stubs.signIn, signOut: stubs.signOut }));
vi.mock("next/navigation", () => ({ redirect: stubs.redirect }));
// 仅使用 Auth.js 核心错误类型，避免单元测试加载 Next.js 的运行时入口。
vi.mock("next-auth", async () => ({ AuthError: (await import("@auth/core/errors")).AuthError }));
import { enterDemo } from "@/server/auth/actions";

describe("便捷演示入口", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("DEMO_PASSWORD", "test-only-password");
    vi.stubEnv("AUTH_SECRET", "test-only-secret");
    stubs.redirect.mockImplementation((url: string) => { throw new Error(`redirect:${url}`); });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("缺配置时返回首页提示，不尝试认证", async () => {
    vi.stubEnv("DEMO_PASSWORD", "");
    await expect(enterDemo()).rejects.toThrow("redirect:/?error=setup");
    expect(stubs.signIn).not.toHaveBeenCalled();
  });
  it("认证失败返回可重试入口", async () => {
    stubs.signIn.mockRejectedValue(new AuthError("unavailable"));
    await expect(enterDemo()).rejects.toThrow("redirect:/?error=signin");
  });
  it("成功重定向异常原样传播", async () => {
    const navigation = new Error("NEXT_REDIRECT");
    stubs.signIn.mockRejectedValue(navigation);
    await expect(enterDemo()).rejects.toBe(navigation);
    expect(stubs.redirect).not.toHaveBeenCalled();
  });
});
