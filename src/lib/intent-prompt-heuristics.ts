export type Locale = 'zh' | 'en';

export type PromptCategoryKey = "code" | "writing" | "analysis" | "creative" | "other";

const CATEGORY_ACCENTS: Record<PromptCategoryKey, string> = {
  code: "#f59e0b",
  writing: "#6ee7f7",
  analysis: "#a78bfa",
  creative: "#34d399",
  other: "#f59e0b",
};

/** 新建提示词等场景：按内置分类给默认强调色，自定义分类用「其他」色 */
export function defaultAccentForCategory(category: string): string {
  const c = String(category || "other").trim() || "other";
  if (c in CATEGORY_ACCENTS) return CATEGORY_ACCENTS[c as PromptCategoryKey];
  return CATEGORY_ACCENTS.other;
}

/** Keyword groups: zh + en (lowercased for matching) */
const CATEGORY_SIGNALS: Record<Exclude<PromptCategoryKey, "other">, string[]> = {
  code: [
    "代码", "编程", "程序", "函数", "类", "接口", "api", "sql", "数据库", "调试", "bug", "报错",
    "重构", "部署", "git", "github", "前端", "后端", "react", "vue", "typescript", "python",
    "java", "golang", "rust", "单元测试", "lint", "review", "pr",
    "code", "program", "programming", "debug", "refactor", "deploy", "compile", "syntax",
    "algorithm", "leetcode", "npm", "docker", "kubernetes",
  ],
  writing: [
    "写", "撰写", "文档", "readme", "博客", "文章", "邮件", "信函", "文案", "翻译", "润色",
    "总结", "会议纪要", "白皮书", "手册", "教程", "说明",
    "write", "writing", "document", "documentation", "blog", "article", "email", "letter",
    "copy", "translate", "proofread", "draft", "readme", "newsletter",
  ],
  analysis: [
    "分析", "数据分析", "报表", "统计", "对比", "评估", "调研", "研究", "指标", "kpi", "归因",
    "审计", "复盘", "洞察", "预测", "建模",
    "analyze", "analysis", "analytics", "metrics", "dashboard", "report", "research",
    "evaluate", "comparison", "forecast", "insight", "audit",
  ],
  creative: [
    "创意", "头脑风暴", "点子", "故事", "小说", "诗歌", "标语", "广告", "营销", "品牌",
    "命名", "标题", "脚本", "分镜", "角色",
    "creative", "brainstorm", "idea", "story", "fiction", "poem", "slogan", "marketing",
    "brand", "naming", "headline", "campaign", "script",
  ],
};

const TAG_BY_SIGNAL: { re: RegExp; tag: string }[] = [
  { re: /代码审查|code\s*review|pr\s*review|pull\s*request/i, tag: "Review" },
  { re: /sql|数据库|database|query/i, tag: "SQL" },
  { re: /文档|documentation|readme|手册/i, tag: "Docs" },
  { re: /测试|test|jest|pytest/i, tag: "Quality" },
  { re: /调试|debug|报错|error|exception/i, tag: "Debug" },
  { re: /数据|data|analytics|指标/i, tag: "Data" },
  { re: /营销|marketing|广告|campaign/i, tag: "Marketing" },
  { re: /翻译|translate|localization/i, tag: "Technical" },
];

function scoreCategories(text: string): Record<PromptCategoryKey, number> {
  const t = text.toLowerCase();
  const scores: Record<PromptCategoryKey, number> = {
    code: 0,
    writing: 0,
    analysis: 0,
    creative: 0,
    other: 0,
  };
  (Object.keys(CATEGORY_SIGNALS) as Exclude<PromptCategoryKey, "other">[]).forEach((cat) => {
    for (const kw of CATEGORY_SIGNALS[cat]) {
      if (kw.length <= 2) {
        if (t.includes(kw.toLowerCase())) scores[cat] += 1;
      } else if (t.includes(kw.toLowerCase())) {
        scores[cat] += 2;
      }
    }
  });
  return scores;
}

