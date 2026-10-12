/**
 * 为 Chrome 扩展提供本地 HTTP 接口服务
 * 仅监听 127.0.0.1：提示词与 Agent Skill 的增删改查（与 sqlitedb / IPC 同源逻辑）
 */
import { createServer, IncomingMessage, ServerResponse } from 'http'
import { randomUUID } from 'crypto'
import { app } from 'electron'
import { isValidBearerToken } from './cliAuth'
import {
  getCurrentPrompts,
  searchPrompts,
  getPrompt,
  createPrompt,
  updatePrompt,
  deletePrompt,
  deletePromptAllVersions,
  getPromptVersions,
  getCurrentAgentSkills,
  searchAgentSkills,
  getAgentSkill,
  createAgentSkill,
  updateAgentSkill,
  deleteAgentSkill,
  deleteAgentSkillAllVersions,
  getAgentSkillVersions,
} from './sqlitedb'
import type {
  AgentSkillMetadata,
  PromptMetadata,
  UpdateAgentSkillInput,
  UpdatePromptInput,
} from './sqlitedb/types'

const DEFAULT_PORT = 38472

/** 基础响应头(不含 ACAO;ACAO 按请求来源动态计算) */
const BASE_RESPONSE_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-PromptMan-Extension',
  'Content-Type': 'application/json; charset=utf-8',
}

/**
 * 按请求计算 CORS 响应头。
 * - 仅当请求 Origin 以 chrome-extension:// 开头(MV3 扩展)时回显该 Origin;
 * - 其余来源(任意网页、无 Origin 的 CLI/curl 等)不返回 Access-Control-Allow-Origin,
 *   浏览器跨源读取会被拦截,降低 DNS-rebinding / 网页窃读本机库的风险。
 * OPTIONS 预检与正常响应共用此函数(预检同样需要按 Origin 决定是否回显 ACAO)。
 */
function corsHeadersFor(req: IncomingMessage): Record<string, string> {
  const origin = req.headers.origin
  if (typeof origin === 'string' && origin.startsWith('chrome-extension://')) {
    return { ...BASE_RESPONSE_HEADERS, 'Access-Control-Allow-Origin': origin }
  }
  return { ...BASE_RESPONSE_HEADERS }
}

let server: ReturnType<typeof createServer> | null = null

function sendJson(res: ServerResponse, headers: Record<string, string>, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, headers)
  res.end(JSON.stringify(body))
}

function sendError(res: ServerResponse, headers: Record<string, string>, statusCode: number, message: string): void {
  sendJson(res, headers, statusCode, { success: false, error: message })
}

function getPathname(url: string): string {
  const idx = url.indexOf('?')
  const raw = idx === -1 ? url : url.slice(0, idx)
  // 去掉尾部 /，否则 /api/skills/current/?limit=… 无法与字面路径匹配而误返回 404
  const path = raw.replace(/\/+$/, '') || '/'
  return path
}

function getQuery(url: string): Record<string, string> {
  const idx = url.indexOf('?')
  if (idx === -1) return {}
  const q: Record<string, string> = {}
  const search = new URLSearchParams(url.slice(idx + 1))
  search.forEach((v, k) => {
    q[k] = v
  })
  return q
}

/** 匹配 /api/prompts/:id 或 /api/skills/:id（单段 id，不含子路径） */
function matchSingleId(pathname: string, prefix: string): string | null {
  if (!pathname.startsWith(prefix)) return null
  const rest = pathname.slice(prefix.length)
  if (!rest || rest.includes('/')) return null
  return rest
}

const PROMPT_SINGLE_RESERVED = new Set(['current', 'search', 'group', 'versions'])
const SKILL_SINGLE_RESERVED = new Set(['current', 'search', 'group', 'versions'])

/** 单条提示词版本 id（排除 current/search 等保留路径） */
function matchPromptEntityId(pathname: string): string | null {
  const id = matchSingleId(pathname, '/api/prompts/')
  if (!id || PROMPT_SINGLE_RESERVED.has(id)) return null
  return id
}

/** 单条技能版本 id */
function matchSkillEntityId(pathname: string): string | null {
  const id = matchSingleId(pathname, '/api/skills/')
  if (!id || SKILL_SINGLE_RESERVED.has(id)) return null
  return id
}

async function handleGetPromptsCurrent(query: Record<string, string>): Promise<
  { success: true; data: unknown } | { success: false; error: string }
