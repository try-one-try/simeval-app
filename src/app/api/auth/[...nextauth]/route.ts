// 将 Auth.js 的会话端点接到 Next.js 路由；认证规则集中在 auth.ts。
import { handlers } from "@/auth";

export const runtime = "nodejs";
export const { GET, POST } = handlers;