export function inferPromptCategory(goal: string): PromptCategoryKey {
  const trimmed = goal.trim();
  if (!trimmed) return "other";
  const scores = scoreCategories(trimmed);
  let best: PromptCategoryKey = "other";
  let max = 0;
  (["code", "analysis", "writing", "creative"] as const).forEach((c) => {
    if (scores[c] > max) {
      max = scores[c];
      best = c;
    }
  });
  return max > 0 ? best : "other";
}

function defaultTagsForCategory(cat: PromptCategoryKey): string[] {
  switch (cat) {
    case "code":
      return ["Code"];
    case "writing":
      return ["Writing"];
    case "analysis":
      return ["Analysis"];
    case "creative":
      return ["Creative"];
    default:
      return [];
  }
}

export function suggestPromptTags(goal: string, category: PromptCategoryKey): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const { re, tag } of TAG_BY_SIGNAL) {
    if (re.test(goal) && !seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
      if (out.length >= 4) return out;
    }
  }
  for (const t of defaultTagsForCategory(category)) {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out.slice(0, 4);
}

function deriveRecordName(
  goal: string,
  locale: Locale,
  fallbackZh: string,
  fallbackEn: string,
): string {
  const first = goal.split("\n")[0]?.trim() ?? "";
  return first.slice(0, 120) || (locale === "zh" ? fallbackZh : fallbackEn);
}

function deriveName(goal: string, locale: Locale): string {
  return deriveRecordName(goal, locale, "新提示词", "New prompt");
}

function categoryWorkstreamLabel(locale: Locale, category: PromptCategoryKey): string {
  if (locale === "zh") {
    const m: Record<PromptCategoryKey, string> = {
      code: "编程与工程",
      writing: "写作与文档",
      analysis: "分析与数据",
      creative: "创意与内容",
      other: "通用协作",
    };
    return m[category];
  }
  const m: Record<PromptCategoryKey, string> = {
    code: "Code & engineering",
    writing: "Writing & docs",
    analysis: "Analysis & data",
    creative: "Creative & content",
    other: "General collaboration",
  };
  return m[category];
}

function buildPromptDescription(goal: string, locale: Locale, category: PromptCategoryKey): string {
  const line = goal.split("\n")[0]?.trim().slice(0, 140) ?? "";
  const focus = categoryWorkstreamLabel(locale, category);
  if (locale === "zh") {
    return line ? `${focus} · ${line}` : `${focus} · 由概览目标生成的完整提示词`;
  }
  return line ? `${focus}: ${line}` : `${focus} — full prompt from overview goal`;
}

