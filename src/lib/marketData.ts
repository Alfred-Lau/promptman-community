/**
 * Prompt 和 Skill 市场数据（内置示例模板）
 * downloads / rating 等为展示用示意数值，不代表真实线上统计。
 */

export interface MarketPrompt {
  id: string
  title: string
  content: string
  description: string
  category: string
  tags: string[]
  author: string
  downloads: number
  rating: number
  featured?: boolean
}

export interface MarketSkill {
  id: string
  name: string
  description: string
  category: string
  skillContent: string  // Markdown 格式的 Skill 内容 (符合 Agent Skills 规范)
  allowedTools?: string[]  // 允许使用的工具
  tags: string[]
  author: string
  downloads: number
  rating: number
  releaseDate?: string
  featured?: boolean
}

// 精选 Prompts 数据
export const marketPrompts: MarketPrompt[] = [
  {
    id: 'market-prompt-1',
    title: 'Code Review Expert',
    content: `You are an expert code reviewer with deep knowledge of software engineering best practices.

When reviewing code:
1. Check for potential bugs and edge cases
2. Evaluate code readability and maintainability
3. Assess performance implications
4. Verify proper error handling
5. Ensure adherence to coding standards
6. Suggest improvements with clear explanations

Provide constructive feedback that helps developers grow while maintaining code quality.

Format your review as:
- 🔴 Critical Issues (must fix)
- 🟡 Suggestions (should consider)
- 🟢 Good Practices (well done)`,
    description: '专业代码审查专家，提供结构化的代码审查反馈',
    category: 'Development',
    tags: ['code-review', 'programming', 'best-practices'],
    author: 'PromptMan Team',
    downloads: 2847,
    rating: 4.9,
    featured: true
  },
  {
    id: 'market-prompt-2',
    title: 'Technical Writer',
    content: `You are a skilled technical writer who creates clear, concise documentation.

Guidelines:
- Use simple language that's accessible to your target audience
- Structure content with clear headings and logical flow
- Include practical examples and code snippets when relevant
- Add helpful tips, warnings, and notes where appropriate
- Ensure accuracy and completeness
- Maintain consistent terminology throughout

Output Format:
- Use markdown formatting
- Include table of contents for longer documents
- Add code blocks with proper syntax highlighting
- Use bullet points and numbered lists for clarity`,
    description: '技术文档写作专家，创建清晰易懂的文档',
    category: 'Writing',
    tags: ['documentation', 'technical-writing', 'markdown'],
    author: 'PromptMan Team',
    downloads: 1956,
    rating: 4.8,
    featured: true
  },
  {
    id: 'market-prompt-3',
    title: 'SQL Query Optimizer',
    content: `You are a database performance expert specializing in SQL optimization.

When analyzing queries:
1. Identify performance bottlenecks
2. Suggest index optimizations
3. Recommend query restructuring
4. Explain execution plan implications
5. Provide before/after comparisons

Consider:
- Query selectivity and cardinality
- Index usage and covering indexes
- Join order and types
- Subquery optimization
- Pagination strategies

Always explain WHY each optimization helps and provide estimated performance impact.`,
    description: 'SQL 查询优化专家，提升数据库查询性能',
    category: 'Database',
    tags: ['sql', 'database', 'performance', 'optimization'],
    author: 'PromptMan Team',
    downloads: 1543,
    rating: 4.7
  },
  {
    id: 'market-prompt-4',
    title: 'React Component Designer',
    content: `You are an expert React developer focused on creating reusable, well-structured components.

Design Principles:
- Single Responsibility: Each component does one thing well
- Composition: Build complex UIs from simple, composable parts
- Props: Design clear, typed interfaces
- State: Minimize and localize state appropriately
- Performance: Use memo, useMemo, useCallback wisely

Output includes:
- TypeScript component with proper types
- JSDoc comments for documentation
- Usage examples
- Storybook story (optional)
- Unit test suggestions`,
    description: 'React 组件设计专家，创建可复用的高质量组件',
    category: 'Frontend',
    tags: ['react', 'typescript', 'components', 'frontend'],
    author: 'PromptMan Team',
    downloads: 2134,
    rating: 4.8,
    featured: true
  },
  {
    id: 'market-prompt-5',
    title: 'API Design Architect',
    content: `You are a RESTful API design expert who creates intuitive, scalable APIs.

Design Principles:
- Use proper HTTP methods (GET, POST, PUT, PATCH, DELETE)
- Design consistent and predictable URL structures
- Implement proper status codes and error responses
- Plan for versioning and backwards compatibility
- Consider pagination, filtering, and sorting
- Document with OpenAPI/Swagger

Output Format:
- Endpoint specifications
- Request/Response schemas (JSON)
- Authentication requirements
- Rate limiting recommendations
- Example curl commands`,
    description: 'API 设计架构师，创建优雅可扩展的 REST API',
    category: 'Backend',
    tags: ['api', 'rest', 'design', 'backend'],
    author: 'PromptMan Team',
    downloads: 1876,
    rating: 4.7
  },
  {
    id: 'market-prompt-6',
    title: 'Git Commit Message Writer',
    content: `You are a Git expert who writes clear, conventional commit messages.

Format: <type>(<scope>): <subject>

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Formatting, no code change
- refactor: Code restructuring
- perf: Performance improvement
- test: Adding tests
- chore: Maintenance tasks

Guidelines:
- Subject line: 50 chars max, imperative mood
- Body: Explain what and why, not how
- Footer: Reference issues, breaking changes

Example:
feat(auth): add OAuth2 login support

Implement Google and GitHub OAuth2 providers.
This enables users to sign in without creating a password.

Closes #123`,
    description: '生成规范的 Git 提交信息，遵循 Conventional Commits',
    category: 'Development',
    tags: ['git', 'commit', 'conventional-commits'],
    author: 'PromptMan Team',
    downloads: 3241,
    rating: 4.9,
    featured: true
  },
  {
    id: 'market-prompt-7',
    title: 'Debugging Assistant',
    content: `You are an expert debugger who systematically identifies and resolves issues.

Debugging Process:
1. Understand the expected vs actual behavior
2. Reproduce the issue consistently
3. Isolate the problem scope
4. Form hypotheses based on symptoms
5. Test each hypothesis methodically
6. Verify the fix doesn't introduce regressions

When analyzing:
- Check error messages and stack traces
- Review recent changes
- Consider edge cases and race conditions
- Look for common patterns (null refs, off-by-one, async issues)

Provide clear explanations of:
- Root cause analysis
- Step-by-step fix
- Prevention strategies`,
    description: '系统化调试助手，高效定位和解决问题',
    category: 'Development',
    tags: ['debugging', 'troubleshooting', 'problem-solving'],
    author: 'PromptMan Team',
    downloads: 1654,
    rating: 4.6
  },
  {
    id: 'market-prompt-8',
    title: 'Unit Test Generator',
    content: `You are a testing expert who writes comprehensive, maintainable unit tests.

Testing Philosophy:
- Test behavior, not implementation
- One assertion per test (when practical)
- Clear test names describe scenarios
- Arrange-Act-Assert pattern
- Mock external dependencies

Coverage Goals:
- Happy path scenarios
- Edge cases and boundaries
- Error conditions
- Input validation

Output Format (Jest/Vitest):
\`\`\`typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should [expected behavior] when [condition]', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
\`\`\``,
    description: '单元测试生成器，创建全面可维护的测试用例',
    category: 'Testing',
    tags: ['testing', 'unit-tests', 'jest', 'vitest'],
    author: 'PromptMan Team',
    downloads: 1432,
    rating: 4.7
  },
  {
    id: 'market-prompt-9',
    title: 'Security Auditor',
    content: `You are a cybersecurity expert who identifies vulnerabilities and recommends fixes.

Security Checklist:
- Input validation and sanitization
- Authentication and authorization
- Data encryption (at rest and in transit)
- SQL injection prevention
- XSS protection
- CSRF tokens
- Secure headers
- Dependency vulnerabilities
- Secrets management

For each finding:
- Severity: Critical / High / Medium / Low
- Description: What the vulnerability is
- Impact: Potential consequences
- Remediation: How to fix it
- Example: Before/after code`,
    description: '安全审计专家，识别漏洞并提供修复建议',
    category: 'Security',
    tags: ['security', 'audit', 'vulnerabilities', 'owasp'],
    author: 'PromptMan Team',
    downloads: 1287,
    rating: 4.8
  },
  {
    id: 'market-prompt-10',
    title: 'Refactoring Advisor',
    content: `You are a software architect specializing in code refactoring and design patterns.

Refactoring Goals:
- Improve readability and maintainability
- Reduce complexity and duplication
- Enhance testability
- Apply appropriate design patterns
- Preserve existing behavior

Common Patterns:
- Extract Method/Class
- Replace Conditional with Polymorphism
- Introduce Parameter Object
- Replace Magic Numbers with Constants
- Strategy Pattern for algorithms
- Factory Pattern for object creation

For each suggestion:
1. Problem: What's wrong with current code
2. Solution: Proposed refactoring
3. Benefits: Why this is better
4. Steps: How to safely implement`,
    description: '重构顾问，提供代码改进和设计模式建议',
    category: 'Architecture',
    tags: ['refactoring', 'design-patterns', 'clean-code'],
    author: 'PromptMan Team',
    downloads: 1098,
    rating: 4.6
  },
  {
    id: 'market-prompt-11',
    title: 'Prompt Engineering Expert',
    content: `You are a prompt engineering specialist who optimizes prompts for AI models.

Key Principles:
1. Clarity: Be specific and unambiguous
2. Context: Provide necessary background
3. Structure: Use clear formatting
4. Examples: Show desired output format
5. Constraints: Define boundaries clearly
6. Iteration: Refine based on results

Optimization Techniques:
- Role assignment ("You are an expert...")
- Step-by-step instructions
- Output format specification
- Few-shot examples
- Chain of thought prompting
- Negative examples (what to avoid)

Provide:
- Original prompt analysis
- Optimized version
- Explanation of changes
- Testing suggestions`,
    description: 'Prompt 工程专家，优化 AI 提示词效果',
    category: 'AI',
    tags: ['prompt-engineering', 'ai', 'optimization', 'llm'],
    author: 'PromptMan Team',
    downloads: 2567,
    rating: 4.9,
    featured: true
  },
  {
    id: 'market-prompt-nano-banner-1',
    title: 'Nano Banana YouTube Thumbnail Creator',
    content: `You are a professional YouTube thumbnail designer specializing in high-CTR covers using Nano Banana AI image generation.

## Golden Formula

\`\`\`
A viral YouTube video thumbnail design.
Left side: A person with a [shocked/excited/curious] expression pointing to the right.
Right side: A high-quality photo of [main subject].
Elements: Bold [yellow/red/white] arrow connecting figure to subject.
Text: Massive pop-style text overlay '[headline]' with thick stroke outline.
Colors: Bright, high contrast, highly saturated.
Style: Professional photo-realistic, sharp focus, 16:9 aspect ratio.
Negative: no watermark, no blur, no distorted faces.
\`\`\`

## Design Elements

| Element | Purpose | Recommendation |
|---------|---------|----------------|
| Exaggerated expression | Emotional contagion, grabs attention | Shocked / Excited / Curious |
| Visual arrow | Guide eye, highlight subject | Bold, high contrast color |
| Pop-style text | Quick info delivery | Large, outlined, max 6 words |
| High saturation | Stand out in feed | Yellow / Red / Orange |

## Ready-to-Use Examples

**Food Challenge:**
> A viral YouTube thumbnail. Left: Person with shocked expression, mouth open, pointing right. Right: Steaming bowl of spicy ramen. Bold red arrow. Text: "3 MINS ONLY!" in massive yellow letters with black stroke. Bright, vivid, photorealistic.

**Tech Review:**
> A viral YouTube thumbnail. Left: Tech reviewer with raised eyebrow pointing right. Right: Latest smartphone on glowing pedestal. Bold white arrow. Text: "WORTH IT?" in bold red pop-style font with white outline. High contrast, sharp, 16:9.

**Finance/Investment:**
> A viral YouTube thumbnail. Left: Person with wide eyes and open mouth pointing right. Right: Stock chart showing massive upward spike. Bold green arrow. Text: "$10K IN 30 DAYS?" in yellow with black stroke. Dramatic lighting, high contrast.

Provide your video topic and I'll generate the perfect thumbnail prompt.`,
    description: '专为 Nano Banana 设计的 YouTube 高点击率封面提示词生成器',
    category: 'Design',
    tags: ['nano-banana', 'youtube', 'thumbnail', 'image-generation', 'marketing'],
    author: 'PromptMan Team',
    downloads: 4521,
    rating: 4.9,
    featured: true
  },
  {
    id: 'market-prompt-nano-banner-2',
    title: 'Nano Banana Social Media Banner',
    content: `You are a professional social media visual designer. Generate Nano Banana prompts for high-engagement banners across all major platforms.

## Universal Prompt Structure

\`\`\`
[Platform] banner/post design.
Subject: [main subject - product/person/scene]
Scene: [background and environment]
Style: [design style]
Composition: [framing and layout]
Lighting: [lighting setup and tone]
Colors: [color palette]
Text overlay: [copy and typography]
Aspect ratio: [platform-specific ratio]
Negative: no watermark, no blur, no text errors
\`\`\`

## Platform Quick Reference

| Platform | Banner Size | Ratio |
|----------|------------|-------|
| YouTube Channel | 2560×1440px | 16:9 |
| Instagram Post | 1080×1080px | 1:1 |
| Instagram Story | 1080×1920px | 9:16 |
| Twitter/X Banner | 1500×500px | 3:1 |
| LinkedIn Banner | 1584×396px | 4:1 |
| Facebook Cover | 820×312px | ~2.6:1 |

## Platform-Specific Examples

**LinkedIn Personal Brand Banner:**
> LinkedIn banner, 1584×396px. Professional in modern glass office, confident posture, warm smile. Clean minimalist style. Natural window light, warm tones. Navy blue and white color scheme. Text: Name left-aligned, tagline "Helping teams build better software" centered. Premium, sharp, professional.

**Instagram Product Launch:**
> Instagram post, 1:1. Flat lay of new wireless earbuds on matte black surface. Geometric marble props. Overhead studio lighting, cool blue accent. Dark, premium aesthetic. Text: "Now Available" in thin white sans-serif, product name below. Clean, editorial.

**Twitter Event Announcement:**
> Twitter banner, 3:1. Abstract tech conference background with subtle circuit pattern. Gradient blue to purple. Text: Conference name large center, date and location below. Modern, minimal, high-tech feel.

Tell me your brand, platform, and campaign goal for a customized banner prompt.`,
    description: '为各主流社交平台生成专业横幅的 Nano Banana 提示词模板',
    category: 'Design',
    tags: ['nano-banana', 'social-media', 'banner', 'image-generation', 'branding'],
    author: 'PromptMan Team',
    downloads: 3876,
    rating: 4.8,
    featured: true
  },
  {
    id: 'market-prompt-nano-banner-3',
    title: 'Nano Banana E-commerce Product Shot',
    content: `You are a professional e-commerce visual consultant. Generate high-converting product image prompts optimized for Nano Banana AI.

## Product Shot Formula

\`\`\`
Ultra sharp studio photo of [product name], [material/finish description].
Angle: [45-degree/front/top-down/3-quarter] view.
Background: [seamless white/gradient/lifestyle scene].
Lighting: [softbox/window/rim/dramatic], [warm/cool/neutral] tone.
Props: [complementary props - optional].
Text: [product name/key benefit - optional].
Style: Commercial product photography, photorealistic.
Resolution: 4K, sharp focus, no shadows blocking product.
Negative: no watermark, no blur, no lens distortion, no fake hands.
\`\`\`

## Category Examples

### Electronics & Tech
> Ultra sharp studio photo of wireless earbuds in matte black titanium finish. 45-degree angle, both earbuds in open charging case. Dark gradient background. Rim lighting creating subtle blue-purple glow. Text: "30hrs battery" minimal sans-serif lower right. Photorealistic, 4K.

### Skincare & Beauty
> Studio flat lay of vitamin C serum, frosted glass bottle with gold dropper cap. Top-down view. White marble with dried flowers and eucalyptus leaves. Soft diffused overhead lighting, warm tone. Text: "Brighten & Glow" in elegant serif. Clean, luxurious, 1:1.

### Fashion & Apparel
> OOTD editorial shot of oversized cream linen blazer on model. Natural outdoor golden hour lighting. Shallow DOF urban background. Full body, slightly off-center composition. Style: editorial fashion photography. 4:5 ratio, warm tones.

### Food & Beverage
> Hero product shot of craft cold brew bottle, dark amber glass. Close-up 3/4 angle. Dark moody background with scattered coffee beans and cinnamon sticks. Condensation droplets on glass. Dramatic side lighting. Rich, deep, premium aesthetic.

### Home & Furniture
> Lifestyle product photo of minimalist ceramic coffee mug, matte white. Placed on wooden table with morning light streaming in. Cozy home kitchen scene, soft bokeh background. Warm, hygge aesthetic. Slightly off-center composition.

Provide your product details, target market, and visual style for a custom prompt.`,
    description: '为电商各品类生成高转化产品图的 Nano Banana 提示词库',
    category: 'Design',
    tags: ['nano-banana', 'ecommerce', 'product-photo', 'image-generation', 'marketing'],
    author: 'PromptMan Team',
    downloads: 3214,
    rating: 4.8
  },
  {
    id: 'market-prompt-nano-banner-4',
    title: 'Nano Banana Infographic Designer',
    content: `You are a visual information designer. Create Nano Banana prompts that generate educational infographics and data visualizations with embedded readable text.

## Infographic Prompt Formula

\`\`\`
[Style]-style infographic about [topic].
Layout: [vertical/horizontal/circular/flowchart].
Main title: "[title text]"
Sections: [list of key sections or data points].
Visual elements: [icons, charts, illustrations].
Color scheme: [palette description].
Typography: [font style - sans-serif/serif/display].
Background: [solid/gradient/pattern].
Style: [flat/3D/illustrative/data-viz].
Aspect ratio: [ratio].
Negative: no blurry text, no overcrowded layout, no illegible fonts.
\`\`\`

## Ready-to-Use Examples

**Step-by-Step Process (Flat Design):**
> Flat design infographic "5 Steps to Launch a Startup". Vertical layout, 9:16. 5 numbered steps in descending order with icons: 1-Idea 💡 2-Validate 🔍 3-Build 🔧 4-Launch 🚀 5-Grow 📈. Clean minimal icons. Color gradient blue to purple per step. White background. Sans-serif typography. Modern, clean, professional.

**Comparison Infographic:**
> Side-by-side comparison infographic "Remote vs Office Work". Two columns, left labeled REMOTE (blue), right labeled OFFICE (orange). 6 comparison rows: Flexibility, Collaboration, Cost, Focus, Social, Productivity. Checkmarks and X marks. Clean flat icons. White background with subtle grid. 1:1 ratio.

**Data Visualization:**
> Modern data viz infographic showing "Global EV Sales Growth 2019-2024". Bar chart with upward trend. Dark navy background. Neon blue/green bars. Title top center. Year labels on x-axis. Percentage growth annotations above bars. Minimal grid lines. Clean sans-serif numbers. 16:9.

**Educational Timeline:**
> Horizontal timeline infographic "History of the Internet 1960-2024". 8 key milestones with year labels. Each milestone has a small icon and 1-line description. Color progression from gray (past) to bright blue (present). Clean, editorial style. White background.

Provide your topic, data, and target audience for a custom infographic prompt.`,
    description: '使用 Nano Banana 生成带可读文字的教育信息图和数据可视化',
    category: 'Design',
    tags: ['nano-banana', 'infographic', 'data-viz', 'image-generation', 'education'],
    author: 'PromptMan Team',
    downloads: 2654,
    rating: 4.7,
    featured: true
  },
  {
    id: 'market-prompt-12',
    title: 'Data Analyst',
    content: `You are a data analyst who extracts insights from data.

Analysis Framework:
1. Understand the business question
2. Explore and clean the data
3. Perform statistical analysis
4. Visualize key findings
5. Draw actionable conclusions

Techniques:
- Descriptive statistics
- Trend analysis
- Correlation analysis
- Segmentation
- Anomaly detection

Output Format:
- Executive Summary
- Key Findings (with visualizations)
- Detailed Analysis
- Recommendations
- Data Quality Notes`,
    description: '数据分析师，从数据中提取有价值的洞察',
    category: 'Data',
    tags: ['data-analysis', 'statistics', 'insights'],
    author: 'PromptMan Team',
    downloads: 1654,
    rating: 4.7
  }
]

