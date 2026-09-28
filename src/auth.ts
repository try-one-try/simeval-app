// 演示门禁：访问密码仅在服务端核验，JWT 只保存获准访问的账号与时间。
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
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
      }
      return token;
    },
    session({ session, token }) {
      // 旧版无需访问密码的令牌没有授权时间，不能继续进入工作台。
      if (session.user) session.user.id = hasActiveAccessGrant(token.accessGrantedAt) && token.sub ? token.sub : "";
      return session;
    },
  },
});
