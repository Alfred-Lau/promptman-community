/**
 * 系统托盘：显示主窗口、快速新建 Prompt/Skill/Agent/Team
 */
import { Tray, Menu, nativeImage, app } from 'electron'
import { join } from 'path'
import { getMainWindow, toggleSearchWindow } from './window'
import { runNewEntity } from './menuActions'

let tray: Tray | null = null

function trayIconPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'assets', 'tray-icon.png')
  }
  return join(__dirname, '../../public/icon.png')
}

function showMainWindow() {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }
}

export function setupTray(): void {
  if (tray) return

  const path = trayIconPath()
  const image = nativeImage.createFromPath(path)
  if (image.isEmpty()) {
    console.warn('[Tray] 图标加载失败，跳过托盘:', path)
    return
  }

  const trayImage =
    process.platform === 'darwin' ? image.resize({ width: 18, height: 18 }) : image

  tray = new Tray(trayImage)
  tray.setToolTip('PromptMan')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => showMainWindow(),
    },
    { type: 'separator' },
    {
      label: '新建 Prompt',
      click: () => runNewEntity('prompts', 'new-prompt'),
    },
    {
      label: '新建 Skill',
      click: () => runNewEntity('skills', 'new-skill'),
    },
    {
      label: '新建 Agent',
      click: () => runNewEntity('agents', 'new-agent'),
    },
    {
      label: '新建 Team',
      click: () => runNewEntity('teams', 'new-team'),
    },
    { type: 'separator' },
    {
      label: '全局搜索',
      click: () => {
        showMainWindow()
        toggleSearchWindow()
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => app.quit(),
    },
  ])

  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    showMainWindow()
  })

  tray.on('double-click', () => {
    showMainWindow()
  })
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
