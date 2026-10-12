#!/usr/bin/env node
/**
 * 两处 patch：
 *
 * Patch 1 — macCodeSign.js (macOS 15 Sequoia 代码签名 bug)
 *   问题：importCerts() 在调用 set-key-partition-list 时误传了 .p12 密码，
 *         而非临时钥匙串的随机密码，导致 errSecInternalComponent。
 *   修复：将 keychainPassword 传入 importCerts，并用于 set-key-partition-list。
 *   参考：https://github.com/electron-userland/electron-builder/issues/7637
 *
 * Patch 2 — @electron/osx-sign sign.js (时间戳服务不可达)
 *   问题：当系统代理（如 Clash）开启 TUN/Fake-IP 模式时，DNS 被劫持，
 *         codesign 连接 timestamp.apple.com 失败（"timestamp service is not available"）。
 *   修复：捕获时间戳错误，依次重试：
 *         1) 用已知真实 IP 直连（绕过 DNS 劫持）
 *         2) 不带时间戳签名（最后兜底，仅本地测试可接受）
 *   永久修复建议：在 Clash 规则中为 timestamp.apple.com 添加 DIRECT 规则。
 */
const fs = require('fs')
const path = require('path')

// ─── Patch 1: macCodeSign.js ───────────────────────────────────────────────

const macCodeSignPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'app-builder-lib',
  'out',
  'codeSign',
  'macCodeSign.js'
)

