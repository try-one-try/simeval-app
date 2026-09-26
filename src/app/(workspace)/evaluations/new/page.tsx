// 只向客户端传递公开选项与最小身份，不暴露数据库对象。
import { requireViewer } from "@/server/auth/require-viewer";
import { evaluationService } from "@/server/application/evaluation";
import { CreateForm } from "@/features/evaluation/create-form";
export default async function NewEvaluationPage() {
  const viewer = await requireViewer();
  return <CreateForm options={await evaluationService.options(viewer)} actor={{ id: viewer.id, role: viewer.role }} />;
}
