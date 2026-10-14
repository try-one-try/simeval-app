# 运行与验收

## 数据准备

需要 Python、pyarrow、imageio-ffmpeg。应用运行时不需要 Python。

```sh
python -m pip install pyarrow imageio-ffmpeg
python scripts/import-replay.py <单Episode数据集目录>
npm run db:generate
npm run db:deploy
npm run dev
```

迁移命令应在已核对的开发库运行。导入从 `meta/`、`data/`、`videos/` 生成 `assets/embodied-replay/agibot-2026-episode-0/`，包括三路 H.264 MP4、manifest 与时序 JSON。源文件不变。素材被 Git 忽略；公开部署前核对来源许可，在构建环境准备相同目录，Next.js 跟踪规则将素材带入回放接口函数。该方案适合单 Episode，更多数据需考虑对象存储及带宽。

访问 `/optimization`，使用现有演示登录。媒体接口也需要会话，不能直接访问磁盘路径。

## 核心验证

- 三路视频可播放、暂停；拖动停在指定时刻，前后帧更新数值；倍速一致。
- 任一路等待或定位时共同暂停；断网、视频缺失明确报错并提供重试；隐藏页面暂停。
- 工程师、评测人员共用标注编辑；预设分段可修改，添加合法帧范围和阶段说明后刷新仍存在。
- 两个编辑页保存同版本：后保存者收到冲突，输入保留，读取并核对最新内容后才能再次保存。
- 未登录接口 401；错误 Episode／摄像头 404；错误 Range 416；越权写入／跨站写入 403。
- 1366×768 桌面一屏展示；14 项关节详情及编辑弹窗居中。进入板块才加载，执行记录和三路视频按就绪项显示进度；窄屏保留必要滚动，控制支持键盘操作。

独立测试库命令 `npm run test:integration`；新增边界测试 `npx vitest run tests/unit/replay.test.ts`。人物动画测试不在本功能范围。
