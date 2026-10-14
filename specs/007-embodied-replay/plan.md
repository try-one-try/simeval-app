# 实施计划

## 线上素材接入（2026-10-14）

采用已创建的 Vercel Private Blob：固定路径 `embodied-replay/v1/agibot-2026-episode-0/`，脚本上传三路视频和两份 JSON，并逐文件校验。服务端保留登录验证，视频流转发 Range；本地默认读取磁盘，Vercel 默认读取 Blob，可用 `REPLAY_STORAGE` 显式选择。密钥仅服务端使用，素材不进入 Git。上传脚本拒绝覆盖内容不同的同名文件，换素材应升级目录版本。生产库仅执行已审阅的增量迁移，不 Seed 或重置。

1. `scripts/import-replay.py` 校验 Parquet 时间和维度，生成三路兼容视频、manifest 和精简时序数据；不覆盖源文件。
2. `src/domain/replay.ts` 管标注和时间规则，`src/lib/replay-dto.ts` 定义前后端数据契约。
3. `src/server/providers/replay-source.ts` 读取固定目录白名单文件；`src/server/repositories/replay-repository.ts` 管标注版本、事务与审计；应用服务组合二者。
4. `/api/replay/episodes/[episodeId]` 返回元数据和时序；`annotations` GET/PUT 返回／保存人工标注；`media/[camera]` 输出带 Range 的视频，鉴权后再读取文件。
5. `/optimization` 组合服务端身份与客户端回放页。客户端将媒体同步逻辑独立为 hook，界面与标注编辑器独立维护。画面使用真实视频，无图表。
6. Prisma 增加一张标注集合表，以 Episode 为唯一键，版本 0 表示尚未保存。原始视频／状态不进数据库。历史 before/after 写 AuditLog。
7. 同步公开契约、产品说明，以及私人新增功能阶段记录与面试笔记。先本地验收，不自动发布。

体验修订：工作台 Link 对 /optimization 关闭 prefetch，进入页面再加载；统一进度以记录和三路视频就绪计数。原生 dialog 居中展示关节数据和编辑草稿。应用层为 version=0 的新记录提供人工预设，已保存内容不覆盖；API、服务、仓储一致允许两种演示角色编辑。
