/** 首页内容的唯一编辑入口：改文案、排序和链接只需改这里，不要改动画代码。
 * GitHub 指向 main 的公开文件；改仓库或分支时先调整下面的 repository 地址。
 * 不要在此填写访问密码、私有资料路径或尚未实现的功能承诺。
 */
const repository = "https://github.com/try-one-try/simeval-app";
const docs = `${repository}/blob/main/docs`;
const specifications = `${repository}/tree/main/specs`;
const specKit = "https://github.com/github/spec-kit";
const prototype = "https://www.figma.com/design/Y2ZIhN1yuuXBeieGkxtnsH/simeval?node-id=371-484";
const development = `${docs}/${encodeURIComponent("开发流程.md")}`;

export const homeContent = {
  brand: "simeval.",
  // 顶部从左到右依次是源码、开发过程和体验入口；external=true 会新标签打开。
  navigation: [
    { label: "项目源码", href: repository, external: true },
    { label: "开发流程", href: development, external: true },
    { label: "开始体验", href: "/login", external: false },
  ],
  introduction: { label: "DESIGN → BUILD → REFINE", note: "一个从产品思考走向工程实践的项目。" },
  behind: {
    // 左侧资料卡。可改标题和说明、调整 items 顺序，新增资料项也有默认图标。
    label: "BEHIND THE BUILD",
    title: "设计->开发->部署",
    items: [
      { number: "01", title: "产品需求 PRD", description: "从问题出发，定义范围与验收标准。", href: `${docs}/PRD.md`, tag: "PRODUCT" },
      { number: "02", title: "架构与接口设计", description: "模块边界、数据关系与完整 API 契约。", href: `${docs}/${encodeURIComponent("架构与接口.md")}`, tag: "ENGINEERING" },
      { number: "03", title: "产品原型设计", description: "使用Figma设计，黑白色调，由简入繁、分层呈现。", href: prototype, tag: "FIGMA" },
    ],
    // 一处讲清方法、展示本项目产物，再给出工具来源；两个链接按阅读顺序排列。
    principle: {
      title: "VIBE CODING, WITH A SPEC.",
      description: "通过 Spec Kit工具 为每个功能先写需求规格，再整理实施计划和任务；开发时按任务推进，完成后对照规格验收。",
      links: [
        { label: "查看本项目 Spec 文档", href: specifications },
        { label: "Spec Kit 开发工具", href: specKit },
      ],
    },
    process: { title: "我的开发流程", steps: "产品定义 → 架构设计 → 交互原型 → 垂直切片开发 → 测试验收 → 部署迭代", linkLabel: "查看完整开发流程", href: development },
  },
  project: {
    // 右侧先用短句介绍项目，再列出真实可体验的流程；不要把未实现的报告写进来。
    label: "EXPLORE SIMEVAL",
    title: "项目简介",
    description: "SimEval 是面向具身智能团队的评测数据工作台。先确认数据质量，再创建模拟评测；拿到结果后，可以对比模型版本、定位异常样本，并由评测人员复核结论。演示使用合成数据，不运行真实仿真器。",
    workflowLabel: "一次评测，如何形成判断",
    steps: [
      { title: "配置与质量确认", detail: "选择模型与数据，确认评测条件。" },
      { title: "执行与版本对比", detail: "模拟执行，从总体表现定位场景差异。" },
      { title: "异常证据与人工复核", detail: "回看样本、保留结论，让判断可追溯。" },
    ],
    action: "开始体验", href: "/login", accessNote: "使用访问密码进入 · 两种角色，随时切换",
  },
  portrait: {
    hint: "上下左右移动鼠标探索",
    touchHint: "在人物上，向上下左右拖动探索",
  },
  footer: {
    // 底部只保留技术栈与演示边界；项目源码已经放在顶部导航。
    signature: "从需求到体验，从代码到证据。",
    stack: ["Next.js", "TypeScript", "PostgreSQL", "Figma"],
    disclosure: "合成数据 · 模拟执行，不运行真实仿真或训练；AI 助手提供聊天调查，评测报告由系统整理。",
    copyright: "© 2026 SimEval",
  },
} as const;
