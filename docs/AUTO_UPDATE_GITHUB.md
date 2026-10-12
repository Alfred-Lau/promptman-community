# PromptMan 自动更新机制设计(GitHub Release + latest YAML)

> 状态:2026-09-02 基于 CI 实测验证(打 tag `v0.1.7-test-ci` 触发完整跑通 mac/win 构建)后修订。
> 适用:开源仓库 `Alfred-Lau/promptman-community`。

## 1. 机制总览

自动更新链路分两段,各自独立:

```
┌─────────────────────────────────────────────────────────────────┐
│ 发布端(维护者,打 tag 即触发)                                      │
│                                                                 │
│  git tag v0.1.7 && git push origin v0.1.7                       │
│        │                                                         │
│        ▼                                                         │
│  GitHub Actions release.yml                                      │
│  ① create-release: 建空 draft Release(tag=v0.1.7)               │
│  ② build-mac / build-win: 并行构建 + electron-builder 上传        │
│     产物 + latest-mac.yml / latest.yml(同一 draft)               │
│  ③ publish-release: draft → 正式(客户端才可见)                   │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTPS
┌───────────────────────────────▼─────────────────────────────────┐
│ 客户端(已安装的 PromptMan.app)                                    │
│                                                                 │
│  electron-updater(GitHub provider)                               │
│  ① 启动 3s / 手动 → checkForUpdates()                            │
│  ② 读 Releases 里最新正式 release 的 latest-mac.yml / latest.yml │
│  ③ 版本更高 → 用户确认 → 下载 zip/exe(差分 blockmap)             │
│  ④ quitAndInstall() → 重启完成更新                                │
└─────────────────────────────────────────────────────────────────┘
```

## 2. electron-updater 的 GitHub provider 原理(设计依据)

electron-updater 支持 `github` provider:更新元数据(latest YAML)与安装包**直接托管在 GitHub Releases**,不需要自建 OSS/CDN。

| 平台 | 元数据文件 | 更新包 | 说明 |
|------|-----------|--------|------|
| macOS arm64 | `latest-mac.yml` | `*.zip` | 自动更新**必须用 zip**,dmg 只用于手动安装 |
| Windows x64 | `latest.yml` | `*.exe` (NSIS) | 差分更新靠 `.exe.blockmap` |

- 打包时 electron-builder 把 publish 配置写入 app 内 `app-update.yml`(provider/owner/repo),客户端据此定位更新源。
- 检查更新时读取 **最新正式 release**(draft / prerelease 不可见,不会推给用户)——这是「先 draft 后转正」流程的根本原因:保证用户永远只看到完整发布。
- 客户端无 token 也能读**公开仓库**的 Releases;私有仓库需 token 且 electron-updater 支持差,所以开源版更新源必须是公开仓库的 Release。

## 3. 实测发现的问题(v0.1.7-test-ci 全流程验证)

CI 跑通了 mac/win 双平台构建,但暴露 4 个 tag/发布流程缺陷:

| # | 问题 | 现象 | 根因 |
|---|------|------|------|
| 1 | **tag 不一致** | 产物全部上传到 `0.1.7` draft,而转正发布的是空的 `v0.1.7-test-ci` | electron-builder 按 package.json `version`(0.1.7,无 v 前缀)找/建 release;workflow 用触发 tag(`v0.1.7-test-ci`)建 draft——两个 release 互不相认 |
| 2 | **双 draft 竞态** | 出现两个 `0.1.7` draft(mac 1 个 dmg / win 完整 7 件) | `build-mac` 与 `build-win` 并行,各自 electron-builder 上传时找不到既有 release → 各建一个 |
| 3 | **releaseType=draft 与 workflow 脱节** | 上传到 draft 后没人转正(转正的 softprops 那个是空的) | `vPrefixedTagName:false` + workflow 建 release 的 tag 与 electron-builder 的不一致 |
| 4 | **v 前缀缺失** | tag `0.1.7` 无 `v`,与「打 v 前缀 tag 触发」约定矛盾 | `vPrefixedTagName:false` |

