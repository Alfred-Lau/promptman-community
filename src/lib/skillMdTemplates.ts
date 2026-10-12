import type { Locale } from "@/lib/i18n";

export type SkillMdTemplateId =
  | "basic"
  | "code-review"
  | "docs"
  | "debug"
  | "workflow";

export type SkillMdTemplate = {
  id: SkillMdTemplateId;
  /** Short label on the card */
  title: { zh: string; en: string };
  /** One-line helper under the title */
  summary: { zh: string; en: string };
  /** Accent used for the card border / selected state */
  accent: string;
  build: (locale: Locale) => string;
};

function fm(name: string, description: string): string {
  return ["---", `name: ${name}`, `description: ${description}`, "---", ""].join("\n");
}

const basic: SkillMdTemplate = {
  id: "basic",
  title: { zh: "基础结构", en: "Basic" },
  summary: {
    zh: "frontmatter + 触发条件 + 步骤骨架",
    en: "Frontmatter, triggers, and a step skeleton",
  },
  accent: "#6ee7f7",
  build: (locale) => {
    if (locale === "zh") {
      return [
        fm("my-skill", "一句话说明此技能何时被加载、解决什么问题"),
        "# 技能说明",
        "",
        "## 何时使用",
        "",
        "- 用户提到……时加载本技能",
        "",
        "## 步骤",
        "",
        "1. ",
        "2. ",
        "",
        "## 约束",
        "",
        "- ",
        "",
        "## 预期输出",
        "",
        "- ",
        "",
      ].join("\n");
    }
    return [
      fm("my-skill", "One-line summary of when to load this skill and what it solves"),
      "# Instructions",
      "",
      "## When to use",
      "",
      "- Load this skill when the user…",
      "",
      "## Steps",
      "",
      "1. ",
      "2. ",
      "",
      "## Constraints",
      "",
      "- ",
      "",
      "## Expected output",
      "",
      "- ",
      "",
    ].join("\n");
  },
};

const codeReview: SkillMdTemplate = {
  id: "code-review",
  title: { zh: "代码审查", en: "Code review" },
  summary: {
    zh: "按严重级别审查 PR / diff",
    en: "Review PRs and diffs by severity",
  },
  accent: "#f59e0b",
  build: (locale) => {
    if (locale === "zh") {
      return [
        fm(
          "code-review",
          "对 PR、diff 或选中代码做结构化审查：正确性、安全、可读性与测试缺口",
        ),
        "# 代码审查技能",
        "",
        "## 何时使用",
        "",
        "- 用户要求 review / 审查代码、PR、diff 或补丁时",
        "",
        "## 审查步骤",
        "",
        "1. 先理解变更意图与影响范围，再逐文件阅读。",
        "2. 按优先级检查：正确性 → 安全/权限 → 边界与错误处理 → 性能 → 可读性与测试。",
        "3. 每条意见必须指向具体位置，并给出可执行的修改建议。",
        "4. 区分「必须修」与「可选改进」，避免噪声。",
        "",
        "## 约束",
        "",
        "- 不要复述整段代码；只引用必要片段。",
        "- 不确定处明确标注假设，不要编造运行结果。",
        "- 风格偏好（命名、格式）仅在影响可维护性时提出。",
        "",
        "## 输出格式",
        "",
        "### 摘要",
        "- 变更目的（1–2 句）",
        "- 总体风险：低 / 中 / 高",
        "",
        "### 问题列表",
        "对每个问题使用：",
        "- **级别**：阻断 / 建议 / 可选",
        "- **位置**：文件与符号（或行号）",
        "- **问题**：一句话",
        "- **建议**：怎么改",
        "",
        "### 测试建议",
        "- 应补充或运行的用例",
        "",
      ].join("\n");
    }
    return [
      fm(
        "code-review",
        "Structured review of PRs, diffs, or selected code: correctness, security, readability, and test gaps",
      ),
      "# Code review skill",
      "",
      "## When to use",
      "",
      "- The user asks to review code, a PR, a diff, or a patch",
      "",
      "## Review steps",
      "",
      "1. Infer change intent and blast radius before line-by-line reading.",
      "2. Check in order: correctness → security/authz → edge cases/errors → performance → readability/tests.",
      "3. Every finding must cite a concrete location and include an actionable fix.",
      "4. Separate must-fix from nice-to-have to keep signal high.",
      "",
      "## Constraints",
      "",
      "- Do not paste large code blocks; quote only what is needed.",
      "- Mark assumptions explicitly; never invent runtime behavior.",
      "- Raise style nits only when they hurt maintainability.",
      "",
      "## Output format",
      "",
      "### Summary",
      "- Change intent (1–2 sentences)",
      "- Overall risk: low / medium / high",
      "",
      "### Findings",
      "For each issue use:",
      "- **Severity**: blocker / should-fix / optional",
      "- **Where**: file + symbol (or line)",
      "- **Issue**: one sentence",
      "- **Suggestion**: how to fix",
      "",
      "### Test ideas",
      "- Cases to add or run",
      "",
    ].join("\n");
  },
};

