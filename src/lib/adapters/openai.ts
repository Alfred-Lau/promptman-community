import type {
  CanonicalSkillSpec,
  RenderedSkill,
  SkillAdapter,
} from './types';

function renderMarkdownSystem(spec: CanonicalSkillSpec): string {
  const parts: string[] = [];

  parts.push(`# ${spec.name}`, '', spec.purpose, '');

  if (spec.persona) {
    parts.push('## Role', spec.persona, '');
  }

  parts.push(
    '## Instructions',
    ...spec.steps.map((s, i) => `${i + 1}. ${s}`),
    '',
  );

  if (spec.inputs.length) {
    parts.push('## Inputs');
    for (const f of spec.inputs) {
      parts.push(
        `- \`${f.name}\` *(${f.type}${f.required ? ', required' : ''})* — ${f.description}`,
      );
    }
    parts.push('');
  }

  if (spec.constraints?.length) {
    parts.push('## Constraints', ...spec.constraints.map((c) => `- ${c}`), '');
  }

  parts.push('## Output', `Return as **${spec.output.format}**.`);
  if (spec.output.fields?.length) {
    parts.push('Fields:');
    for (const f of spec.output.fields) {
      parts.push(`- \`${f.name}\` (${f.type}) — ${f.description}`);
    }
  }
  if (spec.output.constraints?.length) {
    parts.push('', 'Output constraints:');
    for (const c of spec.output.constraints) parts.push(`- ${c}`);
  }

  return parts.join('\n');
}

function renderTools(spec: CanonicalSkillSpec): unknown {
  if (!spec.tools?.length) return undefined;
  return spec.tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          t.parameters.map((p) => [
            p.name,
            {
              type:
                p.type === 'string[]'
                  ? 'array'
                  : p.type === 'enum'
                    ? 'string'
                    : p.type,
              description: p.description,
              ...(p.type === 'enum' && p.enumValues
                ? { enum: p.enumValues }
                : {}),
              ...(p.type === 'string[]'
                ? { items: { type: 'string' } }
                : {}),
            },
          ]),
        ),
        required: t.parameters.filter((p) => p.required).map((p) => p.name),
      },
    },
  }));
}

/**
 * OpenAI 非推理模型（GPT-4o / 4.1 / 5 普通模式）的 Adapter。
 * 采用 Markdown 系统提示 + 标准 function calling schema。
 * 保留完整 few-shot（包含 reasoning）以发挥 in-context learning。
 */
export const openaiChatAdapter: SkillAdapter = {
  family: 'openai-chat',
  descriptor: {
    family: 'openai-chat',
    label: 'GPT (non-reasoning)',
    examples: ['gpt-4o', 'gpt-4.1', 'gpt-5'],
    origin: 'international',
    reasoning: false,
    longContext: true,
    preferredFormat: 'markdown',
    toolProtocol: 'openai',
  },
  render(spec) {
    const system = renderMarkdownSystem(spec);
    const messages: RenderedSkill['messages'] = [
      { role: 'system', content: system },
    ];

    for (const ex of spec.examples ?? []) {
      messages.push({ role: 'user', content: ex.input });
      const assistant = ex.reasoning
        ? `<!-- reasoning: ${ex.reasoning} -->\n${ex.output}`
        : ex.output;
      messages.push({ role: 'assistant', content: assistant });
    }

    return {
      family: 'openai-chat',
      system,
      messages,
      tools: renderTools(spec),
      recommendedParameters: {
        temperature: 0.3,
        ...(spec.output.format === 'json'
          ? { response_format: { type: 'json_object' } }
          : {}),
      },
      notes: [
        '对 GPT 非推理模型，Markdown 结构 + 完整 few-shot（含 reasoning 注释）收益最大。',
        'JSON 输出建议开启 Structured Outputs（response_format: json_schema），比普通 json_object 更稳。',
        '若在 Custom GPT / Assistants API 中使用，本 `system` 直接填入 "Instructions" 字段即可。',
      ],
    };
  },
};

/**
 * 推理模型（o1 / o3 / GPT-5-Thinking）的 Adapter。
 * 刻意剥离：
 *   - CoT 引导词（"think step by step"）
 *   - 带 reasoning 的 few-shot（会干扰原生推理）
 *   - 冗长的 persona 装饰
 * 只保留"问题陈述 + 硬约束 + 输出契约"。
 */
export const openaiReasoningAdapter: SkillAdapter = {
  family: 'openai-reasoning',
  descriptor: {
    family: 'openai-reasoning',
    label: 'o-series / GPT-5-Thinking (reasoning)',
    examples: ['o1', 'o3', 'gpt-5-thinking'],
    origin: 'international',
    reasoning: true,
    longContext: true,
    preferredFormat: 'plain',
    toolProtocol: 'openai',
  },
  render(spec) {
    const parts: string[] = [];
    parts.push(`Task: ${spec.purpose}`);
    if (spec.steps.length) {
      parts.push(
        '',
        'Requirements:',
        ...spec.steps.map((s) => `- ${s}`),
      );
    }
    if (spec.constraints?.length) {
      parts.push('', 'Hard constraints:', ...spec.constraints.map((c) => `- ${c}`));
    }
    if (spec.inputs.length) {
      parts.push(
        '',
        'Inputs provided by the user:',
        ...spec.inputs.map(
          (f) =>
            `- ${f.name} (${f.type}${f.required ? ', required' : ''}): ${f.description}`,
        ),
      );
    }
    parts.push('', `Output format: ${spec.output.format}.`);
    if (spec.output.fields?.length) {
      parts.push(
        'Return the following fields:',
        ...spec.output.fields.map((f) => `- ${f.name} (${f.type}): ${f.description}`),
      );
    }
    if (spec.output.constraints?.length) {
      parts.push(...spec.output.constraints.map((c) => `- ${c}`));
    }

    const messages: RenderedSkill['messages'] = [
      { role: 'user', content: parts.join('\n') },
    ];
    for (const ex of spec.examples?.slice(0, 2) ?? []) {
      messages.push({ role: 'user', content: ex.input });
      messages.push({ role: 'assistant', content: ex.output });
    }

    return {
      family: 'openai-reasoning',
      system: '',
      user: parts.join('\n'),
      messages,
      tools: renderTools(spec),
      recommendedParameters: {
        reasoning_effort: 'medium',
      },
      notes: [
        '推理模型请**不要**加 "think step by step"、"让我们一步一步思考"——它会强制模型产出非原生 CoT，反而降低质量。',
        'few-shot 中的 `reasoning` 字段已被刻意剥离，只保留 I/O 示例。',
        'o 系列目前不支持 system 消息；本 Adapter 已把指令合并到第一条 user 消息。',
      ],
    };
  },
};
