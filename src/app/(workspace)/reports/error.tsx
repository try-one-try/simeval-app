"use client";
import { ReviewReadError } from "@/features/review/read-error";

// 复用证据读取错误界面；retry 重新读取当前任务并恢复路由。
export default function ErrorPage({ retry }: { retry: () => void }) {
  return <ReviewReadError reset={retry} />;
}
