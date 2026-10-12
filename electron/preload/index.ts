import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

export interface ElectronAPI {
  // 窗口控制
  minimize: () => void
  maximize: () => void
  close: () => void
  
  // IPC 通信
  invoke: (channel: string, ...args: any[]) => Promise<any>
  send: (channel: string, ...args: any[]) => void
  on: (channel: string, callback: (...args: any[]) => void) => void
  removeListener: (channel: string, callback: (...args: any[]) => void) => void
  
  // 系统信息
  getPlatform: () => string
  getVersion: () => string
}

// 记录原始 callback → ipcRenderer 包装函数的映射，确保 removeListener 能正确移除
const listenerMap = new Map<(...args: any[]) => void, (_event: IpcRendererEvent, ...args: any[]) => void>()

const electronAPI: ElectronAPI = {
  // 窗口控制
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  
  // IPC 通信（失败时通知主进程写入 ipc-api.log，便于「导出系统错误日志」排查接口）
  invoke: async (channel: string, ...args: any[]) => {
    try {
      const result = await ipcRenderer.invoke(channel, ...args)
      if (
        result &&
        typeof result === 'object' &&
        'success' in result &&
        (result as { success: boolean }).success === false
      ) {
        const err = (result as { error?: string }).error ?? 'unknown'
        ipcRenderer.send('app:ipcDebugLog', {
          channel,
          kind: 'response_error',
          error: String(err),
        })
      }
      return result
    } catch (err) {
      ipcRenderer.send('app:ipcDebugLog', {
        channel,
        kind: 'invoke_throw',
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  },
  send: (channel: string, ...args: any[]) => {
    ipcRenderer.send(channel, ...args)
  },
  on: (channel: string, callback: (...args: any[]) => void) => {
    const wrapper = (_event: IpcRendererEvent, ...args: any[]) => callback(...args)
    listenerMap.set(callback, wrapper)
    ipcRenderer.on(channel, wrapper)
  },
  removeListener: (channel: string, callback: (...args: any[]) => void) => {
    const wrapper = listenerMap.get(callback)
    if (wrapper) {
      ipcRenderer.removeListener(channel, wrapper)
      listenerMap.delete(callback)
    }
  },
  
  // 系统信息
  getPlatform: () => process.platform,
  getVersion: () => process.versions.electron,
}

// 在隔离的上下文中暴露安全的 API
contextBridge.exposeInMainWorld('electronAPI', electronAPI)