const docs: SkillMdTemplate = {
  id: "docs",
  title: { zh: "文档撰写", en: "Docs" },
  summary: {
    zh: "README、API 说明与操作手册",
    en: "README, API notes, and how-to guides",
  },
  accent: "#34d399",
  build: (locale) => {
    if (locale === "zh") {
      return [
        fm(
          "docs-writer",
          "将代码、接口或流程整理为清晰可维护的文档（README、API、操作指南）",
        ),
        "# 文档撰写技能",
        "",
        "## 何时使用",
        "",
        "- 用户要求写/改 README、API 文档、上手指南或变更说明时",
        "",
        "## 步骤",
        "",
        "1. 确认读者（新人 / 使用者 / 维护者）与文档类型。",
        "2. 从源码、接口或现有说明提取事实，标出不确定项。",
        "3. 先写结构大纲，再填充；优先可运行的示例。",
        "4. 检查术语一致、命令可复制、链接与路径有效。",
        "",
        "## 约束",
        "",
        "- 不要编造不存在的 API、参数或行为。",
        "- 示例必须完整可运行，或明确标注占位符。",
        "- 长文用标题分层；避免空洞形容词。",
        "",
        "## 推荐结构",
        "",
        "1. 一句话概述",
        "2. 快速开始",
        "3. 核心概念 / API",
        "4. 示例",
        "5. 常见问题与排错",
        "",
      ].join("\n");
    }
    return [
      fm(
        "docs-writer",
        "Turn code, APIs, or workflows into clear docs (README, API reference, how-to)",
      ),
      "# Documentation skill",
      "",
      "## When to use",
      "",
      "- The user asks to write or revise a README, API doc, getting-started guide, or changelog",
      "",
      "## Steps",
      "",
      "1. Confirm audience (newcomer / user / maintainer) and doc type.",
      "2. Pull facts from source, APIs, or existing notes; flag unknowns.",
      "3. Outline first, then fill; prefer copy-pasteable examples.",
      "4. Check terminology, runnable commands, and valid paths/links.",
      "",
      "## Constraints",
      "",
      "- Never invent APIs, parameters, or behavior.",
      "- Examples must be complete or clearly mark placeholders.",
      "- Use headings for long docs; avoid empty marketing adjectives.",
      "",
      "## Suggested outline",
      "",
      "1. One-line overview",
      "2. Quick start",
      "3. Core concepts / API",
      "4. Examples",
      "5. FAQ / troubleshooting",
      "",
    ].join("\n");
  },
};

