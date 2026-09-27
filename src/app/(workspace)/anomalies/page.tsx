// 模块入口复用单选任务流程；带 runId 时直接打开同一任务。
import { ModuleEntry, type ModuleParams } from "@/features/evaluation/module-entry";
export default function Page({ searchParams }: { searchParams: ModuleParams }) {
  return <ModuleEntry module="anomalies" searchParams={searchParams} />;
}
