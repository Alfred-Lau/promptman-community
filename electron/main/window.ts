import { BrowserWindow, BrowserWindowConstructorOptions, globalShortcut, app, screen, shell, WebContents } from 'electron'
import { join } from 'path'
import { fork, ChildProcess } from 'child_process'
import * as net from 'net'
import { closeDB } from './sqlitedb/db'

const isDev = process.env.NODE_ENV === 'development'

// 窗口实例
let mainWindow: BrowserWindow | null = null
let searchWindow: BrowserWindow | null = null

// 运行时实际使用的端口（动态分配）
let activePort = 4001

// 获取主窗口引用
export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

// 检测端口是否可用
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close()
      resolve(true)
    })
    // 监听 0.0.0.0 以检测所有网卡上的占用（与 Next.js 默认行为一致）
    server.listen(port, '0.0.0.0')
  })
}

// 查找可用端口（从 preferred 开始，最多尝试 20 个）
async function findAvailablePort(preferred: number): Promise<number> {
  for (let port = preferred; port < preferred + 20; port++) {
    if (await isPortAvailable(port)) return port
  }
  throw new Error(`No available port found starting from ${preferred}`)
}

// 注册开发者工具快捷键
function registerDevToolsShortcut(window: BrowserWindow) {
  // Cmd+Option+I (Mac) 或 Ctrl+Shift+I (Windows/Linux)
  const shortcut = process.platform === 'darwin' ? 'Command+Option+I' : 'Control+Shift+I'
  
  globalShortcut.register(shortcut, () => {
    if (window && !window.isDestroyed()) {
      window.webContents.toggleDevTools()
    }
  })
}

// 生产环境启动 Next.js 服务器
let nextServerProcess: ChildProcess | null = null

function startNextServer(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    if (isDev) {
      resolve()
      return
    }

    // Next.js standalone 通过 extraFiles 放在 Contents/Resources/standalone/
    // server.js 及其 node_modules 都在这个目录下，可直接访问
    const serverPath = join(process.resourcesPath, 'standalone/server.js')
    const serverDir = join(process.resourcesPath, 'standalone')

    // 动态查找可用端口，避免多实例端口冲突
    try {
      activePort = await findAvailablePort(4001)
    } catch (err) {
      reject(err)
      return
    }
    
    console.log('Resources path:', process.resourcesPath)
    console.log('Server path:', serverPath)
    console.log('Server dir:', serverDir)
    console.log('Using port:', activePort)
    
    // 使用 fork 替代 spawn，它会使用 Electron 内置的 Node.js
    const server = fork(serverPath, [], {
      cwd: serverDir,
      env: {
        ...process.env,
        PORT: String(activePort),
        NODE_ENV: 'production',
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    })

    nextServerProcess = server

    server.stdout?.on('data', (data) => {
      const output = data.toString()
      console.log(`Next.js Server: ${output}`)
      if (output.includes('Ready') || output.includes('started') || output.includes('Listening')) {
        resolve()
      }
    })

    server.stderr?.on('data', (data) => {
      const errOutput = data.toString()
      console.error(`Next.js Server Error: ${errOutput}`)
    })

    server.on('error', (error) => {
      console.error('Failed to start Next.js server:', error)
      reject(error)
    })

    server.on('exit', (code) => {
      console.log(`Next.js server exited with code ${code}`)
      // 服务器意外退出也 resolve，让窗口尝试加载（可能是端口冲突后重试）
      if (code !== 0) resolve()
    })

    // 超时处理 - 给服务器更多时间启动
    setTimeout(() => {
      resolve() // 即使没有看到 Ready，也继续
    }, 8000)
  })
}

/** http(s) 新窗口 / target=_blank 统一用系统默认浏览器打开（不依赖渲染进程 IPC） */
function openHttpLinksInSystemBrowser(wc: WebContents) {
  wc.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        void shell.openExternal(url)
        return { action: 'deny' as const }
      }
    } catch {
      /* ignore */
    }
    return { action: 'deny' as const }
  })
}

