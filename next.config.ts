// 版本化人物素材长期缓存；替换素材时换 v1 目录版本，避免浏览器沿用旧画面。
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/avatar/v1/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] }];
  },
};

export default nextConfig;
