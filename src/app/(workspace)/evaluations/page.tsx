// 评测任务入口先单选，再进入任务状态；与其他板块共用选择器。
import { ModuleEntry } from "@/features/evaluation/module-entry";
export default function Page() { return <ModuleEntry module="evaluations" searchParams={Promise.resolve({})} />; }
