# PromptMan

<p align="center">
  <img src="public/icon.png" alt="PromptMan Logo" width="128" height="128" />
</p>

<p align="center">
  <strong>本地优先的 AI 提示词 & Agent Skill 工作台</strong><br/>
  <em>Prompt 分库管理 · 语义搜索 · 版本回溯 · 一键变成可复用 Skill</em>
</p>

<p align="center">
  <a href="https://prompt.solokit.run/"><strong>官网下载</strong></a> ·
  <a href="https://github.com/Alfred-Lau/promptman-community/releases/latest"><strong>GitHub Releases</strong></a> ·
  <a href="#功能亮点">功能</a> ·
  <a href="#下载安装">下载</a> ·
  <a href="#安全与隐私">安全与隐私</a> ·
  <a href="#参与贡献">贡献</a>
  &nbsp;|&nbsp;
  <a href="./README.md">English</a>
</p>

<p align="center">
  <a href="https://prompt.solokit.run/">
    <img src="https://img.shields.io/badge/Website-prompt.solokit.run-0ea5e9?style=flat-square" alt="Website" />
  </a>
  <a href="https://github.com/Alfred-Lau/promptman-community/releases/latest">
    <img src="https://img.shields.io/github/v/release/Alfred-Lau/promptman-community?style=flat-square&label=Release&color=6366f1" alt="Latest Release" />
  </a>
  <a href="https://github.com/Alfred-Lau/promptman-community/releases">
    <img src="https://img.shields.io/github/downloads/Alfred-Lau/promptman-community/total?style=flat-square&label=Downloads&color=6366f1" alt="Total Downloads" />
  </a>
  <img src="https://img.shields.io/badge/Signed%20%26%20Notarized-Apple%20Developer%20ID-2ea043?style=flat-square" alt="Signed & Notarized" />
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
  </a>
  <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-lightgrey?style=flat-square" alt="Platform: macOS · Windows" />
</p>

<p align="center">
  <strong>无需注册</strong> · <strong>数据全在本机</strong> · <strong>离线可用</strong> ·
  如果觉得有用，欢迎点右上角 <strong>⭐ Star</strong> ✨
</p>

<p align="center">
  🛡️ <strong>当前开源版 v0.1.0 为「签名 + 公证」的安全版本</strong> — macOS 安装包已通过 Apple Developer ID 签名与 Apple 公证，Gatekeeper 可直接打开，无需右键绕过
</p>

---

## 为什么用 PromptMan？

Prompt 越攒越多之后，真正的问题不是「存不下」，而是**找不到、用不上**：

- 🗂️ **分库 + 标签双维度组织** — 按项目/用途建「库」，再用标签细筛，告别一个扁平大列表
- 🔍 **本地语义搜索** — 不靠关键词死记，输入「帮我写个周报的 prompt」这种自然语言也能找到，模型在**本机运行**、离线可用
- 🕘 **完整版本历史** — 每次修改都可回滚，prompt 迭代过程不丢
- 🧩 **Prompt → Skill 一键升级** — 常用的提示词沉淀为带参数的可复用 Agent Skill，再组合成 SubAgent / Team
- ⚡ **全局快捷键唤起** — 任意界面 `Cmd/Ctrl+Shift+P` 呼出搜索窗，即搜即用
- 🔌 **Chrome 插件联动** — 在浏览器里就能调用本机库，网页内容直接存入 / 检索（配合本地扩展 API 服务）

---

## 产品预览

<p align="center">
  <img src="docs/screenshots/home.png" alt="PromptMan 内置精选市场：浏览并一键导入可复用的 Prompt / Agent Skill" width="90%" />
</p>

<p align="center">
  <img src="docs/screenshots/discover.png" alt="PromptMan Discover 发现页" width="90%" />
</p>

> 更多界面截图与 GIF 演示见 [`docs/screenshots/`](./docs/screenshots/README.md)。

