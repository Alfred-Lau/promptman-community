/**
 * 多文件技能包的共享类型与工具（renderer 侧）
 * 与主进程 electron/main/sqlitedb/types.ts 的 SkillFileNode 保持一致
 */

/** 技能包内的单个文件/目录节点 */
export interface SkillFileNode {
  path: string
  name: string
  size: number
  isDir: boolean
  /** 是否可作为文本预览 */
  isText: boolean
}

/** 技能包导入结果 */
export interface SkillPackageImportResult {
  packageDir: string
  fileTree: SkillFileNode[]
  fileCount: number
  packageSize: number
  /** 从包内 SKILL.md（或 README.md 兜底）提取的正文 */
  skillMd: string
  /** 被跳过的路径数（不安全路径、忽略目录、超限文件） */
  skipped: number
  /** 本地正文原先为空、已用包内 SKILL.md 回填 */
  templateFilled: boolean
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * 把扁平的 SkillFileNode[] 组织成按目录分组的展示结构（目录优先、同级按路径排序）
 */
export interface SkillTreeEntry {
  node: SkillFileNode
  depth: number
}

export function buildDisplayTree(nodes: SkillFileNode[]): SkillTreeEntry[] {
  return [...nodes]
    .sort((a, b) => {
      const aSegs = a.path.split('/')
      const bSegs = b.path.split('/')
      const len = Math.min(aSegs.length, bSegs.length)
      for (let i = 0; i < len; i++) {
        if (aSegs[i] === bSegs[i]) continue
        const aIsLast = i === aSegs.length - 1
        const bIsLast = i === bSegs.length - 1
        // 同级：目录优先
        const aIsDir = !aIsLast || a.isDir
        const bIsDir = !bIsLast || b.isDir
        if (aIsDir !== bIsDir) return aIsDir ? -1 : 1
        return aSegs[i].localeCompare(bSegs[i])
      }
      return aSegs.length - bSegs.length
    })
    .map((node) => ({ node, depth: node.path.split('/').length - 1 }))
}

/** 该路径的所有祖先目录是否都处于展开状态 */
export function isNodeVisible(path: string, expanded: Set<string>): boolean {
  const segs = path.split('/')
  for (let i = 1; i < segs.length; i++) {
    if (!expanded.has(segs.slice(0, i).join('/'))) return false
  }
  return true
}
