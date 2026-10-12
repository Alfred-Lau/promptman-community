import type {
  CanonicalSkillSpec,
  ModelFamily,
  RenderedSkill,
  SkillAdapter,
} from './types';

/**
 * 国产通用模型（Qwen / GLM / ERNIE / Doubao / DeepSeek 非推理）Adapter。
 *
 * 共同点：
 *   - OpenAI 兼容协议（function calling schema 与 OpenAI 一致）。
 *   - Prompt 偏好"中文直叙 + 清晰步骤编号 + 明确输出格式"。
 *   - Markdown 可用，但不需要 Claude 那种重结构 XML。
 *   - 对中文指令理解比英文更自然。
 */
function renderChineseSystem(spec: CanonicalSkillSpec): string {
  const lines: string[] = [];
  lines.push(`# 技能：${spec.name}`);
  lines.push('');
  lines.push(`## 任务目标`);
  lines.push(spec.purpose);
  if (spec.persona) {
    lines.push('', `## 身份设定`, spec.persona);
  }
  if (spec.whenToUse) {
    lines.push('', `## 使用时机`, spec.whenToUse);
  }

  lines.push('', `## 执行步骤`);
  spec.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));

  if (spec.inputs.length) {
    lines.push('', `## 输入字段`);
    for (const f of spec.inputs) {
      lines.push(
        `- \`${f.name}\`（${f.type}${f.required ? '，必填' : ''}）：${f.description}`,
      );
    }
  }

  if (spec.constraints?.length) {
    lines.push('', `## 必须遵守`);
    for (const c of spec.constraints) lines.push(`- ${c}`);
  }

  lines.push('', `## 输出要求`);
  lines.push(`- 格式：${spec.output.format}`);
  if (spec.output.fields?.length) {
    lines.push(`- 字段：`);
    for (const f of spec.output.fields) {
      lines.push(`  - \`${f.name}\`（${f.type}）：${f.description}`);
    }
  }
  if (spec.output.constraints?.length) {
    for (const c of spec.output.constraints) lines.push(`- ${c}`);
  }

  return lines.join('\n');
}

