// 路由组合质量查询与展示；权限和持久化留在服务端应用层。
import { requireViewer } from "@/server/auth/require-viewer";
import { evaluationService } from "@/server/application/evaluation";
import { QualityView } from "@/features/evaluation/quality-view";
export default async function QualityPage() {
  const actor = await requireViewer();
  const options = await evaluationService.options(actor);
  const quality = options.datasets[0];
  if (!quality) return <section className="content state-content"><h1>暂无数据质量报告</h1><p className="muted">请先按 README 初始化数据库与演示数据。</p></section>;
  return <QualityView quality={quality} canWrite={actor.role !== "REVIEWER"} />;
}
