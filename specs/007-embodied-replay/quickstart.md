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

迁移命令应在已核对的开发库运行。导入从 `meta/`、`data/`、`videos/` 生成 `assets/embodied-replay/agibot-2026-episode-0/`，包括三路 H.264 MP4、manifest 与时序 JSON。源文件不变，展示素材被 Git 忽略。

## Vercel Private Blob 上线

1. 创建 Private Blob 并关联当前 Vercel 项目的 Production 环境，添加 `BLOB_READ_WRITE_TOKEN`。本机 `.env.local` 也配置该变量，不提交密钥。
2. 在已导入素材的本地仓库运行 `npm run replay:upload`。上传固定目录 `embodied-replay/v1/agibot-2026-episode-0/` 下五个文件，SHA-256 校验；同名内容不同会停止，不能静默覆盖。仅核验用 `npm run replay:upload -- --verify`。
3. 默认本地从磁盘读取，Vercel 从 Blob 读取；用 `REPLAY_STORAGE=blob` 可在本地验证云端。素材版本调整必须同步修改 Provider 与上传脚本的版本目录。
4. 对核对过的生产数据库执行 `prisma migrate deploy --config prisma7.config.ts`；仅追加迁移，不运行 Seed 或重置。随后重新部署应用，并验证登录、数据、三路视频拖动和标注读取。
5. Private Blob 不提供公开下载入口：服务端校验登录后读取，媒体转发 Range 并核对上游 206／长度／范围；浏览器不会收到 Blob 密钥。缺素材或配置错误仍报错，不回退伪造数据。

来源：[AgiBot World 2026](https://huggingface.co/datasets/agibot-world/AgiBotWorld2026)，数据集标示 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)。展示副本做视频转码、数值字段提取与指令翻译；衍生数据沿用该许可，原始作者保留署名。当前用途为非商业学习与面试展示，新增人工分段单独注明。本说明不改变应用代码许可。

访问 `/optimization`，使用现有演示登录。媒体接口也需要会话，不能直接访问磁盘路径。

## 核心验证

- 三路视频可播放、暂停；拖动停在指定时刻，前后帧更新数值；倍速一致。
- 任一路等待或定位时共同暂停；断网、视频缺失明确报错并提供重试；隐藏页面暂停。
- 工程师、评测人员共用标注编辑；预设分段可修改，添加合法帧范围和阶段说明后刷新仍存在。
- 两个编辑页保存同版本：后保存者收到冲突，输入保留，读取并核对最新内容后才能再次保存。
- 未登录接口 401；错误 Episode／摄像头 404；错误 Range 416；越权写入／跨站写入 403。
- 1366×768 桌面一屏展示；14 项关节详情及编辑弹窗居中。进入板块才加载，执行记录和三路视频按就绪项显示进度；窄屏保留必要滚动，控制支持键盘操作。

独立测试库命令 `npm run test:integration`；新增边界测试 `npx vitest run tests/unit/replay.test.ts`。人物动画测试不在本功能范围。
