import './bootstrapUpdaterNet'
import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron'
import { createWindow, cleanup, toggleSearchWindow, getMainWindow } from './window'
import { setupIPC } from './ipc'
import { seedDefaultDataInMain } from './seedDefaultData'
import { setupAutoUpdater } from './updater'
import { setupMenu } from './menu'
import { setupTray, destroyTray } from './tray'
import { initAppErrorLogging } from './appErrorLog'

initAppErrorLogging()
import { startExtensionServer, stopExtensionServer, EXTENSION_SERVER_DEFAULT_PORT } from './extensionServer'
import { ensureCliSymlink, ensureCliToken } from './cliAuth'
import { initDB, closeDB } from './sqlitedb/db'
import { migrateLegacyTagsToDefinitions } from './sqlitedb/tags'
import { ensureDefaultDataRootPreference } from './dataPaths'
import { store } from './store'
import { syncAgentSkillsFromCustomPaths } from './skillPathSync'
import { syncPromptsFromCustomPaths } from './promptPathSync'
import { startSkillWatcher, stopSkillWatcher } from './skillWatcher'

// 处理应用生命周期
let mainWindow: BrowserWindow | null = null

// 存储默认数据填充结果，供渲染进程查询
let seedResult: { prompts: number; skills: number; subAgents: number } | null = null
/** 启动时从设置中的自定义路径同步入库的 Agent Skill 条数（计入列表刷新） */
let startupPathSyncImported = 0

function initializeApp() {
  // 设置 IPC 处理器
  setupIPC()

  // 注册查询 seed 状态的 IPC handler
  ipcMain.handle('default-data:check', () => {
    if (!seedResult && startupPathSyncImported === 0) {
      return { success: true, data: null }
    }
    return {
      success: true,
      data: {
        prompts: seedResult?.prompts ?? 0,
        skills: (seedResult?.skills ?? 0) + startupPathSyncImported,
        subAgents: seedResult?.subAgents ?? 0,
      },
    }
  })

  // 创建窗口
  app.whenReady().then(async () => {
    ensureDefaultDataRootPreference()
    // 初始化 SQLite 数据库（同步建表，嵌入式无连接延迟）
    initDB()

    mainWindow = createWindow()

    // 设置应用菜单（async，读取语言设置）
    setupMenu().catch((err) => console.error('[Menu] setupMenu error:', err))

    setupTray()

    // 初始化自动更新
    setupAutoUpdater()

    // 注册全局快捷键（Cmd+Shift+P 或 Ctrl+Shift+P）
    const shortcut = process.platform === 'darwin' ? 'Command+Shift+P' : 'Control+Shift+P'
    const ret = globalShortcut.register(shortcut, () => {
      toggleSearchWindow()
    })

    if (!ret) {
      console.error('注册全局快捷键失败:', shortcut)
    } else {
      console.log('全局快捷键注册成功:', shortcut)
    }

    // CLI 支持:确保回环鉴权 token(~/.promptman/cli-token)存在,并尽力建立
    // ~/.local/bin/promptman 软链。失败仅告警,不阻塞启动。
    try {
      ensureCliToken()
      ensureCliSymlink()
    } catch (err) {
      console.warn('[Cli] ensureCliToken / ensureCliSymlink 失败(不阻塞启动):', err)
    }

    // 启动扩展 API 服务（供 Chrome 插件调用：筛选与插入提示词）
    startExtensionServer(EXTENSION_SERVER_DEFAULT_PORT)

    // 空库时写入示例 Prompt / Skill，开源用户打开即可上手（已有数据不会覆盖）
    try {
      const seeded = await seedDefaultDataInMain()
      seedResult = {
        prompts: seeded.prompts,
        skills: seeded.skills,
        subAgents: seeded.subAgents,
      }
    } catch (err) {
      console.warn('[SeedData] Startup seed failed:', err)
      seedResult = { prompts: 0, skills: 0, subAgents: 0 }
    }

    try {
      const pathSync = await syncAgentSkillsFromCustomPaths()
      startupPathSyncImported = pathSync.imported
    } catch (err) {
      console.warn('[SkillPathSync] Startup sync failed:', err)
    }

    // 启动同步成功后开启外部目录实时监听（失败仅告警，不阻塞启动）
    try {
      await startSkillWatcher()
    } catch (err) {
      console.warn('[SkillWatcher] Start failed:', err)
    }

    let startupPromptSyncImported = 0
    try {
      const settings = await store.getSettings()
      if (settings.prompts?.autoScanOnStartup !== false) {
        const promptSync = await syncPromptsFromCustomPaths()
        startupPromptSyncImported = promptSync.imported
      }
    } catch (err) {
      console.warn('[PromptPathSync] Startup sync failed:', err)
    }

    try {
      migrateLegacyTagsToDefinitions()
    } catch (e) {
      console.warn('[Tags] Post-startup migration:', e)
    }

    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      const prompts = (seedResult?.prompts ?? 0) + startupPromptSyncImported
      const skills = (seedResult?.skills ?? 0) + startupPathSyncImported
      const subAgents = seedResult?.subAgents ?? 0
      if (prompts > 0 || skills > 0 || subAgents > 0) {
        win.webContents.send('default-data:seeded', { prompts, skills, subAgents })
      }
    }

    app.on('activate', () => {
      // macOS: 点击 dock 图标时重新创建窗口
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow()
      }
    })
  })

  // 所有窗口关闭时退出应用 (macOS 除外)
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  // 应用退出前清理
  app.on('before-quit', () => {
    stopSkillWatcher()
    destroyTray()
    stopExtensionServer()
    closeDB()
    cleanup()
  })

  // 应用退出时清理
  app.on('will-quit', () => {
    cleanup()
  })
}

// 初始化应用
initializeApp()

