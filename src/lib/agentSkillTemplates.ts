/**
 * Agent Skills 基础模板
 * 遵循 Cursor SKILL.md 标准规范
 *
 * 目录结构:
 *   skill-name/
 *   ├── SKILL.md       # 必需 - 主指令文件 (YAML frontmatter + markdown body)
 *   ├── reference.md   # 可选 - 详细参考文档
 *   └── examples.md    # 可选 - 使用示例
 */

export interface AgentSkillTemplate {
  name: string
  description: string
  category: string
  template: string          // SKILL.md body content (markdown)
  parameters?: Record<string, unknown>
  examples?: string[]
  tags?: string[]
}

/**
 * 根据 skill 元数据生成完整的 SKILL.md 文件内容
 */
export function generateSkillMd(skill: {
  name: string
  description?: string
  template: string
}): string {
  const slugName = toSkillSlug(skill.name)
  const lines = [
    '---',
    `name: ${slugName}`,
    `description: ${(skill.description || '').replace(/\n/g, ' ')}`,
    '---',
    '',
    skill.template,
  ]
  return lines.join('\n')
}

/**
 * 将 skill 名称转为合规的 slug (小写字母、数字、连字符)
 */
export function toSkillSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\u4e00-\u9fa5]+/g, (match) => {
      // 简单的中文到拼音映射，对于无法映射的保留原文
      return match
    })
    .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || name.replace(/\s+/g, '-').toLowerCase()
}

/**
 * 从 SKILL.md 内容解析 frontmatter 和 body
 */
export function parseSkillMd(content: string): {
  frontmatter: { name?: string; description?: string }
  body: string
} {
  const fmRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/
  const match = content.match(fmRegex)
  if (!match) {
    return { frontmatter: {}, body: content }
  }

  const fmStr = match[1]
  const body = match[2].trimStart()
  const frontmatter: Record<string, string> = {}

  for (const line of fmStr.split('\n')) {
    const idx = line.indexOf(':')
    if (idx > 0) {
      const key = line.slice(0, idx).trim()
      const value = line.slice(idx + 1).trim()
      frontmatter[key] = value
    }
  }

  return { frontmatter, body }
}

/**
 * 生成导出文件夹所需的文件列表
 */
export function generateExportFiles(skill: {
  name: string
  description?: string
  template: string
  examples?: string[]
  tags?: string[]
  category?: string
}): Array<{ filename: string; content: string }> {
  const files: Array<{ filename: string; content: string }> = []

  // 主文件 SKILL.md
  files.push({
    filename: 'SKILL.md',
    content: generateSkillMd(skill),
  })

  // 如果有示例，生成 examples.md
  if (skill.examples && skill.examples.length > 0) {
    const examplesContent = [
      `# ${skill.name} - Examples`,
      '',
      ...skill.examples.map((ex, i) => `${i + 1}. ${ex}`),
      '',
    ].join('\n')
    files.push({
      filename: 'examples.md',
      content: examplesContent,
    })
  }

  return files
}