> {
  try {
    const result = await getCurrentPrompts()
    const limit = Math.min(Number(query.limit) || 100, 500)
    const ids = result.ids.slice(0, limit)
    const metadatas = result.metadatas.slice(0, limit)
    return { success: true, data: { ids, metadatas } }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '未知错误' }
  }
}

async function handleGetPromptsSearch(query: Record<string, string>): Promise<
  { success: true; data: unknown } | { success: false; error: string }
> {
  const q = query.q?.trim() ?? ''
  const limit = Math.min(Number(query.limit) || 20, 100)
  if (!q) {
    return { success: false, error: '缺少参数 q' }
  }
  try {
    const result = await searchPrompts({
      queryTexts: [q],
      nResults: limit,
      include: ['documents', 'metadatas', 'distances'],
    })
    const ids = result.ids && result.ids[0] ? result.ids[0] : []
    const metadatas = result.metadatas && result.metadatas[0] ? result.metadatas[0] : []
    const distances = result.distances && result.distances[0] ? result.distances[0] : []
    return { success: true, data: { ids, metadatas, distances } }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '未知错误' }
  }
}

async function handleGetPromptById(id: string): Promise<
  { success: true; data: PromptMetadata } | { success: false; error: string }
> {
  try {
    const prompt = await getPrompt(id)
    if (!prompt) return { success: false, error: '提示词不存在' }
    return { success: true, data: prompt }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '未知错误' }
  }
}

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        if (!raw.trim()) {
          resolve({})
          return
        }
        resolve(JSON.parse(raw) as Record<string, unknown>)
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function pickOptionalLibraryId(body: Record<string, unknown>): string | null | undefined {
  if (!('libraryId' in body)) return undefined
  const v = body.libraryId
  if (v === null) return null
  if (typeof v === 'string') return v
  return undefined
}

function parseUpdatePromptBody(body: Record<string, unknown>): UpdatePromptInput & { isCurrentVersion?: boolean } {
  const input: UpdatePromptInput & { isCurrentVersion?: boolean } = {}
  if (typeof body.title === 'string') input.title = body.title
  if (typeof body.content === 'string') input.content = body.content
  if (typeof body.description === 'string') input.description = body.description
  if (typeof body.category === 'string') input.category = body.category
  const lib = pickOptionalLibraryId(body)
  if (lib !== undefined) input.libraryId = lib
  if (Array.isArray(body.tags) && body.tags.every((t) => typeof t === 'string')) {
    input.tags = body.tags as string[]
  }
  if (typeof body.isCurrentVersion === 'boolean') input.isCurrentVersion = body.isCurrentVersion
  return input
}

async function handlePostPrompts(body: Record<string, unknown>): Promise<
  { success: true; id: string; promptId: string } | { success: false; error: string }
> {
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) {
    return { success: false, error: '缺少 content' }
  }
  const title =
    typeof body.title === 'string' && body.title.trim()
      ? body.title.trim()
      : content.length > 50
        ? `${content.slice(0, 50)}…`
        : content
  try {
    const id = randomUUID()
    const promptId = typeof body.promptId === 'string' && body.promptId.trim() ? body.promptId.trim() : undefined
    await createPrompt({
      id,
      promptId,
      title,
      content,
      description: typeof body.description === 'string' ? body.description.trim() : undefined,
      category: typeof body.category === 'string' ? body.category.trim() : undefined,
      tags:
        Array.isArray(body.tags) && body.tags.every((t) => typeof t === 'string')
          ? (body.tags as string[])
          : undefined,
      changeNotes: typeof body.changeNotes === 'string' ? body.changeNotes.trim() : undefined,
      libraryId: pickOptionalLibraryId(body),
    })
    const created = await getPrompt(id)
    return { success: true, id, promptId: created?.promptId ?? id }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '创建失败' }
  }
}

async function handlePatchPrompt(id: string, body: Record<string, unknown>): Promise<{ success: true } | { success: false; error: string }> {
  const input = parseUpdatePromptBody(body)
  if (Object.keys(input).length === 0) {
    return { success: false, error: '无有效更新字段' }
  }
  try {
    await updatePrompt(id, input)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '更新失败' }
  }
}

async function handleDeletePrompt(id: string): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const existing = await getPrompt(id)
    if (!existing) return { success: false, error: '提示词不存在' }
    await deletePrompt(id)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '删除失败' }
  }
}