function buildPromptBody(goal: string, locale: Locale, category: PromptCategoryKey): string {
  const g = goal.trim();
  if (locale === "zh") {
    const byCat: Record<PromptCategoryKey, string[]> = {
      code: [
        "你是一位资深软件工程师与代码审查专家，擅长阅读代码、定位问题并给出可落地的修改建议。",
        "",
        "### 用户目标",
        g,
        "",
        "### 我将提供的上下文（请把实际内容粘贴到下方或对话中）",
        "- 相关代码片段、文件路径或仓库结构说明",
        "- 报错信息、日志或复现步骤",
        "- 运行环境：语言/框架版本、操作系统（如已知）",
        "- 已尝试过的方案（如有）",
        "",
        "### 请你按以下步骤执行",
        "1. 用一两句话复述目标，确认理解无误；若有歧义先列出需要澄清的问题。",
        "2. 分析根因或可行方案；涉及多方案时对比优缺点并给出推荐。",
        "3. 输出**可直接使用**的内容：完整代码块（注明语言）、必要的命令、或逐文件的修改说明（可用伪 diff）。",
        "4. 简要说明关键设计决策与潜在风险（性能、安全、兼容性）。",
        "",
        "### 输出格式",
        "- 使用 Markdown；代码必须放在带语言标记的围栏代码块中。",
        "- 先给结论或最短可行答案，再给细节与备选方案。",
        "- 若信息不足：明确写出**假设**与**待用户补充**的条目，仍尽量给出可执行的默认方案。",
        "",
        "### 质量与安全",
        "- 不臆造不存在的 API；不确定时标注「需查证」并说明如何验证。",
        "- 涉及密钥、令牌、个人隐私的内容用占位符代替。",
      ],
      writing: [
        "你是一位专业写作者与编辑，擅长把模糊需求变成结构清晰、可直接发布的文稿。",
        "",
        "### 写作任务",
        g,
        "",
        "### 背景与素材（用户将补充）",
        "- 受众：身份、知识水平、使用场景",
        "- 语气：正式 / 友好 / 营销 / 技术 等",
        "- 长度与格式：字数范围、是否需要标题层级、列表、表格",
        "- 必须包含的要点、禁止提及的内容、品牌或合规要求",
        "",
        "### 请你完成",
        "1. 用一句话概括文档目的与读者收益。",
        "2. 输出**完整正文**（可直接复制使用），结构包含：标题（如需要）、导语、分节正文、总结或行动呼吁。",
        "3. 若任务含翻译或改写：先给出终稿，再附「主要改动说明」要点列表。",
        "4. 信息不足时：在文首用简短「假设」段落列出默认设定，然后按假设完成全文，并列出建议用户核对的事项。",
        "",
        "### 风格与格式",
        "- 语言与用户提供的目标一致；专有名词保持一致。",
        "- 避免空洞套话；优先具体、可执行的表述。",
      ],
      analysis: [
        "你是一位数据分析与商业分析顾问，擅长把问题拆解为可验证的假设、指标与结论。",
        "",
        "### 分析目标",
        g,
        "",
        "### 可用输入（用户将粘贴或描述）",
        "- 数据说明：来源、时间范围、粒度、字段含义",
        "- 已知业务背景、竞品或约束",
        "- 已尝试的分析或结论（如有）",
        "",
        "### 请你输出",
        "1. **执行摘要**：3–5 条 bullet，回答「所以呢」——对决策的含义。",
        "2. **分析框架**：列出关键问题、假设、所需数据与验证方式。",
        "3. **详细推导**：分步骤展示推理过程；若缺数据，用「若…则…」情景分析并标注置信度。",
        "4. **建议与下一步**：可执行的行动清单、优先级与风险。",
        "5. **附录（可选）**：建议的图表类型、SQL/表格模板或指标定义，便于用户落地。",
        "",
        "### 原则",
        "- 区分事实与推断；数字与比例需说明口径。",
        "- 不编造数据；缺失处明确写「数据待补充」并说明如何获取。",
      ],
      creative: [
        "你是一位创意总监与策划，擅长头脑风暴、命名、叙事与视觉化创意说明。",
        "",
        "### 创意Brief",
        g,
        "",
        "### 约束与偏好（用户可补充）",
        "- 品牌调性、禁忌词、对标参考",
        "- 载体：社媒 / 视频脚本 / 活动方案 / 产品命名 等",
        "- 数量：需要几个方案、每个方案的长度",
        "",
        "### 请你交付",
        "1. 用两三句话提炼核心创意方向。",
        "2. 输出**可直接采用**的主方案：完整文案或方案结构（含标题、主体、结尾/CTA 等）。",
        "3. 再给出 2–3 个**备选方向**，每个用简短标题 + 要点说明差异。",
        "4. 若适用：补充一句使用场景或投放渠道建议。",
        "",
        "### 风格",
        "- 大胆但可执行；避免陈词滥调。",
        "- 若需求模糊，先给出默认风格下的完整成品，再列出可调整的维度。",
      ],
      other: [
        "你是一位可靠的通用助手，能够严格遵循指令、结构化输出并主动澄清边界。",
        "",
        "### 用户目标",
        g,
        "",
        "### 请你完成",
        "1. 简要复述任务，确认范围；若有歧义列出澄清问题，并基于合理假设继续完成。",
        "2. 输出**完整、可直接使用**的答案：优先给终稿或步骤清单，再补充解释。",
        "3. 使用 Markdown；复杂内容用标题、列表或表格组织。",
        "4. 说明信息来源与不确定之处；需要外部事实时注明「建议核实」并给出检索关键词。",
        "",
        "### 输出要求",
        "- 先结论后细节；避免空泛建议。",
        "- 涉及安全、法律、医疗等专业领域时提醒用户咨询专业人士。",
      ],
    };
    return byCat[category].join("\n");
  }

  const en: Record<PromptCategoryKey, string[]> = {
    code: [
      "You are a senior software engineer and code reviewer. You read code carefully, find root causes, and ship concrete, copy-pasteable fixes.",
      "",
      "### User goal",
      g,
      "",
      "### Context I will provide (paste into the chat or below)",
      "- Relevant code snippets, file paths, or repo layout",
      "- Errors, logs, or repro steps",
      "- Runtime: language/framework versions, OS (if known)",
      "- What I already tried (if any)",
      "",
      "### What you should do",
      "1. Restate the goal in one or two sentences; if anything is ambiguous, list questions—but still proceed with stated assumptions.",
      "2. Analyze root cause or solution options; if multiple, compare trade-offs and recommend one.",
      "3. Deliver **ready-to-use** output: full code blocks (with language tags), commands, or per-file change notes (pseudo-diff OK).",
      "4. Briefly note key design choices and risks (performance, security, compatibility).",
      "",
      "### Output format",
      "- Use Markdown; all code in fenced blocks with language identifiers.",
      "- Lead with the shortest actionable answer, then details and alternatives.",
      "- If context is missing: state **assumptions** and **what I should add**, and still provide a best-effort default.",
      "",
      "### Quality & safety",
      "- Do not invent APIs; mark uncertain items as \u201cneeds verification\u201d and how to check.",
      "- Replace secrets, tokens, and PII with placeholders.",
    ],
    writing: [
      "You are a professional writer and editor. You turn vague requests into clear, publish-ready prose.",
      "",
      "### Writing task",
      g,
      "",
      "### Context (I will add)",
      "- Audience: who they are, expertise, context of use",
      "- Tone: formal, friendly, marketing, technical, etc.",
      "- Length & shape: word count, headings, lists, tables",
      "- Must-include points, off-limits topics, brand/compliance notes",
      "",
      "### Deliver",
      "1. One sentence on purpose and reader takeaway.",
      "2. **Full draft** (copy-paste ready): title (if needed), intro, body sections, closing or CTA.",
      "3. If translation/rewrite: give the final text first, then a short \u201cwhat changed\u201d bullet list.",
      "4. If brief is thin: open with a brief **Assumptions** paragraph, complete the piece, then list what I should verify.",
      "",
      "### Style",
      "- Match the language of my goal; keep terminology consistent.",
      "- Be concrete; avoid filler.",
    ],
    analysis: [
      "You are a data and business analyst. You break problems into testable hypotheses, metrics, and decisions.",
      "",
      "### Analysis goal",
      g,
      "",
      "### Inputs available (I will paste or describe)",
      "- Data: source, time range, grain, field definitions",
      "- Business context, competitors, constraints",
      "- Prior analysis or conclusions (if any)",
      "",
      "### Produce",
      "1. **Executive summary**: 3\u20135 bullets\u2014so what for decisions.",
      "2. **Framework**: key questions, hypotheses, data needed, how to validate.",
      "3. **Reasoning**: step-by-step; if data is missing, scenario analysis with confidence notes.",
      "4. **Recommendations & next steps**: prioritized actions and risks.",
      "5. **Appendix (optional)**: chart ideas, SQL/table templates, or metric definitions to operationalize.",
      "",
      "### Rules",
      "- Separate facts from inference; define any numbers and denominators.",
      "- Never fabricate data; say \u201cdata needed\u201d and how to obtain it.",
    ],
    creative: [
      "You are a creative lead: brainstorming, naming, narrative, and crisp creative direction.",
      "",
      "### Creative brief",
      g,
      "",
      "### Constraints (I may add)",
      "- Brand voice, taboo words, references to match or avoid",
      "- Medium: social, video script, campaign, naming, etc.",
      "- How many concepts and how long each should be",
      "",
      "### Deliver",
      "1. Two or three sentences on the core creative angle.",
      "2. **Primary concept**: full copy or structured plan (headline, body, CTA as appropriate).",
      "3. **2\u20133 alternates**: short title + bullets on how each differs.",
      "4. If useful: one line on channel or usage context.",
      "",
      "### Style",
      "- Bold but executable; avoid clich\u00e9s.",
      "- If the brief is vague, ship a strong default, then list knobs I can tweak.",
    ],
    other: [
      "You are a dependable general assistant: follow instructions, structure output, and surface boundaries clearly.",
      "",
      "### User goal",
      g,
      "",
      "### What to do",
      "1. Restate the task and scope; if unclear, ask concise questions **and** proceed with reasonable assumptions.",
      "2. Give a **complete, ready-to-use** answer: final deliverable or checklist first, then explanation.",
      "3. Use Markdown; use headings, lists, or tables when it helps.",
      "4. Cite uncertainty; for external facts, note \u201cverify\u201d and suggest search keywords.",
      "",
      "### Output bar",
      "- Lead with conclusions, not throat-clearing.",
      "- For legal/medical/financial topics, remind me to consult a professional when needed.",
    ],
  };
  return en[category].join("\n");
}

