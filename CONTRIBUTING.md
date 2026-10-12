# 贡献指南

感谢你对 PromptMan 的关注！本文档说明如何在本地搭建开发环境、代码规范以及发布流程。

> English version: [CONTRIBUTING.en.md](./CONTRIBUTING.en.md)

## 开发环境

### 前置要求

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0（推荐通过 [Corepack](https://nodejs.org/api/corepack.html) 安装）

```bash
corepack enable
```

### 安装与启动

```bash
# 克隆仓库
git clone https://github.com/Alfred-Lau/promptman-community.git
cd kithub

# 安装依赖（自动重建 native 模块并安装 git hooks）
pnpm install

# 启动开发环境
pnpm dev
```

`pnpm dev` 会依次：编译 Electron TypeScript → 启动 Next.js 开发服务器（端口 4001）→ 等待就绪后启动 Electron 窗口。

#### 分终端启动（修改主进程代码时推荐）

```bash
# 终端 1：监听 Electron 代码变化并自动重新编译
pnpm dev:watch

# 终端 2：启动 Next.js 开发服务器
pnpm dev:next

# 终端 3：启动 Electron
pnpm dev:electron
```

### 常用命令

```bash
pnpm dev                 # 完整开发环境
pnpm build               # 生产构建（Next.js + Electron 打包）
pnpm build:electron:dir  # 仅编译 Electron（不打包，用于快速验证）
pnpm lint                # ESLint 检查
pnpm type-check          # TypeScript 类型检查
pnpm clear-cache         # 清除 ML 模型缓存
```

## 项目架构

### 三层 Electron 架构

```
┌─────────────────────────────────────────┐
│           Renderer Process              │
│   Next.js App Router + React 19        │
│   src/  ──→ window.electronAPI (IPC)   │
└──────────────────┬──────────────────────┘
                   │ IPC (contextBridge)
┌──────────────────▼──────────────────────┐
│           Preload Script                │
│   electron/preload/index.ts            │
│   仅暴露白名单 API，context isolation   │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│           Main Process                  │
│   electron/main/                        │
│   - ipc.ts      100+ IPC 处理器        │
│   - sqlitedb/   SQLite + 向量搜索      │
│   - auth.ts     OAuth 认证             │
│   - updater.ts  自动更新               │
└─────────────────────────────────────────┘
```

### IPC 通信约定

```typescript
const result = await window.electronAPI.invoke('namespace:entity:action', ...args)
// 返回格式：{ success: boolean, data?: any, error?: string }
```

频道命名规范示例：`seekdb:prompt:create`、`seekdb:agentSkill:list`、`app:getVersion`。

### 项目结构

```
kithub/
├── electron/
│   ├── main/              # 主进程
│   │   ├── ipc.ts         # 所有 IPC 处理器（100+）
│   │   ├── sqlitedb/      # SQLite CRUD + 向量搜索
│   │   ├── auth.ts        # OAuth 认证
│   │   ├── updater.ts     # 自动更新
│   │   └── prompthub/     # 云同步客户端
│   └── preload/index.ts   # 安全桥接层
├── src/
│   ├── app/               # Next.js App Router
│   ├── components/        # UI 组件（List / Form 成对出现）
│   ├── lib/seekdb/        # 前端 API 封装 + 类型定义
│   └── modules/auth/      # 认证模块
├── scripts/               # 构建 / 发布脚本
├── docs/screenshots/      # README 截图资源
├── .env.example           # 环境变量模板（切勿提交真实 .env）
└── .github/workflows/     # CI / Release
```

## 代码规范

- 使用 TypeScript，开启 strict 模式
- 渲染进程与主进程的通信**只能**通过 IPC，禁止绕过 preload 直接访问 Node.js API
- IPC 频道命名格式：`namespace:entity:action`
- 提交前运行 `pnpm lint` 和 `pnpm type-check` 确保无报错

## 提交 PR

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feat/your-feature`
3. 提交改动：`git commit -m 'feat: add some feature'`
4. 推送分支：`git push origin feat/your-feature`
5. 创建 Pull Request

## 构建与发布

### 本地构建

```bash
pnpm build:mac            # macOS（需要 Apple 开发者证书）
pnpm build:mac:unsigned   # macOS（跳过代码签名，仅用于测试）
pnpm build:win            # Windows（Coming Soon）
pnpm build:all            # 全平台（Coming Soon）
```

复制环境变量模板并填入所需信息：

```bash
cp .env.example .env
```

### 发布到 GitHub Releases

```bash
pnpm release:github:mac   # macOS
pnpm release:github:win   # Windows（Coming Soon）
pnpm release:github:all   # 全平台（Coming Soon）
```

### CI/CD 自动发布

推送版本标签后，GitHub Actions 会在**本仓库**创建 GitHub Release 并上传产物：

```bash
git tag v1.2.3 && git push origin v1.2.3
```

PR 会跑 `pnpm lint` 与 `pnpm type-check`（见 `.github/workflows/ci.yml`）。

在仓库 Secrets 中配置以下变量以启用签名和公证：

| Secret | 说明 |
|--------|------|
| `CSC_LINK` | base64 编码的 .p12 证书（macOS） |
| `CSC_KEY_PASSWORD` | .p12 证书密码 |
| `APPLE_ID` | Apple 开发者账号邮箱 |
| `APPLE_APP_SPECIFIC_PASSWORD` | Apple 应用专用密码 |
| `APPLE_TEAM_ID` | Apple 开发者 Team ID |
| `WIN_CSC_LINK` | base64 编码的 .p12 证书（Windows，可选） |
| `WIN_CSC_KEY_PASSWORD` | Windows 证书密码（可选） |

> 旧的 `promptman-releases` 仓库可保留为历史镜像；新版本以本仓 Releases 与官网下载为准。

### 行为准则与安全

- 参与社区请遵守 [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- 漏洞请按 [SECURITY.md](./SECURITY.md) 私下报告，不要开公开 Issue

## 故障排除

**模型加载错误（Protobuf parsing failed）**

```bash
pnpm clear-cache
```

**修改 Electron 主进程代码后窗口未更新**

需要重新编译主进程代码：

```bash
pnpm dev:watch  # 或重启 pnpm dev
```

**native 模块兼容问题（better-sqlite3 / onnxruntime-node 崩溃）**

```bash
pnpm install  # postinstall 会自动重建 native 模块
```
