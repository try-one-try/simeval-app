/** 这个文件决定：鼠标移到哪里，人物就做到哪个动作、做到多少。
 * 日常修改用 npm run dev，保存后网页会更新。
 * npm run start 播的是上次打包的版本；改完要重新 build、再启动，刷新网页本身没用。
 */
// | 参数 | 控制什么 | 调小后 |
// |---|---|---|
// | `horizontalDeadZone: 0.05` | 鼠标离开人物中心多远，才开始扶镜／伸手 | 更早开始动 |
// | `horizontalTravel: 0.20` | 开始动后，还要移多远才能完成动作 | 移动更短距离就能做完整 |
// | `edgeBand: 0.25` | 从屏幕顶、底各划 25% 高度，优先做抬头／低头 | 上下区域变窄，中间更容易做左右动作 |
// | `edgeHysteresis: 0.04` | 鼠标刚离开上下区域时，暂时保持原动作，防止边界来回抖 | 更快切换动作，但边界更容易抖 |
// | `edgeVerticalTravel: 0.28` | 鼠标已在顶部／底部时：离屏幕高度的中线多远，才做到完整抬头／低头 | 更快做到完整动作；不改变上下区域的大小 |
// | `centerVerticalDeadZone: 0.10` | 鼠标贴近人物的左右中心时：上下离人物中心多远，头才开始动 | 头更早开始动 |
// | `centerVerticalTravel: 0.30` | 在上述中心位置、头开始动之后：还要上下移动多远，才做到完整动作 | 更快做到完整动作；不改变顶部／底部区域 |
// edgeVerticalTravel 管屏幕顶／底两块区域；centerVerticalTravel 只管中间区域里贴近人物中心的窄条。
// 两者用的尺子也不同：前者按“整个屏幕高度”算，后者按“半个屏幕高度”算。
export type Direction = "left" | "right" | "up" | "down";
export type Target = { direction: Direction | null; amount: number };
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** 想调鼠标手感，优先改下面这几个数字。0.30 就是 30%，不是 30 像素。
 * 调左右时，把鼠标放在屏幕中间高度再试；靠近屏幕顶部或底部会做上下动作。
 */
export const POINTER_SETTINGS = {
  // 【edgeBand：从屏幕顶部、底部各划出多高，专门留给抬头和低头】
  // 现在是 0.25。假如屏幕高 1000px：鼠标在最上面 250px 内就抬头，最下面 250px 内就低头。
  // 剩下中间 500px 主要管左右；鼠标在左上角也会抬头，因为这里先判断“上”，再判断“左”。
  // 改成 0.20：上下各只占 200px，左右能活动的中间更宽。改成 0.40：上下各占 400px，中间更窄。
  // 它决定“在哪块区域做哪种动作”，不决定抬头幅度或动作速度。数值要大于 0、小于 0.5。
  // 小例外：在中间区域，如果鼠标紧贴人物的水平中心，上下移动也仍可带动头部。
  edgeBand: 0.25,
  // 【边界别太敏感】已经抬头时，鼠标稍微往下挪，还会保留抬头；低头同理。
  // 0.04 表示多留 4% 屏幕高度。调大更不容易来回切换，调小切换更直接，一般不用改。
  edgeHysteresis: 0.04,

  // 【左右要挪多远才开始动】把人物中心到左边（或右边）屏幕边缘看成一整段路。
  // 0.05：先走这段路的 5%，才开始扶镜或伸手。调小更早动，调大更晚动。
  horizontalDeadZone: 0.05,
  // 【再挪多远才做完整个动作】开始动以后，再走上面那段路的 20%，就完全伸手／扶好墨镜。
  // 调小：鼠标挪一点，动作就做得更足；调大：需要挪更远。必须大于 0。
  // 例：人物到屏幕右边有 720px，先走 36px 开始动，再走 144px 做完，共 180px。
  // 建议这个值加上 horizontalDeadZone 不超过 1，否则移到屏幕边缘也做不完整。
  // 注意：它不会让手伸得比原视频更远，也不会加快人物运动速度。
  horizontalTravel: 0.20,

  // 【edgeVerticalTravel：已进入屏幕顶部／底部时，头部动作做到多少】
  // 0.28：从屏幕高度中线往上／下走满整屏高度的 28%，头部动作就做完。
  // 例：屏幕高 1000px，中线在 500px；上移到 220px 就完全抬头，下移到 780px 就完全低头。
  // 由于 edgeBand 是 0.25，鼠标进入最上面 250px 时，动作已经接近做完。
  // 调小会更早做完；它不改变顶部／底部区域的大小，区域大小只由 edgeBand 控制。
  edgeVerticalTravel: 0.28,
  // 【鼠标就在人物中间时，上下挪多少才动】这里用“半个屏幕高度”当作一整段路。
  // 0.10：离人物中心上下不到“半屏高度”的 10%，保持待机；调小更早动，调大更晚动。
  centerVerticalDeadZone: 0.10,
  // 【centerVerticalTravel：鼠标贴近人物左右中心时，头部动作做到多少】
  // 0.30：越过上面的待机范围后，再上下移动“半屏高度”的 30%，头部动作就做完。
  // 例：屏幕高 1000px、人物中心在屏幕中间；先移动 50px 才开始动，再移动 150px 做完。
  // 只在屏幕中段且鼠标贴近人物左右中心时生效；调小会更早做完，不改变顶部／底部区域。
  centerVerticalTravel: 0.30,
} as const;

