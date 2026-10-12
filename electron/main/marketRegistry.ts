/**
 * Market Registry - 从 GitHub 仓库获取 awesome-skills / awesome-agents 数据
 * 支持缓存机制（TTL 24h）、搜索、分页
 */
import { net } from 'electron'
import { appendIPCApiLog } from './appErrorLog'
import { store } from './store'

// ==================== 类型定义 ====================

export interface RegistrySkill {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  author: string
  repoUrl: string
  installCommand?: string
  version: string
  downloads: number
  rating: number
  featured?: boolean
  readme?: string
}

export interface RegistryAgent {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  author: string
  repoUrl: string
  installCommand?: string
  version: string
  downloads: number
  rating: number
  featured?: boolean
  readme?: string
}

export interface FetchOptions {
  query?: string
  category?: string
  page?: number
  pageSize?: number
  forceRefresh?: boolean
}

export interface FetchResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  cached: boolean
}

// ==================== 默认仓库配置 ====================

const DEFAULT_REPO_OWNER = 'anthropics'
const DEFAULT_REPO_NAME = 'awesome-skills'
const DEFAULT_SKILLS_PATH = 'skills.json'
const DEFAULT_AGENTS_PATH = 'agents.json'
const CACHE_TTL_HOURS = 24

// ==================== 内置的备用数据（GitHub 不可用时使用） ====================

const FALLBACK_SKILLS: RegistrySkill[] = [
  {
    id: 'reg-skill-1',
    name: 'Code Review Assistant',
    description: 'Automated code review skill that checks for common issues, security vulnerabilities, and best practices.',
    category: 'Development',
    tags: ['code-review', 'security', 'best-practices'],
    author: 'community',
    repoUrl: 'https://github.com/example/code-review-skill',
    installCommand: 'npx @promptman/skill-installer code-review-assistant',
    version: '1.2.0',
    downloads: 5420,
    rating: 4.8,
    featured: true,
  },
  {
    id: 'reg-skill-2',
    name: 'API Documentation Generator',
    description: 'Generates comprehensive API documentation from source code, supporting OpenAPI, GraphQL, and REST endpoints.',
    category: 'Documentation',
    tags: ['api', 'documentation', 'openapi', 'graphql'],
    author: 'community',
    repoUrl: 'https://github.com/example/api-doc-gen',
    installCommand: 'npx @promptman/skill-installer api-doc-gen',
    version: '2.0.1',
    downloads: 3210,
    rating: 4.7,
    featured: true,
  },
  {
    id: 'reg-skill-3',
    name: 'Test Generator',
    description: 'Automatically generates unit tests and integration tests for your codebase with high coverage.',
    category: 'Testing',
    tags: ['testing', 'unit-test', 'coverage', 'jest'],
    author: 'community',
    repoUrl: 'https://github.com/example/test-generator',
    installCommand: 'npx @promptman/skill-installer test-generator',
    version: '1.5.0',
    downloads: 4150,
    rating: 4.6,
    featured: true,
  },
  {
    id: 'reg-skill-4',
    name: 'Database Schema Designer',
    description: 'Design and optimize database schemas with support for PostgreSQL, MySQL, and MongoDB.',
    category: 'Database',
    tags: ['database', 'schema', 'postgresql', 'mysql'],
    author: 'community',
    repoUrl: 'https://github.com/example/db-schema-designer',
    installCommand: 'npx @promptman/skill-installer db-schema-designer',
    version: '1.1.0',
    downloads: 2890,
    rating: 4.5,
  },
  {
    id: 'reg-skill-5',
    name: 'i18n Translator',
    description: 'Automated internationalization skill that translates and manages localization files across multiple languages.',
    category: 'Localization',
    tags: ['i18n', 'translation', 'localization'],
    author: 'community',
    repoUrl: 'https://github.com/example/i18n-translator',
    installCommand: 'npx @promptman/skill-installer i18n-translator',
    version: '1.0.3',
    downloads: 1920,
    rating: 4.4,
  },
  {
    id: 'reg-skill-6',
    name: 'Performance Profiler',
    description: 'Analyzes application performance bottlenecks and suggests optimization strategies.',
    category: 'Performance',
    tags: ['performance', 'optimization', 'profiling'],
    author: 'community',
    repoUrl: 'https://github.com/example/perf-profiler',
    version: '1.3.0',
    downloads: 2340,
    rating: 4.6,
    featured: true,
  },
  {
    id: 'reg-skill-7',
    name: 'Security Audit',
    description: 'Performs comprehensive security audits including dependency scanning, OWASP checks, and vulnerability detection.',
    category: 'Security',
    tags: ['security', 'audit', 'vulnerability', 'owasp'],
    author: 'community',
    repoUrl: 'https://github.com/example/security-audit',
    installCommand: 'npx @promptman/skill-installer security-audit',
    version: '2.1.0',
    downloads: 3780,
    rating: 4.9,
    featured: true,
  },
  {
    id: 'reg-skill-8',
    name: 'Git Workflow Manager',
    description: 'Manages complex git workflows including branch strategies, PR templates, and commit conventions.',
    category: 'DevOps',
    tags: ['git', 'workflow', 'ci-cd', 'devops'],
    author: 'community',
    repoUrl: 'https://github.com/example/git-workflow',
    version: '1.0.0',
    downloads: 1560,
    rating: 4.3,
  },
]

