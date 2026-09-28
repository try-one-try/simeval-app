import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ find: vi.fn(), execute: vi.fn(), clear: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/db", () => ({ getDb: () => ({
  accessAttempt: { findUnique: mocks.find, deleteMany: mocks.clear },
  $executeRaw: mocks.execute,
}) }));
import { accessAttemptGate } from "@/server/auth/access-attempts";

beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("AUTH_SECRET", "unit-auth-secret"); });
afterEach(() => vi.unstubAllEnvs());

it("只用来源摘要查询失败记录，并在成功后清理", async () => {
  const gate = await accessAttemptGate(new Request("http://localhost", { headers: { "x-forwarded-for": "203.0.113.5" } }));
  mocks.find.mockResolvedValue({ blockedUntil: null });
  expect(await gate.isBlocked()).toBe(false);
  expect(mocks.find).toHaveBeenCalledWith({ where: { keyHash: expect.stringMatching(/^[a-f0-9]{64}$/) }, select: { blockedUntil: true } });
  expect(JSON.stringify(mocks.find.mock.calls)).not.toContain("203.0.113.5");
  await gate.fail();
  expect(mocks.execute).toHaveBeenCalledOnce();
  await gate.clear();
  expect(mocks.clear).toHaveBeenCalledWith({ where: { keyHash: expect.stringMatching(/^[a-f0-9]{64}$/) } });
});

it("封锁时间未到时拒绝，过期后允许重试", async () => {
  const gate = await accessAttemptGate(new Request("http://localhost"));
  mocks.find.mockResolvedValue({ blockedUntil: new Date("2026-09-28T12:15:00Z") });
  expect(await gate.isBlocked(new Date("2026-09-28T12:00:00Z"))).toBe(true);
  expect(await gate.isBlocked(new Date("2026-09-28T12:16:00Z"))).toBe(false);
});
