/** 与 electron/main/ipc `ai:generate` / `ai:polish` 返回的 error 字段一致 */
export const AI_ERROR_MISSING_API_KEY = "AI_API_KEY_MISSING" as const;

/** 旧版主进程返回的中文文案，前端仍映射为同一套 i18n */
export const LEGACY_AI_ERROR_MISSING_API_KEY_ZH =
  "未配置 AI API Key，请前往设置页面配置 AI 服务";

export function isMissingApiKeyError(message: string | null | undefined): boolean {
  if (!message) return false;
  return message === AI_ERROR_MISSING_API_KEY || message === LEGACY_AI_ERROR_MISSING_API_KEY_ZH;
}
