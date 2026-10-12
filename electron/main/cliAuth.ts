/**
 * 本地回环 CLI token 鉴权
 *
 * PromptMan 桌面版在 ~/.promptman/cli-token 维护一个固定路径的随机 token,
 * 供本机 CLI / 脚本通过 `Authorization: Bearer <token>` 调用本地扩展 API
 * (extensionServer,仅监听 127.0.0.1)。token 只用于回环鉴权,不参与用户
 * 数据或云端鉴权;Chrome 扩展按来源(chrome-extension://)豁免,不走此 token。
 */
import { randomBytes, timingSafeEqual } from 'crypto'
import { app } from 'electron'
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'fs'
import { homedir } from 'os'
import { join } from 'path'

/** CLI token 固定路径(不随 dataRoot 偏好变化,CLI 侧按同一路径读取) */
export const TOKEN_PATH = join(homedir(), '.promptman', 'cli-token')

/** 读取 CLI token;文件不存在/不可读/为空时返回 null */
export function readCliToken(): string | null {
  try {
    const token = readFileSync(TOKEN_PATH, 'utf8').trim()
    return token.length > 0 ? token : null
  } catch {
    return null
  }
}

/**
 * 确保 CLI token 存在:不存在则生成 32 字节随机 token(base64url)并写入,
 * 文件权限 0o600。返回 token 字符串;写入失败时抛出(调用方应仅 warn,不阻塞启动)。
 */
export function ensureCliToken(): string {
  const existing = readCliToken()
  if (existing) return existing

  const dir = join(homedir(), '.promptman')
  mkdirSync(dir, { recursive: true })
  try {
    const token = randomBytes(32).toString('base64url')
    writeFileSync(TOKEN_PATH, token, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
    try {
      chmodSync(TOKEN_PATH, 0o600)
    } catch {
      // chmod 失败不致命(个别平台),继续
    }
    return token
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST') {
      // 并发窗口内已被其他实例写入,读回即可
      const token = readCliToken()
      if (token) return token
    }
    throw e
  }
}

/**
 * 校验 Authorization 头是否为合法 Bearer token(与文件中的 token 常量时间比较)。
 * 长度不一致直接返回 false,同时避免 timingSafeEqual 对不等长 buffer 抛错。
 */
export function isValidBearerToken(authHeader: string | undefined): boolean {
  if (!authHeader) return false
  const prefix = 'Bearer '
  if (!authHeader.startsWith(prefix)) return false
  const provided = Buffer.from(authHeader.slice(prefix.length), 'utf8')
  const expected = readCliToken()
  if (!expected) return false
  const expectedBuf = Buffer.from(expected, 'utf8')
  if (provided.length !== expectedBuf.length) return false
  return timingSafeEqual(provided, expectedBuf)
}

const CLI_LINK_DIR = join(homedir(), '.local', 'bin')
/** ~/.local/bin/promptman 软链目标路径(用户可直接敲 promptman) */
export const CLI_LINK_PATH = join(CLI_LINK_DIR, 'promptman')

/**
 * 尽量确保 ~/.local/bin/promptman 软链指向随 app 分发的 CLI:
 * - 打包后(asar): process.resourcesPath/cli/promptman.js(extraResources 拷贝)
 * - 开发态:        app.getAppPath()/cli/promptman.js(仓库根)
 * 所有失败路径只 console.warn / 打印提示,不抛错、不阻塞启动。
 */
export function ensureCliSymlink(): void {
  if (process.platform === 'win32') {
    // Windows 上创建软链需管理员/开发者模式,且通常用 .exe/.cmd;跳过并提示
    console.log('[Cli] Windows 跳过 ~/.local/bin/promptman 软链(可用打包资源内的 cli/promptman.js 或自行配置别名)')
    return
  }

  const target = app.getAppPath().endsWith('.asar')
    ? join(process.resourcesPath, 'cli', 'promptman.js')
    : join(app.getAppPath(), 'cli', 'promptman.js')

  if (!existsSync(target)) {
    console.warn(`[Cli] CLI 源文件不存在,跳过软链: ${target}`)
    return
  }

  // 通过软链直接执行需要可执行位(shebang 由内核解析),尽力保证
  try {
    chmodSync(target, 0o755)
  } catch {
    // 只读目录(如个别打包场景)忽略
  }

  mkdirSync(CLI_LINK_DIR, { recursive: true })

  try {
    const st = lstatSync(CLI_LINK_PATH)
    if (st.isSymbolicLink()) {
      if (readlinkSync(CLI_LINK_PATH) === target) return // 已指向正确目标
      rmSync(CLI_LINK_PATH) // 指向过期目标,重建
    } else {
      console.warn(`[Cli] ${CLI_LINK_PATH} 已存在且不是符号链接,为不覆盖用户文件已跳过(如需可手动删除后重启)`)
      return
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`[Cli] 检查 ${CLI_LINK_PATH} 失败:`, e)
      return
    }
    // ENOENT:链接不存在,正常创建
  }

  try {
    symlinkSync(target, CLI_LINK_PATH)
    console.log(`[Cli] 已创建 promptman 软链: ${CLI_LINK_PATH} -> ${target}`)
  } catch (e) {
    console.warn('[Cli] 创建软链失败(不影响启动):', e)
  }
}