export function buildPromptRecordFromGoal(
  goal: string,
  locale: Locale,
): {
  name: string;
  content: string;
  category: PromptCategoryKey;
  tags: string[];
  accent: string;
  description: string;
} {
  const g = goal.trim();
  const category = inferPromptCategory(g);
  const tags = suggestPromptTags(g, category);
  const accent = CATEGORY_ACCENTS[category];
  return {
    name: deriveName(g, locale),
    content: buildPromptBody(g, locale, category),
    category,
    tags,
    accent,
    description: buildPromptDescription(g, locale, category),
  };
}

function buildSkillDescriptionBody(goal: string, locale: Locale): string {
  const g = goal.trim();
  if (locale === "zh") {
    return [
      "## 目标",
      g,
      "",
      "## 适用场景",
      "（补充：何时应加载或使用此技能。）",
      "",
      "## 行为与规则",
      "- ",
      "- ",
      "",
      "## 输入与输出",
      "- 典型输入：",
      "- 期望输出：",
      "",
      "## 依赖与限制",
      "- ",
    ].join("\n");
  }
  return [
    "## Goal",
    g,
    "",
    "## When to use",
    "(When should this skill be loaded or invoked?)",
    "",
    "## Behavior & rules",
    "- ",
    "- ",
    "",
    "## Inputs & outputs",
    "- Typical inputs:",
    "- Expected outputs:",
    "",
    "## Dependencies & limits",
    "- ",
  ].join("\n");
}