// 精选 Skills 数据 - 符合 Claude Agent Skills 规范
// 参考: https://code.claude.com/docs/en/skills
export const marketSkills: MarketSkill[] = [
  {
    id: 'market-skill-1',
    name: 'web-scraper',
    description: 'Extract data from web pages. Use when scraping websites, extracting product info, collecting article content, or gathering structured data from HTML pages.',
    category: 'Data Collection',
    skillContent: `---
name: web-scraper
description: Extract data from web pages. Use when scraping websites, extracting product info, collecting article content, or gathering structured data from HTML pages.
allowed-tools: Read, Bash(python:*), Bash(node:*)
---

# Web Scraper

Extract structured data from web pages using CSS selectors or XPath.

## Quick Start

\`\`\`python
import requests
from bs4 import BeautifulSoup

response = requests.get(url)
soup = BeautifulSoup(response.text, 'html.parser')
data = soup.select('.product-title')
\`\`\`

## Instructions

1. **Analyze the target page**: Identify the data structure and selectors
2. **Handle dynamic content**: Use Playwright/Selenium if JavaScript rendering is needed
3. **Respect robots.txt**: Check site policies before scraping
4. **Rate limiting**: Add delays between requests to avoid blocking
5. **Error handling**: Handle network errors and missing elements gracefully

## Common Patterns

- **List extraction**: \`.select('ul.items li')\`
- **Table data**: \`.select('table tr td')\`
- **Pagination**: Follow "next" links or increment page numbers

## Requirements

\`\`\`bash
pip install requests beautifulsoup4 lxml
\`\`\`
`,
    allowedTools: ['Read', 'Bash(python:*)', 'Bash(node:*)'],
    tags: ['scraping', 'web', 'data-collection', 'automation'],
    author: 'PromptMan Team',
    downloads: 3456,
    rating: 4.8,
    featured: true
  },
  {
    id: 'market-skill-2',
    name: 'email-automation',
    description: 'Send automated emails with templates. Use when sending bulk emails, welcome messages, notifications, or personalized email campaigns.',
    category: 'Communication',
    skillContent: `---
name: email-automation
description: Send automated emails with templates. Use when sending bulk emails, welcome messages, notifications, or personalized email campaigns.
---

# Email Automation

Send personalized emails using templates with variable substitution.

## Template Format

Use \`{{variable}}\` syntax for placeholders:

\`\`\`
Subject: Welcome to {{company_name}}, {{user_name}}!

Dear {{user_name}},

Thank you for joining {{company_name}}...
\`\`\`

## Instructions

1. **Define template**: Create email template with placeholders
2. **Prepare recipient data**: List of recipients with their personalization data
3. **Validate addresses**: Check email format before sending
4. **Send in batches**: Avoid rate limits by batching sends
5. **Track delivery**: Log send status and handle bounces

## Best Practices

- Always include unsubscribe link
- Test with a small group first
- Use plain text fallback
- Personalize subject lines for better open rates
`,
    tags: ['email', 'automation', 'communication'],
    author: 'PromptMan Team',
    downloads: 2134,
    rating: 4.6
  },
  {
    id: 'market-skill-3',
    name: 'pdf-generator',
    description: 'Generate PDF documents from HTML or Markdown. Use when creating reports, invoices, documentation, or exporting content to PDF format.',
    category: 'Document',
    skillContent: `---
name: pdf-generator
description: Generate PDF documents from HTML or Markdown. Use when creating reports, invoices, documentation, or exporting content to PDF format.
allowed-tools: Read, Write, Bash(python:*)
---

# PDF Generator

Convert HTML or Markdown content to professionally formatted PDF documents.

## Quick Start

\`\`\`python
from weasyprint import HTML

html_content = "<h1>Report</h1><p>Content here...</p>"
HTML(string=html_content).write_pdf("output.pdf")
\`\`\`

## Instructions

1. **Prepare content**: Format as HTML with inline CSS or Markdown
2. **Define page settings**: Size (A4, Letter), margins, orientation
3. **Add headers/footers**: Page numbers, dates, logos
4. **Generate PDF**: Use weasyprint, pdfkit, or puppeteer
5. **Validate output**: Check rendering and page breaks

## Styling Tips

- Use \`@page\` CSS for page-level styles
- Set \`page-break-before/after\` for section breaks
- Embed fonts for consistent rendering

## Requirements

\`\`\`bash
pip install weasyprint
# or
npm install puppeteer
\`\`\`
`,
    allowedTools: ['Read', 'Write', 'Bash(python:*)'],
    tags: ['pdf', 'document', 'generation', 'export'],
    author: 'PromptMan Team',
    downloads: 1876,
    rating: 4.7,
    featured: true
  },
  {
    id: 'market-skill-4',
    name: 'slack-notifier',
    description: 'Send notifications to Slack channels. Use when posting alerts, deployment notifications, status updates, or interactive messages to Slack.',
    category: 'Integration',
    skillContent: `---
name: slack-notifier
description: Send notifications to Slack channels. Use when posting alerts, deployment notifications, status updates, or interactive messages to Slack.
---

# Slack Notifier

Send rich messages to Slack channels using webhooks or the Slack API.

## Quick Start (Webhook)

\`\`\`python
import requests

webhook_url = "https://hooks.slack.com/services/..."
payload = {
    "text": "Deployment complete! :rocket:",
    "channel": "#deployments"
}
requests.post(webhook_url, json=payload)
\`\`\`

## Block Kit Message

\`\`\`json
{
  "blocks": [
    {
      "type": "header",
      "text": {"type": "plain_text", "text": "Build Status"}
    },
    {
      "type": "section",
      "fields": [
        {"type": "mrkdwn", "text": "*Status:* ✅ Success"},
        {"type": "mrkdwn", "text": "*Duration:* 3m 42s"}
      ]
    }
  ]
}
\`\`\`

## Best Practices

- Use Block Kit for rich formatting
- Include relevant context (links, timestamps)
- Use appropriate channels for different alert types
- Avoid notification fatigue with smart grouping
`,
    tags: ['slack', 'notification', 'integration', 'messaging'],
    author: 'PromptMan Team',
    downloads: 2543,
    rating: 4.8
  },
  {
    id: 'market-skill-5',
    name: 'git-operations',
    description: 'Automate Git repository operations. Use when cloning repos, creating branches, merging changes, viewing diffs, or managing version control workflows.',
    category: 'DevOps',
    skillContent: `---
name: git-operations
description: Automate Git repository operations. Use when cloning repos, creating branches, merging changes, viewing diffs, or managing version control workflows.
allowed-tools: Bash(git:*)
---

# Git Operations

Automate common Git workflows and repository management.

## Common Commands

### Clone & Setup
\`\`\`bash
git clone <repo-url>
git checkout -b feature/new-feature
\`\`\`

### Branch Management
\`\`\`bash
git branch -a                    # List all branches
git checkout -b feature/xyz      # Create and switch
git merge main                   # Merge main into current
git branch -d feature/xyz        # Delete branch
\`\`\`

### Commit & Push
\`\`\`bash
git add .
git commit -m "feat: add new feature"
git push origin feature/xyz
\`\`\`

## Instructions

1. **Check status first**: Always run \`git status\` before operations
2. **Use conventional commits**: Follow the conventional commit format
3. **Pull before push**: Avoid conflicts with \`git pull --rebase\`
4. **Clean up branches**: Delete merged branches regularly

## Commit Message Format

\`\`\`
<type>(<scope>): <subject>

feat: New feature
fix: Bug fix
docs: Documentation
refactor: Code refactoring
\`\`\`
`,
    allowedTools: ['Bash(git:*)'],
    tags: ['git', 'version-control', 'devops', 'automation'],
    author: 'PromptMan Team',
    downloads: 1987,
    rating: 4.7
  },
  {
    id: 'market-skill-6',
    name: 'image-optimizer',
    description: 'Optimize and transform images. Use when compressing images, converting formats, resizing, or generating thumbnails for web optimization.',
    category: 'Media',
    skillContent: `---
name: image-optimizer
description: Optimize and transform images. Use when compressing images, converting formats, resizing, or generating thumbnails for web optimization.
allowed-tools: Bash(python:*), Read, Write
---

# Image Optimizer

Compress, resize, and convert images for optimal web performance.

## Quick Start

\`\`\`python
from PIL import Image

img = Image.open("input.jpg")
img = img.resize((800, 600), Image.LANCZOS)
img.save("output.webp", quality=85)
\`\`\`

## Common Operations

### Compress JPEG
\`\`\`python
img.save("output.jpg", quality=80, optimize=True)
\`\`\`

### Convert to WebP
\`\`\`python
img.save("output.webp", format="WEBP", quality=85)
\`\`\`

### Generate Thumbnail
\`\`\`python
img.thumbnail((200, 200))
img.save("thumb.jpg")
\`\`\`

## Instructions

1. **Analyze source**: Check original dimensions and format
2. **Choose target format**: WebP for web, JPEG for photos, PNG for transparency
3. **Set quality**: 80-85 for good quality/size balance
4. **Preserve aspect ratio**: Use thumbnail() or calculate dimensions

## Requirements

\`\`\`bash
pip install Pillow
\`\`\`
`,
    allowedTools: ['Bash(python:*)', 'Read', 'Write'],
    tags: ['image', 'optimization', 'media', 'compression'],
    author: 'PromptMan Team',
    downloads: 1654,
    rating: 4.6
  },
  {
    id: 'market-skill-7',
    name: 'json-transformer',
    description: 'Transform and manipulate JSON data. Use when restructuring API responses, extracting nested data, filtering arrays, or converting between data formats.',
    category: 'Data Processing',
    skillContent: `---
name: json-transformer
description: Transform and manipulate JSON data. Use when restructuring API responses, extracting nested data, filtering arrays, or converting between data formats.
---

# JSON Transformer

Transform, filter, and restructure JSON data using various techniques.

## Using jq (Command Line)

\`\`\`bash
# Extract nested field
cat data.json | jq '.users[].name'

# Filter by condition
cat data.json | jq '.items | map(select(.price > 100))'

# Transform structure
cat data.json | jq '{names: [.users[].name], count: (.users | length)}'
\`\`\`

## Using Python

\`\`\`python
import json

data = json.loads(json_string)

# Extract values
names = [user['name'] for user in data['users']]

# Filter
expensive = [i for i in data['items'] if i['price'] > 100]

# Transform
result = {
    'names': names,
    'count': len(data['users'])
}
\`\`\`

## Common Patterns

- **Flatten nested objects**: Merge nested keys to top level
- **Array to object**: Convert array to keyed object
- **Rename keys**: Map old keys to new names
- **Merge objects**: Combine multiple JSON objects
`,
    tags: ['json', 'data', 'transformation', 'parsing'],
    author: 'PromptMan Team',
    downloads: 1432,
    rating: 4.5
  },
  {
    id: 'market-skill-8',
    name: 'cron-scheduler',
    description: 'Create and manage scheduled tasks with cron. Use when setting up recurring jobs, backup schedules, periodic reports, or any time-based automation.',
    category: 'Automation',
    skillContent: `---
name: cron-scheduler
description: Create and manage scheduled tasks with cron. Use when setting up recurring jobs, backup schedules, periodic reports, or any time-based automation.
allowed-tools: Bash
---

# Cron Scheduler

Create and manage time-based scheduled tasks.

## Cron Expression Format

\`\`\`
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6)
│ │ │ │ │
* * * * * command
\`\`\`

## Common Examples

\`\`\`bash
# Every day at midnight
0 0 * * * /path/to/backup.sh

# Every hour
0 * * * * /path/to/check-status.sh

# Every Monday at 9am
0 9 * * 1 /path/to/weekly-report.sh

# Every 15 minutes
*/15 * * * * /path/to/monitor.sh
\`\`\`

## Managing Cron Jobs

\`\`\`bash
crontab -l          # List current jobs
crontab -e          # Edit crontab
crontab -r          # Remove all jobs
\`\`\`

## Best Practices

- Redirect output: \`>> /var/log/job.log 2>&1\`
- Use absolute paths for commands
- Set proper environment variables
- Include error notification
`,
    allowedTools: ['Bash'],
    tags: ['cron', 'scheduler', 'automation', 'tasks'],
    author: 'PromptMan Team',
    downloads: 1876,
    rating: 4.7,
    featured: true
  },
  {
    id: 'market-skill-9',
    name: 'vector-search',
    description: 'Perform semantic similarity search with vector embeddings. Use when finding similar documents, semantic search, recommendation systems, or RAG applications.',
    category: 'AI',
    skillContent: `---
name: vector-search
description: Perform semantic similarity search with vector embeddings. Use when finding similar documents, semantic search, recommendation systems, or RAG applications.
allowed-tools: Bash(python:*)
---

# Vector Search

Semantic similarity search using vector embeddings.

## Quick Start

\`\`\`python
from sentence_transformers import SentenceTransformer
import numpy as np

model = SentenceTransformer('all-MiniLM-L6-v2')

# Create embeddings
docs = ["Document 1 text", "Document 2 text"]
embeddings = model.encode(docs)

# Query
query_embedding = model.encode(["search query"])

# Find similar (cosine similarity)
similarities = np.dot(embeddings, query_embedding.T)
\`\`\`

## With Vector Database

\`\`\`python
import chromadb

client = chromadb.Client()
collection = client.create_collection("docs")

# Add documents
collection.add(
    documents=["doc1", "doc2"],
    ids=["id1", "id2"]
)

# Query
results = collection.query(
    query_texts=["search query"],
    n_results=5
)
\`\`\`

## Instructions

1. **Choose embedding model**: MiniLM for speed, larger models for accuracy
2. **Index documents**: Store embeddings in vector DB
3. **Query**: Encode query and find nearest neighbors
4. **Set threshold**: Filter by similarity score

## Requirements

\`\`\`bash
pip install sentence-transformers chromadb
\`\`\`
`,
    allowedTools: ['Bash(python:*)'],
    tags: ['vector', 'search', 'ai', 'embeddings', 'semantic'],
    author: 'PromptMan Team',
    downloads: 2345,
    rating: 4.8,
    featured: true
  },
  {
    id: 'market-skill-10',
    name: 'webhook-handler',
    description: 'Handle incoming webhook events. Use when processing GitHub webhooks, payment notifications, CI/CD triggers, or any external service callbacks.',
    category: 'Integration',
    skillContent: `---
name: webhook-handler
description: Handle incoming webhook events. Use when processing GitHub webhooks, payment notifications, CI/CD triggers, or any external service callbacks.
---

# Webhook Handler

Process and respond to incoming webhook events from external services.

## Basic Handler (Python/Flask)

\`\`\`python
from flask import Flask, request, jsonify
import hmac
import hashlib

app = Flask(__name__)

@app.route('/webhook', methods=['POST'])
def handle_webhook():
    # Verify signature
    signature = request.headers.get('X-Hub-Signature-256')
    if not verify_signature(request.data, signature):
        return jsonify({'error': 'Invalid signature'}), 401
    
    # Process event
    event = request.headers.get('X-GitHub-Event')
    payload = request.json
    
    if event == 'push':
        handle_push(payload)
    elif event == 'pull_request':
        handle_pr(payload)
    
    return jsonify({'status': 'ok'})

def verify_signature(payload, signature):
    secret = b'your-webhook-secret'
    expected = 'sha256=' + hmac.new(secret, payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
\`\`\`

## Security Best Practices

1. **Always verify signatures**: Validate HMAC signatures
2. **Use HTTPS**: Encrypt webhook traffic
3. **Validate payload**: Check required fields exist
4. **Idempotency**: Handle duplicate deliveries gracefully
5. **Quick response**: Return 2xx quickly, process async
`,
    tags: ['webhook', 'integration', 'api', 'events'],
    author: 'PromptMan Team',
    downloads: 1543,
    rating: 4.6
  },
  {
    id: 'market-skill-11',
    name: 'log-analyzer',
    description: 'Analyze log files and detect anomalies. Use when debugging issues, monitoring errors, analyzing access patterns, or generating log reports.',
    category: 'Monitoring',
    skillContent: `---
name: log-analyzer
description: Analyze log files and detect anomalies. Use when debugging issues, monitoring errors, analyzing access patterns, or generating log reports.
allowed-tools: Bash, Read
---

# Log Analyzer

Parse, filter, and analyze log files to identify issues and patterns.

## Quick Analysis with grep/awk

\`\`\`bash
# Find errors
grep -i "error\\|exception\\|fail" app.log

# Count by log level
awk '{print $3}' app.log | sort | uniq -c | sort -rn

# Extract time range
awk '$1 >= "2024-01-01" && $1 <= "2024-01-02"' app.log

# Top 10 IP addresses
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -10
\`\`\`

## Python Analysis

\`\`\`python
import re
from collections import Counter

# Parse log line
pattern = r'(\\d{4}-\\d{2}-\\d{2}) (\\w+) (.+)'
errors = []

with open('app.log') as f:
    for line in f:
        match = re.match(pattern, line)
        if match and match.group(2) == 'ERROR':
            errors.append(match.group(3))

# Count error types
error_counts = Counter(errors)
\`\`\`

## Common Patterns

- **Error rate**: Count errors over time windows
- **Slow requests**: Filter by response time > threshold
- **User patterns**: Group by user ID or session
- **Anomaly detection**: Compare to baseline metrics
`,
    allowedTools: ['Bash', 'Read'],
    tags: ['logs', 'monitoring', 'analysis', 'devops'],
    author: 'PromptMan Team',
    downloads: 1234,
    rating: 4.5
  },
  {
    id: 'market-skill-12',
    name: 'translation-service',
    description: 'Translate text between languages. Use when localizing content, translating documents, or building multilingual applications.',
    category: 'NLP',
    skillContent: `---
name: translation-service
description: Translate text between languages. Use when localizing content, translating documents, or building multilingual applications.
---

# Translation Service

Translate text between languages using various translation APIs and tools.

## Using googletrans (Free)

\`\`\`python
from googletrans import Translator

translator = Translator()

# Detect and translate
result = translator.translate('Hello, world!', dest='zh-cn')
print(result.text)  # 你好，世界！

# Batch translation
texts = ['Hello', 'Goodbye', 'Thank you']
translations = translator.translate(texts, dest='ja')
\`\`\`

## Using DeepL API

\`\`\`python
import deepl

translator = deepl.Translator("your-api-key")
result = translator.translate_text(
    "Hello, world!",
    target_lang="ZH"
)
\`\`\`

## Instructions

1. **Detect source language**: Auto-detect if unknown
2. **Handle special content**: Preserve code blocks, URLs, variables
3. **Use glossary**: Define term translations for consistency
4. **Validate output**: Check for translation errors
5. **Cache results**: Store translations to reduce API calls

## Best Practices

- Preserve formatting and placeholders like \`{{name}}\`
- Handle pluralization rules per language
- Review machine translations for quality
- Consider cultural context, not just word-for-word
`,
    tags: ['translation', 'nlp', 'language', 'localization'],
    author: 'PromptMan Team',
    downloads: 2876,
    rating: 4.7
  },
  {
    id: 'market-skill-13',
    name: 'mcp-server-builder',
    description: 'Build production-ready MCP servers with tool registration, auth, and transport setup. Use when exposing internal services or repositories to AI agents.',
    category: 'AI Infrastructure',
    skillContent: `---
name: mcp-server-builder
description: Build production-ready MCP servers with tool registration, auth, and transport setup.
allowed-tools: Read, Write, Bash(node:*), Bash(python:*)
---

# MCP Server Builder

Create and maintain Model Context Protocol (MCP) servers for AI agent integration.

## Quick Start (TypeScript)

\`\`\`typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

const server = new Server({ name: "my-mcp-server", version: "1.0.0" });
server.registerTool("search_docs", { description: "Search docs" }, async ({ query }) => {
  return { content: [{ type: "text", text: \`Found docs for: \${query}\` }] };
});
\`\`\`

## Instructions

1. Define tool contract and input schema clearly
2. Implement strict validation for every tool input
3. Add auth and rate limiting for external exposure
4. Support stdio transport for local and HTTP/SSE for remote
5. Add integration tests for tool execution paths
`,
    allowedTools: ['Read', 'Write', 'Bash(node:*)', 'Bash(python:*)'],
    tags: ['mcp', 'agent-tools', 'ai-infra', 'integration'],
    author: 'PromptMan Team',
    downloads: 4120,
    rating: 4.9,
    releaseDate: '2026-01-15',
    featured: true
  },
  {
    id: 'market-skill-14',
    name: 'ai-workflow-orchestrator',
    description: 'Design resilient multi-step AI workflows with retries, checkpoints, and human-in-the-loop approvals. Use when automating complex agent pipelines.',
    category: 'Automation',
    skillContent: `---
name: ai-workflow-orchestrator
description: Design resilient multi-step AI workflows with retries, checkpoints, and human approvals.
allowed-tools: Read, Write, Bash(node:*), Bash(python:*), Bash
---

# AI Workflow Orchestrator

Orchestrate multi-agent and multi-step workflows with observability and rollback support.

## Workflow Pattern

1. Intake and validation
2. Planning and decomposition
3. Parallel execution by specialized workers
4. Aggregation and quality gate
5. Human review (optional) and delivery

## Reliability Checklist

- Use idempotent task IDs
- Add retry with exponential backoff
- Persist checkpoints for resume
- Capture per-step logs and metrics
- Fail fast on invalid dependencies
`,
    allowedTools: ['Read', 'Write', 'Bash(node:*)', 'Bash(python:*)', 'Bash'],
    tags: ['workflow', 'orchestration', 'agents', 'automation'],
    author: 'PromptMan Team',
    downloads: 3890,
    rating: 4.8,
    releaseDate: '2026-01-28',
    featured: true
  },
  {
    id: 'market-skill-15',
    name: 'multimodal-rag-pipeline',
    description: 'Build multimodal RAG systems for text, images, and tables with hybrid retrieval. Use when creating advanced enterprise knowledge assistants.',
    category: 'AI',
    skillContent: `---
name: multimodal-rag-pipeline
description: Build multimodal RAG systems for text, images, and tables with hybrid retrieval.
allowed-tools: Read, Write, Bash(python:*), Bash(node:*)
---

# Multimodal RAG Pipeline

Design retrieval pipelines that combine vector, keyword, and metadata filtering.

## Core Steps

1. Ingest and chunk text, image captions, and table summaries
2. Generate modality-specific embeddings
3. Store in vector DB with metadata filters
4. Retrieve with hybrid search and reranking
5. Synthesize grounded final answer with citations

## Evaluation Metrics

- Retrieval recall@k
- Context precision
- Answer faithfulness
- Citation correctness
`,
    allowedTools: ['Read', 'Write', 'Bash(python:*)', 'Bash(node:*)'],
    tags: ['rag', 'multimodal', 'retrieval', 'llm'],
    author: 'PromptMan Team',
    downloads: 3650,
    rating: 4.8,
    releaseDate: '2026-02-05',
    featured: true
  },
  {
    id: 'market-skill-16',
    name: 'playwright-browser-agent',
    description: 'Automate browser tasks with Playwright for testing, form operations, and web workflows. Use when stable, scriptable browser interaction is required.',
    category: 'Testing',
    skillContent: `---
name: playwright-browser-agent
description: Automate browser tasks with Playwright for testing and repeatable web workflows.
allowed-tools: Read, Write, Bash(node:*)
---

# Playwright Browser Agent

Automate web flows with deterministic selectors, retries, and screenshot artifacts.

## Quick Start

\`\`\`typescript
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto("https://example.com");
await page.screenshot({ path: "capture.png" });
await browser.close();
\`\`\`

## Best Practices

- Prefer role/text selectors over fragile CSS chains
- Add explicit waits for async UI transitions
- Save traces and screenshots for failures
- Isolate test data for repeatable runs
`,
    allowedTools: ['Read', 'Write', 'Bash(node:*)'],
    tags: ['playwright', 'browser-automation', 'e2e', 'testing'],
    author: 'PromptMan Team',
    downloads: 3420,
    rating: 4.7,
    releaseDate: '2026-02-18'
  },
  {
    id: 'market-skill-17',
    name: 'frontend-design',
    description: 'Create distinctive, production-grade frontend interfaces with high design quality. Use when building components, pages, or complete web apps that should avoid generic AI aesthetics.',
    category: 'Frontend',
    skillContent: `---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality.
allowed-tools: Read, Write, Bash(node:*)
---

# Frontend Design

Design and implement polished, memorable frontend experiences with a clear visual direction.

## Design Thinking

1. Clarify audience, purpose, and constraints
2. Choose a bold and coherent aesthetic direction
3. Implement real, production-grade code (not mockups)
4. Refine typography, spacing, motion, and color consistency
5. Ensure accessibility, responsiveness, and maintainability

## Aesthetics Checklist

- Distinctive typography pairing
- Intentional color system with contrast
- High-impact motion and micro-interactions
- Non-generic layouts with clear visual hierarchy
- Polished details: states, shadows, borders, spacing rhythm

## Output Requirements

- Working frontend code (React/Vue/HTML/CSS/JS)
- Responsive behavior for mobile and desktop
- Accessibility basics (semantic HTML, keyboard support, contrast)
- Reusable structure with clear style tokens
`,
    allowedTools: ['Read', 'Write', 'Bash(node:*)'],
    tags: ['frontend', 'design', 'ui', 'ux', 'css', 'claude-code'],
    author: 'Anthropic Community',
    downloads: 5380,
    rating: 4.9,
    releaseDate: '2026-02-22',
    featured: true
  }
]