if (!fs.existsSync(macCodeSignPath)) {
  console.log('[patch-mac-codesign] macCodeSign.js not found, skip patch 1.')
} else {
  let src = fs.readFileSync(macCodeSignPath, 'utf8')

  if (src.includes('importCerts(keychainFile, keychainPassword, ')) {
    console.log('[patch-mac-codesign] patch 1 already applied, skip.')
  } else {
    const originalSrc = src

    // 1) 调用点：`return await importCerts(keychainFile, <rest>)` → 追加 keychainPassword
    //    兼容 v24 写法：importCerts(keychainFile, certPaths, [cscKeyPassword, cscIKeyPassword].filter(...))
    //    兼容 v26 写法：importCerts(keychainFile, certPaths, cscPasswords)
    src = src.replace(
      /importCerts\(keychainFile,\s*/g,
      'importCerts(keychainFile, keychainPassword, '
    )

    // 2) 函数定义：补上 keychainPassword 形参
    src = src.replace(
      /async function importCerts\(keychainFile,\s*paths,\s*keyPasswords\)\s*\{/,
      'async function importCerts(keychainFile, keychainPassword, paths, keyPasswords) {'
    )

    // 3) set-key-partition-list：用随机生成的 keychainPassword 代替 p12 密码
    src = src.replace(
      /\["set-key-partition-list",\s*"-S",\s*"apple-tool:,apple:",\s*"-s",\s*"-k",\s*password,\s*keychainFile\]/,
      '["set-key-partition-list", "-S", "apple-tool:,apple:,codesign:", "-s", "-k", keychainPassword, keychainFile]'
    )

    // 校验三处都打上了：调用点、函数定义、set-key-partition-list
    const patchedCall = /importCerts\(keychainFile,\s*keychainPassword,\s*/.test(src)
    const patchedDef = src.includes(
      'async function importCerts(keychainFile, keychainPassword, paths, keyPasswords)'
    )
    const patchedPart = src.includes(
      '["set-key-partition-list", "-S", "apple-tool:,apple:,codesign:", "-s", "-k", keychainPassword, keychainFile]'
    )

    if (!patchedCall || !patchedDef || !patchedPart) {
      console.error(
        `[patch-mac-codesign] patch 1 failed — source pattern not matched. ` +
          `call=${patchedCall} def=${patchedDef} partition=${patchedPart}`
      )
      // 回滚，避免写入半成品
      fs.writeFileSync(macCodeSignPath, originalSrc)
      process.exit(1)
    }

    fs.writeFileSync(macCodeSignPath, src)
    console.log(
      '[patch-mac-codesign] patch 1 applied: macCodeSign.js (macOS 15 Sequoia fix).'
    )
  }
}

// ─── Patch 2: @electron/osx-sign sign.js (时间戳重试) ─────────────────────
// 并对 app-builder-lib 自身的 MAS/asarUnpack 辅助签名调用也加同款重试。

const PATCH2_VERSION = 'v2'
const PATCH2_MARKER = `/* patch2:timestamp-retry ${PATCH2_VERSION} */`
const PATCH2_LEGACY_MARKER = '/* patch2:timestamp-retry */'

// 原始行（精确匹配，@electron/osx-sign 1.0.x / 1.3.x 均为此形式）
const OLD_EXEC = `await (0, util_1.execFileAsync)('codesign', perFileArgs.concat('--entitlements', perFileOptions.entitlements, filePath));`

// 替换为带重试逻辑的版本
// 可通过环境变量 CODESIGN_TIMESTAMP_FALLBACK 提供多个备用 URL（分号分隔）。
const NEW_EXEC = `${PATCH2_MARKER}
        await (async function codesignWithTimestampRetry(args) {
          const isTimestampErr = (e) => e && e.message && e.message.includes('timestamp service is not available');
          const allowUnsigned = process.env.CODESIGN_ALLOW_NO_TIMESTAMP === '1';
          const extra = (process.env.CODESIGN_TIMESTAMP_FALLBACK || '').split(/[;,\\s]+/).filter(Boolean);
          const fallbackUrls = extra.length
            ? extra
            : ['http://17.157.80.35/ts01']; // Apple timestamp.apple.com historic IP
          const maxRetries = 5;
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              await (0, util_1.execFileAsync)('codesign', args);
              return;
            } catch (err) {
              if (!isTimestampErr(err)) throw err;
              if (attempt < maxRetries) {
                const waitMs = 1000 * attempt;
                console.warn('[patch2] timestamp service unavailable (attempt ' + attempt + '/' + maxRetries + '), retrying in ' + waitMs + 'ms...');
                await new Promise(r => setTimeout(r, waitMs));
                continue;
              }
              // 重试用尽 → 依次尝试备用 timestamp URL
              const tsIdx = args.findIndex(a => a === '--timestamp' || a.startsWith('--timestamp='));
              if (tsIdx === -1) throw err;
              for (const url of fallbackUrls) {
                try {
                  const argsAlt = [...args];
                  argsAlt[tsIdx] = '--timestamp=' + url;
                  console.warn('[patch2] retries exhausted, trying fallback timestamp: ' + url);
                  await (0, util_1.execFileAsync)('codesign', argsAlt);
                  return;
                } catch (e2) {
                  if (!isTimestampErr(e2)) throw e2;
                }
              }
              if (allowUnsigned) {
                console.warn('[patch2] all timestamp endpoints failed, signing WITHOUT timestamp (CODESIGN_ALLOW_NO_TIMESTAMP=1, NOT suitable for distribution).');
                const argsFinal = args.filter((_, i) => i !== tsIdx);
                await (0, util_1.execFileAsync)('codesign', argsFinal);
                return;
              }
              throw new Error('All timestamp endpoints failed. Fix network (e.g. Clash TUN / apple.com DIRECT rule) or set CODESIGN_ALLOW_NO_TIMESTAMP=1 to sign without timestamp (NOT for distribution). Original error: ' + err.message);
            }
          }
        })(perFileArgs.concat('--entitlements', perFileOptions.entitlements, filePath));`

// 把一段已打过的 patch（任意版本）识别并整体剥离，还原成"未 patch 的原始行"
// 逻辑：从 "/* patch2:timestamp-retry ... */" 开始 → 向前吃到它所在的 IIFE 开头
// "await (async function codesignWithTimestampRetry..."，向后吃到
// "})(perFileArgs.concat(..., filePath));" 为止，整块替换回 OLD_EXEC。
function revertLegacyPatch(src) {
  const re = /await\s*\(async function codesignWithTimestampRetry[\s\S]*?\}\)\(perFileArgs\.concat\('--entitlements', perFileOptions\.entitlements, filePath\)\);/
  return src.replace(re, OLD_EXEC)
}

function patchOsxSign(signJsPath) {
  if (!fs.existsSync(signJsPath)) {
    return { status: 'missing' }
  }
  let signSrc = fs.readFileSync(signJsPath, 'utf8')

  if (signSrc.includes(PATCH2_MARKER)) {
    return { status: 'already' }
  }

  // 检测到旧版 patch → 整块剥离回原始行，后面再统一重新打新版
  const hasLegacy =
    signSrc.includes(PATCH2_LEGACY_MARKER) &&
    !signSrc.includes(PATCH2_MARKER)
  if (hasLegacy) {
    const reverted = revertLegacyPatch(signSrc)
    if (reverted === signSrc) {
      return { status: 'legacy-revert-failed' }
    }
    signSrc = reverted
  }

  if (!signSrc.includes(OLD_EXEC)) {
    return { status: 'not-matched' }
  }
  signSrc = signSrc.replace(OLD_EXEC, NEW_EXEC)
  fs.writeFileSync(signJsPath, signSrc)
  return { status: hasLegacy ? 'upgraded' : 'applied' }
}

// 收集所有待 patch 的 sign.js 路径
const signJsPaths = new Set()

// pnpm：节点模块分散在 .pnpm/@electron+osx-sign@<ver>/... 里，可能同时存在多个版本
const pnpmPath = path.join(__dirname, '..', 'node_modules', '.pnpm')
if (fs.existsSync(pnpmPath)) {
  for (const entry of fs.readdirSync(pnpmPath)) {
    if (!entry.startsWith('@electron+osx-sign@')) continue
    const p = path.join(
      pnpmPath,
      entry,
      'node_modules',
      '@electron',
      'osx-sign',
      'dist',
      'cjs',
      'sign.js'
    )
    if (fs.existsSync(p)) signJsPaths.add(p)
  }
}

// npm / yarn：顶层单例
const flatPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@electron',
  'osx-sign',
  'dist',
  'cjs',
  'sign.js'
)
if (fs.existsSync(flatPath)) signJsPaths.add(flatPath)

if (signJsPaths.size === 0) {
  console.log('[patch-mac-codesign] osx-sign/sign.js not found, skip patch 2.')
  process.exit(0)
}

let hasFailure = false
for (const signJsPath of signJsPaths) {
  const rel = path.relative(path.join(__dirname, '..'), signJsPath)
  const { status } = patchOsxSign(signJsPath)
  switch (status) {
    case 'applied':
      console.log(`[patch-mac-codesign] patch 2 applied: ${rel}`)
      break
    case 'upgraded':
      console.log(`[patch-mac-codesign] patch 2 upgraded to ${PATCH2_VERSION}: ${rel}`)
      break
    case 'already':
      console.log(
        `[patch-mac-codesign] patch 2 already at ${PATCH2_VERSION}: ${rel}`
      )
      break
    case 'not-matched':
      console.error(
        `[patch-mac-codesign] patch 2 failed — target line not found in ${rel}`
      )
      hasFailure = true
      break
    case 'legacy-revert-failed':
      console.error(
        `[patch-mac-codesign] patch 2 legacy revert failed — please manually restore ${rel} or run 'pnpm install --force'`
      )
      hasFailure = true
      break
    case 'missing':
      break
  }
}

if (hasFailure) {
  process.exit(1)
}