const FALLBACK_AGENTS: RegistryAgent[] = [
  {
    id: 'reg-agent-1',
    name: 'Full-Stack Developer',
    description: 'A comprehensive full-stack development agent that handles frontend, backend, and database tasks.',
    category: 'Development',
    tags: ['fullstack', 'react', 'nodejs', 'database'],
    author: 'community',
    repoUrl: 'https://github.com/example/fullstack-agent',
    installCommand: 'npx @promptman/agent-installer fullstack-dev',
    version: '2.0.0',
    downloads: 6200,
    rating: 4.8,
    featured: true,
  },
  {
    id: 'reg-agent-2',
    name: 'DevOps Engineer',
    description: 'Automates CI/CD pipelines, infrastructure management, and deployment workflows.',
    category: 'DevOps',
    tags: ['devops', 'ci-cd', 'docker', 'kubernetes'],
    author: 'community',
    repoUrl: 'https://github.com/example/devops-agent',
    installCommand: 'npx @promptman/agent-installer devops-engineer',
    version: '1.5.0',
    downloads: 4100,
    rating: 4.7,
    featured: true,
  },
  {
    id: 'reg-agent-3',
    name: 'Data Analyst',
    description: 'Analyzes datasets, generates visualizations, and provides statistical insights.',
    category: 'Data Science',
    tags: ['data-analysis', 'visualization', 'statistics', 'python'],
    author: 'community',
    repoUrl: 'https://github.com/example/data-analyst-agent',
    version: '1.2.0',
    downloads: 3500,
    rating: 4.6,
    featured: true,
  },
  {
    id: 'reg-agent-4',
    name: 'Technical Writer',
    description: 'Creates technical documentation, README files, and developer guides with professional quality.',
    category: 'Documentation',
    tags: ['documentation', 'technical-writing', 'readme'],
    author: 'community',
    repoUrl: 'https://github.com/example/tech-writer-agent',
    version: '1.0.0',
    downloads: 2200,
    rating: 4.5,
  },
  {
    id: 'reg-agent-5',
    name: 'UI/UX Designer',
    description: 'Generates UI mockups, design systems, and accessibility recommendations.',
    category: 'Design',
    tags: ['ui', 'ux', 'design', 'accessibility'],
    author: 'community',
    repoUrl: 'https://github.com/example/uiux-agent',
    version: '1.1.0',
    downloads: 2800,
    rating: 4.4,
  },
]

// ==================== GitHub API 请求辅助 ====================

async function fetchFromGitHub(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = net.request(url)
    let body = ''

    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        appendIPCApiLog(`[MarketRegistry] GET ${url} HTTP ${response.statusCode ?? '?'}`)
        reject(new Error(`GitHub API returned ${response.statusCode}`))
        return
      }
      response.on('data', (chunk) => {
        body += chunk.toString()
      })
      response.on('end', () => {
        try {
          resolve(JSON.parse(body))
        } catch {
          appendIPCApiLog(`[MarketRegistry] GET ${url} response JSON parse failed`)
          reject(new Error('Failed to parse GitHub response'))
        }
      })
    })

    request.on('error', (error) => {
      appendIPCApiLog(
        `[MarketRegistry] GET ${url} network error: ${error instanceof Error ? error.message : String(error)}`,
      )
      reject(error)
    })

    request.end()
  })
}

// ==================== 核心功能 ====================

function isCacheValid(lastFetchedAt: string | null, ttlHours: number): boolean {
  if (!lastFetchedAt) return false
  const lastFetched = new Date(lastFetchedAt).getTime()
  const now = Date.now()
  return (now - lastFetched) < (ttlHours * 60 * 60 * 1000)
}

function filterItems<T extends { name: string; description: string; category: string; tags: string[] }>(
  items: T[],
  query?: string,
  category?: string
): T[] {
  let filtered = items

  if (category) {
    filtered = filtered.filter(item => item.category.toLowerCase() === category.toLowerCase())
  }

  if (query) {
    const q = query.toLowerCase()
    filtered = filtered.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.tags.some(tag => tag.toLowerCase().includes(q))
    )
  }

  return filtered
}

function paginateItems<T>(items: T[], page: number = 1, pageSize: number = 20): { items: T[]; total: number } {
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
  }
}

/**
 * 获取 Registry Skills 列表
 */
