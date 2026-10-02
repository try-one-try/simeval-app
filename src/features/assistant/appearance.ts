/** 小人的动作旋钮：数值越大，动作越明显。只改这里即可，不必找 CSS。 */
export const assistantAppearance = {
  // 一次起伏从最低到最高相差多少像素。20 表示肉眼能明显看见上下移动。
  idleTravelPx: 20,
  // 完成“上去再下来”花几秒；调小更快，调大更悠闲。
  idleSeconds: 2.4,
  // 鼠标移到小人边缘时，最多向那边倾斜多少度。
  hoverTiltDegrees: 10,
  // 靠近时最多向鼠标挪多少像素；不会追着鼠标跑遍网页。
  hoverTravelPx: 6,
  // 点击时向上弹起的高度；打开面板后，待机的大幅起伏会暂停。
  clickJumpPx: 24,
} as const;
