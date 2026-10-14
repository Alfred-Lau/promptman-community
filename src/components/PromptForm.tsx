'use client'

import { useState, useEffect } from 'react'
import { Save, X, Sparkles, RotateCcw, Check, AlertCircle } from 'lucide-react'
import { promptAPI, aiAPI, tagAPI } from '@/lib/seekdb/api'
import type { CloudLibraryFolder } from '@/lib/seekdb/api'
import type { PromptMetadata, CreatePromptInput, LibraryItem, TagDefinition } from '@/lib/seekdb/types'
import TagPicker from '@/components/TagPicker'
import VoiceButton from '@/components/VoiceButton'
import { useLocale } from '@/lib/i18n'
import { showDesktopNotification } from '@/lib/desktopNotify'
import { isMissingApiKeyError } from '@/lib/aiErrors'
import { BUILTIN_CATEGORIES, normalizeCategory } from '@/lib/promptPolicy'
import { defaultAccentForCategory } from '@/lib/intent-prompt-heuristics'

/** 多行文本 → string[]（每行一条，去空行）；空文本返回 [] 表示清空 */
const splitGuidanceLines = (text: string): string[] =>
  text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)

interface PromptFormProps {
  promptId?: string
  promptVersionId?: string // 如果提供，则创建新版本
  libraries?: LibraryItem[]
  /** 云端资料库（顶层 folder），可选。已登录 PromptHub 时显示 */
  cloudFolders?: CloudLibraryFolder[]
  /** 侧栏当前选中的库，新建时作为默认归属 */
  defaultLibraryId?: string | null
  /** 在表单内新建标签后刷新侧栏标签列表 */
  onTagsChanged?: () => void
  onSuccess?: () => void
  onCancel?: () => void
}

type PolishState = 'idle' | 'loading' | 'done' | 'error'