export async function fetchRegistrySkills(options: FetchOptions = {}): Promise<FetchResult<RegistrySkill>> {
  const { query, category, page = 1, pageSize = 20, forceRefresh = false } = options

  let skills: RegistrySkill[] = []
  let cached = false

  // 检查缓存
  const cache = await store.getMarketCache()
  if (!forceRefresh && isCacheValid(cache.lastFetchedAt, cache.ttlHours) && cache.skills.length > 0) {
    skills = cache.skills as RegistrySkill[]
    cached = true
  } else {
    // 尝试从 GitHub 获取
    try {
      const settings = await store.getSettings()
      const repoUrl = settings.marketRegistryUrl ||
        `https://api.github.com/repos/${DEFAULT_REPO_OWNER}/${DEFAULT_REPO_NAME}/contents/${DEFAULT_SKILLS_PATH}`

      const data = await fetchFromGitHub(repoUrl) as { content?: string }
      if (data.content) {
        const decoded = Buffer.from(data.content, 'base64').toString('utf-8')
        skills = JSON.parse(decoded) as RegistrySkill[]
      }

      // 更新缓存
      await store.setMarketCache({
        skills,
        lastFetchedAt: new Date().toISOString(),
      })
      cached = false
    } catch (error) {
      console.warn('Failed to fetch from GitHub, using fallback data:', error)
      appendIPCApiLog(
        `[MarketRegistry] skills fetch failed: ${error instanceof Error ? error.message : String(error)}`,
      )
      skills = FALLBACK_SKILLS
      cached = false
    }
  }

  // 过滤和分页
  const filtered = filterItems(skills, query, category)
  const paginated = paginateItems(filtered, page, pageSize)

  return {
    items: paginated.items,
    total: paginated.total,
    page,
    pageSize,
    cached,
  }
}

/**
 * 获取 Registry Agents 列表
 */
export async function fetchRegistryAgents(options: FetchOptions = {}): Promise<FetchResult<RegistryAgent>> {
  const { query, category, page = 1, pageSize = 20, forceRefresh = false } = options

  let agents: RegistryAgent[] = []
  let cached = false

  // 检查缓存
  const cache = await store.getMarketCache()
  if (!forceRefresh && isCacheValid(cache.lastFetchedAt, cache.ttlHours) && cache.agents.length > 0) {
    agents = cache.agents as RegistryAgent[]
    cached = true
  } else {
    // 尝试从 GitHub 获取
    try {
      const settings = await store.getSettings()
      const repoUrl = settings.marketRegistryUrl
        ? settings.marketRegistryUrl.replace(DEFAULT_SKILLS_PATH, DEFAULT_AGENTS_PATH)
        : `https://api.github.com/repos/${DEFAULT_REPO_OWNER}/${DEFAULT_REPO_NAME}/contents/${DEFAULT_AGENTS_PATH}`

      const data = await fetchFromGitHub(repoUrl) as { content?: string }
      if (data.content) {
        const decoded = Buffer.from(data.content, 'base64').toString('utf-8')
        agents = JSON.parse(decoded) as RegistryAgent[]
      }

      // 更新缓存
      await store.setMarketCache({
        agents,
        lastFetchedAt: new Date().toISOString(),
      })
      cached = false
    } catch (error) {
      console.warn('Failed to fetch agents from GitHub, using fallback data:', error)
      appendIPCApiLog(
        `[MarketRegistry] agents fetch failed: ${error instanceof Error ? error.message : String(error)}`,
      )
      agents = FALLBACK_AGENTS
      cached = false
    }
  }

  // 过滤和分页
  const filtered = filterItems(agents, query, category)
  const paginated = paginateItems(filtered, page, pageSize)

  return {
    items: paginated.items,
    total: paginated.total,
    page,
    pageSize,
    cached,
  }
}

/**
 * 获取单个 Skill/Agent 的详细信息（含 README）
 */
export async function fetchRegistryDetail(repoUrl: string): Promise<{ readme: string } | null> {
  try {
    // 从 repoUrl 提取 owner/repo
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/)
    if (!match) return null

    const [, owner, repo] = match
    const readmeUrl = `https://api.github.com/repos/${owner}/${repo}/readme`
    const data = await fetchFromGitHub(readmeUrl) as { content?: string }

    if (data.content) {
      const readme = Buffer.from(data.content, 'base64').toString('utf-8')
      return { readme }
    }

    return null
  } catch (error) {
    appendIPCApiLog(
      `[MarketRegistry] fetchRegistryDetail(${repoUrl}) failed: ${error instanceof Error ? error.message : String(error)}`,
    )
    return null
  }
}

/**
 * 刷新缓存
 */
export async function refreshMarketCache(): Promise<void> {
  await store.setMarketCache({
    skills: [],
    agents: [],
    lastFetchedAt: null,
  })
}

/**
 * 获取所有 Skill 分类
 */
export function getSkillCategories(skills: RegistrySkill[]): string[] {
  const cats = new Set(skills.map(s => s.category))
  return Array.from(cats).sort()
}

/**
 * 获取所有 Agent 分类
 */
export function getAgentCategories(agents: RegistryAgent[]): string[] {
  const cats = new Set(agents.map(a => a.category))
  return Array.from(cats).sort()
}
