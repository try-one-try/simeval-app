import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { id: string };
    // 每次成功登录都重新生成，不能用共用角色账号代替访客标识。
    accessId?: string;
  }
}

