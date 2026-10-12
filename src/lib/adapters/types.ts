/**
 * Canonical Skill Spec —— 与厂商无关的"中间语义层"。
 *
 * 设计原则：
 *   - 一份 Spec 可以被渲染成任意主流模型（Claude / GPT / Gemini / 国产 / 推理模型 等）
 *     各自偏好的 Prompt 或 Skill 结构。
 *   - Spec 本身**不包含**任何厂商特定语法（不写 XML、不写 markdown 标题、不写
 *     `<thinking>` 之类的引导词）。它只描述语义。
 *   - 各模型的 Adapter 根据自己的最佳实践把语义字段渲染成最终 Prompt / Skill 产物。
 */

/** 模型系列；决定调用哪个 Adapter。 */
export type ModelFamily =
  | 'claude'            // Anthropic Claude 3.x / 4.x（XML 结构 + SKILL.md 渐进披露）
  | 'openai-chat'       // OpenAI GPT-4o / GPT-4.1 / GPT-5 非推理模式（Markdown）
  | 'openai-reasoning'  // o1 / o3 / GPT-5-Thinking（剥离 CoT 引导）
  | 'gemini'            // Google Gemini 1.5 / 2.0 / 2.5（宽松 + 超长上下文）
  | 'qwen'              // 阿里通义千问 Qwen2.5 / Qwen3（OpenAI 兼容，中文原生）
  | 'qwen-reasoning'    // QwQ / Qwen3-Thinking（推理模型）
  | 'deepseek'          // DeepSeek V3 非推理
  | 'deepseek-r1'       // DeepSeek R1 推理模型
  | 'kimi'              // Moonshot Kimi（超长上下文，中文自然语言）
  | 'glm'               // 智谱 GLM-4 / GLM-4-Plus
  | 'ernie'             // 百度文心一言 ERNIE
  | 'doubao';           // 字节豆包 / 扣子 Coze 工作流

/** 模型提供商国家/地区来源，便于前端分组展示。 */
export type ModelOrigin = 'international' | 'china';

/** 模型元信息。 */
export interface ModelDescriptor {
  family: ModelFamily;
  /** 展示名。 */
  label: string;
  /** 典型代表模型示例（如 "claude-sonnet-4.5"）。 */
  examples: string[];
  origin: ModelOrigin;
  /** 是否属于推理模型（会自动产出 CoT）。 */
  reasoning: boolean;
  /** 是否拥有超长上下文（> 200K tokens），影响"直接内联资料 vs 分层"决策。 */
  longContext: boolean;
  /** 主要偏好的结构格式（供 UI 提示）。 */
  preferredFormat: 'xml' | 'markdown' | 'plain' | 'workflow-dsl';
  /** 工具 / 函数协议标准。 */
  toolProtocol: 'anthropic' | 'openai' | 'google' | 'platform-dsl';
}

/** 输入/输出字段的一条 schema 描述（简化版 JSON Schema）。 */
export interface FieldSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'string[]' | 'object' | 'enum';
  description: string;
  required?: boolean;
  enumValues?: string[];
}

/** 一条 few-shot 示例。 */
export interface ShotExample {
  /** 用户输入（可含变量占位符）。 */
  input: string;
  /** 期望输出。 */
  output: string;
  /** 可选的中间推理解释：仅被渲染到非推理模型，推理模型会自动过滤掉，避免干扰 CoT。 */
  reasoning?: string;
}

/** 可被 Skill 调用的工具/函数。 */
export interface ToolSpec {
  name: string;
  description: string;
  parameters: FieldSchema[];
}

/** 输出契约。 */
export interface OutputContract {
  /** 期望输出类型：结构化 JSON / 纯文本 / Markdown / XML 片段。 */
  format: 'json' | 'text' | 'markdown' | 'xml';
  /** 当 format = json 时描述字段；其它格式可选。 */
  fields?: FieldSchema[];
  /** 额外的输出约束（长度上限、必须字段等，自然语言描述）。 */
  constraints?: string[];
}

/**
 * Canonical Skill Spec —— 与模型无关的"技能蓝图"。
 */
export interface CanonicalSkillSpec {
  /** 技能 ID（英文短横线命名）。 */
  id: string;
  /** 简短技能名。 */
  name: string;
  /** 技能目的：一句话说明"做什么"。 */
  purpose: string;
  /** 身份 / 角色设定（Persona）。 */
  persona?: string;
  /** 何时应该使用该技能（路由提示，供 Claude / Custom GPT 判断激活条件）。 */
  whenToUse?: string;
  /** 具体任务步骤；会被各模型按自己的结构习惯展开。 */
  steps: string[];
  /** 输入字段。 */
  inputs: FieldSchema[];
  /** 输出契约。 */
  output: OutputContract;
  /** 硬性约束（"禁止 xxx"、"必须 xxx"）。 */
  constraints?: string[];
  /** few-shot 示例（推理模型会自动精简）。 */
  examples?: ShotExample[];
  /** 工具函数 / 插件。 */
  tools?: ToolSpec[];
  /** 可附加的长文档背景（Kimi / Gemini 会直接内联，Claude 会建议渐进披露）。 */
  knowledge?: { title: string; content: string }[];
  /** 元数据，仅用于展示，不参与渲染。 */
  meta?: {
    author?: string;
    version?: string;
    tags?: string[];
  };
}

/** Adapter 渲染输出。 */
export interface RenderedSkill {
  family: ModelFamily;
  /** 推荐直接放到 system 字段的内容。 */
  system: string;
  /** 推荐作为 user 消息（或首轮 prompt）的内容；可能为空。 */
  user?: string;
  /** 生成的 few-shot 消息序列（messages 风格）。 */
  messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  /** 原生工具定义（不同厂商协议结构不同，使用 unknown 保守暴露）。 */
  tools?: unknown;
  /** 给该家族的调参建议。 */
  recommendedParameters?: Record<string, unknown>;
  /** 额外的补充产物，如 Claude 的 SKILL.md / 扣子工作流 DSL。 */
  artifacts?: Array<{
    filename: string;
    language: string;
    content: string;
    description?: string;
  }>;
  /** 针对该模型的使用提示（对用户可见）。 */
  notes: string[];
}

/** Adapter 接口。 */
export interface SkillAdapter {
  family: ModelFamily;
  descriptor: ModelDescriptor;
  render(spec: CanonicalSkillSpec): RenderedSkill;
}
