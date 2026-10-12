'use client'

import { useState, useEffect } from 'react'
import { Save, X } from 'lucide-react'
import { agentSkillAPI, tagAPI } from '@/lib/seekdb/api'
import type { CloudLibraryFolder } from '@/lib/seekdb/api'
import { agentSkillTemplates, parseSkillMd } from '@/lib/agentSkillTemplates'
import { SKILL_MD_TEMPLATES, getSkillMdTemplateContent, type SkillMdTemplateId } from '@/lib/skillMdTemplates'
import type { AgentSkillMetadata, CreateAgentSkillInput, LibraryItem, TagDefinition } from '@/lib/seekdb/types'
import TagPicker from '@/components/TagPicker'
import VoiceButton from '@/components/VoiceButton'
import SkillPackagePanel from '@/components/SkillPackagePanel'
import { useLocale } from '@/lib/i18n'

/** 与 prompthub-website 的 PLATFORMS_OPTIONS 保持一致 */
const PLATFORM_OPTIONS = [
  'Cursor',
  'VS Code',
  'ChatGPT',
  'Claude',
  'Gemini',
  'GitHub Copilot',
  'GPT-4',
]

interface AgentSkillFormProps {
  skillId?: string
  skillVersionId?: string // 如果提供，则创建新版本
  libraries?: LibraryItem[]
  /** 云端资料库（顶层 folder），可选。已登录 PromptHub 时显示 */
  cloudFolders?: CloudLibraryFolder[]
  defaultLibraryId?: string | null
  onTagsChanged?: () => void
  onSuccess?: () => void
  onCancel?: () => void
}

