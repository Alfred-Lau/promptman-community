# PromptMan 自动更新配置指南（阿里云 OSS）

> ⚠️ **废弃**:开源版(promptman-community)已迁移到 **GitHub Release + latest YAML** 机制,
> 自动更新元数据与安装包直接托管在 GitHub Releases。新方案见
> **[docs/AUTO_UPDATE_GITHUB.md](./docs/AUTO_UPDATE_GITHUB.md)**。
> 本文仅作私有部署 / OSS 自托管的历史参考,配置与当前 package.json 不符时以新文档为准。

> 维护者文档：配置发布与 OSS 更新通道。面向贡献者的日常开发请先看 [CONTRIBUTING.md](./CONTRIBUTING.md)。切勿将真实 AccessKey 提交到仓库。

## 目录

- [概述](#概述)
- [架构设计](#架构设计)
- [前置条件](#前置条件)
- [一次性配置](#一次性配置)
  - [1. 阿里云 OSS 配置](#1-阿里云-oss-配置)
  - [2. 环境变量配置](#2-环境变量配置)
  - [3. package.json 说明](#3-packagejson-说明)
  - [4. macOS 代码签名（可选）](#4-macos-代码签名可选)
- [发布流程](#发布流程)
  - [手动发布](#手动发布)
  - [CI/CD 自动发布](#cicd-自动发布)
- [更新机制详解](#更新机制详解)
  - [更新生命周期](#更新生命周期)
  - [IPC 通信协议](#ipc-通信协议)
  - [更新状态流转](#更新状态流转)
- [OSS 目录结构](#oss-目录结构)
- [开发环境测试](#开发环境测试)
- [故障排除](#故障排除)
- [安全注意事项](#安全注意事项)

---

## 概述

PromptMan 使用 [electron-updater](https://www.electron.build/auto-update) + **阿里云 OSS** 实现自动更新。

electron-updater 的 `generic` provider 允许将更新文件托管在任意 HTTPS 服务器上。OSS 作为静态文件存储，通过公网 URL 对外提供以下文件：

| 文件 | 说明 |
|------|------|
| `latest-mac.yml` | macOS 更新元数据（版本号、SHA512、文件名） |
| `latest.yml` | Windows 更新元数据 |
| `PromptMan-x.x.x-mac-x64.zip` | macOS 自动更新包 |
| `PromptMan-x.x.x-mac-x64.dmg` | macOS 手动安装包 |
| `PromptMan-x.x.x-win-x64.exe` | Windows 安装包（含自动更新） |

**核心特性：**

- 应用启动后自动检查更新（延迟 3 秒）
- 用户手动触发检查更新
- 发现新版本后由用户确认下载（不自动下载）
- 实时下载进度反馈
- 下载完成后提示重启安装

---

## 架构设计

```
┌──────────────────────────────────────────────────────┐
│                  阿里云 OSS Bucket                    │
│                                                      │
│  releases/promptman/                                 │
│  ├── latest-mac.yml    ← macOS 更新元数据             │
│  ├── latest.yml        ← Windows 更新元数据           │
│  ├── PromptMan-x.x.x-mac-x64.zip   (自动更新包)      │
│  ├── PromptMan-x.x.x-mac-x64.dmg   (手动安装包)      │
│  └── PromptMan-x.x.x-win-x64.exe   (Windows 安装包)  │
└───────────────────────┬──────────────────────────────┘
                        │  HTTPS 请求
                        ▼
┌──────────────────────────────────────────────────────┐
│              Electron Main Process                    │
│  ┌──────────────────────────────────────────────┐    │
│  │  electron-updater（generic provider）         │    │
│  │                                              │    │
│  │  checkForUpdates()   → GET latest-mac.yml    │    │
│  │  downloadUpdate()    → GET *.zip / *.exe     │    │
│  │  quitAndInstall()    → 退出并安装             │    │
│  └──────────────┬───────────────────────────────┘    │
│                 │ IPC Events                          │
│  ┌──────────────▼───────────────────────────────┐    │
│  │  updater.ts（IPC Handlers）                   │    │
│  │                                              │    │
│  │  updater:check      updater:download         │    │
│  │  updater:install    updater:getState         │    │
│  │  ← updater:status（状态推送）                 │    │
│  └──────────────┬───────────────────────────────┘    │
└─────────────────┼────────────────────────────────────┘
                  │ contextBridge (preload)
                  ▼
┌──────────────────────────────────────────────────────┐
│              Renderer Process (Next.js)               │
│         Settings.tsx → Update Tab                     │
│                                                      │
│  当前版本号 / 检查更新 / 下载进度 / 重启安装          │
└──────────────────────────────────────────────────────┘
```

---

## 前置条件

1. **阿里云账号** 并开通 OSS 服务
2. **RAM 子账号** 只授予 OSS PutObject 权限（生产环境推荐）
3. **Bucket** 配置为公共读（或使用 CDN + 签名 URL）
4. **Node.js** >= 18 和 **pnpm** 包管理器

---

## 一次性配置

### 1. 阿里云 OSS 配置

**创建 Bucket：**

1. 登录 [阿里云 OSS 控制台](https://oss.console.aliyun.com/)
2. 创建 Bucket，选择合适的地域（建议选主要用户所在地）
3. 读写权限设置为**公共读**（允许任何人下载更新文件）
4. 开启版本控制（可选，方便回滚）

**创建 RAM 子账号（推荐）：**

1. 进入 [RAM 控制台](https://ram.console.aliyun.com/)
2. 创建用户，选择"Open API 调用访问"
3. 为该用户添加以下自定义策略（仅允许向指定 Bucket 写入）：

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["oss:PutObject"],
      "Resource": ["acs:oss:*:*:your-bucket-name/releases/*"]
    }
  ]
}
```

4. 保存 AccessKey ID 和 Secret

**（可选）绑定自定义域名：**

在 Bucket 的"传输管理 → 自定义域名"中绑定你的域名，可显著提升国内下载速度，并隐藏 Bucket 名称。

### 2. 环境变量配置

复制 `.env.example` 为 `.env`，填入实际值：

```bash
cp .env.example .env
```

```dotenv
OSS_REGION=oss-cn-hangzhou
OSS_BUCKET=your-bucket-name
OSS_ACCESS_KEY_ID=your-access-key-id
OSS_ACCESS_KEY_SECRET=your-access-key-secret
OSS_PATH=releases/promptman
OSS_UPDATE_URL=https://your-bucket.oss-cn-hangzhou.aliyuncs.com/releases/promptman
```

> **重要**：`OSS_UPDATE_URL` 是嵌入到应用包中的更新服务器地址，客户端将从此 URL 检查并下载更新。确保它是公网可访问的 HTTPS 地址，且路径与 `OSS_PATH` 保持一致。

### 3. package.json 说明

`build.publish` 已配置为 `generic` provider，使用 `${env.OSS_UPDATE_URL}` 读取环境变量：

```json
{
  "build": {
    "publish": [
      {
        "provider": "generic",
        "url": "${env.OSS_UPDATE_URL}",
        "channel": "latest"
      }
    ]
  }
}
```

electron-builder 在打包时会将此 URL 写入应用内部的 `app-update.yml` 文件，安装后的应用据此知道去哪里检查更新。

**发布命令：**

| 命令 | 说明 |
|------|------|
| `pnpm build:mac` | 仅构建 macOS，不上传 |
| `pnpm build:win` | 仅构建 Windows，不上传 |
| `pnpm publish:oss:mac` | 构建 macOS 并上传到 OSS |
| `pnpm publish:oss:win` | 构建 Windows 并上传到 OSS |
| `pnpm publish:oss:all` | 构建全平台并上传到 OSS |

### 4. macOS 代码签名（可选）

未签名的应用在 macOS 上进行自动更新会因 Gatekeeper 校验失败。如需支持 macOS 自动更新（不仅是手动下载 DMG 安装），需要配置 Apple 开发者证书：

```bash
export CSC_LINK="/path/to/DeveloperIDApplication.p12"
export CSC_KEY_PASSWORD="your-certificate-password"
# Notarization（推荐，macOS 15+ 必须）
export APPLE_ID="your-apple-id@example.com"
export APPLE_ID_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="XXXXXXXXXX"
```

> 当前 `package.json` 中 `"identity": null` 表示跳过代码签名。macOS 用户需手动从 DMG 安装（拖入 Applications 后右键"打开"允许运行）。

---

## 发布流程

### 手动发布

**步骤一：更新版本号**

```bash
# 修补版本（Bug 修复）：0.1.0 → 0.1.1
pnpm version patch

# 次要版本（新功能）：0.1.0 → 0.2.0
pnpm version minor

# 主要版本（重大变更）：0.1.0 → 1.0.0
pnpm version major
```

**步骤二：加载环境变量**

```bash
# 方式一：使用 .env 文件 + dotenv-cli
npx dotenv -e .env -- pnpm publish:oss:mac

# 方式二：直接 export
export $(cat .env | grep -v '#' | xargs)
pnpm publish:oss:mac

# 方式三：逐行 export
export OSS_REGION=oss-cn-hangzhou
export OSS_BUCKET=your-bucket-name
# ...
pnpm publish:oss:all
```

**步骤三：验证**

发布后在 OSS 控制台确认以下文件已存在：

```
releases/promptman/
├── latest-mac.yml           ← 必须存在
├── latest.yml               ← 必须存在
├── PromptMan-x.x.x-DATE-mac-x64.dmg
├── PromptMan-x.x.x-DATE-mac-x64.zip
└── PromptMan-x.x.x-DATE-win-x64.exe
```

打开旧版本应用 → 设置 → Update → 手动触发检查，确认能检测到新版本。

### CI/CD 自动发布

在 GitHub Actions 中配置：

```yaml
# .github/workflows/release.yml
name: Release to OSS

on:
  push:
    tags:
      - 'v*'

jobs:
  release-mac:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - run: pnpm install
      - run: pnpm publish:oss:mac
        env:
          OSS_REGION: ${{ secrets.OSS_REGION }}
          OSS_BUCKET: ${{ secrets.OSS_BUCKET }}
          OSS_ACCESS_KEY_ID: ${{ secrets.OSS_ACCESS_KEY_ID }}
          OSS_ACCESS_KEY_SECRET: ${{ secrets.OSS_ACCESS_KEY_SECRET }}
          OSS_PATH: ${{ secrets.OSS_PATH }}
          OSS_UPDATE_URL: ${{ secrets.OSS_UPDATE_URL }}

  release-win:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - run: pnpm install
      - run: pnpm publish:oss:win
        env:
          OSS_REGION: ${{ secrets.OSS_REGION }}
          OSS_BUCKET: ${{ secrets.OSS_BUCKET }}
          OSS_ACCESS_KEY_ID: ${{ secrets.OSS_ACCESS_KEY_ID }}
          OSS_ACCESS_KEY_SECRET: ${{ secrets.OSS_ACCESS_KEY_SECRET }}
          OSS_PATH: ${{ secrets.OSS_PATH }}
          OSS_UPDATE_URL: ${{ secrets.OSS_UPDATE_URL }}
```

在 GitHub 仓库 Settings → Secrets and variables → Actions 中添加上述 6 个 Secret。

---

## 更新机制详解

### 更新生命周期

```
应用启动
   │
   ├── 延迟 3 秒
   ▼
checkForUpdates()
   │
   ├── GET ${OSS_UPDATE_URL}/latest-mac.yml（macOS）
   │   GET ${OSS_UPDATE_URL}/latest.yml（Windows）
   │
   ├─── 有更新 ──────────────────────────────┐
   │                                          ▼
   │                               通知用户（update-available）
   │                                          │
   │                               用户确认 → downloadUpdate()
   │                                          │
   │                               ├── 实时进度（download-progress）
   │                               ▼
   │                               下载完成（update-downloaded）
   │                                          │
   │                               用户点击重启 → quitAndInstall()
   │                                          │
   │                               ├── macOS：替换 .app 包
   │                               ├── Windows：运行 NSIS 静默更新
   │                               └── 自动重启应用
   │
   └─── 无更新 ──→ 显示"已是最新版本"
```

### IPC 通信协议

**渲染进程 → 主进程（请求）：**

| Channel | 说明 |
|---------|------|
| `updater:check` | 检查是否有新版本 |
| `updater:download` | 开始下载更新 |
| `updater:install` | 退出并安装更新 |
| `updater:getState` | 获取当前更新状态 |
| `updater:getVersion` | 获取当前应用版本号 |

**主进程 → 渲染进程（推送）：**

| `updater:status` payload | 说明 |
|--------------------------|------|
| `{ status: 'checking' }` | 正在检查 |
| `{ status: 'available', version, releaseDate, releaseNotes }` | 有新版本 |
| `{ status: 'not-available', version }` | 已是最新 |
| `{ status: 'downloading', percent, bytesPerSecond, transferred, total }` | 下载进度 |
| `{ status: 'downloaded', version, releaseNotes }` | 下载完成 |
| `{ status: 'error', error }` | 出错 |

### 更新状态流转

```
idle ──检查──► checking ──┬── available ──下载──► downloading ──► downloaded ──安装──► (重启)
                          ├── not-available
                          └── error ◄─────────────────────────────────────────────────┘
```

---

## OSS 目录结构

建议使用版本化目录结构（每次发布不覆盖旧版本文件）：

```
releases/
└── promptman/
    ├── latest-mac.yml          ← 始终指向最新版（每次发布覆盖）
    ├── latest.yml              ← 始终指向最新版（每次发布覆盖）
    ├── PromptMan-0.2.0-2026-03-21-mac-x64.dmg
    ├── PromptMan-0.2.0-2026-03-21-mac-x64.zip
    ├── PromptMan-0.2.0-2026-03-21-win-x64.exe
    ├── PromptMan-0.1.0-2026-01-15-mac-x64.dmg    ← 旧版本保留
    └── PromptMan-0.1.0-2026-01-15-win-x64.exe    ← 旧版本保留
```

`latest-mac.yml` / `latest.yml` 的 `path` 字段指向最新安装包文件名，electron-updater 会拼接 `OSS_UPDATE_URL` 作为完整下载地址。

---

## 开发环境测试

### 启用开发环境更新检查

1. 修改 `electron/main/updater.ts`，启用以下配置：

```typescript
autoUpdater.forceDevUpdateConfig = true
```

2. 修改 `dev-app-update.yml` 中的 `url` 为你的实际 OSS 地址

3. 确保 OSS 上已有高于当前版本的 `latest-mac.yml`

4. 运行 `pnpm dev` 后等待 3 秒自动检查，或在设置页面手动触发

### 本地完整测试流程

1. 将应用版本号降低（如从 0.2.0 改为 0.1.0）
2. `pnpm publish:oss:mac` 发布 0.2.0 到 OSS
3. 本地安装旧版本（0.1.0）
4. 打开应用，在设置页面检查更新，应能检测到 0.2.0 并完成更新

---

## 故障排除

**Q: 检查更新报错 "No such file"`latest-mac.yml`"**

A: 确认 OSS 上已上传 `latest-mac.yml`，且 `OSS_UPDATE_URL` 路径与 `OSS_PATH` 完全匹配。可在浏览器直接访问 `${OSS_UPDATE_URL}/latest-mac.yml` 验证。

**Q: 下载速度慢**

A: 建议为 OSS Bucket 开启 CDN 加速，并将 `OSS_UPDATE_URL` 改为 CDN 域名。

**Q: 上传失败报 `AccessDenied`**

A: 检查 RAM 子账号是否有目标 Bucket 的 `oss:PutObject` 权限，路径是否与策略中的 Resource 匹配。

**Q: macOS 更新时报 "The update is not signed" / Gatekeeper 拦截**

A: macOS 自动更新（`.zip` 差量更新）需要代码签名。未签名时只能使用 DMG 手动更新。

**Q: Windows 更新后提示找不到 `latest.yml`**

A: 确保 Windows 构建产物和 `latest.yml` 都已上传到同一 OSS 路径。检查 `out/` 目录中是否生成了 `latest.yml`。

**Q: 开发环境控制台显示 "Auto check failed (this is normal in dev)"**

A: 正常行为。开发环境下 `forceDevUpdateConfig` 默认未启用，生产打包后才生效。若需在开发环境测试，参见上方"开发环境测试"章节。

---

## 安全注意事项

1. **不要将 `.env` 提交到 Git** — 已加入 `.gitignore`
2. **使用 RAM 子账号** — 仅授予最小必要权限（PutObject 到指定路径）
3. **定期轮换 AccessKey** — 建议每 90 天更换一次
4. **electron-updater 自动校验文件完整性** — YAML 中的 SHA512 哈希确保下载文件未被篡改
5. **强烈建议启用代码签名** — macOS/Windows 代码签名防止更新包被替换
6. **OSS Bucket 只需公共读** — 无需公共写，上传通过服务端 AccessKey 完成

---

## 相关文件清单

| 文件 | 作用 |
|------|------|
| `electron/main/updater.ts` | 自动更新核心模块（IPC + 事件处理） |
| `electron/main/index.ts` | 主进程入口，初始化更新模块 |
| `electron/preload/index.ts` | 预加载脚本，桥接 IPC 通信 |
| `src/components/Settings.tsx` | 前端更新 UI 界面 |
| `scripts/publish-to-oss.js` | 构建产物上传到 OSS 的发布脚本 |
| `package.json` | 构建配置（generic provider + OSS URL）|
| `.env.example` | 环境变量配置模板 |
| `dev-app-update.yml` | 开发环境更新测试配置（不提交到 Git）|
| `.github/workflows/release.yml` | CI/CD 发布配置（需手动创建）|

---

*最后更新：2026-03-21*
