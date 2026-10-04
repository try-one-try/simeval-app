/** 助手的名字、提示语和示例问题集中放这里，改文案不用改浮窗逻辑。 */
export const assistantContent = {
  name: "SimEval 助手",
  greeting: "一起，把结果看明白。",
  introduction: "从评测指标到异常证据，陪你理清每一步。",
  status: "评测调查 · 有据可查",
  suggestions: [
    { title: "读懂本次评测", description: "概括结果，说明值得关注的指标", prompt: "帮我概括当前评测的结果，有哪些指标需要关注？" },
    { title: "调查异常样本", description: "从异常记录中寻找可核对的线索", prompt: "当前任务有哪些异常样本值得优先复核？请列出证据。" },
    { title: "解释版本差异", description: "对照已选基线，理解指标变化", prompt: "与我选中的基线相比，当前版本有哪些变化？哪些结论还不能确定？" },
  ],
  followUpLabel: "继续询问",
  followUpHint: "点击问题，填入输入框",
  followUpSample: {
    withNumber: "样本 {sampleNumber}（样本 ID：{sampleId}）",
    withoutNumber: "样本 ID 为 {sampleId} 的样本",
  },
  followUps: {
    sampleLogs: { title: "继续看样本日志", prompt: "请重新读取{sample}的当前日志，按记录梳理异常发生的过程，区分直接证据与待验证的解释。" },
    sampleReview: { title: "核对人工复核", prompt: "请重新查询{sample}的当前人工复核信息，区分已确认结论与未确认草稿，并指出仍需要核对的问题。" },
    sampleChecks: { title: "梳理核查步骤", prompt: "请围绕{sample}列出下一步人工核查的步骤，每一步说明需要查看什么记录、能确认什么、还不能确认什么。" },
    comparisonScenarios: { title: "细看场景差异", prompt: "请重新对照当前任务与本会话已选基线的分场景指标，说明哪些场景差异需要继续核对，并说明比较口径。" },
    comparisonSamples: { title: "从差异找样本", prompt: "请结合当前任务与本会话已选基线的指标差异，查询当前任务中的相关异常样本；如果没有对应样本，请说明证据不足，不推断原因。" },
    anomalyEvidence: { title: "查看样本证据", prompt: "请重新查询当前任务的异常样本，选一个有代表性的样本读取详细日志，并区分事实、人工结论与待验证的线索；如果没有异常样本，请直接说明。" },
    anomalyReview: { title: "看看待复核样本", prompt: "请重新查询当前任务中尚待人工复核的异常样本，说明可供人工核对的记录；如果没有，请直接说明。" },
    metricMeaning: { title: "解释指标口径", prompt: "请重新读取当前任务的指标定义、计算口径与目标规则，说明如何判断是否达标，并区分执行完成和业务达标。" },
    uncertainties: { title: "梳理证据缺口", prompt: "针对当前任务，请重新核对现有记录，说明哪些判断已有证据支持、哪些问题仍需补充证据，以及可以怎样人工核查。" },
  },
  followUpFallbacks: [
    { title: "核对分析范围", prompt: "请重新查询当前任务的配置与评测规则，说明这些合成演示数据可支持哪些判断，以及不能直接推广到真实环境的结论。" },
    { title: "梳理人工清单", prompt: "请重新核对当前任务的现有记录，给我一份简洁的人工核查清单；按优先顺序说明要查看哪条记录、核对什么、还需补充什么证据。" },
  ],
  guide: "先配置评测、确认数据质量，再创建模拟评测。完成后查看指标、按需对比基线、复核异常。助手只通过聊天解释当前任务记录，并给出证据链接。每个任务的系统评测报告在报告页生成与更新，由评测人员确认，不包含私人聊天。业务数据是合成演示，AI 分析仍需人工核对。",
} as const;

// 工作台共享入口会在换页后继续存在；退出或切换身份时，用此事件清除输入草稿。
export const ASSISTANT_RESET_EVENT = "simeval:assistant-reset";
