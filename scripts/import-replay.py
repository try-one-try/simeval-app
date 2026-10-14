"""导入单 Episode 展示副本；依赖 pyarrow、imageio-ffmpeg，不修改来源文件。"""
import argparse
import hashlib
import json
import math
import subprocess
from pathlib import Path

import imageio_ffmpeg
import pyarrow.parquet as pq

parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
parser.add_argument("--output", type=Path, default=Path("assets/embodied-replay/agibot-2026-episode-0"))
args = parser.parse_args()
source, output = args.source.resolve(), args.output.resolve()
if output == source or source in output.parents:
    raise ValueError("展示副本必须放在源数据目录之外")
info = json.loads((source / "meta/info.json").read_text(encoding="utf-8"))
table = pq.read_table(source / "data/chunk-000/episode_000000.parquet").to_pydict()
times = table["timestamp"]
fps = info["fps"]
assert len(times) == info["total_frames"] and times[0] == 0
assert all(b > a for a, b in zip(times, times[1:]))
assert table["frame_index"] == list(range(len(times)))
assert set(table["episode_index"]) == {0}
assert max(abs(t - i / fps) for i, t in enumerate(times)) < 0.001
for key in ("observation.state", "action"):
    assert all(len(row) == info["features"][key]["shape"][0] for row in table[key])
    assert all(math.isfinite(v) for row in table[key] for v in row)

fields = []
for name, state_key, action_key in [
    ("左侧末端位置", "state/left_effector/position", "action/left_effector/position"),
    ("右侧末端位置", "state/right_effector/position", "action/right_effector/position"),
    ("关节位置", "state/joint/position", "action/joint/position"),
]:
    state = info["features"]["observation.state"]["field_descriptions"][state_key]["indices"]
    action = info["features"]["action"]["field_descriptions"][action_key]["indices"]
    assert len(state) == len(action)
    for i, (s, a) in enumerate(zip(state, action)):
        fields.append({"key": f"position-{s}", "label": name + (f" {i+1:02d}" if len(state)>1 else ""),
                       "stateField": f"{state_key}[{i}]", "actionField": f"{action_key}[{i}]",
                       "unit": None, "stateIndex": s, "actionIndex": a})
rows = [{"timestamp": t, "state": [table["observation.state"][i][f["stateIndex"]] for f in fields],
         "action": [table["action"][i][f["actionIndex"]] for f in fields]} for i, t in enumerate(times)]
output.mkdir(parents=True, exist_ok=True)
cameras = []
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
for key, label, channel in [("head", "头部摄像头", "top_head"), ("left", "左手摄像头", "hand_left"), ("right", "右手摄像头", "hand_right")]:
    original = source / f"videos/chunk-000/observation.images.{channel}/episode_000000.mp4"
    target = output / f"{key}.mp4"
    subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(original), "-map", "0:v:0",
                    "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-pix_fmt", "yuv420p",
                    "-r", str(fps), "-g", str(fps), "-movflags", "+faststart", str(target)], check=True)
    # 展示副本保留与数值帧相同的数量和帧率。
    frames, duration = imageio_ffmpeg.count_frames_and_secs(str(target))
    assert frames == len(times) and abs(duration - len(times) / fps) < 0.05
    cameras.append({"key": key, "label": label, "sourceChannel": f"observation.images.{channel}",
                    "sourceSha256": hashlib.sha256(original.read_bytes()).hexdigest(), "bytes": target.stat().st_size})
    print(key, frames, duration, target.stat().st_size, flush=True)
task = json.loads((source / "meta/tasks.jsonl").read_text(encoding="utf-8").splitlines()[0])["task"]
original_segments = [{"label": s["instruction"], "startFrame": s["start_frame_index"], "endFrame": s["end_frame_index"]}
                     for s in info["instruction_segments"]["0"]]
manifest = {"id": "agibot-2026-episode-0", "dataset": "AgiBot World 2026", "format": "LeRobot v2.1",
            "robot": info["robot_type"], "episodeIndex": 0, "task": task,
            "instruction": original_segments[0]["label"], "instructionZh": "机器人夹爪与视野中的物体进行随机交互（原始指令译文）",
            "frameCount": len(times), "fps": fps, "duration": len(times)/fps, "lastTimestamp": times[-1],
            "cameras": cameras, "fields": [{k:v for k,v in f.items() if k not in ("stateIndex", "actionIndex")} for f in fields],
            "originalSegments": original_segments, "sourceParquetSha256": hashlib.sha256((source / "data/chunk-000/episode_000000.parquet").read_bytes()).hexdigest()}
for name, data in [("manifest.json", manifest), ("frames.json", rows)]:
    (output/name).write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print("Imported", len(rows), "frames to", str(output), flush=True)
