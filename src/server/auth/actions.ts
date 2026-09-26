"use server";

// 演示入口与退出只在服务端执行；按钮提交后，服务端读取 DEMO_PASSWORD 完成便捷登录。
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

export async function enterDemo() {
  const password = process.env.DEMO_PASSWORD;
  if (!password || !process.env.AUTH_SECRET) {
    redirect("/?error=setup");
  }

  try {
    await signIn("credentials", {
      email: "engineer@demo.simeval.local",
      password,
      redirectTo: "/overview",
    });
  } catch (error) {
    // Auth.js 的预期认证失败提供恢复入口；Next.js 成功重定向必须继续抛出。
    if (error instanceof AuthError) redirect("/?error=signin");
    throw error;
  }
}

export async function leaveDemo() {
  await signOut({ redirectTo: "/" });
}