---

## 下载安装

**推荐**：前往官网 [prompt.solokit.run](https://prompt.solokit.run/) 获取最新安装包。

也可直接从 [GitHub Releases](https://github.com/Alfred-Lau/promptman-community/releases/latest) 下载：

> ⚡ **当前开源版（v0.1.0）即为签名 + 公证的正式构建**：macOS 产物使用 Apple Developer ID 签名并通过 Apple 公证（`spctl` 评估为 Notarized Developer ID），Gatekeeper 可直接打开，无需任何绕过操作。

| 平台 | 文件格式 | 状态 |
|------|----------|------|
| macOS (Apple Silicon / arm64) | `.dmg`（手动安装）/ `.zip`（自动更新） | ✅ 可用 · 已签名 + Apple 公证 |
| Windows (x64) | `.exe`（NSIS 安装包） | ✅ 可用 · 未签名（SmartScreen 会提示，见下方说明） |
| Linux | `.AppImage` / `.deb` | 🚧 Coming Soon |

> **macOS**：v0.1.0 起所有正式产物均已通过 Developer ID 签名与 Apple 公证，Gatekeeper 可直接打开，**无需**右键「打开」或到「系统设置 → 隐私与安全性」手动放行。
> **Windows**：目前没有 Windows 代码签名证书，产物未签名。首次运行 SmartScreen 会提示「Windows 已保护你的电脑」——点击「更多信息 → 仍要运行」即可，属预期行为。
> **Linux**：正式安装包仍在制作中，可留意后续 Release。

**开源用户无需账号**：安装后直接进入本机库，空库会自动写入示例 Prompt / Skill。

---

## 功能亮点

### 📝 Prompt 管理

- **创建与编辑** — 标题、分类、标签、模板内容
- **语义搜索** — 自然语言检索，本机向量嵌入，无需联网
- **版本历史** — 每个 Prompt 保留修改历史，随时回滚
- **分库管理** — 按项目/方向建多个库，标签 + 库双维度筛选

### 🧩 Agent Skills / SubAgents / Teams

- 把常用提示词沉淀为**可复用 Skill**（带参数 / 变量 / 示例）
- Skill 组合为 **Sub-Agent**，多个 Sub-Agent 编排成 **Agent Team**
- 全部版本化迭代，适合团队沉淀「标准工作流」

### 🛍️ 内置精选市场（Discover）

- 浏览精选 Prompt / Skill，**一键导入**本机
- 从 GitHub `awesome-skills` 等源拉取在线技能，或粘贴命令 CLI 安装

### 🔌 浏览器联动（扩展 API）

- 应用内启动本地 HTTP API 服务（仅 127.0.0.1）
- Chrome 插件可跨页检索、存入 Prompt / Skill（需自行配置插件指向本机端口）

### ✨ UI / 体验

- **品牌启动动画** — 琥珀色打字 logo + 轨道环进度动画（BootLoader，纯 CSS/SVG、样式内联），HTML 一到即渲染，CSS 就绪后平滑淡出，消除启动时的裸 HTML 闪烁；Electron splash 与页面使用同款品牌视觉
- **全局快捷键** — `Cmd/Ctrl+Shift+P` 任意界面呼出搜索窗

### ⚙️ 可选能力

- **云同步** — 开源版不内置官方后端，见下方「云同步」说明
- **AI 润色 / 生成** — 在设置中填入自己的 Provider Key（OpenAI / Anthropic / DeepSeek / 火山方舟等）
- **自动更新** — 启动时检查并一键安装

> 自动更新通过本仓库的 GitHub Releases 分发；仓库转为公开后，将对所有安装用户生效。

---

## 🔒 安全与隐私

- **数据全在本机** — Prompt / Skill 数据存于本机 SQLite，向量嵌入也在本机运行，默认不向任何服务器上传
- **无遥测 / 无埋点** — 不含 PostHog / Sentry / 第三方分析 SDK，不采集任何使用数据；启动时的更新检查仅请求版本信息
- **离线可用** — 除首次启动下载语义搜索模型（约 100 MB）外，日常使用无需联网
- **macOS：签名 + 公证** — v0.1.0 起正式产物经 Developer ID 签名并通过 Apple 公证（评估为 Notarized Developer ID），Gatekeeper 可直接打开，无需绕过安全设置
- **Windows：未签名说明** — 暂无 Windows 代码签名证书，产物未签名，SmartScreen 可能提示；属预期行为，点击「更多信息 → 仍要运行」即可
- **云同步边界** — 见下文「☁️ 云同步」；仅在你显式配置并登录自部署的兼容后端后，才可能发生数据同步

---

## ☁️ 云同步（开源版说明）

- 开源版**不内置官方云同步后端** —— `PROMPTHUB_API_BASE_URL` 默认仅为占位值、未指向任何官方服务时，登录 / 同步按钮不可用属正常现象
- 本地核心功能（创建 / 搜索 / 版本 / 技能包 / 市场导入）**完全离线可用**，不依赖任何后端
- 需要云同步的开发者可自部署 PromptHub 兼容后端，通过环境变量接入：

  ```bash
  PROMPTHUB_API_BASE_URL=https://your-prompt-hub.example.com pnpm dev
  ```

- 应用内官网入口（`prompt.solokit.run`）仅作为项目主页链接保留

---

## 快速开始

```bash
git clone https://github.com/Alfred-Lau/promptman-community.git
cd promptman-community
corepack enable
pnpm install
pnpm dev
```

常用命令：

| 命令 | 作用 |
|------|------|
| `pnpm dev` | 完整开发环境（Next.js + Electron） |
| `pnpm build` | 生产构建（Next.js + 打包） |
| `pnpm build:electron:dir` | 仅打包 Electron（不生成 dmg，最快验证） |
| `pnpm lint` | ESLint |
| `pnpm type-check` | TypeScript 类型检查 |
| `pnpm clear-cache` | 清理模型缓存（修复 Protobuf 解析错误） |

> 修改 Electron 主进程代码（`electron/main/`、`electron/preload/`）后需重新编译：运行 `pnpm dev:watch` 或重启 `pnpm dev`。

更多说明见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

---

## 常见问题

**Q: 需要注册才能用吗？**
不需要。打开即可管理本机 Prompt / Skill；登录只用于可选的云同步。

**Q: 首次启动很慢？**
首次需下载本地语义搜索模型（约 100 MB），之后缓存复用。

**Q: 语义搜索报错（Protobuf parsing failed）？**

```bash
pnpm clear-cache
```

**Q: Windows 打开时提示 SmartScreen / 「未知发布者」？**
Windows 版暂未做代码签名，SmartScreen 会拦截一次：点击「更多信息 → 仍要运行」即可正常安装。macOS 版不存在此问题（已签名 + 公证）。

**Q: 数据存在哪里？**

- macOS：`~/Library/Application Support/PromptMan/` 或 `~/.promptman/`（视数据根目录设置）
- Windows：`%APPDATA%\PromptMan\`
- Linux：`~/.config/PromptMan/`

**Q: 数据会上传到云端吗？**
不会。默认数据面是本机 SQLite，向量嵌入也在本机运行；只有在显式配置并登录自部署后端后才可能发生同步。

---

## 参与贡献

欢迎 Issue 与 Pull Request！请先阅读：

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [SECURITY.md](./SECURITY.md)

Good first issues 会陆续标注 `good first issue`。

---

## 相关链接

| | |
|--|--|
| 官网 / PromptHub | https://prompt.solokit.run/ |
| 源码 | https://github.com/Alfred-Lau/promptman-community |
| Releases | https://github.com/Alfred-Lau/promptman-community/releases |

## License

[MIT](./LICENSE) © Solokit Labs
