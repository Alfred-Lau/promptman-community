/**
 * Agent Team 模板和导出工具
 * 基于 Claude Agent Teams 标准规范
 */

import type { TeammateDef, TeamDisplayMode } from './seekdb/types'

/**
 * 将团队名称转为 slug
 */
export function toTeamSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * 生成 TEAM.md 内容
 */
export function generateTeamMd(team: {
  name: string
  description?: string
  displayMode?: TeamDisplayMode
  leadInstructions: string
  leadModel?: string
  delegateMode?: boolean
  requirePlanApproval?: boolean
  teammates: TeammateDef[]
  taskTemplate?: string
  qualityGates?: string
  maxTeammates?: number
}): string {
  const frontmatter = [
    '---',
    `name: ${toTeamSlug(team.name)}`,
    `description: ${(team.description || '').replace(/\n/g, ' ')}`,
    `display_mode: ${team.displayMode || 'auto'}`,
    team.leadModel ? `lead_model: ${team.leadModel}` : null,
    team.delegateMode ? `delegate_mode: true` : null,
    team.requirePlanApproval ? `require_plan_approval: true` : null,
    team.maxTeammates ? `max_teammates: ${team.maxTeammates}` : null,
    '---',
  ].filter(Boolean).join('\n')

  const teammatesSection = team.teammates.length > 0
    ? `\n## Teammates\n\n${team.teammates.map((t, i) => {
        const lines = [
          `### ${i + 1}. ${t.role}`,
          t.description ? `\n${t.description}` : '',
          t.model ? `\n**Model:** ${t.model}` : '',
          t.requirePlanApproval ? '\n**Requires Plan Approval:** Yes' : '',
          t.tools && t.tools.length > 0 ? `\n**Tools:** ${t.tools.join(', ')}` : '',
          `\n**Spawn Prompt:**\n\n\`\`\`\n${t.spawnPrompt}\n\`\`\``,
        ].filter(Boolean).join('')
        return lines
      }).join('\n\n')}`
    : ''

  const taskSection = team.taskTemplate
    ? `\n## Task Template\n\n${team.taskTemplate}`
    : ''

  const qualitySection = team.qualityGates
    ? `\n## Quality Gates\n\n${team.qualityGates}`
    : ''

  return `${frontmatter}\n\n# Lead Instructions\n\n${team.leadInstructions}${teammatesSection}${taskSection}${qualitySection}\n`
}

/**
 * 生成导出文件列表
 */
export function generateExportFiles(team: {
  name: string
  description?: string
  displayMode?: TeamDisplayMode
  leadInstructions: string
  leadModel?: string
  delegateMode?: boolean
  requirePlanApproval?: boolean
  teammates: TeammateDef[]
  taskTemplate?: string
  qualityGates?: string
  maxTeammates?: number
  tags?: string[]
  category?: string
}): Array<{ filename: string; content: string }> {
  const files: Array<{ filename: string; content: string }> = []

  // 主文件 TEAM.md
  files.push({
    filename: 'TEAM.md',
    content: generateTeamMd(team),
  })

  // 如果有标签或分类，生成 README.md
  if ((team.tags && team.tags.length > 0) || team.category) {
    const readmeLines = [
      `# ${team.name}`,
      '',
      team.description || '',
      '',
    ]
    if (team.category) {
      readmeLines.push(`**Category:** ${team.category}`)
    }
    if (team.tags && team.tags.length > 0) {
      readmeLines.push(`**Tags:** ${team.tags.join(', ')}`)
    }
    readmeLines.push('')
    readmeLines.push(`**Teammates:** ${team.teammates.length}`)
    readmeLines.push(`**Display Mode:** ${team.displayMode || 'auto'}`)
    if (team.delegateMode) {
      readmeLines.push('**Delegate Mode:** Enabled')
    }

    files.push({
      filename: 'README.md',
      content: readmeLines.join('\n'),
    })
  }

  // 如果队友数量较多，单独生成 teammates.md
  if (team.teammates.length > 2) {
    const teammatesLines = ['# Teammates Configuration', '']
    team.teammates.forEach((t, i) => {
      teammatesLines.push(`## ${i + 1}. ${t.role}`)
      if (t.description) teammatesLines.push(`\n${t.description}`)
      if (t.model) teammatesLines.push(`\n**Model:** ${t.model}`)
      if (t.tools && t.tools.length > 0) teammatesLines.push(`**Tools:** ${t.tools.join(', ')}`)
      if (t.requirePlanApproval) teammatesLines.push('**Plan Approval Required:** Yes')
      teammatesLines.push(`\n### Spawn Prompt\n\n\`\`\`\n${t.spawnPrompt}\n\`\`\`\n`)
    })

    files.push({
      filename: 'teammates.md',
      content: teammatesLines.join('\n'),
    })
  }

  return files
}

/**
 * 预设团队模板类别
 */
export const TEAM_CATEGORIES = [
  'Code Review',
  'Feature Development',
  'Bug Investigation',
  'Refactoring',
  'Research',
  'Testing',
  'Documentation',
  'Architecture',
  'Custom',
] as const

/**
 * 预设团队模板
 */
