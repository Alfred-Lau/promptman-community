/**
 * SubAgent 导出工具
 * 基于 Claude subagent 标准规范，生成 AGENT.md 文件结构
 *
 * 目录结构:
 *   agent-name/
 *   ├── AGENT.md          # 必需 - 子代理配置和指令
 *   ├── tools.md          # 可选 - 工具配置说明
 *   └── examples.md       # 可选 - 使用示例和移交场景
 */

import type { SubAgentType } from './seekdb/types'

const TYPE_LABELS: Record<SubAgentType, string> = {
  generalPurpose: 'General Purpose',
  explore: 'Code Explorer',
  shell: 'Shell Executor',
  codeReview: 'Code Reviewer',
  testing: 'Testing',
  documentation: 'Documentation',
  refactoring: 'Refactoring',
  custom: 'Custom',
}

/**
 * 将 agent 名称转为合规的 slug
 */
export function toAgentSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\u4e00-\u9fa5]+/g, (match) => match)
    .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || name.replace(/\s+/g, '-').toLowerCase()
}

/**
 * 生成 AGENT.md 完整内容
 */
export function generateAgentMd(agent: {
  name: string
  description?: string
  type: SubAgentType
  model?: string
  instructions: string
  tools?: string[]
  handoffConditions?: string
  outputFormat?: string
  maxTokens?: number
  temperature?: number
}): string {
  const slugName = toAgentSlug(agent.name)
  const lines: string[] = []

  // YAML frontmatter
  lines.push('---')
  lines.push(`name: ${slugName}`)
  lines.push(`type: ${agent.type}`)
  if (agent.description) {
    lines.push(`description: ${agent.description.replace(/\n/g, ' ')}`)
  }
  if (agent.model) {
    lines.push(`model: ${agent.model}`)
  }
  if (agent.tools && agent.tools.length > 0) {
    lines.push(`tools: [${agent.tools.join(', ')}]`)
  }
  if (agent.outputFormat) {
    lines.push(`output_format: ${agent.outputFormat}`)
  }
  if (agent.maxTokens) {
    lines.push(`max_tokens: ${agent.maxTokens}`)
  }
  if (agent.temperature) {
    lines.push(`temperature: ${agent.temperature}`)
  }
  lines.push('---')
  lines.push('')

  // Header
  lines.push(`# ${agent.name}`)
  lines.push('')
  lines.push(`> Type: **${TYPE_LABELS[agent.type] || agent.type}**`)
  if (agent.model) {
    lines.push(`> Model: **${agent.model}**`)
  }
  lines.push('')

  // Instructions
  lines.push('## System Instructions')
  lines.push('')
  lines.push(agent.instructions)
  lines.push('')

  // Handoff Conditions
  if (agent.handoffConditions) {
    lines.push('## Handoff Conditions')
    lines.push('')
    lines.push(agent.handoffConditions)
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * 生成导出文件夹所需的全部文件
 */
export function generateExportFiles(agent: {
  name: string
  description?: string
  type: SubAgentType
  model?: string
  instructions: string
  tools?: string[]
  handoffConditions?: string
  inputSchema?: Record<string, unknown>
  outputFormat?: string
  maxTokens?: number
  temperature?: number
  tags?: string[]
  category?: string
}): Array<{ filename: string; content: string }> {
  const files: Array<{ filename: string; content: string }> = []

  // 主文件 AGENT.md
  files.push({
    filename: 'AGENT.md',
    content: generateAgentMd(agent),
  })

  // 工具配置 tools.md
  if (agent.tools && agent.tools.length > 0) {
    const toolsContent = [
      `# ${agent.name} - Available Tools`,
      '',
      '## Tools',
      '',
      ...agent.tools.map((tool) => `- **${tool}**`),
      '',
      '## Input Schema',
      '',
    ]

    if (agent.inputSchema && Object.keys(agent.inputSchema).length > 0) {
      toolsContent.push('```json')
      toolsContent.push(JSON.stringify(agent.inputSchema, null, 2))
      toolsContent.push('```')
    } else {
      toolsContent.push('No specific input schema defined.')
    }

    toolsContent.push('')

    if (agent.outputFormat) {
      toolsContent.push('## Output Format')
      toolsContent.push('')
      toolsContent.push(agent.outputFormat)
      toolsContent.push('')
    }

    files.push({
      filename: 'tools.md',
      content: toolsContent.join('\n'),
    })
  }

  // 元信息 README.md (分类和标签)
  if ((agent.tags && agent.tags.length > 0) || agent.category) {
    const readmeContent = [
      `# ${agent.name}`,
      '',
      agent.description || '',
      '',
    ]

    if (agent.category) {
      readmeContent.push(`**Category:** ${agent.category}`)
      readmeContent.push('')
    }

    if (agent.tags && agent.tags.length > 0) {
      readmeContent.push(`**Tags:** ${agent.tags.join(', ')}`)
      readmeContent.push('')
    }

    readmeContent.push('## Files')
    readmeContent.push('')
    readmeContent.push('| File | Description |')
    readmeContent.push('|------|-------------|')
    readmeContent.push('| AGENT.md | Main agent configuration and instructions |')
    if (agent.tools && agent.tools.length > 0) {
      readmeContent.push('| tools.md | Available tools and input schema |')
    }
    readmeContent.push('')

    files.push({
      filename: 'README.md',
      content: readmeContent.join('\n'),
    })
  }

  return files
}
