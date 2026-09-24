// 会话门禁测试：角色只从服务器上的用户记录读取，过期或已删除账号不可访问。
import { beforeEach, describe, expect, it, vi } from "vitest";

const stubs = vi.hoisted(() => ({
  auth: vi.fn(),
  findById: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: stubs.auth }));
vi.mock("@/server/repositories/user-repository", () => ({ userRepository: { findById: stubs.findById } }));
vi.mock("next/navigation", () => ({ redirect: stubs.redirect }));

import { requireViewer } from "@/server/auth/require-viewer";

describe("requireViewer", () => {
  beforeEach(() => vi.resetAllMocks());

  it("无会话时返回入口且不查用户库", async () => {
    stubs.auth.mockResolvedValue(null);
    await expect(requireViewer()).rejects.toThrow("redirect:/");
    expect(stubs.findById).not.toHaveBeenCalled();
  });

  it("会话账号已删除时返回入口", async () => {
    stubs.auth.mockResolvedValue({ user: { id: "missing" } });
    stubs.findById.mockResolvedValue(null);
    await expect(requireViewer()).rejects.toThrow("redirect:/");
    expect(stubs.findById).toHaveBeenCalledWith("missing");
  });

  it.each(["ENGINEER", "REVIEWER", "ADMIN"])("%s 角色由数据库重新确认", async (role) => {
    stubs.auth.mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } });
    stubs.findById.mockResolvedValue({ id: "user-1", name: "演示用户", email: "user@example.test", role });
    await expect(requireViewer()).resolves.toEqual({ id: "user-1", name: "演示用户", email: "user@example.test", role });
    expect(stubs.findById).toHaveBeenCalledWith("user-1");
  });
});
