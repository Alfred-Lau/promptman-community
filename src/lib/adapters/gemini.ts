import type {
  CanonicalSkillSpec,
  RenderedSkill,
  SkillAdapter,
} from './types';

/**
 * Gemini Adapter：利用 system_instruction + 长上下文内联 knowledge。
 * 结构相对自由，Markdown + 段落混合即可。
 */
export const geminiAdapter: SkillAdapter = {
  family: 'gemini',
  descriptor: {
    family: 'gemini',
    label: 'Gemini (Google)',
    examples: ['gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-2.5-pro'],
    origin: 'international',
    reasoning: false,
    longContext: true,
    preferredFormat: 'markdown',
    toolProtocol: 'google',
  },
  render(spec: CanonicalSkillSpec): RenderedSkill {
    const parts: string[] = [];
    parts.push(`You are ${spec.persona ?? `an assistant specialized in: ${spec.name}`}.`);
    parts.push('', `Goal: ${spec.purpose}`);
    if (spec.whenToUse) parts.push('', `Invoke when: ${spec.whenToUse}`);
    if (spec.steps.length) {
      parts.push(
        '',
        'Steps:',
        ...spec.steps.map((s, i) => `${i + 1}. ${s}`),
      );
    }
    if (spec.inputs.length) {
      parts.push(
        '',
        'Inputs:',
        ...spec.inputs.map(
          (f) =>
            `- ${f.name} (${f.type}${f.required ? ', required' : ''}): ${f.description}`,
        ),
      );
    }
    if (spec.constraints?.length) {
      parts.push('', 'Constraints:', ...spec.constraints.map((c) => `- ${c}`));
    }
    parts.push('', `Output format: ${spec.output.format}`);
    if (spec.output.fields?.length) {
      parts.push(
        ...spec.output.fields.map((f) => `  - ${f.name} (${f.type}): ${f.description}`),
      );
    }

    if (spec.knowledge?.length) {
      parts.push('', '---', 'Reference material (inline, Gemini handles long context natively):');
      for (const k of spec.knowledge) {
        parts.push('', `### ${k.title}`, k.content);
      }
    }

    const toolDeclarations = spec.tools?.length
      ? [
          {
            function_declarations: spec.tools.map((t) => ({
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
                          ? 'ARRAY'
                          : p.type.toUpperCase(),
                      description: p.description,
                      ...(p.type === 'string[]'
                        ? { items: { type: 'STRING' } }
                        : {}),
                    },
                  ]),
                ),
                required: t.parameters
                  .filter((p) => p.required)
                  .map((p) => p.name),
              },
            })),
          },
        ]
      : undefined;

    return {
      family: 'gemini',
      system: parts.join('\n'),
      tools: toolDeclarations,
      recommendedParameters: {
        temperature: 0.3,
        response_mime_type:
          spec.output.format === 'json' ? 'application/json' : 'text/plain',
      },
      notes: [
        'Gemini 上下文长（1M–2M），知识文档可直接内联，不必像 Claude 那样做渐进披露。',
        '工具协议使用 Google 原生 `function_declarations`，参数类型需大写（STRING / ARRAY）。',
        '在 Gems / Vertex AI 平台发布时，本 `system` 可直接粘贴到 "System instructions"。',
      ],
    };
  },
};
