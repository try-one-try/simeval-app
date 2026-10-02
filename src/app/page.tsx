// 公开首页只组合展示内容，不访问数据库；登录与工作区继续使用原有服务端门禁。
import { Home } from "@/features/home/home-page";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <Home error={typeof error === "string" ? error : undefined} />;
}
