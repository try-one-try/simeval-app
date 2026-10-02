import Link from "next/link";
import { ArrowRight, ArrowUpRight, FileText, Layers, PenTool } from "lucide-react";
import { homeContent as content } from "./content";
import { InteractiveHome } from "./interactive-home";
import styles from "./home.module.css";

const icons = [FileText, Layers, PenTool];
const external = { target: "_blank", rel: "noopener noreferrer" } as const;

/** 静态产品叙事在服务端组合；文案统一读取 content.ts，交互只负责中间的人物。 */
export function Home({ error }: { error?: string }) {
  const header = <header className={styles.header}>
    <Link href="/" className={styles.brand} aria-label="SimEval 首页">{content.brand}</Link>
    <nav aria-label="首页导航">{content.navigation.map(item => item.external
      ? <a key={item.label} href={item.href} {...external}>{item.label}<ArrowUpRight size={13} aria-hidden="true" /></a>
      : <Link key={item.label} href={item.href}>{item.label}<ArrowRight size={13} aria-hidden="true" /></Link>)}</nav>
  </header>;
  const introduction = <div className={styles.introduction}><p>{content.introduction.label}</p><span>{content.introduction.note}</span></div>;
  const left = <section className={`${styles.panel} ${styles.behind}`} aria-labelledby="behind-title">
    <p className={styles.eyebrow}>{content.behind.label}</p>
    <h2 id="behind-title">{content.behind.title}</h2>
    <div className={styles.resourceList}>{content.behind.items.map((item, index) => {
      const Icon = icons[index] ?? FileText;
      return <a className={styles.resource} key={item.title} href={item.href} {...external}>
        <span className={styles.resourceIcon}><Icon size={18} strokeWidth={1.4} aria-hidden="true" /></span>
        <span><span className={styles.resourceTitle}>{item.title}<ArrowUpRight size={14} aria-hidden="true" /></span><span className={styles.resourceCopy}>{item.description}</span></span>
      </a>;
    })}</div>
    <div className={styles.principle}>
      <h3>{content.behind.principle.title}</h3>
      <span>{content.behind.principle.description}</span>
      <nav className={styles.principleLinks} aria-label="规格驱动开发资料">
        {content.behind.principle.links.map(link => <a key={link.href} href={link.href} {...external}>
          {link.label}<ArrowUpRight size={14} aria-hidden="true" />
        </a>)}
      </nav>
    </div>
    <div className={styles.process}><h3>{content.behind.process.title}</h3><p>{content.behind.process.steps}</p><a href={content.behind.process.href} {...external}>{content.behind.process.linkLabel}<ArrowUpRight size={15} aria-hidden="true" /></a></div>
  </section>;
  const right = <section className={`${styles.panel} ${styles.project}`} aria-labelledby="home-title">
    <p className={styles.eyebrow}>{content.project.label}</p>
    <h1 id="home-title">{content.project.title}</h1>
    <p className={styles.projectDescription}>{content.project.description}</p>
    <div className={styles.workflow}><p className={styles.workflowLabel}>{content.project.workflowLabel}</p><ol>
      {content.project.steps.map((step, index) => <li key={step.title}><span className={styles.stepNumber}>0{index + 1}</span><div><h3>{step.title}</h3><p>{step.detail}</p></div></li>)}
    </ol></div>
    <div className={styles.cta}><Link href={content.project.href} className={styles.primary}>{content.project.action}<ArrowRight size={18} aria-hidden="true" /></Link><p>{content.project.accessNote}</p></div>
    {error && <p role="alert" className={styles.error}>{error === "setup" ? "演示环境暂未准备好，请稍后再试。" : "暂时无法进入演示，请稍后再试。"}</p>}
  </section>;
  const footer = <footer className={styles.footer}>
    <div className={styles.footerTop}><p>{content.footer.signature}</p><div>{content.footer.stack.map(name => <span key={name}>{name}</span>)}</div></div>
    <div className={styles.footerBottom}><p>{content.footer.disclosure}</p><span>{content.footer.copyright}</span></div>
  </footer>;
  return <InteractiveHome header={header} introduction={introduction} left={left} right={right} footer={footer} />;
}