/** Skill create-modal fields from dashboard overview goal */
export function buildSkillRecordFromGoal(goal: string, locale: Locale): {
  name: string;
  description: string;
  tags: string[];
  accent: string;
} {
  const g = goal.trim();
  const category = inferPromptCategory(g);
  const tags = suggestPromptTags(g, category);
  const accent = CATEGORY_ACCENTS[category];
  return {
    name: deriveRecordName(g, locale, "新技能", "New skill"),
    description: buildSkillDescriptionBody(g, locale),
    tags,
    accent,
  };
}

/** Initial SKILL.md body when creating a skill from the overview goal */
export function buildSkillMdFromGoal(
  goal: string,
  locale: Locale,
  name: string,
  description: string,
): string {
  const g = goal.trim();
  const descOneLine = description.replace(/\s*\n\s*/g, " ").trim();
  if (locale === "zh") {
    return [
      "---",
      `name: ${name}`,
      `description: ${descOneLine}`,
      "---",
      "",
      "# 技能说明",
      "",
      "## 用户目标",
      "",
      g,
      "",
      "## 何时加载此技能",
      "",
      "- ",
      "",
      "## 步骤与约束",
      "",
      "1. ",
      "2. ",
      "",
      "## 预期输出",
      "",
      "- ",
      "",
    ].join("\n");
  }
  return [
    "---",
    `name: ${name}`,
    `description: ${descOneLine}`,
    "---",
    "",
    "# Skill",
    "",
    "## User goal",
    "",
    g,
    "",
    "## When to load this skill",
    "",
    "- ",
    "",
    "## Steps & constraints",
    "",
    "1. ",
    "2. ",
    "",
    "## Expected output",
    "",
    "- ",
    "",
  ].join("\n");
}