export default function PromptForm({
  promptId,
  promptVersionId,
  libraries = [],
  cloudFolders = [],
  defaultLibraryId = null,
  onTagsChanged,
  onSuccess,
  onCancel,
}: PromptFormProps) {
  const { t } = useLocale()
  const pf = t.promptForm
  const lib = t.library
  const st = t.settings
  const g = t.generate
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    description: '',
    libraryId: '',
    changeNotes: '',
    category: 'other',
    useWhen: '',
    guidance: '',
    pitfalls: '',
  })
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [allTags, setAllTags] = useState<TagDefinition[]>([])
  const [existingPrompt, setExistingPrompt] = useState<PromptMetadata | null>(null)

  // AI 润色状态
  const [polishState, setPolishState] = useState<PolishState>('idle')
  const [polishError, setPolishError] = useState<string | null>(null)
  const [originalContent, setOriginalContent] = useState<string | null>(null)
  const [showRestoreHint, setShowRestoreHint] = useState(false)

  useEffect(() => {
    if (promptId) {
      loadPrompt()
    } else if (promptVersionId) {
      loadPromptVersion()
    }
  }, [promptId, promptVersionId])

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
    if (!promptId && !promptVersionId) {
      setFormData((prev) => ({ ...prev, libraryId: defaultLibraryId ?? '' }))
    }
  }, [defaultLibraryId, promptId, promptVersionId])

  const loadPrompt = async () => {
    if (!promptId) return
    try {
      setLoading(true)
      const prompt = await promptAPI.get(promptId)
      if (prompt) {
        setExistingPrompt(prompt)
        setFormData({
          title: prompt.title,
          content: prompt.content,
          description: prompt.description || '',
          libraryId: prompt.libraryId ?? '',
          changeNotes: '',
          category: prompt.category || 'other',
          useWhen: (prompt.useWhen ?? []).join('\n'),
          guidance: (prompt.guidance ?? []).join('\n'),
          pitfalls: (prompt.pitfalls ?? []).join('\n'),
        })
        setSelectedTagIds(Array.isArray(prompt.tagIds) ? prompt.tagIds : [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : pf.errorLoad)
    } finally {
      setLoading(false)
    }
  }

  const loadPromptVersion = async () => {
    if (!promptVersionId) return
    try {
      setLoading(true)
      const prompt = await promptAPI.get(promptVersionId)
      if (prompt) {
        setExistingPrompt(prompt)
        setFormData({
          title: prompt.title,
          content: prompt.content,
          description: prompt.description || '',
          libraryId: prompt.libraryId ?? '',
          changeNotes: '',
          category: prompt.category || 'other',
          useWhen: (prompt.useWhen ?? []).join('\n'),
          guidance: (prompt.guidance ?? []).join('\n'),
          pitfalls: (prompt.pitfalls ?? []).join('\n'),
        })
        setSelectedTagIds(Array.isArray(prompt.tagIds) ? prompt.tagIds : [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : pf.errorLoadVersion)
    } finally {
      setLoading(false)
    }
  }

  const handlePolish = async () => {
    if (!formData.content.trim()) {
      setPolishError(pf.errorPolishEmpty)
      setPolishState('error')
      return
    }

    setPolishState('loading')
    setPolishError(null)
    setOriginalContent(formData.content)
    setShowRestoreHint(false)

    try {
      const polishTags = selectedTagIds
        .map((id) => allTags.find((x) => x.id === id)?.name)
        .filter((n): n is string => Boolean(n))

      const polished = await aiAPI.polish({
        content: formData.content,
        title: formData.title || undefined,
        description: formData.description || undefined,
        tags: polishTags.length > 0 ? polishTags : undefined,
      })

      setFormData((prev) => ({ ...prev, content: polished }))
      setPolishState('done')
      setShowRestoreHint(true)

      // 3秒后恢复提示消失
      setTimeout(() => setPolishState('idle'), 4000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setPolishError(
        isMissingApiKeyError(msg)
          ? g.errorMissingApiKey
          : err instanceof Error
            ? err.message
            : pf.errorPolishFailed,
      )
      setPolishState('error')
      setOriginalContent(null)
    }
  }

  const handleRestore = () => {
    if (originalContent !== null) {
      setFormData((prev) => ({ ...prev, content: originalContent }))
      setOriginalContent(null)
      setShowRestoreHint(false)
      setPolishState('idle')
    }
  }

  const syncToHub = async (item: {
    id?: string
    name: string
    content: string
    description?: string
    category?: string
    tags?: string[]
    client_updated_at?: string
  }) => {
    if (typeof window === 'undefined' || !window.electronAPI) return
    try {
      const userResult = await window.electronAPI.invoke('prompthub:auth:user')
      if (!userResult.success || !userResult.data) return
      await window.electronAPI.invoke('prompthub:sync:push', {
        upsert: [item],
      })
    } catch {
      // 同步失败不阻断本地保存流程，静默处理
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.title.trim() || !formData.content.trim()) {
      setError(pf.errorRequired)
      return
    }

    try {
      setLoading(true)

      const tags = selectedTagIds
      const hubTagNames = tags
        .map((id) => allTags.find((x) => x.id === id)?.name)
        .filter((n): n is string => Boolean(n))

      const libraryIdResolved = formData.libraryId.trim() || null
      const category = normalizeCategory(formData.category)
      const accent = defaultAccentForCategory(category)

      if (promptId) {
        // 更新现有prompt
        await promptAPI.update(promptId, {
          title: formData.title,
          content: formData.content,
          description: formData.description || undefined,
          libraryId: libraryIdResolved,
          tags,
          category,
          accent,
          useWhen: splitGuidanceLines(formData.useWhen),
          guidance: splitGuidanceLines(formData.guidance),
          pitfalls: splitGuidanceLines(formData.pitfalls),
        })
        // 推送到云端（若已登录 PromptHub）
        await syncToHub({
          id: promptId.startsWith('p_') ? promptId : undefined,
          name: formData.title,
          content: formData.content,
          description: formData.description || undefined,
          tags: hubTagNames,
          client_updated_at: new Date().toISOString(),
        })
      } else if (promptVersionId && existingPrompt) {
        // 创建新版本
        const newId = `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const input: CreatePromptInput = {
          id: newId,
          promptId: existingPrompt.promptId,
          title: formData.title,
          content: formData.content,
          description: formData.description || undefined,
          libraryId: libraryIdResolved,
          tags,
          changeNotes: formData.changeNotes || undefined,
          category,
          accent,
          useWhen: splitGuidanceLines(formData.useWhen),
          guidance: splitGuidanceLines(formData.guidance),
          pitfalls: splitGuidanceLines(formData.pitfalls),
        }
        await promptAPI.create(input)
        // 推送到云端（若已登录 PromptHub）
        await syncToHub({
          name: formData.title,
          content: formData.content,
          description: formData.description || undefined,
          tags: hubTagNames,
          client_updated_at: new Date().toISOString(),
        })
      } else {
        // 创建新prompt
        const newId = `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const input: CreatePromptInput = {
          id: newId,
          title: formData.title,
          content: formData.content,
          description: formData.description || undefined,
          libraryId: libraryIdResolved,
          tags,
          category,
          accent,
          useWhen: splitGuidanceLines(formData.useWhen),
          guidance: splitGuidanceLines(formData.guidance),
          pitfalls: splitGuidanceLines(formData.pitfalls),
        }
        await promptAPI.create(input)
        // 推送到云端（若已登录 PromptHub）
        await syncToHub({
          name: formData.title,
          content: formData.content,
          description: formData.description || undefined,
          tags: hubTagNames,
          client_updated_at: new Date().toISOString(),
        })
      }

      void showDesktopNotification({
        kind: 'save',
        title: st.notifToastSaveTitle,
        body: st.notifToastSaveBody(formData.title),
      })
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : pf.errorSave)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="prompt-form">
      <h2>{promptId ? pf.titleEdit : promptVersionId ? pf.titleNewVersion : pf.titleCreate}</h2>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="title">{pf.labelTitle}</label>
          <div className="input-with-voice">
            <input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder={pf.placeholderTitle}
              required
              disabled={loading}
            />
            <VoiceButton
              onTranscribed={(text) => setFormData((prev) => ({ ...prev, title: prev.title + text }))}
              disabled={loading}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="description">{pf.labelDescription}</label>
          <div className="input-with-voice">
            <input
              id="description"
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={pf.placeholderDescription}
              disabled={loading}
            />
            <VoiceButton
              onTranscribed={(text) => setFormData((prev) => ({ ...prev, description: prev.description + text }))}
              disabled={loading}
            />
          </div>
        </div>

        <details className="form-group prompt-guidance">
          <summary>{pf.labelGuidanceSection}</summary>
          <div className="guidance-field">
            <label htmlFor="useWhen">{pf.labelUseWhen}</label>
            <textarea
              id="useWhen"
              rows={3}
              value={formData.useWhen}
              onChange={(e) => setFormData({ ...formData, useWhen: e.target.value })}
              placeholder={pf.placeholderUseWhen}
              disabled={loading}
            />
          </div>
          <div className="guidance-field">
            <label htmlFor="guidance">{pf.labelGuidance}</label>
            <textarea
              id="guidance"
              rows={3}
              value={formData.guidance}
              onChange={(e) => setFormData({ ...formData, guidance: e.target.value })}
              placeholder={pf.placeholderGuidance}
              disabled={loading}
            />
          </div>
          <div className="guidance-field">
            <label htmlFor="pitfalls">{pf.labelPitfalls}</label>
            <textarea
              id="pitfalls"
              rows={3}
              value={formData.pitfalls}
              onChange={(e) => setFormData({ ...formData, pitfalls: e.target.value })}
              placeholder={pf.placeholderPitfalls}
              disabled={loading}
            />
          </div>
        </details>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="libraryId">{pf.labelLibrary}</label>
            <select
              id="libraryId"
              value={formData.libraryId}
              onChange={(e) => setFormData({ ...formData, libraryId: e.target.value })}
              disabled={loading}
              className="library-select"
            >
              <option value="">{pf.optionNoLibrary}</option>
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
            <label>{pf.labelCategory}</label>
            <div className="category-chips">
              {BUILTIN_CATEGORIES.map((cat) => {
                const labels: Record<string, string> = {
                  code: pf.categoryCode,
                  writing: pf.categoryWriting,
                  analysis: pf.categoryAnalysis,
                  creative: pf.categoryCreative,
                  other: pf.categoryOther,
                }
                const active = formData.category === cat
                return (
                  <button
                    key={cat}
                    type="button"
                    className={`category-chip${active ? ' category-chip--active' : ''}`}
                    onClick={() => setFormData((prev) => ({ ...prev, category: cat }))}
                    disabled={loading}
                  >
                    {labels[cat]}
                  </button>
                )
              })}
            </div>
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
          <div className="content-label-row">
            <label htmlFor="content">{pf.labelContent}</label>
            <div className="content-toolbar">
              {showRestoreHint && originalContent !== null && (
                <button
                  type="button"
                  className="btn-restore"
                  onClick={handleRestore}
                  title={pf.btnRestoreTitle}
                >
                  <RotateCcw size={13} />
                  <span>{pf.btnRestore}</span>
                </button>
              )}
              <button
                type="button"
                className={`btn-polish ${polishState}`}
                onClick={handlePolish}
                disabled={loading || polishState === 'loading'}
                title={pf.btnPolishTitle}
              >
                {polishState === 'loading' ? (
                  <>
                    <span className="polish-spinner" />
                    <span>{pf.btnPolishing}</span>
                  </>
                ) : polishState === 'done' ? (
                  <>
                    <Check size={14} />
                    <span>{pf.btnPolishDone}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>{pf.btnPolish}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {polishState === 'error' && polishError && (
            <div className="polish-error">
              <AlertCircle size={13} />
              <span>{polishError}</span>
            </div>
          )}

          <div className="textarea-with-voice">
            <div className="textarea-voice-toolbar">
              <VoiceButton
                onTranscribed={(text) => setFormData((prev) => ({ ...prev, content: prev.content + text }))}
                mode="append"
                disabled={loading}
              />
            </div>
            <textarea
              id="content"
              value={formData.content}
              onChange={(e) => {
                setFormData({ ...formData, content: e.target.value })
                if (polishState === 'done' || polishState === 'error') {
                  setPolishState('idle')
                  setShowRestoreHint(false)
                }
              }}
              placeholder={pf.placeholderContent}
              rows={15}
              required
              disabled={loading || polishState === 'loading'}
              className={polishState === 'loading' ? 'polishing' : polishState === 'done' ? 'polished' : ''}
            />
          </div>
        </div>

        {promptVersionId && (
          <div className="form-group">
            <label htmlFor="changeNotes">{pf.labelChangeNotes}</label>
            <div className="input-with-voice">
              <input
                id="changeNotes"
                type="text"
                value={formData.changeNotes}
                onChange={(e) => setFormData({ ...formData, changeNotes: e.target.value })}
                placeholder={pf.placeholderChangeNotes}
                disabled={loading}
              />
              <VoiceButton
                onTranscribed={(text) => setFormData((prev) => ({ ...prev, changeNotes: prev.changeNotes + text }))}
                disabled={loading}
              />
            </div>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <Save size={16} /> {loading ? pf.btnSaving : pf.btnSave}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn btn-secondary" disabled={loading}>
              <X size={16} /> {pf.btnCancel}
            </button>
          )}
        </div>
      </form>

      <style jsx>{`
        .prompt-form {
          width: 100%;
          max-width: 800px;
          animation: fadeInOpacity 0.35s ease;
        }

        .prompt-form h2 {
          margin: 0 0 2rem 0;
          font-size: 1.3rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.03em;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
        }

        label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
          font-size: 0.78rem;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        input,
        textarea {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: 0.9rem;
          font-family: inherit;
          background: var(--bg-glass);
          transition: all var(--transition-fast);
        }

        input::placeholder,
        textarea::placeholder {
          color: var(--text-tertiary);
        }

        input:focus,
        textarea:focus {
          outline: none;
          border-color: var(--border-focus);
          box-shadow: 0 0 0 3px var(--input-focus-shadow);
          background: var(--bg-item-hover);
        }

        input:disabled,
        textarea:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          background: var(--input-disabled-bg);
        }

        .library-select {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: 0.9rem;
          font-family: inherit;
          background: var(--bg-glass);
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

        .category-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .category-chip {
          padding: 5px 10px;
          border-radius: 999px;
          border: 1px solid var(--border-color);
          background: transparent;
          color: inherit;
          font-size: 0.78rem;
          cursor: pointer;
        }
        .category-chip--active {
          background: var(--accent-muted);
          border-color: var(--accent-color);
          color: var(--accent-color);
        }

        textarea {
          resize: vertical;
          min-height: 280px;
          font-family: 'SF Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, Liberation Mono, monospace;
          font-size: 0.85rem;
          line-height: 1.65;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
        }

        textarea.polishing {
          opacity: 0.5;
          cursor: wait;
          border-color: var(--accent-color);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
          animation: polishPulse 1.5s ease-in-out infinite;
        }

        textarea.polished {
          border-color: rgba(34, 197, 94, 0.5);
          box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.08);
        }

        @keyframes polishPulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12); }
          50% { box-shadow: 0 0 0 6px rgba(99, 102, 241, 0.06); }
        }

        .content-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .content-label-row label {
          margin-bottom: 0;
        }

        .content-toolbar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .btn-polish {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 5px 12px;
          border-radius: var(--radius-md);
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          border: 1px solid transparent;
          letter-spacing: 0.01em;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.12) 100%);
          color: #818cf8;
          border-color: rgba(99, 102, 241, 0.25);
        }

        .btn-polish:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%);
          border-color: rgba(99, 102, 241, 0.4);
          color: #a5b4fc;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
        }

        .btn-polish:active:not(:disabled) {
          transform: translateY(0);
        }

        .btn-polish:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-polish.loading {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%);
          border-color: rgba(99, 102, 241, 0.3);
          color: #818cf8;
        }

        .btn-polish.done {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%);
          border-color: rgba(34, 197, 94, 0.3);
          color: #4ade80;
        }

        .btn-polish.error {
          background: linear-gradient(135deg, rgba(244, 63, 94, 0.1) 0%, rgba(239, 68, 68, 0.1) 100%);
          border-color: rgba(244, 63, 94, 0.25);
          color: #f87171;
        }

        .polish-spinner {
          width: 12px;
          height: 12px;
          border: 2px solid rgba(129, 140, 248, 0.3);
          border-top-color: #818cf8;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .btn-restore {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 5px 10px;
          border-radius: var(--radius-md);
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          border: 1px solid var(--border-color);
          background: var(--bg-glass);
          color: var(--text-tertiary);
          letter-spacing: 0.01em;
        }

        .btn-restore:hover {
          background: var(--bg-item-hover);
          color: var(--text-secondary);
          border-color: var(--border-focus);
        }

        .polish-error {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.6rem 0.875rem;
          border-radius: var(--radius-md);
          background: var(--danger-muted);
          border: 1px solid rgba(244, 63, 94, 0.2);
          color: var(--danger-color);
          font-size: 0.8rem;
          margin-bottom: 0.5rem;
          animation: fadeIn 0.2s ease;
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
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: transparent;
          color: var(--text-primary);
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

