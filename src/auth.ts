// 演示门禁：JWT 保存账号、授权时间与每次登录的新标识，用来隔离共用角色的私人聊天。
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { randomUUID } from "node:crypto";
import { authenticateDemo } from "@/server/auth/authenticate-demo";
import { ACCESS_SESSION_MAX_AGE_SECONDS, hasActiveAccessGrant } from "@/server/auth/access-grant";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: ACCESS_SESSION_MAX_AGE_SECONDS },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        role: { label: "Demo role", type: "text" },
        accessPassword: { label: "Access password", type: "password" },
      },
      authorize: authenticateDemo,
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.accessGrantedAt = Date.now();
        token.accessId = randomUUID();
      }
      return token;
    },
    session({ session, token }) {
      // 旧版无需访问密码的令牌没有授权时间，不能继续进入工作台。
      if (session.user) session.user.id = hasActiveAccessGrant(token.accessGrantedAt) && token.sub ? token.sub : "";
      session.accessId = session.user?.id && typeof token.accessId === "string" ? token.accessId : undefined;
      return session;
    },
  },
});
