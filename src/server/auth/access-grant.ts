// 访问许可使用绝对期限；旧令牌没有授权时间，必须重新输入访问密码。
export const ACCESS_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export function hasActiveAccessGrant(grantedAt: unknown, now = Date.now()): boolean {
  return typeof grantedAt === "number"
    && Number.isFinite(grantedAt)
    && grantedAt <= now
    && now - grantedAt < ACCESS_SESSION_MAX_AGE_SECONDS * 1000;
}
