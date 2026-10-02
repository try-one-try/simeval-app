// 全站根布局：集中设置页面元信息、中文语义和全局样式。
import type { Metadata } from "next";
import { AssistantHost } from "@/features/assistant/assistant-host";
import "./globals.css";

export const metadata: Metadata = {
  title: "SimEval · 具身智能评测工作台",
  description: "用可追溯的合成演示数据理解评测质量、模型回退与人工复核。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}<AssistantHost /></body>
    </html>
  );
}