export function createWindow(): BrowserWindow {
  const options: BrowserWindowConstructorOptions = {
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    resizable: true, // 允许调整窗口大小
    maximizable: true, // 允许最大化
    fullscreenable: true, // 允许全屏
    show: false, // 初始不显示，等待 ready-to-show
    backgroundColor: '#1c2128', // 设置背景色，避免白色闪烁
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  }

  const win = new BrowserWindow(options)
  mainWindow = win

  openHttpLinksInSystemBrowser(win.webContents)
  
  // 注册开发者工具快捷键 (所有环境都可用)
  registerDevToolsShortcut(win)

  // 当窗口准备好时立即显示
  win.once('ready-to-show', () => {
    win.show()
  })

  // 窗口关闭时清除引用
  win.on('closed', () => {
    mainWindow = null
  })

  // 加载应用
  if (isDev) {
    // 开发环境：加载 Next.js 开发服务器
    win.loadURL('http://localhost:4001')
  } else {
    // 生产环境：
    // 1. 先加载 Splash 页面（dist-electron 通过 asarUnpack 解包）
    const appPath = app.getAppPath()
    const splashBasePath = appPath.endsWith('.asar')
      ? join(process.resourcesPath, 'app.asar.unpacked')
      : appPath
    win.loadFile(join(splashBasePath, 'dist-electron/main/splash.html'))
    
    // 2. 后台启动 Next.js 服务器
    startNextServer()
      .then(() => {
        // 3. 服务器启动后加载主页面
        win.loadURL(`http://localhost:${activePort}`)
      })
      .catch((error) => {
        console.error('Failed to load application:', error)
        // 加载失败时显示错误页面
        win.loadURL(`data:text/html,<h1>Failed to load application</h1><pre>${error}</pre>`)
      })
  }

  return win
}

// 创建搜索窗口
export function createSearchWindow(): BrowserWindow | null {
  // 如果窗口已存在，直接显示并聚焦
  if (searchWindow && !searchWindow.isDestroyed()) {
    searchWindow.show()
    searchWindow.focus()
    return searchWindow
  }

  // 获取鼠标所在屏幕，居中显示
  const cursorPoint = screen.getCursorScreenPoint()
  const currentDisplay = screen.getDisplayNearestPoint(cursorPoint)
  const { width: screenWidth } = currentDisplay.workAreaSize
  const { x: displayX, y: displayY } = currentDisplay.workArea

  // 窗口尺寸：更窄更紧凑，类似 Spotlight / Raycast
  const windowWidth = 680
  const windowHeight = 56 // 初始只显示搜索框高度，动态调整
  const x = displayX + Math.floor((screenWidth - windowWidth) / 2)
  const y = displayY + Math.floor(currentDisplay.workAreaSize.height * 0.22) // 偏上 22% 位置

  const options: BrowserWindowConstructorOptions = {
    width: windowWidth,
    height: windowHeight,
    minHeight: 56,
    maxHeight: 520,
    x,
    y,
    resizable: false,
    movable: true,           // 允许拖动搜索窗口
    minimizable: false,
    maximizable: false,
    closable: true,
    fullscreenable: false,
    show: false,
    frame: false,            // 完全无边框，不显示红绿灯
    titleBarStyle: 'hidden', // 彻底隐藏红绿灯
    trafficLightPosition: { x: -20, y: -20 }, // 将红绿灯移到窗口外部，彻底不可见
    transparent: true,       // 完全透明背景
    hasShadow: true,         // 保留阴影营造悬浮感
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    roundedCorners: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  }

  searchWindow = new BrowserWindow(options)

  openHttpLinksInSystemBrowser(searchWindow.webContents)

  // 当窗口准备好时显示
  searchWindow.once('ready-to-show', () => {
    searchWindow?.show()
    searchWindow?.focus()
  })

  // 加载搜索页面
  const searchURL = isDev ? 'http://localhost:4001/search' : `http://localhost:${activePort}/search`
  searchWindow.loadURL(searchURL)

  // 窗口关闭时清理引用
  searchWindow.on('closed', () => {
    searchWindow = null
  })

  // 失去焦点时自动关闭（类似 Spotlight 行为）
  searchWindow.on('blur', () => {
    if (searchWindow && !searchWindow.isDestroyed()) {
      searchWindow.close()
    }
  })

  return searchWindow
}

// 关闭搜索窗口
export function closeSearchWindow(): void {
  if (searchWindow && !searchWindow.isDestroyed()) {
    searchWindow.close()
    searchWindow = null
  }
}

// 切换搜索窗口显示/隐藏
export function toggleSearchWindow(): void {
  if (searchWindow && !searchWindow.isDestroyed() && searchWindow.isVisible()) {
    closeSearchWindow()
  } else {
    createSearchWindow()
  }
}

// 清理函数
export async function cleanup() {
  // 关闭搜索窗口
  closeSearchWindow()
  
  // 注销所有快捷键
  globalShortcut.unregisterAll()

  // 关闭 SQLite 数据库连接
  try {
    closeDB()
  } catch (error) {
    console.error('Error closing SQLite database:', error)
  }

  // 关闭 Next.js 服务器进程
  if (nextServerProcess) {
    nextServerProcess.kill()
    nextServerProcess = null
  }
}

