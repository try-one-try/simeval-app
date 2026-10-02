# 实施方案

- `src/app/page.tsx`：公开页面组合，保留原入口错误提示。
- `src/features/home/content.ts`：可编辑文案、外链、步骤；无需接数据库。
- `home-page.tsx`、`home.module.css`：服务端排版，CSS Module 隔离工作区样式。
- `interactive-home.tsx`：React 生命周期、加载屏、触屏和键盘操作；通过 children 保留正文服务端渲染。
- `avatar/controls.ts`：纯函数负责指针区域、滞回与逐帧运动。
- `avatar/engine.ts`：独立 Canvas 引擎，流式下载、解码验证、6 张 LRU 缓存、预解码、回程与清理；逐帧不触发 React 重渲染。
- `public/avatar/v1/`：仅复制已验收的 WebP 运行图集及清单，版本目录采用长期缓存。替换素材须换版本目录，避免旧 CDN 缓存。
- 维持现有 Next.js／React／TypeScript 与 CSS，无新增动画库、数据库表或 HTTP 业务接口。

先固定规格、文件职责和内容，再迁移动作引擎与高清资源，组合页面，最后依据浏览器实际画面与回程数据修正。素材哈希需与已认可 Demo 一致。