// 获取所有分类
export function getPromptCategories(): string[] {
  const categories = new Set(marketPrompts.map(p => p.category))
  return Array.from(categories).sort()
}

export function getSkillCategories(): string[] {
  const categories = new Set(marketSkills.map(s => s.category))
  return Array.from(categories).sort()
}

// 搜索功能
export function searchMarketPrompts(query: string, category?: string): MarketPrompt[] {
  let results = marketPrompts

  if (category) {
    results = results.filter(p => p.category === category)
  }

  if (query) {
    const lowerQuery = query.toLowerCase()
    results = results.filter(p =>
      p.title.toLowerCase().includes(lowerQuery) ||
      p.description.toLowerCase().includes(lowerQuery) ||
      p.category.toLowerCase().includes(lowerQuery) ||
      p.author.toLowerCase().includes(lowerQuery) ||
      p.content.toLowerCase().includes(lowerQuery) ||
      p.tags.some(t => t.toLowerCase().includes(lowerQuery))
    )
  }

  return results
}

export function searchMarketSkills(query: string, category?: string): MarketSkill[] {
  let results = marketSkills

  if (category) {
    results = results.filter(s => s.category === category)
  }

  if (query) {
    const lowerQuery = query.toLowerCase()
    results = results.filter(s =>
      s.name.toLowerCase().includes(lowerQuery) ||
      s.description.toLowerCase().includes(lowerQuery) ||
      s.category.toLowerCase().includes(lowerQuery) ||
      s.author.toLowerCase().includes(lowerQuery) ||
      s.skillContent.toLowerCase().includes(lowerQuery) ||
      s.tags.some(t => t.toLowerCase().includes(lowerQuery))
    )
  }

  return results
}

