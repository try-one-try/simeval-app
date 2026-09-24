// 公开入口：说明产品价值与合成演示边界，并通过服务端动作进入工作台。
import { ArrowRight, Check, Fingerprint, Layers3 } from "lucide-react";
import { enterDemo } from "@/server/auth/actions";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function HomePage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <div className="page-shell">
      <header className="site-header">
        <div className="brand"><span className="brand-mark" aria-hidden="true">S</span> SimEval</div>
        <span className="header-note">Embodied AI Evaluation Workspace</span>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div>
            <div className="eyebrow">从评测结果，到可信判断</div>
            <h1 id="hero-title">让每次模型迭代<br /><em>有据可循。</em></h1>
            <p className="hero-copy">
              SimEval 把数据质量、模拟评测、版本对比和异常复核串成一条证据链，
              帮助具身智能团队解释：候选版本究竟能否替换基线。
            </p>
            <div className="hero-actions">
              <form action={enterDemo}>
                <button className="primary-button" type="submit">进入演示工作台 <ArrowRight size={17} aria-hidden="true" /></button>
              </form>
              <a className="subtle-link" href="#workflow">了解工作流 ↓</a>
            </div>
            {error === "setup" && <p role="alert" className="synthetic-note">演示环境尚未配置会话密钥或演示口令，请按 README 完成设置。</p>}
            <p className="synthetic-note"><span className="note-dot" aria-hidden="true" />本项目使用合成数据与模拟评测，不运行真实仿真器。</p>
          </div>

          <div className="hero-visual" aria-label="工作台界面示意，不代表当前数据库中的真实记录">
            <div className="visual-glow" aria-hidden="true" />
            <div className="preview-card">
              <div className="preview-top"><span>工作台 / 界面示意</span><span className="preview-pill">合成演示</span></div>
              <div className="preview-heading"><strong>一次评测，完整的证据路径</strong><span>进入后查看实际保存的演示记录</span></div>
              <div className="preview-grid">
                <div className="preview-stat"><small>数据质量</small><b>检查</b></div>
                <div className="preview-stat"><small>模型迭代</small><b>对比</b></div>
              </div>
              <div className="preview-line">
                <div><strong>评测结果如何变成判断？</strong><span>证据链</span></div>
                <div className="mini-bars" aria-hidden="true">
                  <i style={{ height: "33%" }} /><i style={{ height: "68%" }} /><i style={{ height: "49%" }} />
                  <i style={{ height: "81%" }} /><i style={{ height: "59%" }} /><i style={{ height: "74%" }} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="feature-strip" id="workflow" aria-label="产品工作流">
          <div className="feature-inner">
            <div className="feature-item"><strong><Check size={15} style={{ display: "inline", marginRight: 8 }} aria-hidden="true" />先确认数据可信</strong><p>质量问题进入评测前就被看见，警告有明确来源。</p></div>
            <div className="feature-item"><strong><Layers3 size={15} style={{ display: "inline", marginRight: 8 }} aria-hidden="true" />再看版本差异</strong><p>统一的基准和场景口径，让指标回退有迹可循。</p></div>
            <div className="feature-item"><strong><Fingerprint size={15} style={{ display: "inline", marginRight: 8 }} aria-hidden="true" />最后由人确认</strong><p>异常分类、回补与报告保留可追溯的人工判断。</p></div>
          </div>
        </section>
      </main>

      <footer className="site-footer">SimEval · 面试演示项目 · 当前版本逐阶段开放功能</footer>
    </div>
  );
}
