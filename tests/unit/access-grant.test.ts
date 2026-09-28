import { expect, it } from "vitest";
import { ACCESS_SESSION_MAX_AGE_SECONDS, hasActiveAccessGrant } from "@/server/auth/access-grant";

it("旧令牌、未来时间和到期许可均无效", () => {
  const now = Date.UTC(2026, 8, 28, 12);
  expect(hasActiveAccessGrant(undefined, now)).toBe(false);
  expect(hasActiveAccessGrant(now + 1, now)).toBe(false);
  expect(hasActiveAccessGrant(now - ACCESS_SESSION_MAX_AGE_SECONDS * 1000, now)).toBe(false);
  expect(hasActiveAccessGrant(now - ACCESS_SESSION_MAX_AGE_SECONDS * 1000 + 1, now)).toBe(true);
});
