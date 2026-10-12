/**
 * 认证模块
 * - GitHub OAuth 登录
 * - Google OAuth 登录
 * - 邮箱密码登录/注册（对接正式接口）
 */
import { BrowserWindow } from 'electron'
import { appendIPCApiLog } from './appErrorLog'
import { store, type AuthData, type GitHubUser } from './store'
import { login as promptHubPasswordLogin, register as promptHubRegister, PromptHubAPIError } from './prompthub/client'
import { checkPromptHubToken } from './prompthub/sync'

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize'
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const GITHUB_USER_URL = 'https://api.github.com/user'
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USER_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'
const REDIRECT_URI = 'http://localhost/oauth/callback'

type OAuthProvider = 'github' | 'google'

interface GitHubTokenResponse {
  access_token?: string
  error?: string
  error_description?: string
}

interface GitHubUserApiResponse {
  id: number
  login: string
  name: string | null
  avatar_url: string
  html_url: string
  email: string | null
  bio: string | null
  [key: string]: unknown
}

interface GoogleTokenResponse {
  access_token?: string
  refresh_token?: string
  error?: string
  error_description?: string
}

interface GoogleUserApiResponse {
  sub: string
  name?: string
  email?: string
  picture?: string
}

interface OAuthTokens {
  accessToken: string
  refreshToken: string | null
}

interface OAuthConfig {
  provider: OAuthProvider
  authUrl: string
  scopes: string[]
  title: string
  extraAuthParams?: Record<string, string>
}

interface OAuthCredentials {
  clientId: string
  clientSecret: string
}

const OAUTH_CONFIGS: Record<OAuthProvider, OAuthConfig> = {
  github: {
    provider: 'github',
    authUrl: GITHUB_AUTH_URL,
    scopes: ['read:user', 'user:email'],
    title: 'GitHub 登录',
  },
  google: {
    provider: 'google',
    authUrl: GOOGLE_AUTH_URL,
    scopes: ['openid', 'profile', 'email'],
    title: 'Google 登录',
    extraAuthParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  },
}

export async function githubLogin(): Promise<AuthData> {
  return runOAuthLogin('github')
}

export async function googleLogin(): Promise<AuthData> {
  return runOAuthLogin('google')
}

export async function emailLogin(email: string, password: string): Promise<AuthData> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('请输入有效的邮箱地址')
  }

  if (!password || password.length < 8) {
    throw new Error('密码至少需要 8 位')
  }

  // 与注册流程一致：POST /api/auth/login（生产环境对 /api/auth/token 的密码换票可能直接返回 401）
  try {
    const resp = await promptHubPasswordLogin(normalizedEmail, password)
    const u = resp.user
    if (!u?.apiToken) {
      throw new Error('登录成功但未返回有效 Token，请稍后重试')
    }
    const tokenResp = {
      token: u.apiToken,
      userId: u.id,
      email: u.email,
      name: u.name,
    }
    await store.setPromptHubAuth({
      token: tokenResp.token,
      userId: tokenResp.userId,
      email: tokenResp.email,
      name: tokenResp.name,
    })

    const authData = buildEmailAuthDataFromToken(tokenResp)
    await store.setAuth(authData)
    return authData
  } catch (err) {
    if (err instanceof PromptHubAPIError) {
      if (err.statusCode === 401) {
        throw new Error('邮箱或密码错误')
      }
      throw new Error(err.message || '登录失败')
    }
    throw err
  }
}

export async function emailRegister(email: string, password: string, name: string, code: string): Promise<AuthData> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('请输入有效的邮箱地址')
  }

  if (!password || password.length < 8) {
    throw new Error('密码至少需要 8 位')
  }

  if (!code || !/^\d{6}$/.test(code.trim())) {
    throw new Error('请输入 6 位数字验证码')
  }

  try {
    const resp = await promptHubRegister(
      normalizedEmail,
      password,
      name.trim() || normalizedEmail.split('@')[0],
      code.trim()
    )

    // 注册成功后保存 PromptHub Token
    await store.setPromptHubAuth({
      token: resp.user.apiToken,
      userId: resp.user.id,
      email: resp.user.email,
      name: resp.user.name,
    })

    const authData = buildEmailAuthData({
      id: resp.user.id,
      name: resp.user.name,
      email: resp.user.email,
      avatar: resp.user.avatar,
      avatarGradient: resp.user.avatarGradient,
      provider: resp.user.provider,
    })
    await store.setAuth(authData)
    return authData
  } catch (err) {
    if (err instanceof PromptHubAPIError) {
      if (err.statusCode === 409) {
        throw new Error('该邮箱已注册，请直接登录')
      }
      if (err.statusCode === 400) {
        throw new Error(err.message || '注册信息有误，请检查后重试')
      }
      throw new Error(err.message || '注册失败')
    }
    throw err
  }
}

interface RemoteUser {
  id: string
  name?: string | null
  email: string
  avatar?: string | null
  avatarGradient?: string | null
  provider?: string
  createdAt?: string
}