export function pointerTarget(x: number, y: number, width: number, height: number, center: { x: number; y: number }, previous: Direction | null): Target {
  const settings = POINTER_SETTINGS;
  const vertical = y / Math.max(1, height);
  // 先看鼠标是不是在屏幕顶部／底部：是的话就做上下动作，包括四个角。
  if (vertical < settings.edgeBand || (previous === "up" && vertical < settings.edgeBand + settings.edgeHysteresis)) {
    return { direction: "up", amount: clamp((.5 - vertical) / settings.edgeVerticalTravel, 0, 1) };
  }
  if (vertical > 1 - settings.edgeBand || (previous === "down" && vertical > 1 - settings.edgeBand - settings.edgeHysteresis)) {
    return { direction: "down", amount: clamp((vertical - .5) / settings.edgeVerticalTravel, 0, 1) };
  }
  // 把鼠标距离换成比例：人物中心是 0，走到左边是 -1，右边是 1，换屏幕也能用。
  const dx = (x - center.x) / Math.max(1, x < center.x ? center.x : width - center.x);
  const dy = (y - center.y) / Math.max(1, height * .5);
  if (Math.abs(dx) < settings.horizontalDeadZone) {
    if (Math.abs(dy) < settings.centerVerticalDeadZone) return { direction: null, amount: 0 };
    return { direction: dy < 0 ? "up" : "down", amount: clamp((Math.abs(dy) - settings.centerVerticalDeadZone) / settings.centerVerticalTravel, 0, 1) };
  }
  // 算出动作要做多少：0 是待机，1 是完整动作；鼠标再远也不会超过原视频的结尾。
  return { direction: dx < 0 ? "left" : "right", amount: clamp((Math.abs(dx) - settings.horizontalDeadZone) / settings.horizontalTravel, 0, 1) };
}

/** 手机手感单独调整，不影响上面的鼠标参数。
 * 手指按下的位置就是起点：往哪边拖，人物就做哪边的动作，不要求手指碰到屏幕边缘。
 */
export const TOUCH_SETTINGS = {
  // 手指先走 8px 才开始动，避免轻点人物时因为手抖误触。
  deadZone: 8,
  // 开始动后，再拖动人物区域宽度的 24% 就完成动作。调小，手指挪得更短。
  travel: 0.24,
  // 上面的距离限制在 56～96px，手机和平板都不需要拖太远。
  minTravel: 56,
  maxTravel: 96,
  // 斜着拖时，另一方向明显多出 15% 才换方向，避免左右／上下反复抢动作。
  directionHysteresis: 0.15,
} as const;

export function touchTarget(dx: number, dy: number, width: number, previous: Direction | null): Target {
  const settings = TOUCH_SETTINGS;
  const horizontal = Math.abs(dx), vertical = Math.abs(dy);
  if (Math.max(horizontal, vertical) <= settings.deadZone) return { direction: null, amount: 0 };

  let useVertical = vertical >= horizontal;
  if (previous === "up" || previous === "down") {
    useVertical = horizontal <= vertical * (1 + settings.directionHysteresis);
  } else if (previous === "left" || previous === "right") {
    useVertical = vertical > horizontal * (1 + settings.directionHysteresis);
  }
  const distance = useVertical ? vertical : horizontal;
  const travel = clamp(width * settings.travel, settings.minTravel, settings.maxTravel);
  return {
    direction: useVertical ? (dy < 0 ? "up" : "down") : (dx < 0 ? "left" : "right"),
    amount: clamp((distance - settings.deadZone) / travel, 0, 1),
  };
}

/** 下面才是人物运动速度。上面的参数只管“鼠标走多远，动作做多少”。
 * 人物会沿着视频慢慢做到指定动作；换方向时，先自然收手，再做新动作。
 * 为了保留已调好的流畅效果，日常调手感不用改这里。
 */
export function advanceFrame(position: number, target: number, seconds: number, frames: number) {
  // 快到指定动作时逐渐放慢，避免手突然停住。0.4 是最低速度，1 是最高速度，6 控制何时减速。
  const speed = clamp(Math.abs(target - position) * 6, .4, 1);
  // 每次最多走一张图片；电脑暂时卡顿时，也不突然跳过一大段动作。
  const distance = Math.min(Math.max(0, seconds) * speed, 1 / (frames - 1));
  return Math.abs(target - position) <= distance ? target : position + Math.sign(target - position) * distance;
}
