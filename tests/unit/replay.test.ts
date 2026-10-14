import { describe, expect, it } from "vitest";
import { replayPresetAnnotations, byteRange, nearestReplayFrame, replaySaveSchema, validateReplayAnnotations } from "@/domain/replay";

describe("真实执行回放边界", () => {
  it("人工预设连续覆盖完整记录，注明来源且可作为合法草稿保存", () => {
    for (const count of [2089, 120]) {
      const annotations = replayPresetAnnotations(count, 30);
      expect(replaySaveSchema.safeParse({ expectedVersion: 0, annotations }).success).toBe(true);
      expect(() => validateReplayAnnotations({ expectedVersion: 0, annotations }, count)).not.toThrow();
      expect(annotations[0].startFrame).toBe(0);
      expect(annotations.at(-1)?.endFrame).toBe(count);
      annotations.forEach((a, i) => {
        expect(a.note).toContain("非数据集原始阶段标注");
        if (i) expect(a.startFrame).toBe(annotations[i-1].endFrame);
      });
    }
  });
  it("非均匀时间戳按最近记录定位，边缘收敛且相同距离取前帧", () => {
    const frames = [0,.03,.07,.11].map(timestamp => ({ timestamp, state: [], action: [] }));
    expect(nearestReplayFrame(frames,-1)).toBe(0);
    expect(nearestReplayFrame(frames,.049)).toBe(1);
    expect(nearestReplayFrame(frames,.065)).toBe(2);
    expect(nearestReplayFrame(frames,90)).toBe(3);
  });
  it("人工片段允许到结束边界，但拒绝反向、越界和重复编号", () => {
    const annotation = { id: "13b7121c-a4c7-4ffc-9c9f-9d769d194864", label: "人工观察", note: "", startFrame: 0, endFrame: 2089 };
    const input = { expectedVersion: 0, annotations: [annotation] };
    expect(() => validateReplayAnnotations(input,2089)).not.toThrow();
    for (const change of [{ startFrame: 2089 }, { endFrame: 2090 }])
      expect(() => validateReplayAnnotations({ ...input, annotations: [{ ...annotation, ...change }] },2089)).toThrow();
    expect(() => validateReplayAnnotations({ ...input, annotations: [annotation,annotation] },2089)).toThrow();
    expect(replaySaveSchema.safeParse({ ...input, annotations:[{ ...annotation, startFrame: .5 }] }).success).toBe(false);
    expect(replaySaveSchema.safeParse({ ...input, annotations:[{ ...annotation, label: " " }] }).success).toBe(false);
  });
  it("媒体范围支持整段、开区间和后缀，拒绝越界、多段与反向", () => {
    expect(byteRange(null,100)).toBeNull();
    expect(byteRange("bytes=0-9",100)).toEqual({start:0,end:9});
    expect(byteRange("bytes=90-",100)).toEqual({start:90,end:99});
    expect(byteRange("bytes=-20",100)).toEqual({start:80,end:99});
    expect(byteRange("bytes=90-200",100)).toEqual({start:90,end:99});
    for (const value of ["bytes=100-", "bytes=50-10", "bytes=0-1,5-8", "bytes=-0", "bytes=-", "bytes=9007199254740993-"])
      expect(() => byteRange(value,100)).toThrow();
  });
});
