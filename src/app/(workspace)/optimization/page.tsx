// 独立真实数据回放入口；页面与接口均复用工作台的服务端身份校验。
import { requireViewer } from "@/server/auth/require-viewer";
import { ReplayPage } from "@/features/replay/replay-page";
export default async function Page() {
  await requireViewer();
  return <ReplayPage />;
}