const debug: SkillMdTemplate = {
  id: "debug",
  title: { zh: "调试排错", en: "Debug" },
  summary: {
    zh: "从报错到根因再到验证修复",
    en: "From error to root cause to verified fix",
  },
  accent: "#ef4444",
  build: (locale) => {
    if (locale === "zh") {
      return [
        fm(
          "debug-assistant",
          "根据报错、日志与复现步骤定位根因，并给出可验证的修复方案",
        ),
        "# 调试排错技能",
        "",
        "## 何时使用",
        "",
        "- 用户提供报错、异常堆栈、失败测试或「某处坏了」时",
        "",
        "## 步骤",
        "",
        "1. 复述现象：期望 vs 实际、环境、最近改动。",
        "2. 收集最小复现与关键信号（日志、堆栈、状态）。",
        "3. 提出 2–3 个假设，按代价从低到高验证。",
        "4. 确认根因后给出最小修复，并说明如何验证。",
        "",
        "## 约束",
        "",
        "- 先诊断再改代码；避免无目标大范围重构。",
        "- 区分「已证实」与「猜测」。",
        "- 若信息不足，先列出需要用户补充的 3 个关键问题。",
        "",
        "## 输出格式",
        "",
        "1. **现象**",
        "2. **假设**（含如何验证）",
        "3. **根因**",
        "4. **修复**",
        "5. **验证步骤**",
        "",
      ].join("\n");
    }
    return [
      fm(
        "debug-assistant",
        "Locate root cause from errors, logs, and repro steps, then propose a verifiable fix",
      ),
      "# Debugging skill",
      "",
      "## When to use",
      "",
      "- The user shares an error, stack trace, failing test, or “something is broken”",
      "",
      "## Steps",
      "",
      "1. Restate the symptom: expected vs actual, environment, recent changes.",
      "2. Gather a minimal repro and signals (logs, stack, state).",
      "3. Form 2–3 hypotheses; validate cheapest-first.",
      "4. After root cause, propose a minimal fix and how to verify it.",
      "",
      "## Constraints",
      "",
      "- Diagnose before coding; avoid drive-by refactors.",
      "- Separate confirmed facts from guesses.",
      "- If info is missing, ask at most 3 high-signal questions next.",
      "",
      "## Output format",
      "",
      "1. **Symptom**",
      "2. **Hypotheses** (with how to test)",
      "3. **Root cause**",
      "4. **Fix**",
      "5. **Verification**",
      "",
    ].join("\n");
  },
};

const workflow: SkillMdTemplate = {
  id: "workflow",
  title: { zh: "多步工作流", en: "Workflow" },
  summary: {
    zh: "带检查点的分阶段任务流程",
    en: "Phased task flow with checkpoints",
  },
  accent: "#a78bfa",
  build: (locale) => {
    if (locale === "zh") {
      return [
        fm(
          "multi-step-workflow",
          "把复杂目标拆成可检查的阶段，按顺序执行并在关键节点确认",
        ),
        "# 多步工作流技能",
        "",
        "## 何时使用",
        "",
        "- 任务跨多个阶段（调研 → 设计 → 实现 → 验证），需要节奏与检查点时",
        "",
        "## 步骤",
        "",
        "1. 用一句话重述成功标准与非目标。",
        "2. 列出阶段计划（每阶段：输入、动作、完成定义）。",
        "3. 一次只推进一个阶段；阶段结束时做简短检查点。",
        "4. 阻塞时说明缺什么，提出最小下一步，而不是并行铺开。",
        "",
        "## 约束",
        "",
        "- 未经确认不要跳过检查点去改大量代码。",
        "- 保持变更可回顾：每阶段说明做了什么、为什么。",
        "- 优先可验证的中间产物（大纲、接口草案、失败复现）。",
        "",
        "## 检查点模板",
        "",
        "- **本阶段目标**",
        "- **已完成**",
        "- **风险 / 待决**",
        "- **下一阶段是否继续？**",
        "",
      ].join("\n");
    }
    return [
      fm(
        "multi-step-workflow",
        "Break a complex goal into checkable phases and advance with clear checkpoints",
      ),
      "# Multi-step workflow skill",
      "",
      "## When to use",
      "",
      "- The task spans phases (research → design → implement → verify) and needs pacing",
      "",
      "## Steps",
      "",
      "1. Restate success criteria and non-goals in one sentence.",
      "2. Draft a phase plan (each: inputs, actions, definition of done).",
      "3. Advance one phase at a time; end each with a short checkpoint.",
      "4. When blocked, state what is missing and the smallest next step.",
      "",
      "## Constraints",
      "",
      "- Do not skip checkpoints to land large unverified changes.",
      "- Keep work reviewable: say what changed and why each phase.",
      "- Prefer verifiable mid-artifacts (outline, API sketch, failing repro).",
      "",
      "## Checkpoint template",
      "",
      "- **Phase goal**",
      "- **Done**",
      "- **Risks / open questions**",
      "- **Continue to next phase?**",
      "",
    ].join("\n");
  },
};

/** Curated starters shown under the SKILL.md editor when creating a skill. */
export const SKILL_MD_TEMPLATES: SkillMdTemplate[] = [
  basic,
  codeReview,
  docs,
  debug,
  workflow,
];

export function getSkillMdTemplateContent(
  id: SkillMdTemplateId,
  locale: Locale,
): string {
  const tpl = SKILL_MD_TEMPLATES.find((t) => t.id === id);
  return tpl ? tpl.build(locale) : basic.build(locale);
}