export const TEAM_TEMPLATES: Array<{
  name: string
  description: string
  category: string
  displayMode: TeamDisplayMode
  leadInstructions: string
  delegateMode: boolean
  requirePlanApproval: boolean
  teammates: TeammateDef[]
  taskTemplate: string
}> = [
  {
    name: 'Parallel Code Review',
    description: 'A team of 3 reviewers examining code from different perspectives: security, performance, and test coverage.',
    category: 'Code Review',
    displayMode: 'auto',
    leadInstructions: 'You are the lead of a code review team. Coordinate three reviewers to examine the code from different angles. Synthesize their findings into a comprehensive review report. Wait for all teammates to finish before providing the final summary.',
    delegateMode: true,
    requirePlanApproval: false,
    teammates: [
      {
        role: 'Security Reviewer',
        description: 'Focused on security implications and vulnerabilities',
        spawnPrompt: 'Review the code for security vulnerabilities. Focus on: authentication, authorization, input validation, SQL injection, XSS, CSRF, token handling, session management, and data exposure. Report issues with severity ratings (Critical/High/Medium/Low).',
        tools: ['Read', 'Grep', 'Glob'],
      },
      {
        role: 'Performance Reviewer',
        description: 'Focused on performance impact and optimization',
        spawnPrompt: 'Review the code for performance issues. Focus on: algorithmic complexity, memory usage, database queries (N+1), caching opportunities, unnecessary re-renders, bundle size impact, and async/await patterns. Suggest concrete optimizations.',
        tools: ['Read', 'Grep', 'Glob'],
      },
      {
        role: 'Test Coverage Reviewer',
        description: 'Focused on test coverage and quality',
        spawnPrompt: 'Review the code for test coverage gaps. Check: unit tests, integration tests, edge cases, error handling, boundary conditions, and mock quality. Suggest specific test cases that should be added.',
        tools: ['Read', 'Grep', 'Glob'],
      },
    ],
    taskTemplate: 'Each reviewer should: 1) Analyze their domain 2) Document findings with code references 3) Provide actionable recommendations 4) Rate overall quality in their area',
  },
  {
    name: 'Feature Development Team',
    description: 'A team for building new features with separate frontend, backend, and test responsibilities.',
    category: 'Feature Development',
    displayMode: 'auto',
    leadInstructions: 'You are the lead of a feature development team. Break down the feature into frontend, backend, and testing tasks. Assign work to teammates ensuring they work on separate files to avoid conflicts. Coordinate integration points between frontend and backend. Ensure tests are written for all new functionality.',
    delegateMode: false,
    requirePlanApproval: true,
    teammates: [
      {
        role: 'Frontend Developer',
        description: 'Responsible for UI components and client-side logic',
        spawnPrompt: 'Implement the frontend portion of the feature. Create React components, handle state management, add proper TypeScript types, and ensure responsive design. Follow existing code patterns and style conventions.',
        tools: ['Read', 'Write', 'Grep', 'Glob', 'Shell'],
        requirePlanApproval: true,
      },
      {
        role: 'Backend Developer',
        description: 'Responsible for API endpoints and server-side logic',
        spawnPrompt: 'Implement the backend portion of the feature. Create API endpoints, handle data validation, implement business logic, and ensure proper error handling. Follow existing patterns for routing, middleware, and database access.',
        tools: ['Read', 'Write', 'Grep', 'Glob', 'Shell'],
        requirePlanApproval: true,
      },
      {
        role: 'Test Engineer',
        description: 'Responsible for writing comprehensive tests',
        spawnPrompt: 'Write tests for the new feature. Create unit tests for individual functions, integration tests for API endpoints, and component tests for React components. Aim for high coverage of critical paths and edge cases.',
        tools: ['Read', 'Write', 'Grep', 'Glob', 'Shell'],
        requirePlanApproval: false,
      },
    ],
    taskTemplate: 'Phase 1: Plan and design (all teammates plan, lead approves). Phase 2: Implementation (frontend + backend in parallel). Phase 3: Testing (after implementation). Phase 4: Integration review (lead synthesizes).',
  },
  {
    name: 'Bug Investigation Squad',
    description: 'Multiple agents investigate different hypotheses about a bug in parallel, then debate findings.',
    category: 'Bug Investigation',
    displayMode: 'auto',
    leadInstructions: 'You are leading a bug investigation. Spawn investigators to explore different hypotheses in parallel. Have them share findings and challenge each other\'s theories. Converge on the root cause based on evidence. Only the theory that survives scrutiny from all investigators should be accepted.',
    delegateMode: true,
    requirePlanApproval: false,
    teammates: [
      {
        role: 'Hypothesis A Investigator',
        description: 'Investigates the first hypothesis and tries to prove/disprove it',
        spawnPrompt: 'Investigate the bug by exploring the first hypothesis. Gather evidence from code, logs, and tests. Try to both prove and disprove your hypothesis. Share findings with other investigators and challenge their theories if you find contradicting evidence.',
        tools: ['Read', 'Grep', 'Glob', 'Shell'],
      },
      {
        role: 'Hypothesis B Investigator',
        description: 'Investigates an alternative hypothesis',
        spawnPrompt: 'Investigate the bug by exploring an alternative hypothesis different from Investigator A. Gather evidence from code, logs, and tests. Try to both prove and disprove your hypothesis. Share findings and challenge other theories.',
        tools: ['Read', 'Grep', 'Glob', 'Shell'],
      },
      {
        role: 'Hypothesis C Investigator',
        description: 'Plays devil\'s advocate and explores edge cases',
        spawnPrompt: 'Investigate the bug by playing devil\'s advocate. Explore edge cases and uncommon code paths. Try to disprove the hypotheses of other investigators. Look for root causes that others might miss.',
        tools: ['Read', 'Grep', 'Glob', 'Shell'],
      },
    ],
    taskTemplate: '1) Each investigator forms and investigates their hypothesis independently. 2) Investigators share initial findings. 3) Cross-challenge phase where investigators try to disprove each other. 4) Converge on the most evidence-supported root cause.',
  },
]
