// 用户仓储封装演示身份与会话门禁查询；访问密码不存数据库。
import "server-only";
import { getDb } from "@/server/db";

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isDemo: true,
} as const;

export const userRepository = {
  findByEmail(email: string) {
    return getDb().user.findUnique({ where: { email }, select: userSelect });
  },
  findById(id: string) {
    return getDb().user.findUnique({ where: { id }, select: userSelect });
  },
};
