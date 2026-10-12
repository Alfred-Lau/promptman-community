/**
 * 主窗口菜单/托盘共用的导航与动作（避免 menu 与 tray 重复实现）
 */
import { getMainWindow } from './window'

export function navigateToTab(tab: string) {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send('menu:navigate', { tab })
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }
}

export function sendMenuAction(action: string, data?: Record<string, unknown>) {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send('menu:action', { action, ...data })
  }
}

/** 与菜单「文件」中新建项相同的延迟，等待 Tab 切换完成 */
export function runNewEntity(tab: string, action: string) {
  navigateToTab(tab)
  setTimeout(() => sendMenuAction(action), 200)
}
