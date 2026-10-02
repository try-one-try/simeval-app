/** 助手的名字、提示语和示例问题集中放这里，改文案不用改浮窗逻辑。 */
export const assistantContent = {
  name: "SimEval 助手",
  greeting: "一起，把结果看明白。",
  introduction: "从评测指标到异常证据，陪你理清每一步。",
  // 当前先交付入口与布局。接通真实 Agent 后再替换状态，不能提前显示“在线”。
  status: "界面预览 · AI 分析尚未接通",
  suggestions: [
    { title: "读懂本次评测", description: "概括结果，说明值得关注的指标", prompt: "帮我概括当前评测的结果，有哪些指标需要关注？" },
    { title: "调查异常样本", description: "从异常记录中寻找可核对的线索", prompt: "当前任务有哪些异常样本值得优先复核？请列出证据。" },
    { title: "解释版本差异", description: "对照已选基线，理解指标变化", prompt: "与我选中的基线相比，当前版本有哪些变化？哪些结论还不能确定？" },
  ],
  guide: "先配置模型、数据集与评测标准，确认数据质量，再创建模拟评测。完成后查看指标，按需选择基线比较，并进入异常样本核对日志。人工复核用于记录结论。当前业务数据为合成演示数据；AI 分析与报告功能正在开发。",
} as const;

// 全站共享入口会在换页后继续存在；退出或切换身份时，用此事件清除输入草稿。
export const ASSISTANT_RESET_EVENT = "simeval:assistant-reset";
