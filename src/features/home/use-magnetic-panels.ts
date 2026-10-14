"use client";

import { useEffect, type RefObject } from "react";
import styles from "./home.module.css";

// 桌面磁吸参数：位移单位 px，倾斜单位度。
const MOTION = { range: 160, x: 16, y: 12, tilt: 3 };

/** 两侧说明靠近鼠标；只更新 CSS 变量，不让指针移动触发 React 渲染。 */
export function useMagneticPanels(root: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const panels = Array.from(root.current?.querySelectorAll<HTMLElement>(`.${styles.panel}`) ?? []);
    const enabled = matchMedia("(hover: hover) and (pointer: fine) and (min-width: 901px) and (prefers-reduced-motion: no-preference)");
    let pending = 0;
    let pointer: { x: number; y: number } | null = null;
    const reset = () => {
      pointer = null;
      cancelAnimationFrame(pending);
      pending = 0;
      for (const panel of panels) {
        panel.style.removeProperty("--magnet-x");
        panel.style.removeProperty("--magnet-y");
        panel.style.removeProperty("--tilt-x");
        panel.style.removeProperty("--tilt-y");
        panel.style.removeProperty("--magnet-strength");
      }
    };
    const paint = () => {
      pending = 0;
      if (!pointer || !enabled.matches) return;
      for (const panel of panels) {
        // 使用布局坐标，避免 3D 变换后的包围盒反过来改变吸附目标。
        let left = -window.scrollX, top = -window.scrollY;
        let node: HTMLElement | null = panel;
        while (node) {
          left += node.offsetLeft;
          top += node.offsetTop;
          node = node.offsetParent instanceof HTMLElement ? node.offsetParent : null;
          if (node) { left += node.clientLeft; top += node.clientTop; }
        }
        const width = panel.offsetWidth, height = panel.offsetHeight;
        const dx = pointer.x - (left + width / 2);
        const dy = pointer.y - (top + height / 2);
        const distance = Math.hypot(Math.max(0, Math.abs(dx) - width / 2), Math.max(0, Math.abs(dy) - height / 2));
        const strength = Math.max(0, 1 - distance / MOTION.range);
        const horizontal = Math.max(-1, Math.min(1, dx / (width / 2))) * strength;
        const vertical = Math.max(-1, Math.min(1, dy / (height / 2))) * strength;
        const x = horizontal * MOTION.x;
        const y = vertical * MOTION.y;
        panel.style.setProperty("--magnet-x", `${x.toFixed(2)}px`);
        panel.style.setProperty("--magnet-y", `${y.toFixed(2)}px`);
        panel.style.setProperty("--tilt-x", `${(-vertical * MOTION.tilt).toFixed(2)}deg`);
        panel.style.setProperty("--tilt-y", `${(horizontal * MOTION.tilt).toFixed(2)}deg`);
        panel.style.setProperty("--magnet-strength", strength.toFixed(3));
      }
    };
    const move = (event: PointerEvent) => {
      if (!enabled.matches || event.pointerType !== "mouse") { reset(); return; }
      pointer = { x: event.clientX, y: event.clientY };
      if (!pending) pending = requestAnimationFrame(paint);
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("blur", reset);
    window.addEventListener("resize", reset);
    window.addEventListener("scroll", reset, { passive: true });
    document.documentElement.addEventListener("pointerleave", reset);
    document.addEventListener("visibilitychange", reset);
    enabled.addEventListener("change", reset);
    return () => {
      reset();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("blur", reset);
      window.removeEventListener("resize", reset);
      window.removeEventListener("scroll", reset);
      document.documentElement.removeEventListener("pointerleave", reset);
      document.removeEventListener("visibilitychange", reset);
      enabled.removeEventListener("change", reset);
    };
  }, [root]);
}
