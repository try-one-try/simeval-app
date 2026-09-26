import Link from "next/link";
// 公开入口展示产品价值；故事预览是合成示意，登录建立真实服务端会话。
import { MobileNavigation } from "@/components/workspace-navigation";
export default async function HomePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <div className="landing">
    <header className="site-header">
      <Link href="/" className="brand">simeval.</Link>
      <nav className="landing-nav" aria-label="首页导航"><Link href="#workflow">产品概览</Link><Link href="/login">体验演示 ↗</Link><span className="eyebrow">SYNTHETIC DEMO</span></nav>
      <MobileNavigation />
    </header>
    <main>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-message">
          <p className="eyebrow">EMBODIED AI / EVALUATION WORKSPACE</p>
          <h1 id="hero-title">看清模型表现，<br className="desktop-break" />也看清问题出在哪。</h1>
          <h2 className="mobile-only">具身智能团队的评测数据工作台</h2>
          <p className="hero-copy">SimEval 帮助团队检查数据质量、比较模型版本、复核异常样本，并形成有证据的评测报告。</p>
          <div className="mobile-story mobile-only"><p className="muted">固定故事</p><p>总体成功率提升，但遮挡场景碰撞增加</p><p className="muted">演示路径</p><p>质量 → 评测 → 对比 → 证据 → 报告</p></div>
          <div className="hero-actions"><Link href="/login" className="primary-button">体验一次评测 →</Link><Link href="#workflow" className="secondary-button">了解流程 ↓</Link></div>
          {error && <p role="alert" className="entry-error">{error === "setup" ? "演示环境尚未准备，请按 README 完成配置。" : "暂时无法进入演示，请稍后重试。"}</p>}
          <p className="fine-print">合成数据 · 模拟评测 · 当前开放总览、质量与评测</p>
        </div>
        <aside className="story-preview" aria-label="固定合成故事示意，后续业务功能尚未开放">
          <div className="preview-header"><span>一次评测</span><span>01 / 03 · 合成示意</span></div>
          <h2>表现提升，风险待核对。</h2><p className="muted">PickPlace v2.3 → v2.4</p>
          <div className="preview-metrics"><div><strong>81%</strong><span>总体成功率</span><span>+5 pp · 改善</span></div><div className="risk"><strong>13%</strong><span>遮挡场景碰撞率</span><span>+5 pp · 待复核</span></div></div>
          <p className="preview-next">故事中的下一步 / 查看 2 个异常样本 →</p>
        </aside>
      </section>
      <section className="workflow" id="workflow" aria-labelledby="workflow-title"><div className="workflow-inner">
        <div className="workflow-heading"><h2 id="workflow-title">一次判断，如何形成</h2><span className="muted">从结果进入证据 · 目标流程</span></div>
        <ol>{[["比较版本", "看见改善与代价"], ["复核样本", "分清数据问题与模型问题"], ["形成报告", "保留结论与证据"]].map(([title, copy], i) => <li key={title}><span className="step-number">0{i + 1}</span><div><h3>{title}</h3><p>{copy}</p></div></li>)}</ol>
      </div></section>
    </main>
  </div>;
}