## 4. 最佳实践方案

### 4.1 版本与 tag 单一来源

**规则:Git tag = `v` + package.json `version`。** 二者必须一致,这是整个机制的锚点。

```
package.json  version = 0.1.7
git tag               = v0.1.7   ← 唯一合法发布 tag
```

发布动作(全程 3 条命令):

```bash
# 1. 升版本(自动改 package.json + git commit + 打 tag 可分开做)
pnpm version patch        # 或 minor / major;完成后确认 tag 为 vX.Y.Z

# 2. 打 tag 并推送 → 触发 CI
git push origin v0.1.7

# 3. 监控
gh run watch --repo Alfred-Lau/promptman-community
```

### 4.2 release.yml 三段式流程(已在实现中,修复后)

```
create-release ──► build-mac ──┐
        │                      ├──► publish-release(转正式)
        └─────────────────────► build-win ──┘
```

- **create-release**:softprops/action-gh-release 建 draft,`tag_name: ${{ github.ref_name }}`(即触发的 v0.1.7)。⚠️ draft 阶段用户端不可见,天然防半成品推送。
- **build-mac / build-win**:先 build Next.js + prune + tsc,再 `electron-builder --publish always`。electron-builder 上传时**按 tag 找既有 draft 并复用**,不新建。
- **publish-release**:mac/win 都成功后把 draft 转正式,客户端此刻起可发现新版本。

### 4.3 关键配置(package.json build.publish)

```jsonc
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "Alfred-Lau",
      "repo": "promptman-community",   // 与 workflow 同仓库(开源版)
      "releaseType": "draft",          // 先草稿;workflow 末步转正式
      "vPrefixedTagName": true         // ← 必须 true:tag = v0.1.7
    }
  }
}
```

配套约束:

- mac target 必须同时含 `zip`(自动更新用)与 `dmg`(手动安装),`artifactName` 建议保留 `${env.BUILD_DATE}` 区分同日多版本。
- electron-builder 生成 `latest-mac.yml`/`latest.yml` 时内置各文件的 `sha512` 与 `blockmap`,客户端校验完整性,无需自建签名校验。

### 4.4 测试发布流程(仓库公开前)

仓库仍 PRIVATE 时,Releases 可建、CI 可跑,但**客户端自动更新读不到**(私有 repo 无 token)。验证步骤:

1. 打 tag `v0.2.0`(必须 ≥ 当前 0.1.7)→ CI 三段跑完,确认 draft→正式、产物齐全(latest-mac.yml + zip + dmg / latest.yml + exe)。
2. 用 `curl https://api.github.com/repos/Alfred-Lau/promptman-community/releases/latest` 确认返回的是新 release。
3. 设 Public 后,装 0.1.7 旧包 → 应用内「检查更新」应发现 0.2.0 → 下载 → 重启完成。

### 4.5 回滚与修复

| 场景 | 操作 |
|------|------|
| 发布后发现问题 | 打 `v0.2.1` 修复版即可;不要删已发布 release(用户端 updater 读到空会困惑) |
| 误打 tag | `gh release delete vX.Y.Z` + `git push origin :vX.Y.Z`(仅限未公开/刚打时) |
| 需紧急全量更新 | 直接编辑最新 release 换资产(不建议,sha512 需配套) |

## 5. 待办/已知缺口

- [ ] 设 Public(更新源可被客户端访问的前提)
- [ ] macOS 签名 + 公证(未签名 zip 更新会被 Gatekeeper 拦;当前 CI 无证书,`CSC_IDENTITY_AUTO_DISCOVERY=false` 跳过)
- [ ] Windows 签名(可选,未签名 exe 有 SmartScreen 警告)
- [ ] 客户端 updater.ts 已有 `PROMPTMAN_UPDATE_URL` env 覆盖(generic),可作灰度/内测通道,不必依赖 GitHub provider

---

*本文档与 scripts/release 相关脚本配套;旧 AUTO_UPDATE.md 的 OSS 方案已废弃,仅存于 git 历史。*
