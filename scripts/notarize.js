#!/usr/bin/env node
/**
 * Apple 公证脚本（afterSign hook）
 *
 * 前置条件：
 *  1. 拥有 Apple Developer 账号（$99/年）并持有 "Developer ID Application" 证书
 *  2. 在 Apple ID 账号安全中生成一个「应用专用密码」
 *     https://appleid.apple.com/account/manage → App-Specific Passwords
 *  3. 在构建环境中设置以下环境变量：
 *       APPLE_ID            — 你的 Apple ID 邮箱
 *       APPLE_TEAM_ID       — 你的 Apple Team ID（10 位字母+数字）
 *       APPLE_APP_SPECIFIC_PASSWORD — 应用专用密码（格式：xxxx-xxxx-xxxx-xxxx）
 *
 * 如果任意变量未设置，脚本会跳过公证（方便本地无证书时构建）。
 */
const { notarize } = require('@electron/notarize')
const { spawnSync } = require('child_process')
const path = require('path')

function isAdhocOrUnsigned(appPath) {
  // 用系统自带的 codesign 检查签名类型，ad-hoc / 未签名都要跳过公证
  const res = spawnSync('codesign', ['-dv', '--verbose=2', appPath], {
    encoding: 'utf8',
  })
  const output = `${res.stdout || ''}\n${res.stderr || ''}`
  if (res.status !== 0) return true
  if (/Signature=adhoc/i.test(output)) return true
  if (/code object is not signed at all/i.test(output)) return true
  if (!/TeamIdentifier=[A-Z0-9]{10}/i.test(output)) return true
  return false
}

module.exports = async function afterSign(context) {
  const { electronPlatformName, appOutDir } = context

  if (electronPlatformName !== 'darwin') {
    return
  }

  const { APPLE_ID, APPLE_TEAM_ID, APPLE_APP_SPECIFIC_PASSWORD } = process.env

  if (!APPLE_ID || !APPLE_TEAM_ID || !APPLE_APP_SPECIFIC_PASSWORD) {
    console.log(
      '[notarize] 跳过公证：未设置 APPLE_ID / APPLE_TEAM_ID / APPLE_APP_SPECIFIC_PASSWORD'
    )
    return
  }

  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(appOutDir, `${appName}.app`)

  // 当 app 为 ad-hoc / 未签名状态时（例如本地无 Developer ID 证书、CI 里强制
  // --config.mac.identity=null），notarytool 会在校验签名阶段报：
  //   "code has no resources but signature indicates they must be present"
  // 这里主动跳过，避免整个构建失败。
  if (isAdhocOrUnsigned(appPath)) {
    console.log(
      `[notarize] 跳过公证：${appPath} 为 ad-hoc / 未签名状态，无法公证`
    )
    return
  }

  console.log(`[notarize] 开始公证 ${appPath} …`)

  await notarize({
    tool: 'notarytool',
    appPath,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID,
  })

  console.log('[notarize] 公证完成！')
}
