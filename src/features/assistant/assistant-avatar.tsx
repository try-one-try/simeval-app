import Image from "next/image";
import styles from "./assistant.module.css";

/** 原图保存在私人 avatar/assistant；网页只下载压缩后的透明 WebP。 */
export function AssistantAvatar({ compact = false }: { compact?: boolean }) {
  return <span className={styles.avatar} data-compact={compact}>
    <Image src="/assistant/chibi-thinking-v2.webp" alt="" width={320} height={320} unoptimized draggable={false} />
  </span>;
}
