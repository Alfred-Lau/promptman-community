/**
 * 本地数据根目录：可在「应用用户目录」与「用户主目录 ~/.promptman」之间切换。
 * 偏好文件固定写在 Electron userData，避免与 promptman-store.json 的路径形成循环依赖。
 */
import { app } from 'electron'
import { join, dirname } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'

export const DATA_ROOT_PREFERENCE_FILENAME = 'data-root-preference.json'

export type DataRootMode = 'appUserData' | 'homeDotPromptman'

export function getElectronUserDataPath(): string {
  return app.getPath('userData')
}

export function getDataRootPreferencePath(): string {
  return join(getElectronUserDataPath(), DATA_ROOT_PREFERENCE_FILENAME)
}

export function readDataRootModeSync(): DataRootMode {
  const prefPath = getDataRootPreferencePath()
  try {
    if (!existsSync(prefPath)) return 'appUserData'
    const raw = readFileSync(prefPath, 'utf-8')
    const parsed = JSON.parse(raw) as { mode?: string }
    if (parsed.mode === 'homeDotPromptman') return 'homeDotPromptman'
    return 'appUserData'
  } catch {
    return 'appUserData'
  }
}

/**
 * 实际存放数据库、配置 JSON、skills、模型缓存的根目录
 */
export function getDataRoot(): string {
  const mode = readDataRootModeSync()
  if (mode === 'homeDotPromptman') {
    const root = join(app.getPath('home'), '.promptman')
    mkdirSync(root, { recursive: true })
    return root
  }
  const ud = getElectronUserDataPath()
  mkdirSync(ud, { recursive: true })
  return ud
}

export function setDataRootMode(mode: DataRootMode): void {
  const prefPath = getDataRootPreferencePath()
  mkdirSync(dirname(prefPath), { recursive: true })
  writeFileSync(prefPath, JSON.stringify({ mode }, null, 2), 'utf-8')
  if (mode === 'homeDotPromptman') {
    mkdirSync(join(app.getPath('home'), '.promptman'), { recursive: true })
  }
}

/**
 * 首次启动且无偏好文件时：若 Electron userData 下已有旧版库/配置则继续用该目录，否则默认 ~/.promptman 并写入偏好。
 * 须在 app ready 之后、initDB / store 之前调用。
 */
export function ensureDefaultDataRootPreference(): void {
  if (existsSync(getDataRootPreferencePath())) {
    return
  }
  const ud = getElectronUserDataPath()
  const legacyStore = join(ud, 'promptman-store.json')
  const legacyDb = join(ud, 'promptman.db')
  if (existsSync(legacyStore) || existsSync(legacyDb)) {
    setDataRootMode('appUserData')
    return
  }
  setDataRootMode('homeDotPromptman')
}

export function getResolvedDataPaths() {
  const electronUserData = getElectronUserDataPath()
  const home = app.getPath('home')
  const dataRootMode = readDataRootModeSync()
  const dataRoot = getDataRoot()
  return {
    dataRootMode,
    dataRoot,
    electronUserData,
    home,
    dotPromptmanDir: join(home, '.promptman'),
    preferenceFile: getDataRootPreferencePath(),
    storeFile: join(dataRoot, 'promptman-store.json'),
    dbFile: join(dataRoot, 'promptman.db'),
    skillsDir: join(dataRoot, 'skills'),
    modelsDir: join(dataRoot, 'models'),
  }
}
