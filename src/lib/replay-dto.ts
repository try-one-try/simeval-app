// 真实执行记录的展示契约；动作值按来源解释，不默认等于某种物理单位。
export type ReplayCamera = { key: "head" | "left" | "right"; label: string; sourceChannel: string };
export type ReplayField = { key: string; label: string; stateField: string; actionField: string; unit: string | null };
export type ReplayManifest = {
  id: string; dataset: string; format: string; robot: string; episodeIndex: number;
  task: string; instruction: string; instructionZh: string;
  frameCount: number; fps: number; duration: number; lastTimestamp: number;
  cameras: ReplayCamera[]; fields: ReplayField[];
  originalSegments: { label: string; startFrame: number; endFrame: number }[];
};
export type ReplayFrame = { timestamp: number; state: number[]; action: number[] };
export type ReplayData = { manifest: ReplayManifest; frames: ReplayFrame[] };
export type ReplayAnnotation = { id: string; label: string; note: string; startFrame: number; endFrame: number };
export type ReplayAnnotations = { version: number; annotations: ReplayAnnotation[]; updatedAt: string | null; updatedBy: string | null };
