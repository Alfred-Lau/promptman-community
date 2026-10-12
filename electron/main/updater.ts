/**
 * 自动更新模块 - 基于 electron-updater
 * 
 * 支持功能：
 * - 应用启动时由渲染进程触发自动检查更新（IPC updater:check）
 * - 手动检查更新
 * - 下载更新并提示用户安装
 * - 更新进度反馈
 */
import { autoUpdater, UpdateInfo, ProgressInfo, UpdateCheckResult } from 'electron-updater'
import { BrowserWindow, ipcMain, app } from 'electron'
import { getMainWindow } from './window'

/** 开发模式下可通过环境变量覆盖 app-update.yml 中的更新地址（仅 !app.isPackaged 生效） */
const UPDATE_URL_ENV = 'PROMPTMAN_UPDATE_URL'

function normalizeUpdateBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

function applyOptionalFeedUrlOverride(): void {
  const raw = process.env[UPDATE_URL_ENV]?.trim()
  if (!raw) return
  // 生产环境忽略覆盖，避免恶意或误配 env 把更新源劫持到任意地址
  if (app.isPackaged) {
    console.log(`[Updater] 生产环境忽略 ${UPDATE_URL_ENV}，仅开发模式允许覆盖更新源`)
    return
  }
  const url = normalizeUpdateBaseUrl(raw)
  autoUpdater.setFeedURL({
    provider: 'generic',
    url,
    channel: 'latest',
  })
  console.log(`[Updater] 使用 ${UPDATE_URL_ENV} 覆盖更新源:`, url)
}

function isRetryableUpdateNetworkError(err: unknown): boolean {
  const e = err as NodeJS.ErrnoException & { code?: string }
  const msg = err instanceof Error ? err.message : String(err)
  const code = e.code ?? ''
  return (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    code === 'ENETUNREACH' ||
    code === 'EAI_AGAIN' ||
    msg.includes('CONNECTION_CLOSED') ||
    msg.includes('ERR_CONNECTION_CLOSED') ||
    msg.includes('ECONNRESET') ||
    msg.includes('socket hang up') ||
    msg.includes('ETIMEDOUT')
  )
}

/**
 * 将 electron-updater 原始错误转换为对用户友好的提示文本。
 * 私有仓库 / 未配置更新服务器时，GitHub 返回 404，原始消息含敏感细节，
 * 不应直接展示给终端用户。
 */
function toUserFriendlyUpdateError(err: Error): string {
  const msg = err.message ?? ''
  // GitHub 私有仓库或未发布 Release 时返回 404，
  // electron-updater 会在消息里加上 "authentication token" 提示。
  if (
    msg.includes('404') ||
    msg.includes('authentication token') ||
    msg.includes('releases.atom')
  ) {
    return '暂时无法获取更新信息，请检查网络后重试，或前往官网手动下载最新版本。'
  }
  return msg
}

/**
 * 对瞬时网络错误重试检查更新（OSS/CDN 偶发断连）
 */
export async function checkForUpdatesWithRetry(): Promise<UpdateCheckResult | null> {
  const max = 3
  let lastErr: unknown
  for (let attempt = 0; attempt < max; attempt++) {
    try {
      return await autoUpdater.checkForUpdates()
    } catch (e) {
      lastErr = e
      if (!isRetryableUpdateNetworkError(e) || attempt === max - 1) {
        throw e
      }
      const delayMs = 800 * (attempt + 1)
      console.warn(
        `[Updater] 检查更新失败，${delayMs}ms 后重试 (${attempt + 1}/${max}):`,
        e instanceof Error ? e.message : e,
      )
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  throw lastErr
}

// 更新状态类型
export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

interface UpdateState {
  status: UpdateStatus
  info: UpdateInfo | null
  progress: ProgressInfo | null
  error: string | null
}

let updateState: UpdateState = {
  status: 'idle',
  info: null,
  progress: null,
  error: null,
}

/**
 * 向渲染进程发送更新状态
 */
function sendUpdateStatus(status: UpdateStatus, data?: Record<string, unknown>) {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send('updater:status', { status, ...data })
  }
}

/**
 * 初始化自动更新
 */
export function setupAutoUpdater() {
  applyOptionalFeedUrlOverride()

  // 配置 autoUpdater
  autoUpdater.autoDownload = false         // 不自动下载，让用户确认
  autoUpdater.autoInstallOnAppQuit = true  // 退出时自动安装已下载的更新
  autoUpdater.autoRunAppAfterInstall = true // 安装后自动重启应用

  // 开发环境下也允许检测更新（可选）
  // autoUpdater.forceDevUpdateConfig = true

  // ==================== 更新事件监听 ====================

  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Checking for updates...')
    updateState = { ...updateState, status: 'checking', error: null }
    sendUpdateStatus('checking')
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    console.log('[Updater] Update available:', info.version)
    updateState = { ...updateState, status: 'available', info }
    sendUpdateStatus('available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    })
  })

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    console.log('[Updater] No update available. Current version is up to date.')
    updateState = { ...updateState, status: 'not-available', info }
    sendUpdateStatus('not-available', {
      version: info.version,
    })
  })

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    console.log(`[Updater] Download progress: ${progress.percent.toFixed(1)}%`)
    updateState = { ...updateState, status: 'downloading', progress }
    sendUpdateStatus('downloading', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    console.log('[Updater] Update downloaded:', info.version)
    updateState = { ...updateState, status: 'downloaded', info }
    sendUpdateStatus('downloaded', {
      version: info.version,
      releaseNotes: info.releaseNotes,
    })
  })

  autoUpdater.on('error', (error: Error) => {
    console.error('[Updater] Error:', error.message)
    const displayError = toUserFriendlyUpdateError(error)
    updateState = { ...updateState, status: 'error', error: displayError }
    sendUpdateStatus('error', {
      error: displayError,
    })
  })

  // ==================== IPC 处理器 ====================

  // 检查更新
  ipcMain.handle('updater:check', async () => {
    // 下载中/已下载时短路，避免重复 check 打断状态机
    if (updateState.status === 'downloading' || updateState.status === 'downloaded') {
      return { success: true, data: updateState.info || null }
    }
    try {
      const result = await checkForUpdatesWithRetry()
      return { success: true, data: result?.updateInfo }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? toUserFriendlyUpdateError(error) : '检查更新失败',
      }
    }
  })

  // 下载更新
  ipcMain.handle('updater:download', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? toUserFriendlyUpdateError(error) : '下载更新失败',
      }
    }
  })

  // 安装更新（退出并安装）
  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall(false, true)
    return { success: true }
  })

  // 获取当前更新状态
  ipcMain.handle('updater:getState', () => {
    return {
      success: true,
      data: {
        status: updateState.status,
        version: updateState.info?.version || null,
        progress: updateState.progress
          ? {
              percent: updateState.progress.percent,
              transferred: updateState.progress.transferred,
              total: updateState.progress.total,
              bytesPerSecond: updateState.progress.bytesPerSecond,
            }
          : null,
        error: updateState.error,
      },
    }
  })

  // 获取当前应用版本
  ipcMain.handle('updater:getVersion', () => {
    return { success: true, data: app.getVersion() }
  })

  // 启动时检查更新由渲染进程在界面就绪后调用 updater:check（见 AppShell）
}