export const agentSkillTemplates: AgentSkillTemplate[] = [
  {
    name: 'Code Review',
    description: 'Review code for quality, security, and maintainability following team standards. Use when reviewing pull requests, examining code changes, or when the user asks for a code review.',
    category: '代码质量',
    template: `# Code Review

## Quick Start

When reviewing code:

1. Check for correctness and potential bugs
2. Verify security best practices
3. Assess code readability and maintainability
4. Ensure tests are adequate

## Review Checklist

- [ ] Logic is correct and handles edge cases
- [ ] No security vulnerabilities (SQL injection, XSS, etc.)
- [ ] Code follows project style conventions
- [ ] Functions are appropriately sized and focused
- [ ] Error handling is comprehensive
- [ ] Tests cover the changes

## Providing Feedback

Format feedback as:
- **Critical**: Must fix before merge
- **Suggestion**: Consider improving
- **Nice to have**: Optional enhancement

## Review Dimensions

### Code Quality
- Readability and naming conventions
- Code structure and organization
- DRY / SOLID principles

### Security
- Input validation
- Authentication / Authorization
- Data sanitization

### Performance
- Unnecessary loops or re-renders
- Memory leaks
- N+1 queries

## Additional Resources

- For detailed coding standards, see [reference.md](reference.md)
- For example reviews, see [examples.md](examples.md)`,
    examples: [
      'Review this pull request for potential issues',
      'Check this function for security vulnerabilities',
      'Evaluate code quality and suggest improvements',
    ],
    tags: ['code-review', 'quality', 'security', 'best-practices'],
  },
  {
    name: 'Git Commit Message',
    description: 'Generate descriptive commit messages by analyzing git diffs following Conventional Commits specification. Use when the user asks for help writing commit messages or reviewing staged changes.',
    category: '开发工作流',
    template: `# Git Commit Message Generator

## Commit Format

Use Conventional Commits:

\`\`\`
<type>(<scope>): <subject>

<body>

<footer>
\`\`\`

## Types

| Type | Description |
|------|-------------|
| feat | New feature |
| fix | Bug fix |
| docs | Documentation changes |
| style | Formatting (no logic change) |
| refactor | Code restructuring |
| perf | Performance improvement |
| test | Adding/modifying tests |
| build | Build system or dependencies |
| ci | CI configuration |
| chore | Miscellaneous |

## Rules

1. Subject line: imperative mood, max 50 chars
2. Body: explain **what** and **why**, not how
3. Footer: reference issues, note breaking changes

## Examples

**Example 1:**
\`\`\`
feat(auth): add JWT-based authentication

Implement login endpoint and token validation middleware.
Sessions are stored in Redis with 24h TTL.

Closes #142
\`\`\`

**Example 2:**
\`\`\`
fix(reports): correct date formatting in timezone conversion

Use UTC timestamps consistently across report generation
to prevent off-by-one day errors for users in negative UTC offsets.

Fixes #287
\`\`\``,
    examples: [
      'Generate a commit message for my staged changes',
      'Write a conventional commit for this feature',
      'Review and improve this commit message',
    ],
    tags: ['git', 'commit', 'conventional-commits', 'workflow'],
  },
  {
    name: 'Unit Test Generator',
    description: 'Generate comprehensive unit tests for code with proper coverage of happy paths, edge cases, and error scenarios. Use when the user needs tests written for their code or asks about testing strategies.',
    category: '测试',
    template: `# Unit Test Generator

## Test Strategy

For each function/module, cover:

1. **Happy path** - Standard usage scenarios
2. **Edge cases** - Empty values, zero, min/max, empty arrays
3. **Error cases** - Invalid input, network errors, timeouts
4. **Type checks** - Type mismatches (if applicable)

## Test Template (Jest/Vitest)

\`\`\`typescript
describe('ModuleName', () => {
  describe('methodName', () => {
    it('should [expected behavior] when [condition]', () => {
      // Arrange
      // Act
      // Assert
    });

    it('should throw when [error condition]', () => {
      // ...
    });
  });
});
\`\`\`

## Guidelines

- One assertion per test (prefer)
- Descriptive test names
- Use mocks to isolate external dependencies
- Coverage target > 80%
- Always test boundary conditions
- Use \`beforeEach\` / \`afterEach\` for setup/teardown

## Mocking Pattern

\`\`\`typescript
// Mock external dependency
vi.mock('./api', () => ({
  fetchData: vi.fn(),
}));

// In test
const mockFetch = vi.mocked(fetchData);
mockFetch.mockResolvedValueOnce({ data: 'test' });
\`\`\``,
    examples: [
      'Generate unit tests for this utility function',
      'Write tests covering edge cases for this class',
      'Create a test suite for this API handler',
    ],
    tags: ['testing', 'unit-test', 'jest', 'vitest', 'TDD'],
  },
  {
    name: 'API Documentation',
    description: 'Generate clear and complete API documentation for RESTful endpoints including request/response schemas, error codes, and usage examples. Use when documenting APIs or when the user asks for API docs.',
    category: '文档',
    template: `# API Documentation Generator

## Document Structure

### Endpoint Entry

For each endpoint, document:

\`\`\`markdown
### [METHOD] /api/path

**Description:** What this endpoint does

**Authentication:** Required / Optional / None

**Request Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| param | type | Y/N | description |

**Request Body:**
\\\`\\\`\\\`json
{
  "field": "value"
}
\\\`\\\`\\\`

**Response (200):**
\\\`\\\`\\\`json
{
  "code": 200,
  "data": {},
  "message": "success"
}
\\\`\\\`\\\`

**Error Codes:**
| Code | Message | Resolution |
|------|---------|------------|
| 400 | Bad Request | Check parameters |
| 401 | Unauthorized | Provide valid token |
\`\`\`

## Best Practices

- Include curl examples for each endpoint
- Document rate limits and pagination
- Show both success and error responses
- Note any deprecation warnings`,
    examples: [
      'Generate API docs for this Express router',
      'Document this REST API with OpenAPI spec',
      'Create endpoint documentation with examples',
    ],
    tags: ['api', 'documentation', 'rest', 'openapi'],
  },
  {
    name: 'Dockerfile Generator',
    description: 'Generate optimized Dockerfiles and docker-compose configurations with multi-stage builds, security best practices, and production-ready settings. Use when containerizing applications or setting up Docker environments.',
    category: 'DevOps',
    template: `# Dockerfile Generator

## Multi-stage Build Template

\`\`\`dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# Runtime stage
FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s CMD curl -f http://localhost:3000/health || exit 1
CMD ["node", "dist/main.js"]
\`\`\`

## Optimization Checklist

- [ ] Use alpine base images
- [ ] Leverage layer caching (copy package.json first)
- [ ] Run as non-root user
- [ ] Add health checks
- [ ] Create .dockerignore
- [ ] Minimize layers

## docker-compose Template

\`\`\`yaml
services:
  app:
    build: .
    ports: ["3000:3000"]
    environment:
      - NODE_ENV=production
    depends_on:
      db: { condition: service_healthy }
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
  db:
    image: postgres:16-alpine
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
volumes:
  pgdata:
\`\`\``,
    examples: [
      'Create a Dockerfile for a Node.js project',
      'Set up docker-compose with app + database + redis',
      'Optimize Docker image size for Python app',
    ],
    tags: ['docker', 'devops', 'containerization', 'deployment'],
  },
  {
    name: 'Database Migration',
    description: 'Generate safe database migration scripts with up/down migrations, idempotency checks, and rollback plans. Use when making schema changes, adding columns, creating indexes, or migrating data.',
    category: '数据库',
    template: `# Database Migration Assistant

## Pre-Migration Checklist

- [ ] Backup current database
- [ ] Confirm scope of changes
- [ ] Test in staging environment
- [ ] Plan rollback strategy

## Migration Requirements

1. **Idempotent** - Safe to run multiple times
2. **Reversible** - Provide UP and DOWN migrations
3. **Data-safe** - Never lose existing data
4. **Performant** - Use online DDL for large tables

## Migration Template

\`\`\`sql
-- Migration: [description]
-- Created: [date]

-- UP
BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_phone ON users(phone);

COMMIT;

-- DOWN
BEGIN;

DROP INDEX IF EXISTS idx_users_phone;
ALTER TABLE users DROP COLUMN IF EXISTS phone;

COMMIT;
\`\`\`

## Common Operations

| Operation | Consideration |
|-----------|--------------|
| Add column | Use IF NOT EXISTS, set default |
| Drop column | Backup data first, use IF EXISTS |
| Add index | Use CONCURRENTLY to avoid locks |
| Modify type | May require data migration |
| Partition table | Plan data redistribution |`,
    examples: [
      'Add phone number column to users table',
      'Partition large table by date range',
      'Migrate from MySQL to PostgreSQL',
    ],
    tags: ['database', 'migration', 'sql', 'schema'],
  },
  {
    name: 'Error Handling Pattern',
    description: 'Design unified error handling patterns for applications covering error classification, structured responses, and recovery strategies. Use when setting up error handling architecture or debugging error flows.',
    category: '架构模式',
    template: `# Error Handling Pattern

## Design Principles

1. **Unified format** - All errors use consistent structure
2. **Layered handling** - Each layer has appropriate strategy
3. **User-friendly** - Clear, actionable messages for users
4. **Traceable** - Every error traceable to source

## Error Classification

| Category | Examples | HTTP Status |
|----------|----------|-------------|
| ValidationError | Invalid input, missing fields | 400 |
| AuthError | Expired token, insufficient permissions | 401/403 |
| NotFoundError | Resource doesn't exist | 404 |
| ConflictError | Duplicate entry, version mismatch | 409 |
| SystemError | DB connection, third-party failure | 500 |

## Backend Error Response

\`\`\`typescript
interface ErrorResponse {
  code: string;          // Machine-readable code
  message: string;       // Human-readable message
  details?: unknown;     // Additional context
  requestId: string;     // For tracing
}
\`\`\`

## Frontend Error Boundary

\`\`\`typescript
// Global error boundary
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, info);
  }
}

// API error interceptor
async function apiCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error.status === 401) redirectToLogin();
    throw new AppError(error.message, error.code);
  }
}
\`\`\``,
    examples: [
      'Design unified error responses for REST API',
      'Implement React global error handling',
      'Set up error propagation between microservices',
    ],
    tags: ['error-handling', 'architecture', 'robustness', 'best-practices'],
  },
  {
    name: 'Performance Optimization',
    description: 'Frontend and backend performance optimization guide covering Core Web Vitals, database tuning, caching strategies, and React optimization patterns. Use when optimizing application performance or analyzing bottlenecks.',
    category: '性能',
    template: `# Performance Optimization Checklist

## Frontend - Core Web Vitals

### LCP (< 2.5s) - Largest Contentful Paint
- Lazy load below-fold images
- Use CDN for static assets
- Server-side render critical content
- Preload key resources

### FID (< 100ms) - First Input Delay
- Code splitting with dynamic imports
- Offload heavy tasks to Web Workers
- Break up long tasks (< 50ms each)

### CLS (< 0.1) - Cumulative Layout Shift
- Set explicit dimensions on images/videos
- Avoid dynamically injected content above fold
- Use CSS containment

## React Optimization

\`\`\`typescript
// Memoize expensive components
const MemoComponent = React.memo(Component);

// Cache computed values
const value = useMemo(() => expensiveCalc(a, b), [a, b]);

// Stabilize callbacks
const handler = useCallback(() => fn(id), [id]);

// Virtual scrolling for large lists
<VirtualList items={items} height={400} itemSize={50} />
\`\`\`

## Backend Optimization

### Database
- Analyze slow queries (EXPLAIN ANALYZE)
- Optimize indexes
- Connection pooling
- Read replicas

### Caching Strategy
- L1: In-memory cache (LRU)
- L2: Redis distributed cache
- Cache warming on deploy
- Guard against stampede/penetration/avalanche

### API
- Response compression (gzip/brotli)
- Pagination and rate limiting
- Batch endpoints
- GraphQL for selective fetching`,
    examples: [
      'Optimize React app first contentful paint',
      'Analyze and optimize slow SQL queries',
      'Design multi-level caching strategy',
    ],
    tags: ['performance', 'optimization', 'web-vitals', 'caching'],
  },
]
