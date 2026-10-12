/**
 * 应用程序菜单配置
 *
 * 根据 PromptMan 的实际功能定制菜单：
 * - PromptMan: 关于、检查更新、设置、退出
 * - 文件: 新建 Prompt/Skill、全局搜索
 * - 编辑: 标准文本编辑操作
 * - 视图: 导航到各个功能页面
 * - 窗口: 标准窗口操作
 * - 帮助: 帮助信息
 *
 * 支持国际化：从 store 读取 language 设置（'zh' | 'en'），
 * 调用 rebuildMenu() 可在语言变更后重新构建。
 */
import { Menu, MenuItemConstructorOptions, app, shell } from 'electron'
import { getMainWindow } from './window'
import { toggleSearchWindow } from './window'
import { checkForUpdatesWithRetry } from './updater'
import { navigateToTab, sendMenuAction } from './menuActions'
import { exportSystemErrorLogs } from './appErrorLog'
import { store } from './store'
import { menuMessages } from './menuI18n'

const isMac = process.platform === 'darwin'

/**
 * 构建应用菜单模板
 */
async function buildMenuTemplate(): Promise<MenuItemConstructorOptions[]> {
  const settings = await store.getSettings()
  const lang = (settings.language === 'en' ? 'en' : 'zh') as 'zh' | 'en'
  const m = menuMessages[lang]
  const template: MenuItemConstructorOptions[] = []

  // ==================== macOS 应用菜单 ====================
  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        {
          label: m.app.about,
          role: 'about',
        },
        { type: 'separator' },
        {
          label: m.app.checkForUpdates,
          click: () => {
            sendMenuAction('check-update')
            checkForUpdatesWithRetry().catch((err) => {
              console.log('[Menu] Check update failed:', err.message)
            })
          },
        },
        { type: 'separator' },
        {
          label: m.app.settings,
          accelerator: 'Cmd+,',
          click: () => navigateToTab('settings'),
        },
        { type: 'separator' },
        { label: m.app.hide, role: 'hide' },
        { label: m.app.hideOthers, role: 'hideOthers' },
        { label: m.app.unhide, role: 'unhide' },
        { type: 'separator' },
        { label: m.app.quit, role: 'quit' },
      ],
    })
  }

  // ==================== 文件菜单 ====================
  template.push({
    label: m.file.label,
    submenu: [
      {
        label: m.file.newPrompt,
        accelerator: isMac ? 'Cmd+N' : 'Ctrl+N',
        click: () => {
          navigateToTab('prompts')
          setTimeout(() => sendMenuAction('new-prompt'), 200)
        },
      },
      {
        label: m.file.newSkill,
        accelerator: isMac ? 'Cmd+Shift+N' : 'Ctrl+Shift+N',
        click: () => {
          navigateToTab('skills')
          setTimeout(() => sendMenuAction('new-skill'), 200)
        },
      },
      { type: 'separator' },
      {
        label: m.file.globalSearch,
        accelerator: isMac ? 'Cmd+Shift+P' : 'Ctrl+Shift+P',
        click: () => toggleSearchWindow(),
      },
      { type: 'separator' },
      ...(isMac
        ? []
        : [
            {
              label: m.file.settings,
              accelerator: 'Ctrl+,',
              click: () => navigateToTab('settings'),
            } as MenuItemConstructorOptions,
            { type: 'separator' as const },
            { label: m.file.quit, role: 'quit' as const },
          ]),
    ],
  })

  // ==================== 编辑菜单 ====================
  template.push({
    label: m.edit.label,
    submenu: [
      { label: m.edit.undo, role: 'undo' },
      { label: m.edit.redo, role: 'redo' },
      { type: 'separator' },
      { label: m.edit.cut, role: 'cut' },
      { label: m.edit.copy, role: 'copy' },
      { label: m.edit.paste, role: 'paste' },
      ...(isMac
        ? [
            { label: m.edit.pasteAndMatchStyle, role: 'pasteAndMatchStyle' as const },
            { label: m.edit.delete, role: 'delete' as const },
            { label: m.edit.selectAll, role: 'selectAll' as const },
          ]
        : [
            { label: m.edit.delete, role: 'delete' as const },
            { type: 'separator' as const },
            { label: m.edit.selectAll, role: 'selectAll' as const },
          ]),
    ],
  })

  // ==================== 视图菜单 ====================
  template.push({
    label: m.view.label,
    submenu: [
      {
        label: m.view.prompts,
        accelerator: isMac ? 'Cmd+1' : 'Ctrl+1',
        click: () => navigateToTab('prompts'),
      },
      {
        label: m.view.skills,
        accelerator: isMac ? 'Cmd+2' : 'Ctrl+2',
        click: () => navigateToTab('skills'),
      },
      {
        label: m.view.discover,
        accelerator: isMac ? 'Cmd+3' : 'Ctrl+3',
        click: () => navigateToTab('discover'),
      },
      { type: 'separator' },
      { label: m.view.reload, role: 'reload' },
      { label: m.view.forceReload, role: 'forceReload' },
      { type: 'separator' },
      { label: m.view.resetZoom, role: 'resetZoom' },
      { label: m.view.zoomIn, role: 'zoomIn' },
      { label: m.view.zoomOut, role: 'zoomOut' },
      { type: 'separator' },
      { label: m.view.toggleFullscreen, role: 'togglefullscreen' },
      { type: 'separator' },
      {
        label: m.view.devTools,
        accelerator: isMac ? 'Cmd+Option+I' : 'Ctrl+Shift+I',
        click: () => {
          const win = getMainWindow()
          if (win && !win.isDestroyed()) {
            win.webContents.toggleDevTools()
          }
        },
      },
    ],
  })

  // ==================== 窗口菜单 ====================
  template.push({
    label: m.window.label,
    submenu: [
      { label: m.window.minimize, role: 'minimize' },
      { label: m.window.zoom, role: 'zoom' },
      ...(isMac
        ? [
            { type: 'separator' as const },
            { label: m.window.front, role: 'front' as const },
          ]
        : [{ label: m.window.close, role: 'close' as const }]),
    ],
  })

  // ==================== 帮助菜单 ====================
  template.push({
    label: m.help.label,
    submenu: [
      {
        label: m.help.visitHomepage,
        click: () => {
          shell.openExternal('https://github.com/nicepkg/promptman')
        },
      },
      {
        label: m.help.reportIssue,
        click: () => {
          shell.openExternal('https://github.com/nicepkg/promptman/issues')
        },
      },
      {
        label: m.help.exportLogs,
        click: async () => {
          const win = getMainWindow()
          await exportSystemErrorLogs(win && !win.isDestroyed() ? win : null)
        },
      },
      { type: 'separator' },
      ...(isMac
        ? []
        : [
            {
              label: m.help.checkForUpdates,
              click: () => {
                sendMenuAction('check-update')
                checkForUpdatesWithRetry().catch((err) => {
                  console.log('[Menu] Check update failed:', err.message)
                })
              },
            } as MenuItemConstructorOptions,
            { type: 'separator' as const },
            {
              label: m.help.about,
              role: 'about' as const,
            },
          ]),
    ],
  })

  return template
}

/**
 * 创建并设置应用菜单
 */
export async function setupMenu() {
  const template = await buildMenuTemplate()
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

/**
 * 重新构建菜单（语言变更后调用）
 */
export async function rebuildMenu() {
  await setupMenu()
}