export default function AgentSkillForm({
  skillId,
  skillVersionId,
  libraries = [],
  cloudFolders = [],
  defaultLibraryId = null,
  onTagsChanged,
  onSuccess,
  onCancel,
}: AgentSkillFormProps) {
  const { t, locale } = useLocale()
  const pf = t.promptForm
  const lib = t.library
  const sp = t.skillPackage
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    libraryId: '',
    template: '',
    parameters: '',
    examples: '',
    versionLabel: 'v1.0',
  })
  const [platforms, setPlatforms] = useState<string[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [allTags, setAllTags] = useState<TagDefinition[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [selectedMdTemplate, setSelectedMdTemplate] = useState<SkillMdTemplateId | ''>('')
  const [existingSkill, setExistingSkill] = useState<AgentSkillMetadata | null>(null)

  // 技能包挂在 skill_id 分组上；新建技能时还没有分组，保存后才能导入
  const packageSkillGroupId = existingSkill?.skillId ?? null

  const loadTagOptions = async () => {
    try {
      const data = await tagAPI.getAll()
      setAllTags(data)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void loadTagOptions()
  }, [])

  useEffect(() => {
    if (skillId) {
      loadSkill()
    } else if (skillVersionId) {
      loadSkillVersion()
    }
  }, [skillId, skillVersionId])

  useEffect(() => {
    if (!skillId && !skillVersionId) {
      setFormData((prev) => ({ ...prev, libraryId: defaultLibraryId ?? '' }))
    }
  }, [defaultLibraryId, skillId, skillVersionId])

  const loadSkill = async () => {
    if (!skillId) return
    try {
      setLoading(true)
      const skill = await agentSkillAPI.get(skillId)
      if (skill) {
        setExistingSkill(skill)
        setFormData({
          name: skill.name,
          description: skill.description || '',
          libraryId: skill.libraryId ?? '',
          template: skill.template,
          parameters: JSON.stringify(skill.parameters || {}, null, 2),
          examples: (skill.examples || []).join('\n'),
          versionLabel: skill.versionLabel || 'v1.0',
        })
        setPlatforms(Array.isArray(skill.platforms) ? skill.platforms : [])
        setSelectedTagIds(Array.isArray(skill.tagIds) ? skill.tagIds : [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载 Agent Skill 失败')
    } finally {
      setLoading(false)
    }
  }

  const loadSkillVersion = async () => {
    if (!skillVersionId) return
    try {
      setLoading(true)
      const skill = await agentSkillAPI.get(skillVersionId)
      if (skill) {
        setExistingSkill(skill)
        setFormData({
          name: skill.name,
          description: skill.description || '',
          libraryId: skill.libraryId ?? '',
          template: skill.template,
          parameters: JSON.stringify(skill.parameters || {}, null, 2),
          examples: (skill.examples || []).join('\n'),
          versionLabel: skill.versionLabel || 'v1.0',
        })
        setPlatforms(Array.isArray(skill.platforms) ? skill.platforms : [])
        setSelectedTagIds(Array.isArray(skill.tagIds) ? skill.tagIds : [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载 Agent Skill 版本失败')
    } finally {
      setLoading(false)
    }
  }

  const handleTemplateSelect = async (templateName: string) => {
    const template = agentSkillTemplates.find((t) => t.name === templateName)
    if (!template) return
    setSelectedTemplate(templateName)
    setFormData((prev) => ({
      name: template.name,
      description: template.description,
      libraryId: prev.libraryId,
      template: template.template,
      parameters: JSON.stringify(template.parameters || {}, null, 2),
      examples: (template.examples || []).join('\n'),
      versionLabel: prev.versionLabel,
    }))
    const ids: string[] = []
    for (const nm of template.tags || []) {
      const s = String(nm).trim()
      if (!s) continue
      try {
        const row = await tagAPI.create(s)
        ids.push(row.id)
      } catch {
        // ignore
      }
    }
    setSelectedTagIds(ids)
    await loadTagOptions()
  }

  /**
   * 保存后把技能推到云端（沿用 PromptForm 的做法：未登录或失败都静默跳过，不阻断本地保存）
   */
  const pushSkillToHub = async (skillGroupId: string) => {
    if (typeof window === 'undefined' || !window.electronAPI) return
    try {
      const userResult = await window.electronAPI.invoke('prompthub:auth:user')
      if (!userResult.success || !userResult.data) return
      await window.electronAPI.invoke('prompthub:skill:pushOne', { skillId: skillGroupId })
    } catch {
      // 同步失败不阻断本地保存流程，静默处理
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.name.trim() || !formData.template.trim()) {
      setError('名称和模板不能为空')
      return
    }

    try {
      setLoading(true)

      let parametersObj: Record<string, unknown> = {}
      if (formData.parameters.trim()) {
        try {
          parametersObj = JSON.parse(formData.parameters)
        } catch {
          setError('参数格式不正确，必须是有效的 JSON')
          setLoading(false)
          return
        }
      }

      const examplesArray = formData.examples
        .split('\n')
        .map((e) => e.trim())
        .filter(Boolean)

      const libraryIdResolved = formData.libraryId.trim() || null
      const tagList = selectedTagIds

      let savedSkillGroupId: string | null = null

      if (skillId) {
        // 更新现有 Agent Skill
        await agentSkillAPI.update(skillId, {
          name: formData.name,
          description: formData.description || undefined,
          category: '',
          libraryId: libraryIdResolved,
          template: formData.template,
          parameters: parametersObj,
          examples: examplesArray,
          tags: tagList,
          platforms,
          versionLabel: formData.versionLabel.trim() || 'v1.0',
        })
        savedSkillGroupId = existingSkill?.skillId ?? null
      } else if (skillVersionId && existingSkill) {
        // 创建新版本
        const newId = `skill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const input: CreateAgentSkillInput = {
          id: newId,
          skillId: existingSkill.skillId,
          name: formData.name,
          description: formData.description || undefined,
          category: '',
          libraryId: libraryIdResolved,
          template: formData.template,
          parameters: parametersObj,
          examples: examplesArray,
          tags: tagList,
          platforms,
          versionLabel: formData.versionLabel.trim() || 'v1.0',
        }
        await agentSkillAPI.create(input)
        savedSkillGroupId = existingSkill.skillId
      } else {
        // 创建新 Agent Skill
        const newId = `skill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const input: CreateAgentSkillInput = {
          id: newId,
          name: formData.name,
          description: formData.description || undefined,
          category: '',
          libraryId: libraryIdResolved,
          template: formData.template,
          parameters: parametersObj,
          examples: examplesArray,
          tags: tagList,
          platforms,
          versionLabel: formData.versionLabel.trim() || 'v1.0',
        }
        await agentSkillAPI.create(input)
        // 新建时 skill_id 由主进程生成，取回当前版本以拿到分组 id
        savedSkillGroupId = (await agentSkillAPI.get(newId))?.skillId ?? null
      }

      if (savedSkillGroupId) {
        await pushSkillToHub(savedSkillGroupId)
      }

      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="agent-skill-form">
      <h2>{skillId ? '编辑 Agent Skill' : skillVersionId ? '创建新版本' : '创建 Agent Skill'}</h2>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {!skillId && !skillVersionId && (
        <div className="template-selector">
          <label>SKILL.md 快速模板</label>
          <div className="md-template-grid">
            {SKILL_MD_TEMPLATES.map((tpl) => {
              const active = selectedMdTemplate === tpl.id
              return (
                <button
                  key={tpl.id}
                  type="button"
                  className={`md-template-card${active ? ' md-template-card--active' : ''}`}
                  style={{ borderColor: active ? tpl.accent : undefined, ['--tpl-accent' as string]: tpl.accent }}
                  disabled={loading}
                  onClick={() => {
                    const content = getSkillMdTemplateContent(tpl.id, locale)
                    const parsed = parseSkillMd(content)
                    setSelectedMdTemplate(tpl.id)
                    setSelectedTemplate('')
                    setFormData((prev) => ({
                      ...prev,
                      name: prev.name.trim() ? prev.name : (parsed.frontmatter.name || prev.name),
                      description: prev.description.trim()
                        ? prev.description
                        : (parsed.frontmatter.description || prev.description),
                      template: content,
                    }))
                  }}
                >
                  <strong>{tpl.title[locale]}</strong>
                  <span>{tpl.summary[locale]}</span>
                </button>
              )
            })}
          </div>
          <label htmlFor="template-select" className="more-templates-label">完整技能模板（可选）</label>
          <select
            id="template-select"
            value={selectedTemplate}
            onChange={(e) => {
              setSelectedMdTemplate('')
              void handleTemplateSelect(e.target.value)
            }}
            className="template-select"
            disabled={loading}
          >
            <option value="">-- 选择模板 --</option>
            {agentSkillTemplates.map((template) => (
              <option key={template.name} value={template.name}>
                {template.name} - {template.description}
              </option>
            ))}
          </select>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">名称 *</label>
          <div className="input-with-voice">
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="输入 Agent Skill 名称"
              required
              disabled={loading}
            />
            <VoiceButton
              onTranscribed={(text) => setFormData((prev) => ({ ...prev, name: prev.name + text }))}
              disabled={loading}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="description">描述</label>
          <div className="input-with-voice">
            <input
              id="description"
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="描述 WHAT (功能) 和 WHEN (触发时机)，使用第三人称"
              disabled={loading}
            />
            <VoiceButton
              onTranscribed={(text) => setFormData((prev) => ({ ...prev, description: prev.description + text }))}
              disabled={loading}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="skill-libraryId">{lib.assignLabel}</label>
            <select
              id="skill-libraryId"
              value={formData.libraryId}
              onChange={(e) => setFormData({ ...formData, libraryId: e.target.value })}
              disabled={loading}
              className="library-select"
            >
              <option value="">{lib.assignNone}</option>
              {libraries.length > 0 && (
                <optgroup label={lib.localSection}>
                  {libraries.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.icon} {item.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {cloudFolders.length > 0 && (
                <optgroup label={lib.cloudSection}>
                  {cloudFolders.map((folder) => (
                    <option key={`cloud-${folder.id}`} value={`cloud:${folder.id}`}>
                      ☁️ {folder.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {libraries.length === 0 && cloudFolders.length === 0 && (
              <p className="library-empty-hint">{lib.noLibraries}</p>
            )}
          </div>

          <div className="form-group">
            <label>{pf.labelTags}</label>
            <TagPicker
              value={selectedTagIds}
              onChange={setSelectedTagIds}
              allTags={allTags}
              onTagsUpdated={() => {
                void loadTagOptions()
                onTagsChanged?.()
              }}
              disabled={loading}
              labels={{
                selectPlaceholder: lib.tagSelectPlaceholder,
                newTagPlaceholder: lib.tagNewPlaceholder,
                addNew: lib.tagAddNew,
              }}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="template">Skill Template (Markdown) *</label>
          <div className="template-hint">遵循 Cursor SKILL.md 规范：使用 Markdown 编写，包含 Instructions、Checklist、Examples 等章节</div>
          <div className="textarea-with-voice">
            <div className="textarea-voice-toolbar">
              <VoiceButton
                onTranscribed={(text) => setFormData((prev) => ({ ...prev, template: prev.template + text }))}
                mode="append"
                disabled={loading}
              />
            </div>
            <textarea
              id="template"
              value={formData.template}
              onChange={(e) => setFormData({ ...formData, template: e.target.value })}
              placeholder={`# Skill Name\n\n## Instructions\nClear, step-by-step guidance for the agent.\n\n## Checklist\n- [ ] Step 1\n- [ ] Step 2\n\n## Examples\nConcrete examples of using this skill.`}
              rows={16}
              required
              disabled={loading}
              className="code-textarea"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="skill-version-label">{sp.versionLabel}</label>
            <input
              id="skill-version-label"
              type="text"
              value={formData.versionLabel}
              onChange={(e) => setFormData({ ...formData, versionLabel: e.target.value })}
              placeholder="v1.0"
              disabled={loading}
            />
            <p className="field-hint">{sp.versionLabelHint}</p>
          </div>

          <div className="form-group">
            <label>{sp.platformsLabel}</label>
            <div className="platform-chips">
              {PLATFORM_OPTIONS.map((option) => {
                const active = platforms.includes(option)
                return (
                  <button
                    key={option}
                    type="button"
                    className={`platform-chip${active ? ' platform-chip--active' : ''}`}
                    onClick={() =>
                      setPlatforms((prev) =>
                        prev.includes(option)
                          ? prev.filter((p) => p !== option)
                          : [...prev, option],
                      )
                    }
                    disabled={loading}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* 多文件技能包：需要先有 skill_id 分组才能落盘，故新建时仅提示 */}
        <div className="form-group">
          <label>{sp.packageLabel}</label>
          {packageSkillGroupId ? (
            <SkillPackagePanel
              skillId={packageSkillGroupId}
              disabled={loading}
              onTemplateFilled={(skillMd) =>
                setFormData((prev) => (prev.template.trim() ? prev : { ...prev, template: skillMd }))
              }
            />
          ) : (
            <p className="field-hint">{sp.packageAfterSaveHint}</p>
          )}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="parameters">参数定义 (JSON)</label>
            <textarea
              id="parameters"
              value={formData.parameters}
              onChange={(e) => setFormData({ ...formData, parameters: e.target.value })}
              placeholder="输入参数定义（JSON 格式，可选）"
              rows={8}
              disabled={loading}
              className="code-textarea"
            />
          </div>

          <div className="form-group">
            <label htmlFor="examples">使用示例</label>
            <div className="textarea-with-voice">
              <div className="textarea-voice-toolbar">
                <VoiceButton
                  onTranscribed={(text) => setFormData((prev) => ({ ...prev, examples: prev.examples + text }))}
                  mode="append"
                  disabled={loading}
                />
              </div>
              <textarea
                id="examples"
                value={formData.examples}
                onChange={(e) => setFormData({ ...formData, examples: e.target.value })}
                placeholder="每行一个示例（可选）"
                rows={8}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <Save size={16} /> {loading ? '保存中...' : '保存'}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn btn-secondary" disabled={loading}>
              <X size={16} /> 取消
            </button>
          )}
        </div>
      </form>

      <style jsx>{`
        .agent-skill-form {
          width: 100%;
          max-width: 900px;
          animation: fadeInOpacity 0.35s ease;
        }

        .agent-skill-form h2 {
          margin: 0 0 2rem 0;
          font-size: 1.3rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.03em;
        }

        .template-selector {
          margin-bottom: 1.5rem;
          padding: 1rem;
          background: var(--bg-glass);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-color);
        }

        .template-selector label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
          font-size: 0.78rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .template-select {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          font-size: 0.85rem;
          background: var(--bg-app);
          color: var(--text-primary);
          transition: all var(--transition-fast);
        }

        .template-select:focus {
          outline: none;
          border-color: var(--border-focus);
          box-shadow: 0 0 0 3px var(--input-focus-shadow);
        }

        .md-template-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 8px;
          margin-bottom: 12px;
        }
        .md-template-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          padding: 10px 11px;
          border-radius: 10px;
          border: 1px solid var(--border-color);
          background: var(--bg-app);
          color: inherit;
          cursor: pointer;
          text-align: left;
        }
        .md-template-card strong {
          font-size: 0.82rem;
        }
        .md-template-card span {
          font-size: 0.72rem;
          color: var(--text-tertiary);
          line-height: 1.35;
        }
        .md-template-card--active {
          box-shadow: inset 0 0 0 1px var(--tpl-accent, var(--accent-color));
        }
        .more-templates-label {
          margin-top: 4px;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
          font-size: 0.78rem;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          font-size: 0.9rem;
          color: var(--text-primary);
          background: var(--bg-glass);
          transition: all var(--transition-fast);
          font-family: inherit;
        }

        .form-group input::placeholder,
        .form-group textarea::placeholder {
          color: var(--text-tertiary);
        }

        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: var(--border-focus);
          box-shadow: 0 0 0 3px var(--input-focus-shadow);
          background: var(--bg-item-hover);
        }

        .form-group input:disabled,
        .form-group textarea:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          background: var(--input-disabled-bg);
        }

        .library-select {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          font-size: 0.9rem;
          color: var(--text-primary);
          background: var(--bg-glass);
          font-family: inherit;
          cursor: pointer;
        }

        .library-select:focus {
          outline: none;
          border-color: var(--border-focus);
          box-shadow: 0 0 0 3px var(--input-focus-shadow);
        }

        .library-select:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .library-empty-hint {
          margin: 0.45rem 0 0;
          font-size: 0.78rem;
          color: var(--text-tertiary);
          line-height: 1.4;
        }

        .template-hint {
          font-size: 0.75rem;
          color: var(--text-tertiary);
          margin-bottom: 0.5rem;
          line-height: 1.4;
        }

        .field-hint {
          margin: 0.45rem 0 0;
          font-size: 0.75rem;
          color: var(--text-tertiary);
          line-height: 1.4;
        }

        .platform-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .platform-chip {
          padding: 0.35rem 0.75rem;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          background: var(--bg-glass);
          color: var(--text-secondary);
          font-size: 0.8rem;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          transition: all var(--transition-fast);
          line-height: 1.3;
        }

        .platform-chip:hover:not(:disabled) {
          background: var(--bg-item-hover);
          color: var(--text-primary);
          border-color: var(--border-focus);
        }

        .platform-chip--active {
          background: var(--category-tag-bg);
          color: var(--accent-color);
          border-color: var(--badge-version-border);
        }

        .platform-chip:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .code-textarea {
          font-family: 'SF Mono', ui-monospace, Menlo, Consolas, monospace;
          font-size: 0.82rem;
          line-height: 1.65;
        }

        .form-actions {
          display: flex;
          gap: 0.75rem;
          margin-top: 2rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--border-color);
        }

        .btn {
          padding: 10px 20px;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-normal);
          background: transparent;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 0.5rem;
          letter-spacing: -0.01em;
        }

        .btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .btn-primary {
          background: var(--accent-color);
          color: white;
          border: none;
        }

        .btn-primary:hover:not(:disabled) {
          background: var(--accent-hover);
          box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
          transform: translateY(-1px);
        }

        .btn-primary:active:not(:disabled) {
          transform: translateY(0);
        }

        .btn-secondary {
          background: transparent;
          color: var(--text-secondary);
        }

        .btn-secondary:hover:not(:disabled) {
          background: var(--bg-item-hover);
          color: var(--text-primary);
        }

        .error-message {
          border: 1px solid rgba(244, 63, 94, 0.2);
          border-radius: var(--radius-lg);
          color: var(--danger-color);
          background: var(--danger-muted);
          padding: 0.875rem 1rem;
          margin-bottom: 1.5rem;
          font-size: 0.85rem;
        }

        .input-with-voice {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .input-with-voice input {
          flex: 1;
          min-width: 0;
        }

        .textarea-with-voice {
          position: relative;
        }

        .textarea-voice-toolbar {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 6px;
        }
      `}</style>
    </div>
  )
}