async function handleDeletePromptGroup(promptId: string): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await deletePromptAllVersions(promptId)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '删除失败' }
  }
}

// --- Agent Skills ---

async function handleGetSkillsCurrent(query: Record<string, string>): Promise<
  { success: true; data: unknown } | { success: false; error: string }
> {
  try {
    const result = await getCurrentAgentSkills()
    const limit = Math.min(Number(query.limit) || 100, 500)
    const ids = result.ids.slice(0, limit)
    const metadatas = result.metadatas.slice(0, limit)
    return { success: true, data: { ids, metadatas } }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '未知错误' }
  }
}

async function handleGetSkillsSearch(query: Record<string, string>): Promise<
  { success: true; data: unknown } | { success: false; error: string }
> {
  const q = query.q?.trim() ?? ''
  const limit = Math.min(Number(query.limit) || 20, 100)
  if (!q) {
    return { success: false, error: '缺少参数 q' }
  }
  try {
    const result = await searchAgentSkills({
      queryTexts: [q],
      nResults: limit,
      include: ['documents', 'metadatas', 'distances'],
    })
    const ids = result.ids && result.ids[0] ? result.ids[0] : []
    const metadatas = result.metadatas && result.metadatas[0] ? result.metadatas[0] : []
    const distances = result.distances && result.distances[0] ? result.distances[0] : []
    return { success: true, data: { ids, metadatas, distances } }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '未知错误' }
  }
}

async function handleGetSkillById(id: string): Promise<
  { success: true; data: AgentSkillMetadata } | { success: false; error: string }
> {
  try {
    const skill = await getAgentSkill(id)
    if (!skill) return { success: false, error: '技能不存在' }
    return { success: true, data: skill }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '未知错误' }
  }
}

function parseUpdateSkillBody(body: Record<string, unknown>): UpdateAgentSkillInput & { isCurrentVersion?: boolean } {
  const input: UpdateAgentSkillInput & { isCurrentVersion?: boolean } = {}
  if (typeof body.name === 'string') input.name = body.name
  if (typeof body.description === 'string') input.description = body.description
  if (typeof body.category === 'string') input.category = body.category
  if (typeof body.template === 'string') input.template = body.template
  const lib = pickOptionalLibraryId(body)
  if (lib !== undefined) input.libraryId = lib
  if (body.parameters !== undefined && typeof body.parameters === 'object' && body.parameters !== null && !Array.isArray(body.parameters)) {
    input.parameters = body.parameters as Record<string, unknown>
  }
  if (Array.isArray(body.examples) && body.examples.every((x) => typeof x === 'string')) {
    input.examples = body.examples as string[]
  }
  if (Array.isArray(body.tags) && body.tags.every((t) => typeof t === 'string')) {
    input.tags = body.tags as string[]
  }
  if (typeof body.isCurrentVersion === 'boolean') input.isCurrentVersion = body.isCurrentVersion
  return input
}

async function handlePostSkills(body: Record<string, unknown>): Promise<
  { success: true; id: string; skillId: string } | { success: false; error: string }
> {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const template = typeof body.template === 'string' ? body.template : ''
  if (!name || !template.trim()) {
    return { success: false, error: '缺少 name 或 template' }
  }
  try {
    const id = randomUUID()
    const skillId = typeof body.skillId === 'string' && body.skillId.trim() ? body.skillId.trim() : undefined
    await createAgentSkill({
      id,
      skillId,
      name,
      description: typeof body.description === 'string' ? body.description : '',
      category: typeof body.category === 'string' ? body.category : '',
      template,
      parameters:
        body.parameters !== undefined && typeof body.parameters === 'object' && body.parameters !== null && !Array.isArray(body.parameters)
          ? (body.parameters as Record<string, unknown>)
          : undefined,
      examples:
        Array.isArray(body.examples) && body.examples.every((x) => typeof x === 'string')
          ? (body.examples as string[])
          : undefined,
      tags:
        Array.isArray(body.tags) && body.tags.every((t) => typeof t === 'string')
          ? (body.tags as string[])
          : undefined,
      libraryId: pickOptionalLibraryId(body),
    })
    const created = await getAgentSkill(id)
    return { success: true, id, skillId: created?.skillId ?? id }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '创建失败' }
  }
}

