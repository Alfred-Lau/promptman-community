/**
 * 将主进程错误与 console.error 写入安装目录侧 logs（无写权限时回退 userData）
 */
import { app, dialog, BrowserWindow } from 'electron'
import type { MessageBoxOptions, SaveDialogOptions } from 'electron'
import { join, dirname } from 'path'
import fs from 'fs'

function attachedWindow(win: BrowserWindow | null): BrowserWindow | undefined {
  if (win && !win.isDestroyed()) return win
  return undefined
}

async function showMessageBoxSafe(
  parent: BrowserWindow | null,
  options: MessageBoxOptions,
): Promise<void> {
  const w = attachedWindow(parent)
  if (w) await dialog.showMessageBox(w, options)
  else await dialog.showMessageBox(options)
}

async function showSaveDialogSafe(
  parent: BrowserWindow | null,
  options: SaveDialogOptions,
): Promise<Electron.SaveDialogReturnValue> {
  const w = attachedWindow(parent)
  if (w) return dialog.showSaveDialog(w, options)
  return dialog.showSaveDialog(options)
}

const LOG_SUBDIR = 'logs'
const MAIN_LOG = 'main.log'
/** IPC 与主进程对外 HTTP 接口错误，供「导出系统错误日志」时排查接口问题 */
export const IPC_API_LOG = 'ipc-api.log'

let resolvedLogDir: string | null = null

function defaultLogDirForPackaged(): string {
  if (process.platform === 'darwin') {
    // .../App.app/Contents/MacOS/App -> .../App.app/Contents/logs
    return join(dirname(dirname(process.execPath)), LOG_SUBDIR)
  }
  return join(dirname(process.execPath), LOG_SUBDIR)
}

function resolvePreferredLogDir(): string {
  if (app.isPackaged) {
    return defaultLogDirForPackaged()
  }
  return join(app.getPath('userData'), LOG_SUBDIR)
}

function tryMkdir(dir: string): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true })
    return true
  } catch {
    return false
  }
}

/**
 * 实际用于读写的日志目录（安装侧优先，失败则用 userData）
 */
export function getErrorLogDirectory(): string {
  if (resolvedLogDir) return resolvedLogDir

  const preferred = resolvePreferredLogDir()
  if (tryMkdir(preferred)) {
    resolvedLogDir = preferred
    return resolvedLogDir
  }

  const fallback = join(app.getPath('userData'), LOG_SUBDIR)
  tryMkdir(fallback)
  resolvedLogDir = fallback
  return resolvedLogDir
}

function appendLine(filename: string, line: string) {
  try {
    const dir = getErrorLogDirectory()
    const path = join(dir, filename)
    fs.appendFileSync(path, line, { encoding: 'utf8' })
  } catch {
    // 避免日志写入失败再抛错
  }
}

/**
 * 记录 IPC / 远端接口相关调试信息（不含密钥；导出日志时会合并 ipc-api.log）
 */
export function appendIPCApiLog(message: string): void {
  appendLine(IPC_API_LOG, `[${new Date().toISOString()}] ${message}\n`)
}

function formatArgs(args: unknown[]): string {
  return args
    .map((a) => {
      if (a instanceof Error) return a.stack || String(a)
      if (typeof a === 'object') {
        try {
          return JSON.stringify(a)
        } catch {
          return String(a)
        }
      }
      return String(a)
    })
    .join(' ')
}

let loggingInitialized = false

export function initAppErrorLogging(): void {
  if (loggingInitialized) return
  loggingInitialized = true

  getErrorLogDirectory()
  appendLine(
    MAIN_LOG,
    `\n======== PromptMan 启动 ${new Date().toISOString()} (${app.getVersion()}) ========\n`,
  )

  const origError = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    appendLine(MAIN_LOG, `[${new Date().toISOString()}] [ERROR] ${formatArgs(args)}\n`)
    origError(...args)
  }

  const origWarn = console.warn.bind(console)
  console.warn = (...args: unknown[]) => {
    appendLine(MAIN_LOG, `[${new Date().toISOString()}] [WARN] ${formatArgs(args)}\n`)
    origWarn(...args)
  }

  process.on('uncaughtException', (err) => {
    appendLine(
      MAIN_LOG,
      `[${new Date().toISOString()}] [uncaughtException] ${err?.stack || err}\n`,
    )
  })

  process.on('unhandledRejection', (reason) => {
    const text =
      reason instanceof Error ? reason.stack || String(reason) : formatArgs([reason])
    appendLine(MAIN_LOG, `[${new Date().toISOString()}] [unhandledRejection] ${text}\n`)
  })
}

/**
 * 合并 logs 目录下文本日志并导出到用户选择的路径
 */
export async function exportSystemErrorLogs(parentWindow: BrowserWindow | null): Promise<void> {
  const dir = getErrorLogDirectory()
  let names: string[] = []
  try {
    names = fs.readdirSync(dir).filter((n) => {
      const lower = n.toLowerCase()
      return lower.endsWith('.log') || lower.endsWith('.txt')
    })
  } catch {
    names = []
  }

  if (names.length === 0) {
    await showMessageBoxSafe(parentWindow, {
      type: 'info',
      title: '导出系统错误日志',
      message: '当前没有可导出的日志文件。',
      detail: `日志目录：\n${dir}`,
    })
    return
  }

  const defaultName = `promptman-system-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`
  const { canceled, filePath } = await showSaveDialogSafe(parentWindow, {
    title: '导出系统错误日志',
    defaultPath: defaultName,
    filters: [{ name: '文本日志', extensions: ['txt'] }],
  })

  if (canceled || !filePath) return

  const chunks: string[] = [
    `PromptMan 系统错误日志导出\n生成时间: ${new Date().toISOString()}\n来源目录: ${dir}\n说明: ipc-api.log 记录渲染进程 IPC 失败、AI（润色/生成）、OAuth（GitHub/Google）、PromptHub、Market（GitHub）等接口侧错误，便于排查。\n\n`,
  ]

  for (const name of names.sort()) {
    const full = join(dir, name)
    try {
      const stat = fs.statSync(full)
      if (!stat.isFile()) continue
      const content = fs.readFileSync(full, 'utf8')
      chunks.push(`\n${'='.repeat(60)}\n## ${name}\n${'='.repeat(60)}\n\n`)
      chunks.push(content)
      if (!content.endsWith('\n')) chunks.push('\n')
    } catch {
      chunks.push(`\n(读取失败: ${name})\n`)
    }
  }

  try {
    fs.writeFileSync(filePath, chunks.join(''), 'utf8')
    await showMessageBoxSafe(parentWindow, {
      type: 'info',
      title: '导出系统错误日志',
      message: '导出完成。',
      detail: filePath,
    })
  } catch (e) {
    await showMessageBoxSafe(parentWindow, {
      type: 'error',
      title: '导出系统错误日志',
      message: '写入文件失败。',
      detail: e instanceof Error ? e.message : String(e),
    })
  }
}
