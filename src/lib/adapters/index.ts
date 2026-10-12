import { claudeAdapter } from './claude';
import { openaiChatAdapter, openaiReasoningAdapter } from './openai';
import { geminiAdapter } from './gemini';
import {
  qwenAdapter,
  qwenReasoningAdapter,
  glmAdapter,
  ernieAdapter,
  doubaoAdapter,
  deepseekAdapter,
  deepseekR1Adapter,
  kimiAdapter,
} from './chinese';
import type {
  CanonicalSkillSpec,
  FieldSchema,
  ModelDescriptor,
  ModelFamily,
  OutputContract,
  RenderedSkill,
  ShotExample,
  SkillAdapter,
  ToolSpec,
} from './types';

export type {
  CanonicalSkillSpec,
  FieldSchema,
  ModelDescriptor,
  ModelFamily,
  OutputContract,
  RenderedSkill,
  ShotExample,
  SkillAdapter,
  ToolSpec,
};

const REGISTRY: Record<ModelFamily, SkillAdapter> = {
  claude: claudeAdapter,
  'openai-chat': openaiChatAdapter,
  'openai-reasoning': openaiReasoningAdapter,
  gemini: geminiAdapter,
  qwen: qwenAdapter,
  'qwen-reasoning': qwenReasoningAdapter,
  deepseek: deepseekAdapter,
  'deepseek-r1': deepseekR1Adapter,
  kimi: kimiAdapter,
  glm: glmAdapter,
  ernie: ernieAdapter,
  doubao: doubaoAdapter,
};

/** 按固定顺序导出，便于前端分组展示。 */
export const ALL_MODELS: ModelDescriptor[] = Object.values(REGISTRY).map(
  (a) => a.descriptor,
);

export function getAdapter(family: ModelFamily): SkillAdapter {
  const adapter = REGISTRY[family];
  if (!adapter) {
    throw new Error(`未知的模型家族: ${family}`);
  }
  return adapter;
}

/**
 * 主入口：根据 Canonical Spec + 目标家族，渲染最终产物。
 * 一份 Spec 可以一次性渲染到多个家族（调用方自己循环）。
 */
export function renderSkill(
  spec: CanonicalSkillSpec,
  family: ModelFamily,
): RenderedSkill {
  validateSpec(spec);
  return getAdapter(family).render(spec);
}

/** 基础校验：避免传入不完整的 Spec 导致下游爆炸。 */
export function validateSpec(spec: CanonicalSkillSpec): void {
  if (!spec.id || !/^[a-z][a-z0-9-]{1,63}$/.test(spec.id)) {
    throw new Error('spec.id 必须是 kebab-case 英文/数字/短横线');
  }
  if (!spec.name?.trim()) throw new Error('spec.name 必填');
  if (!spec.purpose?.trim()) throw new Error('spec.purpose 必填');
  if (!Array.isArray(spec.steps) || spec.steps.length === 0) {
    throw new Error('spec.steps 至少需要 1 条');
  }
  if (!spec.output?.format) throw new Error('spec.output.format 必填');
  for (const f of spec.inputs ?? []) {
    if (!f.name || !f.type) throw new Error(`inputs 字段缺失 name/type: ${JSON.stringify(f)}`);
  }
}

/** 一次性渲染到所有家族，便于 playground / 批量导出。 */
export function renderAll(
  spec: CanonicalSkillSpec,
): Record<ModelFamily, RenderedSkill> {
  validateSpec(spec);
  const result = {} as Record<ModelFamily, RenderedSkill>;
  for (const family of Object.keys(REGISTRY) as ModelFamily[]) {
    result[family] = REGISTRY[family].render(spec);
  }
  return result;
}

/** 内置示例 Spec：让 UI / 文档有一个现成的出发点。 */
export const SAMPLE_SPEC: CanonicalSkillSpec = {
  id: 'code-reviewer',
  name: '代码审查助手',
  purpose:
    '对用户提交的代码片段进行 Code Review，产出可读性、性能、安全、可维护性四个维度的结构化评价。',
  persona: '一位严格但友好的资深工程师，精通多语言代码审查。',
  whenToUse:
    '当用户贴出一段代码并要求"review / 审查 / 看看问题"时调用此技能。',
  steps: [
    '理解代码意图（先读注释和函数签名，再读实现）。',
    '按 readability / performance / security / maintainability 四个维度列出问题。',
    '对每条问题给出严重度（low / medium / high / critical）与可执行的修改建议。',
    '最后给出一句总体结论。',
  ],
  inputs: [
    { name: 'language', type: 'string', description: '代码语言', required: true },
    { name: 'code', type: 'string', description: '待审查的代码正文', required: true },
    {
      name: 'context',
      type: 'string',
      description: '可选：这段代码的业务背景',
    },
  ],
  constraints: [
    '不要重写整份代码，只指出问题和 minimal diff 建议。',
    '当代码质量已经很好时，如实回答"没有明显问题"，不要强行挑刺。',
  ],
  output: {
    format: 'json',
    fields: [
      {
        name: 'issues',
        type: 'object',
        description:
          '数组，元素包含 dimension、severity、description、suggestion 四个字段。',
      },
      { name: 'summary', type: 'string', description: '一句话总体结论' },
    ],
  },
  examples: [
    {
      input:
        '// 语言: TypeScript\nfunction sum(a,b){return a+b}',
      reasoning:
        '这段代码没有类型注解也没有输入校验，但极其简单，属于轻量工具函数。',
      output:
        '{"issues":[{"dimension":"maintainability","severity":"low","description":"缺少参数类型注解","suggestion":"改为 function sum(a: number, b: number): number"}],"summary":"基本功能正确，补上类型即可。"}',
    },
  ],
  meta: {
    author: 'PromptMan',
    version: '1.0.0',
    tags: ['code', 'review', 'example'],
  },
};
