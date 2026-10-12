/**
 * PromptHub 同步相关错误码（主进程通过 IPC 的 error 字段原样返回，渲染进程做文案映射）
 */
export const PROMPTHUB_SYNC_NOT_LOGGED_IN = 'PROMPTHUB_SYNC_NOT_LOGGED_IN' as const

/** 云端返回 401，主进程已清除本地统一会话 */
export const PROMPTHUB_SESSION_EXPIRED = 'PROMPTHUB_SESSION_EXPIRED' as const

type CloudSyncStrings = {
  syncError: string
  syncErrorNeedPromptHub: string
  syncSessionExpired: string
}

export function mapPromptHubSyncErrorForDisplay(raw: string, cs: CloudSyncStrings): string {
  if (raw === PROMPTHUB_SESSION_EXPIRED) {
    return cs.syncSessionExpired
  }
  if (raw === PROMPTHUB_SYNC_NOT_LOGGED_IN || raw.startsWith('未登录 PromptHub')) {
    return cs.syncErrorNeedPromptHub
  }
  if (!raw.trim()) return cs.syncError
  return raw
}
