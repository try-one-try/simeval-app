// 示例依据当前合成日志填表，不推断未经证实的根因，也不负责保存或确认。
export function reviewExample(log: string | null): string {
  let observation = "当前证据不足以判断异常原因";
  let suggestion = "补充对应 Episode 的完整日志和场景信息，再核对异常是否可复现";
  if (log?.includes("occlusion_label_offset=true")) {
    observation = "合成日志标记遮挡标签偏移，需核对标注与场景是否对齐";
    suggestion = "检查标签坐标与遮挡区域，修正后在相同评测条件下复测";
  } else if (log?.includes("synthetic_grasp_path_collision=true") || log?.includes("collision_during_grasp=true")) {
    observation = "合成日志记录抓取路径发生碰撞，单凭该标记尚不能确定模型或数据原因";
    suggestion = "核对抓取轨迹、物体位置和遮挡情况，再用相同配置复测";
  } else if (log?.includes("synthetic_collision_contact=true")) {
    observation = "合成日志记录碰撞接触，单凭该标记尚不能确定模型或数据原因";
    suggestion = "检查接触时刻的轨迹与场景信息，再用相同配置复测";
  }
  return "演示结论：" + observation + "。建议" + suggestion + "。仅用于合成演示，不代表真实模型性能或已证实原因。";
}
