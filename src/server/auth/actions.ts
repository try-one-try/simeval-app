"use server";

// 演示入口与退出只在服务端执行；按钮提交后，服务端读取 DEMO_PASSWORD 完成便捷登录。
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";

export async function enterDemo() {
  const password = process.env.DEMO_PASSWORD;
  if (!password || !process.env.AUTH_SECRET) {
    redirect("/?error=setup");
  }

  await signIn("credentials", {
    email: "engineer@demo.simeval.local",
    password,
    redirectTo: "/overview",
  });
}

export async function leaveDemo() {
  await signOut({ redirectTo: "/" });
}
