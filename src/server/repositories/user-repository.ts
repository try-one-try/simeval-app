// 用户仓储封装账号查询，供凭据验证和会话门禁复用。
import "server-only";
import { getDb } from "@/server/db";

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isDemo: true,
  passwordHash: true,
} as const;

export const userRepository = {
  findByEmail(email: string) {
    return getDb().user.findUnique({ where: { email }, select: userSelect });
  },
  findById(id: string) {
    return getDb().user.findUnique({ where: { id }, select: userSelect });
  },
};
