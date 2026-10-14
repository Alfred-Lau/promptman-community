/**
 * 库导出为 Agent Skill（references 生成模式）
 *
 * 参考 agi2 的 generate-site-data 模式：DB 数据 → 结构化 JSON + 每条一篇 Markdown
 * → SKILL.md 工作流。同一份导出数据同时服务两种消费方式：
 * - Agent 程序化检索：references/prompts.json（tags / useWhen / guidance / pitfalls 结构化索引）
 * - 人工浏览：references/prompts/<NN>-<slug>.md（每条一篇，含完整内容与指导）
 */
import type { PromptMetadata } from '@/lib/seekdb/types'

export interface LibrarySkillExportInput {
  libraryName: string
  libraryDescription?: string
  prompts: PromptMetadata[]
  exportedAt?: string
}

export interface LibrarySkillExport {
  folderName: string
  files: Array<{ filename: string; content: string }>
}

/** 目录名清理：去路径非法字符与首尾分隔符（macOS/Windows 通吃，中文名保留） */
function sanitizeName(s: string): string {
  return s
    .replace(/[/\\:*?"<>|\s]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** 文件名 slug：序号前缀保序，导出顺序稳定可预期 */
function promptSlug(index: number, title: string): string {
  const base = sanitizeName(title).slice(0, 40) || 'prompt'
  return `${String(index + 1).padStart(2, '0')}-${base}`
}

/** SKILL.md frontmatter 的 name 字段：多数 Agent 规范要求 ASCII 小写连字符 */
function asciiSkillId(name: string, fallbackSeed: string): string {
  const ascii = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return ascii || `promptman-${fallbackSeed.slice(0, 8)}`
}

/** 单条 Prompt → references/prompts/<slug>.md */
function promptToMarkdown(p: PromptMetadata): string {
  const meta: string[] = ['---', `name: ${JSON.stringify(p.title)}`]
  if (p.description) meta.push(`description: ${JSON.stringify(p.description)}`)
  if (p.tags && p.tags.length) meta.push(`tags: ${JSON.stringify(p.tags)}`)
  if (p.useWhen && p.useWhen.length) meta.push(`useWhen: ${JSON.stringify(p.useWhen)}`)
  meta.push('---')

  const lines = [...meta, '', `# ${p.title}`, '']
  if (p.description) lines.push(p.description, '')
  lines.push(p.content.trim(), '')
  if (p.guidance && p.guidance.length) {
    lines.push('## 使用指导 / Guidance', '')
    p.guidance.forEach((g) => lines.push(`- ${g}`))
    lines.push('')
  }
  if (p.pitfalls && p.pitfalls.length) {
    lines.push('## 常见陷阱 / Pitfalls', '')
    p.pitfalls.forEach((x) => lines.push(`- ${x}`))
    lines.push('')
  }
  return lines.join('\n')
}

/**
 * 把一个库（含其全部当前版本 Prompt）导出为 Agent Skill 文件集合。
 * files 交给 skillAPI.exportToFolder 写盘（选目录 + 写入一体）。
 */
export function buildLibrarySkillExport(input: LibrarySkillExportInput): LibrarySkillExport {
  const exportedAt = input.exportedAt ?? new Date().toISOString()
  const folderName = sanitizeName(input.libraryName) || 'prompt-library'
  const entries = input.prompts.map((p, i) => ({ p, slug: promptSlug(i, p.title) }))

  // references/prompts.json：结构化全量，供 Agent 程序化检索
  const jsonData = {
    library: {
      name: input.libraryName,
      description: input.libraryDescription ?? '',
      exportedAt,
    },
    count: entries.length,
    prompts: entries.map(({ p, slug }) => ({
      slug,
      name: p.title,
      description: p.description ?? '',
      category: p.category ?? '',
      tags: p.tags ?? [],
      useWhen: p.useWhen ?? [],
      guidance: p.guidance ?? [],
      pitfalls: p.pitfalls ?? [],
      content: p.content,
      updatedAt: p.updatedAt,
    })),
  }

  // SKILL.md：工作流 + 索引表
  const rows = entries
    .map(({ p, slug }) => {
      const tags = (p.tags ?? []).join('、') || '-'
      const useWhen = (p.useWhen ?? []).join('、') || p.description || '-'
      return `| ${p.title} | ${tags} | ${useWhen} | references/prompts/${slug}.md |`
    })
    .join('\n')

  const skillMd = [
    '---',
    `name: ${asciiSkillId(input.libraryName, folderName)}`,
    `description: ${JSON.stringify(
      `${input.libraryName}${input.libraryDescription ? ` — ${input.libraryDescription}` : ''}（${entries.length} 条提示词 / prompts）`,
    )}`,
    '---',
    '',
    `# ${input.libraryName}`,
    '',
    input.libraryDescription ?? '',
    '',
    '## 工作流 / Workflow',
    '',
    '1. 读 `references/prompts.json` 获取全部条目的结构化索引（tags / useWhen / guidance / pitfalls）',
    '2. 根据用户需求匹配条目：优先比对 `useWhen`（适用场景），其次 `tags`（标签）',
    '3. 选定条目后读 `references/prompts/<slug>.md` 查看完整提示词与使用指导',
    '4. 输出时遵循该条目的 `guidance`（使用指导），规避 `pitfalls`（常见陷阱）',
    '',
    `## 提示词索引（${entries.length} 条）`,
    '',
    '| 名称 | 标签 | 适用场景 | 文件 |',
    '|---|---|---|---|',
    rows,
    '',
    '## references',
    '',
    '- `prompts.json`：全部条目结构化数据（Agent 程序化检索入口）',
    '- `prompts/<NN>-<slug>.md`：每条提示词的完整 Markdown（人工浏览 / 直接复制）',
    '',
  ].join('\n')

  const files: Array<{ filename: string; content: string }> = [
    { filename: 'SKILL.md', content: skillMd },
    { filename: 'references/prompts.json', content: JSON.stringify(jsonData, null, 2) + '\n' },
    ...entries.map(({ p, slug }) => ({
      filename: `references/prompts/${slug}.md`,
      content: promptToMarkdown(p),
    })),
  ]

  return { folderName, files }
}
