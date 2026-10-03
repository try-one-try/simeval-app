// 用户仓储封装演示身份与会话门禁查询；访问密码不存数据库。
import "server-only";
import { getDb } from "@/server/db";
import { demoIdentityLabel } from "@/lib/demo-identity";

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isDemo: true,
} as const;

export const userRepository = {
  async findByEmail(email: string) {
    const user = await getDb().user.findUnique({ where: { email }, select: userSelect });
    return user ? { ...user, name: demoIdentityLabel(user.role) } : null;
  },
  async findById(id: string) {
    const user = await getDb().user.findUnique({ where: { id }, select: userSelect });
    return user ? { ...user, name: demoIdentityLabel(user.role) } : null;
  },
};