async function handlePatchSkill(id: string, body: Record<string, unknown>): Promise<{ success: true } | { success: false; error: string }> {
  const input = parseUpdateSkillBody(body)
  if (Object.keys(input).length === 0) {
    return { success: false, error: '无有效更新字段' }
  }
  try {
    await updateAgentSkill(id, input)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '更新失败' }
  }
}

async function handleDeleteSkill(id: string): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const existing = await getAgentSkill(id)
    if (!existing) return { success: false, error: '技能不存在' }
    await deleteAgentSkill(id)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '删除失败' }
  }
}

async function handleDeleteSkillGroup(skillId: string): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await deleteAgentSkillAllVersions(skillId)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '删除失败' }
  }
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // CORS 头按请求计算:仅回显 chrome-extension:// 来源,其余不返回 ACAO
  const headers = corsHeadersFor(req)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { ...headers, 'Content-Length': '0' })
    res.end()
    return
  }

  const pathname = getPathname(req.url ?? '')
  const query = getQuery(req.url ?? '')

  // ---- 鉴权门(OPTIONS 处理之后、任何路由之前)----
  // 放行条件(任一):(1) /api/health(供 CLI/插件探测);(2) Authorization 通过
  // isValidBearerToken(本地 CLI/脚本);(3) Origin 为 chrome-extension://(MV3 扩展豁免)
  // (4) Origin 缺失但带扩展专用标记(兼容部分 Chromium 版本的扩展 fetch)
  const origin = req.headers.origin
  const isExtensionOrigin = typeof origin === 'string' && origin.startsWith('chrome-extension://')
  const isExtensionRequestWithoutOrigin = origin === undefined && req.headers['x-promptman-extension'] === '1'
  if (pathname !== '/api/health' && !isExtensionOrigin && !isExtensionRequestWithoutOrigin && !isValidBearerToken(req.headers.authorization)) {
    sendJson(res, headers, 401, { ok: false, error: 'Unauthorized' })
    return
  }

  try {
    // POST /api/prompts
    if (req.method === 'POST' && pathname === '/api/prompts') {
      const body = await readJsonBody(req)
      const out = await handlePostPrompts(body)
      if (out.success) sendJson(res, headers, 200, out)
      else sendError(res, headers, 400, out.error)
      return
    }

    // POST /api/skills
    if (req.method === 'POST' && pathname === '/api/skills') {
      const body = await readJsonBody(req)
      const out = await handlePostSkills(body)
      if (out.success) sendJson(res, headers, 200, out)
      else sendError(res, headers, 400, out.error)
      return
    }

    const promptGroupId = matchSingleId(pathname, '/api/prompts/group/')
    if (promptGroupId && req.method === 'DELETE') {
      const out = await handleDeletePromptGroup(promptGroupId)
      if (out.success) sendJson(res, headers, 200, { success: true })
      else sendError(res, headers, 400, out.error)
      return
    }

    const skillGroupId = matchSingleId(pathname, '/api/skills/group/')
    if (skillGroupId && req.method === 'DELETE') {
      const out = await handleDeleteSkillGroup(skillGroupId)
      if (out.success) sendJson(res, headers, 200, { success: true })
      else sendError(res, headers, 400, out.error)
      return
    }

    const promptVersionsPid = matchSingleId(pathname, '/api/prompts/versions/')
    if (promptVersionsPid && req.method === 'GET') {
      try {
        const data = await getPromptVersions(promptVersionsPid)
        sendJson(res, headers, 200, { success: true, data })
      } catch (e) {
        sendError(res, headers, 500, e instanceof Error ? e.message : '未知错误')
      }
      return
    }

    const skillVersionsSid = matchSingleId(pathname, '/api/skills/versions/')
    if (skillVersionsSid && req.method === 'GET') {
      try {
        const data = await getAgentSkillVersions(skillVersionsSid)
        sendJson(res, headers, 200, { success: true, data })
      } catch (e) {
        sendError(res, headers, 500, e instanceof Error ? e.message : '未知错误')
      }
      return
    }

    const promptIdForPatch = matchPromptEntityId(pathname)
    if (promptIdForPatch && req.method === 'PATCH') {
      const body = await readJsonBody(req)
      const out = await handlePatchPrompt(promptIdForPatch, body)
      if (out.success) sendJson(res, headers, 200, { success: true })
      else sendError(res, headers, 400, out.error)
      return
    }

    const skillIdForPatch = matchSkillEntityId(pathname)
    if (skillIdForPatch && req.method === 'PATCH') {
      const body = await readJsonBody(req)
      const out = await handlePatchSkill(skillIdForPatch, body)
      if (out.success) sendJson(res, headers, 200, { success: true })
      else sendError(res, headers, 400, out.error)
      return
    }

    const promptIdForDelete = matchPromptEntityId(pathname)
    if (promptIdForDelete && req.method === 'DELETE') {
      const out = await handleDeletePrompt(promptIdForDelete)
      if (out.success) sendJson(res, headers, 200, { success: true })
      else sendError(res, headers, out.error === '提示词不存在' ? 404 : 400, out.error)
      return
    }

    const skillIdForDelete = matchSkillEntityId(pathname)
    if (skillIdForDelete && req.method === 'DELETE') {
      const out = await handleDeleteSkill(skillIdForDelete)
      if (out.success) sendJson(res, headers, 200, { success: true })
      else sendError(res, headers, out.error === '技能不存在' ? 404 : 400, out.error)
      return
    }

    if (req.method !== 'GET') {
      sendError(res, headers, 405, 'Method Not Allowed')
      return
    }

    if (pathname === '/api/health') {
      sendJson(res, headers, 200, { ok: true, version: app.getVersion() })
      return
    }

    if (pathname === '/api/prompts/current') {
      const out = await handleGetPromptsCurrent(query)
      if (out.success) sendJson(res, headers, 200, out)
      else sendError(res, headers, 500, out.error)
      return
    }

    if (pathname === '/api/prompts/search') {
      const out = await handleGetPromptsSearch(query)
      if (out.success) sendJson(res, headers, 200, out)
      else sendError(res, headers, 400, out.error)
      return
    }

    if (pathname === '/api/skills/current') {
      const out = await handleGetSkillsCurrent(query)
      if (out.success) sendJson(res, headers, 200, out)
      else sendError(res, headers, 500, out.error)
      return
    }

    if (pathname === '/api/skills/search') {
      const out = await handleGetSkillsSearch(query)
      if (out.success) sendJson(res, headers, 200, out)
      else sendError(res, headers, 400, out.error)
      return
    }

    const promptIdGet = matchPromptEntityId(pathname)
    if (promptIdGet) {
      const out = await handleGetPromptById(promptIdGet)
      if (out.success) sendJson(res, headers, 200, out)
      else sendError(res, headers, out.error === '提示词不存在' ? 404 : 500, out.error)
      return
    }

    const skillIdGet = matchSkillEntityId(pathname)
    if (skillIdGet) {
      const out = await handleGetSkillById(skillIdGet)
      if (out.success) sendJson(res, headers, 200, out)
      else sendError(res, headers, out.error === '技能不存在' ? 404 : 500, out.error)
      return
    }

    sendError(res, headers, 404, 'Not Found')
  } catch (err) {
    console.error('[ExtensionServer]', err)
    sendError(res, headers, 500, err instanceof Error ? err.message : 'Internal Server Error')
  }
}

