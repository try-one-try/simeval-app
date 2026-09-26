// 网页身份认证：从用户表读 passwordHash，与提交的演示口令比较；它不使用 MySQL 连接密码。
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authenticateDemo } from "@/server/auth/authenticate-demo";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        role: { label: "Demo role", type: "text" },
      },
      authorize: authenticateDemo,
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
