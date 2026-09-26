// 路由只组合应用查询与展示组件，不访问 Prisma 或保存判断规则。
import { getOverview } from "@/server/application/get-overview";
import { OverviewView } from "@/features/overview/overview-view";
export default async function OverviewPage() {
  return <OverviewView overview={await getOverview()} />;
}