/**
 * 启动扩展 API 服务（仅 127.0.0.1）
 * @param port 端口，默认 38472
 * @returns 实际监听的端口，若启动失败返回 0
 */
export function startExtensionServer(port: number = DEFAULT_PORT): number {
  if (server) {
    return port
  }
  server = createServer(handleRequest)
  server.on('error', (err) => {
    console.error('[ExtensionServer] Failed to start:', err)
  })
  server.listen(port, '127.0.0.1', () => {
    console.log(`[ExtensionServer] Listening on http://127.0.0.1:${port}`)
  })
  return port
}

/**
 * 停止扩展 API 服务
 */
export function stopExtensionServer(): void {
  if (!server) return
  server.close((err) => {
    if (err) console.error('[ExtensionServer] Close error:', err)
    else console.log('[ExtensionServer] Stopped')
  })
  server = null
}

/**
 * 获取当前服务端口（用于设置页或插件配置展示）
 */
export const EXTENSION_SERVER_DEFAULT_PORT = DEFAULT_PORT

/**
 * 获取扩展 API 信息（供设置页展示或复制给插件配置）
 */
export function getExtensionServerInfo(): { port: number; baseUrl: string } {
  return {
    port: DEFAULT_PORT,
    baseUrl: `http://127.0.0.1:${DEFAULT_PORT}`,
  }
}