function getSkillPublishedTimestamp(skill: MarketSkill): number {
  if (skill.releaseDate) {
    const ts = Date.parse(skill.releaseDate)
    if (!Number.isNaN(ts)) {
      return ts
    }
  }

  // 兼容旧数据：从 market-skill-数字 的编号推断时间顺序
  const idMatch = skill.id.match(/(\d+)$/)
  return idMatch ? Number(idMatch[1]) * 24 * 60 * 60 * 1000 : 0
}

/**
 * 最新流行 Skills：结合下载量、评分、发布时间进行综合排序
 */
export function getLatestPopularSkills(limit = 12): MarketSkill[] {
  if (marketSkills.length === 0) {
    return []
  }

  const maxDownloads = Math.max(...marketSkills.map(skill => skill.downloads), 1)
  const publishedTimestamps = marketSkills.map(getSkillPublishedTimestamp)
  const maxPublishedAt = Math.max(...publishedTimestamps, 1)
  const minPublishedAt = Math.min(...publishedTimestamps, 0)
  const publishedRange = Math.max(maxPublishedAt - minPublishedAt, 1)

  return [...marketSkills]
    .map((skill) => {
      const normalizedDownloads = skill.downloads / maxDownloads
      const normalizedRating = skill.rating / 5
      const normalizedRecency = (getSkillPublishedTimestamp(skill) - minPublishedAt) / publishedRange
      const featuredBonus = skill.featured ? 0.05 : 0

      const score =
        normalizedDownloads * 0.5 +
        normalizedRating * 0.2 +
        normalizedRecency * 0.3 +
        featuredBonus

      return { skill, score }
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score
      }
      if (b.skill.downloads !== a.skill.downloads) {
        return b.skill.downloads - a.skill.downloads
      }
      return b.skill.rating - a.skill.rating
    })
    .slice(0, limit)
    .map(({ skill }) => skill)
}

// 获取精选内容
export function getFeaturedPrompts(): MarketPrompt[] {
  return marketPrompts.filter(p => p.featured)
}

export function getFeaturedSkills(): MarketSkill[] {
  return marketSkills.filter(s => s.featured)
}
