/**
 * 实时监听外部 Skill 目录（已知 plugin cache 目录 + 设置中的自定义扫描路径）。
 * - 目录集合变更（保存设置）时由调用方先 stopSkillWatcher 再 startSkillWatcher 重建
 * - fs.watch 事件 debounce 800ms 后触发一次全量增量同步（syncAgentSkillsFromCustomPaths 幂等，
 *   内容未变化自动跳过，不重复入库）
 * - 启动时先跑一次 backfillFsScanSourcePaths（存量 source_path 回填，幂等）
 * - 单个目录监听失败仅 warn，不阻塞其他目录与启动流程
 */
import { existsSync, watch, type FSWatcher } from 'fs'
import { store } from './store'
import {
  backfillFsScanSourcePaths,
  expandUserPath,
  getExistingKnownPaths,
  syncAgentSkillsFromCustomPaths,
} from './skillPathSync'

/** 事件聚合窗口：目录内连续变更（如 IDE 原子写文件）合并为一次同步 */
const SYNC_DEBOUNCE_MS = 800

let activeWatchers: FSWatcher[] = []
let syncTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSync(): void {
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    syncTimer = null
    syncAgentSkillsFromCustomPaths().catch((e) => {
      console.warn('[SkillWatcher] debounced sync failed:', e)
    })
  }, SYNC_DEBOUNCE_MS)
}

/** 计算应监听目录：已存在的已知 agent 目录 + 设置中自定义路径（展开 ~），去重、仅保留存在的目录 */
async function collectWatchDirs(): Promise<string[]> {
  const dirs = new Set<string>()
  for (const p of getExistingKnownPaths()) {
    dirs.add(p)
  }
  try {
    const settings = await store.getSettings()
    for (const raw of settings.skills?.customScanPaths ?? []) {
      const expanded = expandUserPath(raw)
      if (expanded) dirs.add(expanded)
    }
  } catch (e) {
    console.warn('[SkillWatcher] read settings failed:', e)
  }
  return [...dirs].filter((d) => d && existsSync(d))
}

/** 单目录监听：recursive 抛错（平台不支持等）时回退非 recursive，仍监听该层 */
function watchOne(dir: string): void {
  const onEvent = (): void => scheduleSync()
  let watcher: FSWatcher
  try {
    watcher = watch(dir, { recursive: true }, onEvent)
  } catch {
    try {
      watcher = watch(dir, onEvent)
    } catch (e) {
      console.warn(`[SkillWatcher] cannot watch ${dir}:`, e)
      return
    }
  }
  watcher.on('error', (e) => {
    console.warn(`[SkillWatcher] watch error on ${dir}:`, e)
  })
  activeWatchers.push(watcher)
}

/**
 * 启动监听：先幂等 backfill 存量 source_path，再开始监听全部外部目录。
 * 监听失败仅 warn；重复调用会先停掉旧 watcher（避免对同一目录重复 watch）。
 * @returns 当前活动的 watcher 句柄列表；停止请调用 stopSkillWatcher()
 */
export async function startSkillWatcher(): Promise<FSWatcher[]> {
  stopSkillWatcher()
  try {
    backfillFsScanSourcePaths()
  } catch (e) {
    console.warn('[SkillWatcher] backfill failed:', e)
  }
  const dirs = await collectWatchDirs()
  for (const dir of dirs) {
    watchOne(dir)
  }
  if (activeWatchers.length > 0) {
    console.log(
      `[SkillWatcher] watching ${activeWatchers.length} dir(s): ${dirs.join(', ')}`,
    )
  }
  return [...activeWatchers]
}

/** 关闭全部 watcher 并清空待触发的 debounce 同步 */
export function stopSkillWatcher(): void {
  for (const w of activeWatchers) {
    try {
      w.close()
    } catch {
      /* ignore */
    }
  }
  activeWatchers = []
  if (syncTimer) {
    clearTimeout(syncTimer)
    syncTimer = null
  }
}
