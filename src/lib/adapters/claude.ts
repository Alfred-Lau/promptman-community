import type {
  CanonicalSkillSpec,
  RenderedSkill,
  SkillAdapter,
  ShotExample,
} from './types';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function xmlWrap(tag: string, content: string, indent = 0): string {
  const pad = '  '.repeat(indent);
  return `${pad}<${tag}>\n${content}\n${pad}</${tag}>`;
}

function renderExamples(examples: ShotExample[] = []): string {
  if (examples.length === 0) return '';
  const body = examples
    .map((ex, i) => {
      const parts: string[] = [
        `  <input>${escapeXml(ex.input)}</input>`,
      ];
      if (ex.reasoning) {
        parts.push(`  <reasoning>${escapeXml(ex.reasoning)}</reasoning>`);
      }
      parts.push(`  <output>${escapeXml(ex.output)}</output>`);
      return `<example id="${i + 1}">\n${parts.join('\n')}\n</example>`;
    })
    .join('\n');
  return xmlWrap('examples', body);
}

function renderInputs(spec: CanonicalSkillSpec): string {
  if (!spec.inputs.length) return '';
  const rows = spec.inputs
    .map(
      (f) =>
        `  <field name="${f.name}" type="${f.type}"${f.required ? ' required="true"' : ''}>${escapeXml(f.description)}</field>`,
    )
    .join('\n');
  return xmlWrap('inputs', rows);
}

function renderOutput(spec: CanonicalSkillSpec): string {
  const lines: string[] = [`  <format>${spec.output.format}</format>`];
  if (spec.output.fields?.length) {
    const rows = spec.output.fields
      .map(
        (f) =>
          `    <field name="${f.name}" type="${f.type}">${escapeXml(f.description)}</field>`,
      )
      .join('\n');
    lines.push(`  <fields>\n${rows}\n  </fields>`);
  }
  if (spec.output.constraints?.length) {
    lines.push(
      `  <constraints>\n${spec.output.constraints
        .map((c) => `    <item>${escapeXml(c)}</item>`)
        .join('\n')}\n  </constraints>`,
    );
  }
  return xmlWrap('output', lines.join('\n'));
}

function renderTools(spec: CanonicalSkillSpec): unknown {
  if (!spec.tools?.length) return undefined;
  return spec.tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: {
      type: 'object',
      properties: Object.fromEntries(
        t.parameters.map((p) => [
          p.name,
          { type: p.type === 'string[]' ? 'array' : p.type, description: p.description },
        ]),
      ),
      required: t.parameters.filter((p) => p.required).map((p) => p.name),
    },
  }));
}

/**
 * 生成 Claude "Agent Skills" 规范的 SKILL.md。
 * Anthropic 官方 Skills 需要一个 frontmatter + 渐进披露的 Markdown 文件。
 */
function renderSkillMd(spec: CanonicalSkillSpec): string {
  const frontmatter = [
    '---',
    `name: ${spec.id}`,
    `description: ${spec.purpose}`,
    spec.whenToUse ? `when_to_use: ${spec.whenToUse}` : null,
    spec.meta?.version ? `version: ${spec.meta.version}` : null,
    '---',
  ]
    .filter(Boolean)
    .join('\n');

  const body: string[] = [`# ${spec.name}`, '', spec.purpose, ''];
  if (spec.persona) {
    body.push('## Role', spec.persona, '');
  }
  if (spec.whenToUse) {
    body.push('## When to use this skill', spec.whenToUse, '');
  }
  body.push(
    '## Instructions',
    ...spec.steps.map((s, i) => `${i + 1}. ${s}`),
    '',
  );
  if (spec.constraints?.length) {
    body.push('## Constraints', ...spec.constraints.map((c) => `- ${c}`), '');
  }
  if (spec.output.format !== 'text') {
    body.push(
      '## Output',
      `Return the answer as **${spec.output.format}**.`,
      '',
    );
  }
  if (spec.examples?.length) {
    body.push('## Examples');
    spec.examples.forEach((ex, i) => {
      body.push(
        `### Example ${i + 1}`,
        `**Input:** ${ex.input}`,
        '',
        `**Output:** ${ex.output}`,
        '',
      );
    });
  }
  return `${frontmatter}\n\n${body.join('\n')}`;
}

export const claudeAdapter: SkillAdapter = {
  family: 'claude',
  descriptor: {
    family: 'claude',
    label: 'Claude (Anthropic)',
    examples: ['claude-sonnet-4.5', 'claude-opus-4', 'claude-haiku-4'],
    origin: 'international',
    reasoning: false,
    longContext: true,
    preferredFormat: 'xml',
    toolProtocol: 'anthropic',
  },
  render(spec: CanonicalSkillSpec): RenderedSkill {
    const segments: string[] = [];

    if (spec.persona) {
      segments.push(xmlWrap('role', `  ${escapeXml(spec.persona)}`));
    }
    segments.push(xmlWrap('purpose', `  ${escapeXml(spec.purpose)}`));

    if (spec.whenToUse) {
      segments.push(xmlWrap('when_to_use', `  ${escapeXml(spec.whenToUse)}`));
    }

    segments.push(
      xmlWrap(
        'instructions',
        spec.steps
          .map((s, i) => `  <step order="${i + 1}">${escapeXml(s)}</step>`)
          .join('\n'),
      ),
    );

    const inputs = renderInputs(spec);
    if (inputs) segments.push(inputs);

    if (spec.constraints?.length) {
      segments.push(
        xmlWrap(
          'constraints',
          spec.constraints
            .map((c) => `  <item>${escapeXml(c)}</item>`)
            .join('\n'),
        ),
      );
    }

    segments.push(renderOutput(spec));

    const examples = renderExamples(spec.examples);
    if (examples) segments.push(examples);

    if (spec.knowledge?.length) {
      const kb = spec.knowledge
        .map(
          (k) =>
            `  <document title="${escapeXml(k.title)}">\n${escapeXml(k.content)}\n  </document>`,
        )
        .join('\n');
      segments.push(xmlWrap('reference_material', kb));
    }

    return {
      family: 'claude',
      system: segments.join('\n\n'),
      tools: renderTools(spec),
      recommendedParameters: {
        temperature: 0.2,
        max_tokens: 4096,
      },
      artifacts: [
        {
          filename: 'SKILL.md',
          language: 'markdown',
          content: renderSkillMd(spec),
          description:
            'Drop this file under `skills/<skill-id>/SKILL.md` when deploying Anthropic Agent Skills. Claude 会按需渐进披露。',
        },
      ],
      notes: [
        'Claude 在 XML 结构下表现最稳：每个语义模块用独立标签包裹，比 Markdown 标题更可靠。',
        '工具协议走 Anthropic tool_use；如需通过 Bedrock/OpenAI-兼容 gateway 调用，请用对应 Adapter 再渲染一次。',
        '若在 Cursor / Claude Code 中使用，将 `SKILL.md` artifact 放到 `.claude/skills/<id>/` 目录可自动被识别。',
      ],
    };
  },
};
