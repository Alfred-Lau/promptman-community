/**
 * Electron API 类型定义和工具函数
 */

// 检查是否在 Electron 环境中
export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI
}

// 安全地调用 Electron API
export function getElectronAPI() {
  if (!isElectron()) {
    throw new Error('Electron API is not available in this environment')
  }
  return window.electronAPI
}

