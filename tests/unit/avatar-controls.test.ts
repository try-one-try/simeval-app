import { describe, expect, it } from "vitest";
import { advanceFrame, pointerTarget } from "@/features/home/avatar/controls";

const target = (x: number, y: number, previous: "up" | "down" | null = null) => pointerTarget(x, y, 1440, 900, { x: 720, y: 450 }, previous);

describe("主页人物的方向与连续运动", () => {
  it.each([[0, 0, "up"], [1440, 0, "up"], [0, 900, "down"], [1440, 900, "down"]] as const)("角落 %d,%d 保持上下动作", (x, y, direction) => {
    expect(target(x, y)).toEqual({ direction, amount: 1 });
  });
  it("左右边与中心不会误判为同一个动作", () => {
    expect(target(0, 450)).toEqual({ direction: "left", amount: 1 });
    expect(target(1440, 450)).toEqual({ direction: "right", amount: 1 });
    expect(target(720, 450)).toEqual({ direction: null, amount: 0 });
  });
  it("上下边界保留滞回，轻微抖动不立刻转向", () => {
    expect(target(0, 290, "up").direction).toBe("up");
    expect(target(0, 290).direction).toBe("left");
    expect(target(1440, 610, "down").direction).toBe("down");
    expect(target(1440, 610).direction).toBe("right");
  });
  it("极端帧延迟也最多前进一帧，避免追赶时间造成跳帧", () => {
    expect(advanceFrame(1, 0, 2, 56)).toBeCloseTo(54 / 55);
    expect(advanceFrame(0, 1, 2, 56)).toBeCloseTo(1 / 55);
  });
  it("完整回程逐帧到达待机，并在目标附近减速", () => {
    let position = 1;
    const frames = new Set<number>();
    let ticks = 0;
    while (position > 0 && ticks++ < 300) {
      const next = advanceFrame(position, 0, 1 / 60, 56);
      expect(position - next).toBeLessThanOrEqual(1 / 55 + 1e-9);
      expect(next).toBeGreaterThanOrEqual(0);
      frames.add(Math.round(position * 55)); position = next;
    }
    expect(position).toBe(0);
    expect(frames.size).toBeGreaterThanOrEqual(55);
    expect(ticks / 60).toBeGreaterThan(1);
    expect(ticks / 60).toBeLessThan(1.5);
  });
  it("快速改变目标仍由当前位置继续，不越过新目标", () => {
    expect(advanceFrame(.4, .402, 1 / 60, 56)).toBe(.402);
    expect(advanceFrame(.4, .398, 1 / 60, 56)).toBe(.398);
    expect(advanceFrame(.4, .4, 1 / 60, 56)).toBe(.4);
  });
});
