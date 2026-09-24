// 网页身份认证：从用户表读 passwordHash，与提交的演示口令比较；它不使用 MySQL 连接密码。
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { userRepository } from "@/server/repositories/user-repository";

const credentialsSchema = z.object({
  email: z.email().max(191),
  password: z.string().min(1).max(200),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        // userRepository → getDb() 才连接数据库；浏览器不会收到 passwordHash。
        const user = await userRepository.findByEmail(parsed.data.email);
        if (!user || !(await compare(parsed.data.password, user.passwordHash))) return null;
        return { id: user.id, name: user.name, email: user.email };
      },
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
