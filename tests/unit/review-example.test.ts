// 防止演示填表把未知日志当成固定根因；填表函数不依赖服务端或数据库。
import { expect, it } from "vitest";
import { reviewExample } from "../../src/lib/review-example";
it("根据当前合成证据填入示例，同时保留不确定性", () => {
  expect(reviewExample("occlusion_label_offset=true")).toContain("标签偏移");
  const collision = reviewExample("synthetic_grasp_path_collision=true");
  expect(collision).toContain("抓取路径");
  expect(collision).toContain("尚不能确定");
  expect(reviewExample("synthetic_collision_contact=true")).toContain("碰撞接触");
  expect(reviewExample("unexpected_event=true")).toContain("证据不足");
  expect(reviewExample(null)).not.toContain("标签偏移");
});
