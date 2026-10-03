// 演示门禁：JWT 保存账号、授权时间与每次登录的新标识，用来隔离共用角色的私人聊天。
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { randomUUID } from "node:crypto";
import { authenticateDemo } from "@/server/auth/authenticate-demo";
import { ACCESS_SESSION_MAX_AGE_SECONDS, hasActiveAccessGrant } from "@/server/auth/access-grant";
import { demoIdentities } from "@/lib/demo-identity";

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
      // 旧登录的令牌可能还存着昵称；认证接口也统一显示角色名称。
      const identity = Object.values(demoIdentities).find(value => value.email === session.user?.email);
      if (session.user && identity) session.user.name = identity.label;
      session.accessId = session.user?.id && typeof token.accessId === "string" ? token.accessId : undefined;
      return session;
    },
  },
});