function buildSubagentSpecBody(goal: string, locale: Locale): string {
  const g = goal.trim();
  const stream = categoryWorkstreamLabel(locale, inferPromptCategory(g));
  if (locale === "zh") {
    return [
      "## 用户目标",
      g,
      "",
      "## 工作流归类",
      stream,
      "",
      "## 触发与调度",
      "- 触发条件：（如定时 / 事件 / 手动）",
      "- 运行频率：",
      "",
      "## 所需工具与数据",
      "- ",
      "",
      "## 步骤草案",
      "1. ",
      "2. ",
      "3. ",
      "",
      "## 输出与通知",
      "- 交付物：",
      "- 失败处理：",
    ].join("\n");
  }
  return [
    "## User goal",
    g,
    "",
    "## Workflow focus",
    stream,
    "",
    "## Triggers & schedule",
    "- Trigger: (cron / event / manual)",
    "- Frequency:",
    "",
    "## Tools & data",
    "- ",
    "",
    "## Step outline",
    "1. ",
    "2. ",
    "3. ",
    "",
    "## Outputs & alerts",
    "- Deliverables:",
    "- Failure handling:",
  ].join("\n");
}

/** Sub-agent page: search hint + full spec to copy or refine */
export function buildSubagentDraftFromGoal(goal: string, locale: Locale): {
  searchQuery: string;
  spec: string;
} {
  const g = goal.trim();
  const searchQuery =
    deriveRecordName(g, locale, "子智能体", "Sub-agent").slice(0, 120);
  return {
    searchQuery,
    spec: buildSubagentSpecBody(g, locale),
  };
}

/** Workspace invite / OpenClaw: structured brief from overview goal */
export function buildTeamCollaborationBriefFromGoal(goal: string, locale: Locale): string {
  const g = goal.trim();
  const stream = categoryWorkstreamLabel(locale, inferPromptCategory(g));
  if (locale === "zh") {
    return [
      "## 协作目的",
      g,
      "",
      "## 建议工作流方向",
      `- 与「${stream}」相关的协作与资产（提示词、技能、子智能体）可对齐到此目标。`,
      "- （补充：角色分工、工具权限、里程碑与交付物。）",
      "",
      "## 邀请时可附带说明（可编辑）",
      "你好，我们希望你加入工作区，一起推进上述目标。",
    ].join("\n");
  }
  return [
    "## Collaboration goal",
    g,
    "",
    "## Suggested focus",
    `- Align prompts, skills, and sub-agents around **${stream}** for this goal.`,
    "- (Add roles, tool access, milestones, and deliverables.)",
    "",
    "## Note to send with the invite (editable)",
    "Hi — we would love you to join the workspace to work toward the goal above.",
  ].join("\n");
}