function renderOpenAICompatibleTools(spec: CanonicalSkillSpec): unknown {
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

interface ChineseAdapterConfig {
  family: ModelFamily;
  label: string;
  examples: string[];
  extraNotes: string[];
}

function makeChineseAdapter(cfg: ChineseAdapterConfig): SkillAdapter {
  return {
    family: cfg.family,
    descriptor: {
      family: cfg.family,
      label: cfg.label,
      examples: cfg.examples,
      origin: 'china',
      reasoning: false,
      longContext: cfg.family === 'kimi',
      preferredFormat: cfg.family === 'kimi' ? 'plain' : 'markdown',
      toolProtocol: 'openai',
    },
    render(spec: CanonicalSkillSpec): RenderedSkill {
      const system = renderChineseSystem(spec);
      const messages: RenderedSkill['messages'] = [
        { role: 'system', content: system },
      ];
      for (const ex of spec.examples ?? []) {
        messages.push({ role: 'user', content: ex.input });
        messages.push({ role: 'assistant', content: ex.output });
      }
      return {
        family: cfg.family,
        system,
        messages,
        tools: renderOpenAICompatibleTools(spec),
        recommendedParameters: {
          temperature: 0.3,
        },
        notes: cfg.extraNotes,
      };
    },
  };
}

export const qwenAdapter = makeChineseAdapter({
  family: 'qwen',
  label: '通义千问 Qwen (阿里)',
  examples: ['qwen2.5-72b', 'qwen3-235b', 'qwen-max'],
  extraNotes: [
    'Qwen 支持 OpenAI 兼容的 function calling 协议，可复用 GPT 的 tools schema。',
    '在阿里百炼（Bailian）平台发布 Agent 时，可直接把 system prompt 填入"角色指令"，知识库走 RAG。',
  ],
});

export const glmAdapter = makeChineseAdapter({
  family: 'glm',
  label: '智谱 GLM',
  examples: ['glm-4', 'glm-4-plus', 'glm-4-air'],
  extraNotes: [
    'GLM-4 对中文写作细腻度较好，适合内容生成类技能。',
    '支持 OpenAI 兼容协议，也有自己的 all-tools 接口。',
  ],
});

export const ernieAdapter = makeChineseAdapter({
  family: 'ernie',
  label: '文心一言 ERNIE (百度)',
  examples: ['ernie-4.0', 'ernie-4.5', 'ernie-x1'],
  extraNotes: [
    '文心一言对中国本地语境理解较好，涉及政策合规的业务可减少背景解释。',
    '在百度千帆平台上，可将本产物拆成"Agent + 插件 + 知识库 + 工作流"的组件 DSL。',
  ],
});

export const doubaoAdapter = makeChineseAdapter({
  family: 'doubao',
  label: '豆包 Doubao (字节)',
  examples: ['doubao-pro-32k', 'doubao-1.5-pro', 'doubao-seed'],
  extraNotes: [
    '豆包响应速度快、成本低，适合高并发调用场景。',
    '在扣子（Coze）中，本 system 对应 Bot 的"人设与回复逻辑"，工具对应插件市场调用。',
  ],
});

export const deepseekAdapter = makeChineseAdapter({
  family: 'deepseek',
  label: 'DeepSeek V3 (非推理)',
  examples: ['deepseek-chat', 'deepseek-v3'],
  extraNotes: [
    'DeepSeek V3 走 OpenAI 兼容 API，Markdown 结构友好。',
    '若切换到 DeepSeek-R1，请改用 `deepseek-r1` Adapter，以避免 CoT 引导冲突。',
  ],
});

/**
 * Kimi（Moonshot）—— 超长上下文，更偏好"中文自然语言 + 直接内联长资料"。
 */
export const kimiAdapter: SkillAdapter = {
  family: 'kimi',
  descriptor: {
    family: 'kimi',
    label: 'Kimi (Moonshot)',
    examples: ['moonshot-v1-128k', 'moonshot-v1-1m', 'kimi-k2'],
    origin: 'china',
    reasoning: false,
    longContext: true,
    preferredFormat: 'plain',
    toolProtocol: 'openai',
  },
  render(spec) {
    const lines: string[] = [];
    if (spec.persona) lines.push(`你是${spec.persona}。`);
    lines.push(`你的任务：${spec.purpose}`);
    if (spec.whenToUse) lines.push(`使用时机：${spec.whenToUse}`);
    lines.push('');
    lines.push('请按以下步骤完成：');
    spec.steps.forEach((s, i) => lines.push(`${i + 1}）${s}`));
    if (spec.constraints?.length) {
      lines.push('', '必须遵守：');
      spec.constraints.forEach((c) => lines.push(`- ${c}`));
    }
    lines.push('', `输出请以 ${spec.output.format} 格式返回。`);
    if (spec.output.fields?.length) {
      lines.push('包含字段：');
      spec.output.fields.forEach((f) =>
        lines.push(`- ${f.name}（${f.type}）：${f.description}`),
      );
    }

    if (spec.knowledge?.length) {
      lines.push(
        '',
        '以下是可供参考的完整背景资料，Kimi 支持长上下文，已直接内联：',
      );
      for (const k of spec.knowledge) {
        lines.push('', `【${k.title}】`, k.content);
      }
    }

    return {
      family: 'kimi',
      system: lines.join('\n'),
      recommendedParameters: { temperature: 0.3 },
      notes: [
        'Kimi 对超长资料友好，可直接把整本文档/日志粘进 system，不必做分层压缩。',
        'Prompt 用自然中文叙事即可，不需要 XML 或复杂 Markdown 结构。',
      ],
    };
  },
};

/**
 * DeepSeek R1（推理模型）—— 与 o1/o3 类似，剥离 CoT 引导。
 */
export const deepseekR1Adapter: SkillAdapter = {
  family: 'deepseek-r1',
  descriptor: {
    family: 'deepseek-r1',
    label: 'DeepSeek R1 (reasoning)',
    examples: ['deepseek-r1', 'deepseek-r1-distill'],
    origin: 'china',
    reasoning: true,
    longContext: true,
    preferredFormat: 'plain',
    toolProtocol: 'openai',
  },
  render(spec) {
    const parts: string[] = [];
    parts.push(`任务：${spec.purpose}`);
    if (spec.steps.length) {
      parts.push('', '要求：');
      spec.steps.forEach((s) => parts.push(`- ${s}`));
    }
    if (spec.constraints?.length) {
      parts.push('', '硬约束：');
      spec.constraints.forEach((c) => parts.push(`- ${c}`));
    }
    parts.push('', `输出格式：${spec.output.format}`);
    if (spec.output.fields?.length) {
      parts.push('需要包含以下字段：');
      spec.output.fields.forEach((f) =>
        parts.push(`- ${f.name}（${f.type}）：${f.description}`),
      );
    }
    return {
      family: 'deepseek-r1',
      system: '',
      user: parts.join('\n'),
      messages: [{ role: 'user', content: parts.join('\n') }],
      recommendedParameters: { temperature: 0.6 },
      notes: [
        'DeepSeek R1 会自己输出 `<think>…</think>`，**不要**在 Prompt 里再加"让我们一步一步思考"。',
        'few-shot 中的 reasoning 字段已被自动剥离；只保留 I/O 示例。',
        '部分兼容网关不支持 system 消息；此 Adapter 将全部指令合并到首条 user。',
      ],
    };
  },
};

export const qwenReasoningAdapter: SkillAdapter = {
  family: 'qwen-reasoning',
  descriptor: {
    family: 'qwen-reasoning',
    label: 'QwQ / Qwen3-Thinking',
    examples: ['qwq-32b', 'qwen3-thinking'],
    origin: 'china',
    reasoning: true,
    longContext: true,
    preferredFormat: 'plain',
    toolProtocol: 'openai',
  },
  render(spec) {
    const r1 = deepseekR1Adapter.render(spec);
    return {
      ...r1,
      family: 'qwen-reasoning',
      notes: [
        'QwQ / Qwen3-Thinking 属于原生推理模型，写法与 DeepSeek R1 / o1 对齐：只给问题和约束，不给 CoT 引导。',
        '建议 temperature 0.6；输出较长，请上调 max_tokens。',
      ],
    };
  },
};