function buildEmailAuthDataFromToken(tokenResp: { token: string; userId: string; email: string; name: string }): AuthData {
  const email = tokenResp.email.trim().toLowerCase()
  const login = email.split('@')[0] || 'user'
  const name = tokenResp.name || login
  const avatarUrl = createInitialAvatar(name.charAt(0).toUpperCase())

  const user: GitHubUser = {
    id: tokenResp.userId,
    provider: 'email',
    login,
    name,
    avatar_url: avatarUrl,
    html_url: '',
    email,
    bio: null,
  }

  return {
    provider: 'email',
    accessToken: tokenResp.token,
    refreshToken: null,
    user,
  }
}

function buildEmailAuthData(remoteUser: RemoteUser): AuthData {
  const email = remoteUser.email.trim().toLowerCase()
  const login = email.split('@')[0] || 'user'
  const name = remoteUser.name || login
  const avatarUrl = remoteUser.avatar
    ? createInitialAvatar(remoteUser.avatar, remoteUser.avatarGradient)
    : createInitialAvatar(name.charAt(0).toUpperCase())

  const user: GitHubUser = {
    id: remoteUser.id,
    provider: 'email',
    login,
    name,
    avatar_url: avatarUrl,
    html_url: '',
    email,
    bio: null,
  }

  return {
    provider: 'email',
    accessToken: `email-session-${remoteUser.id}-${Date.now()}`,
    refreshToken: null,
    user,
  }
}

async function runOAuthLogin(provider: OAuthProvider): Promise<AuthData> {
  const settings = await store.getSettings()
  const credentials = getCredentials(settings, provider)

  if (!credentials.clientId || !credentials.clientSecret) {
    const providerName = provider === 'github' ? 'GitHub' : 'Google'
    throw new Error(
      `未配置 ${providerName} OAuth 的 Client ID 与 Client Secret，第三方登录不可用。请使用邮箱登录，或在应用偏好配置文件中添加 github/google 凭据。`,
    )
  }

  const code = await getAuthorizationCode(OAUTH_CONFIGS[provider], credentials.clientId)
  const tokens = provider === 'github'
    ? await exchangeGitHubCodeForToken(credentials, code)
    : await exchangeGoogleCodeForToken(credentials, code)
  const user = provider === 'github'
    ? await fetchGitHubUser(tokens.accessToken)
    : await fetchGoogleUser(tokens.accessToken)

  const authData: AuthData = {
    provider,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user,
  }
  await store.setAuth(authData)
  return authData
}

/**
 * 登出 - 清除应用与 PromptHub 完整会话
 */
export async function githubLogout(): Promise<void> {
  await store.clearUnifiedSession()
}

/**
 * 获取当前登录状态
 * - 邮箱登录与 PromptHub 绑定：无云端凭据或 Token 失效时视为未登录并清空本地会话
 */
export async function getAuthStatus(): Promise<AuthData> {
  const auth = await store.getAuth()
  if (!auth.user) return auth

  if (auth.provider === 'email') {
    const hubAuth = await store.getPromptHubAuth()
    if (!hubAuth.token) {
      await store.clearUnifiedSession()
      return store.getAuth()
    }
    const hubOk = await checkPromptHubToken()
    if (!hubOk) {
      return store.getAuth()
    }
  }

  return auth
}

/**
 * 打开 OAuth 授权窗口，返回 authorization code
 */
function getAuthorizationCode(config: OAuthConfig, clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const authWindow = new BrowserWindow({
      width: 800,
      height: 700,
      show: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
      titleBarStyle: 'default',
      title: config.title,
    })

    const authParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: config.scopes.join(' '),
      ...(config.extraAuthParams || {}),
    })
    const authUrl = `${config.authUrl}?${authParams.toString()}`
    let finished = false

    const handleOAuthRedirect = (url: string) => {
      if (finished) return
      if (!url.startsWith(REDIRECT_URI)) return

      try {
        const parsedUrl = new URL(url)
        const code = parsedUrl.searchParams.get('code')
        const error = parsedUrl.searchParams.get('error')

        if (error) {
          finished = true
          reject(new Error(`${config.provider.toUpperCase()} OAuth 错误: ${error}`))
        } else if (code) {
          finished = true
          resolve(code)
        } else {
          finished = true
          reject(new Error('未获取到授权码'))
        }
      } catch {
        finished = true
        reject(new Error('解析回调 URL 失败'))
      }

      if (!authWindow.isDestroyed()) {
        authWindow.removeAllListeners('closed')
        authWindow.close()
      }
    }

    // 监听导航事件，截获重定向（did-navigate 作为兜底：部分环境下 will-navigate 对顶层跳转不可靠）
    authWindow.webContents.on('will-redirect', (_event, url) => {
      handleOAuthRedirect(url)
    })

    authWindow.webContents.on('will-navigate', (_event, url) => {
      handleOAuthRedirect(url)
    })

    authWindow.webContents.on('did-navigate', (_event, url) => {
      handleOAuthRedirect(url)
    })

    authWindow.on('closed', () => {
      if (finished) return
      finished = true
      reject(new Error('用户关闭了登录窗口'))
    })

    authWindow.loadURL(authUrl)
  })
}

