# 开源公开前检查清单（手动项 + 已验证项）

仓库内文档与 CI 已按开源引流方案改好。公开仓库前请人工完成：

## 🔴 必须（不完成会导致用户无法构建/使用）

- [ ] 将 GitHub 仓库 `Alfred-Lau/promptman-community` 设为 **Public**
- [ ] 验证 `pnpm build` 完整跑通（macOS + Windows 至少各一次）
  - 确认 `build/icon.png`(1024×1024)、`build/icon.ico`、`build/entitlements.mac.plist` 均已提交到 git
  - ⚠️ 这三个文件是 electron-builder 打包的硬依赖，缺失则构建直接失败
- [ ] 确认云同步后端策略，二选一：
  - **A. 开源版不提供官方云同步**：保留 `PROMPTHUB_API_BASE_URL` 环境变量占位（已实现，默认 `your-prompt-hub.example.com`），README 注明「云同步需自部署兼容后端」
  - **B. 官方开放注册**：把 `client.ts` 的占位符改回你的真实域名，并确认后端能承受公开流量
  - ⚠️ 当前默认是 A（占位符），不要在没有后端承载能力时改回 B
- [ ] macOS 签名/公证决定：
  - 有 Apple Developer 账号（¥688/年）→ 配 `APPLE_ID`/`APPLE_TEAM_ID`/`APPLE_APP_SPECIFIC_PASSWORD` 环境变量，`notarize.js` 会真正公证
  - 没有 → README 显著位置注明「macOS 版未签名，首次打开需右键 → 打开（或 `xattr -cr` 绕过 Gatekeeper）」
- [ ] Windows 代码签名决定：无证书时用户会看到 SmartScreen 警告，README 注明即可

## 🟡 建议（体验与口碑）

- [ ] 在 `docs/screenshots/` 放入真实产品截图 / GIF（当前只有占位 README），并更新 README 预览区
- [ ] 打 tag 发一版 Release（本仓），官网下载页指向同一版本
- [ ] 可选：在仓库标注若干 `good first issue`
- [ ] 宣布开源时同步官网「开源在 GitHub」入口
- [ ] 写一份「从源码构建」快速入门（`pnpm install` → `pnpm dev` / `pnpm build`），新手 5 分钟能跑起来

## ✅ 已验证（本次开源审查结论）

- [x] 无硬编码密钥：全仓库 + git 历史无真实 token/密码/证书
- [x] `.env` 被忽略，`.env.example` 全占位符
- [x] 无遥测/埋点代码（无 posthog/sentry/analytics 等数据外发）
- [x] SQL 全部参数化（42 处 prepare，无注入）
- [x] 无真实用户截图/数据入库
- [x] `prompt.solokit.run` 后端域名已从代码改为占位符（`client.ts`），应用内官网链接 `productLinks.ts` 保留作引流
- [x] `build/` 打包资源已补入仓库（icon.png / icon.ico / entitlements.mac.plist）

## ⚠️ 运维注意（开源后）

- 私有主仓库 `~/codezone/kithub` 配置了 `oss` remote 指向本开源仓库 —— **不要在私有主仓库 push 到 oss**，开源仓库内容以 `promptman-opensource` 目录为准；如不需要可删除该 remote
- 自动更新链路：发布用 `publish:github:*`（推 GitHub Releases）或 `publish:oss:*`（推自己的 OSS）。若走 OSS 且未签名，更新包会被系统拦截，务必在文档说明