function getCredentials(
  settings: Awaited<ReturnType<typeof store.getSettings>>,
  provider: OAuthProvider
): OAuthCredentials {
  if (provider === 'github') {
    return settings.github
  }
  return settings.google
}

/**
 * GitHub: 用 authorization code 换取 access token
 */
async function exchangeGitHubCodeForToken(credentials: OAuthCredentials, code: string): Promise<OAuthTokens> {
  let response: Response
  try {
    response = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        code,
        redirect_uri: REDIRECT_URI,
      }),
    })
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    appendIPCApiLog(`[auth:github-token] POST ${GITHUB_TOKEN_URL} fetch error: ${m}`)
    throw e
  }

  if (!response.ok) {
    appendIPCApiLog(`[auth:github-token] POST ${GITHUB_TOKEN_URL} HTTP ${response.status}`)
    throw new Error(`获取 access token 失败: HTTP ${response.status}`)
  }

  const data = (await response.json()) as GitHubTokenResponse

  if (data.error) {
    appendIPCApiLog(
      `[auth:github-token] provider error: ${data.error_description || data.error}`,
    )
    throw new Error(`GitHub Token 错误: ${data.error_description || data.error}`)
  }

  if (!data.access_token) {
    throw new Error('未获取到 access token')
  }

  return {
    accessToken: data.access_token,
    refreshToken: null,
  }
}

/**
 * Google: 用 authorization code 换取 access token
 */
async function exchangeGoogleCodeForToken(credentials: OAuthCredentials, code: string): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    code,
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  })

  let response: Response
  try {
    response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    appendIPCApiLog(`[auth:google-token] POST ${GOOGLE_TOKEN_URL} fetch error: ${m}`)
    throw e
  }

  if (!response.ok) {
    appendIPCApiLog(`[auth:google-token] POST ${GOOGLE_TOKEN_URL} HTTP ${response.status}`)
    throw new Error(`获取 Google access token 失败: HTTP ${response.status}`)
  }

  const data = (await response.json()) as GoogleTokenResponse
  if (data.error) {
    appendIPCApiLog(`[auth:google-token] provider error: ${data.error_description || data.error}`)
    throw new Error(`Google Token 错误: ${data.error_description || data.error}`)
  }
  if (!data.access_token) {
    throw new Error('未获取到 Google access token')
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
  }
}

/**
 * 用 access token 获取 GitHub 用户信息
 */
async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  let response: Response
  try {
    response = await fetch(GITHUB_USER_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    appendIPCApiLog(`[auth:github-user] GET ${GITHUB_USER_URL} fetch error: ${m}`)
    throw e
  }

  if (!response.ok) {
    appendIPCApiLog(`[auth:github-user] GET ${GITHUB_USER_URL} HTTP ${response.status}`)
    throw new Error(`获取用户信息失败: HTTP ${response.status}`)
  }

  const user = (await response.json()) as GitHubUserApiResponse
  return {
    id: user.id,
    provider: 'github',
    login: user.login,
    name: user.name,
    avatar_url: user.avatar_url,
    html_url: user.html_url,
    email: user.email,
    bio: user.bio,
  }
}

/**
 * 用 access token 获取 Google 用户信息
 */
async function fetchGoogleUser(accessToken: string): Promise<GitHubUser> {
  let response: Response
  try {
    response = await fetch(GOOGLE_USER_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    appendIPCApiLog(`[auth:google-user] GET ${GOOGLE_USER_URL} fetch error: ${m}`)
    throw e
  }

  if (!response.ok) {
    appendIPCApiLog(`[auth:google-user] GET ${GOOGLE_USER_URL} HTTP ${response.status}`)
    throw new Error(`获取 Google 用户信息失败: HTTP ${response.status}`)
  }

  const user = (await response.json()) as GoogleUserApiResponse
  const email = (user.email || '').trim().toLowerCase()
  const login = email ? email.split('@')[0] : `google-${user.sub.slice(0, 8)}`
  const name = user.name || login

  return {
    id: user.sub,
    provider: 'google',
    login,
    name,
    avatar_url: user.picture || createInitialAvatar(name),
    html_url: 'https://myaccount.google.com/',
    email: email || null,
    bio: null,
  }
}

function createInitialAvatar(initial: string, gradient?: string | null): string {
  const letter = (initial.trim()[0] || 'U').toUpperCase()
  const bg = gradient || '#374151'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:${bg.includes('gradient') ? '#6366f1' : bg}"/><stop offset="100%" style="stop-color:${bg.includes('gradient') ? '#8b5cf6' : bg}"/></linearGradient></defs><rect width="80" height="80" fill="${bg.includes('gradient') ? 'url(#g)' : bg}"/><text x="40" y="51" font-family="Arial, sans-serif" font-size="32" text-anchor="middle" fill="#E5E7EB">${letter}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
