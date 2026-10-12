'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { agentTeamAPI } from '@/lib/seekdb/api'
import { TEAM_CATEGORIES, TEAM_TEMPLATES } from '@/lib/teamTemplates'
import type { AgentTeamMetadata, TeammateDef, TeamDisplayMode } from '@/lib/seekdb/types'
import VoiceButton from '@/components/VoiceButton'

interface TeamFormProps {
  teamId?: string          // 编辑模式时传入
  teamVersionId?: string   // 创建新版本时传入
  onSuccess?: () => void
  onCancel?: () => void
}

const DISPLAY_MODES: { value: TeamDisplayMode; label: string; desc: string }[] = [
  { value: 'auto', label: 'Auto', desc: 'Automatically choose based on environment' },
  { value: 'in-process', label: 'In-Process', desc: 'All teammates in main terminal' },
  { value: 'split-panes', label: 'Split Panes', desc: 'Each teammate in own pane (requires tmux)' },
]

export default function TeamForm({
  teamId,
  teamVersionId,
  onSuccess,
  onCancel,
}: TeamFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [displayMode, setDisplayMode] = useState<TeamDisplayMode>('auto')
  const [leadInstructions, setLeadInstructions] = useState('')
  const [leadModel, setLeadModel] = useState('')
  const [delegateMode, setDelegateMode] = useState(false)
  const [requirePlanApproval, setRequirePlanApproval] = useState(false)
  const [teammates, setTeammates] = useState<TeammateDef[]>([])
  const [taskTemplate, setTaskTemplate] = useState('')
  const [qualityGates, setQualityGates] = useState('')
  const [maxTeammates, setMaxTeammates] = useState(5)
  const [tags, setTags] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [expandedTeammate, setExpandedTeammate] = useState<number | null>(null)

  // 加载编辑数据
  useEffect(() => {
    if (teamId) {
      loadTeam(teamId)
    }
  }, [teamId])

  const loadTeam = async (id: string) => {
    try {
      setLoading(true)
      const data = await agentTeamAPI.get(id)
      if (data) {
        setName(data.name)
        setDescription(data.description || '')
        setCategory(data.category || '')
        setDisplayMode(data.displayMode || 'auto')
        setLeadInstructions(data.leadInstructions)
        setLeadModel(data.leadModel || '')
        setDelegateMode(data.delegateMode || false)
        setRequirePlanApproval(data.requirePlanApproval || false)

        let parsedTeammates: TeammateDef[] = []
        try {
          parsedTeammates = typeof data.teammates === 'string'
            ? JSON.parse(data.teammates)
            : data.teammates
        } catch { parsedTeammates = [] }
        setTeammates(Array.isArray(parsedTeammates) ? parsedTeammates : [])

        setTaskTemplate(data.taskTemplate || '')
        setQualityGates(data.qualityGates || '')
        setMaxTeammates(data.maxTeammates || 5)
        setTags((data.tags || []).join(', '))
        setIsEditing(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleApplyTemplate = (template: typeof TEAM_TEMPLATES[0]) => {
    setName(template.name)
    setDescription(template.description)
    setCategory(template.category)
    setDisplayMode(template.displayMode)
    setLeadInstructions(template.leadInstructions)
    setDelegateMode(template.delegateMode)
    setRequirePlanApproval(template.requirePlanApproval)
    setTeammates([...template.teammates])
    setTaskTemplate(template.taskTemplate)
    setShowTemplates(false)
  }

  const handleAddTeammate = () => {
    setTeammates([
      ...teammates,
      {
        role: '',
        description: '',
        model: '',
        spawnPrompt: '',
        tools: [],
        requirePlanApproval: false,
      },
    ])
    setExpandedTeammate(teammates.length)
  }

  const handleRemoveTeammate = (index: number) => {
    setTeammates(teammates.filter((_, i) => i !== index))
    if (expandedTeammate === index) setExpandedTeammate(null)
  }

  const handleUpdateTeammate = (index: number, field: keyof TeammateDef, value: unknown) => {
    const updated = [...teammates]
    updated[index] = { ...updated[index], [field]: value }
    setTeammates(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !leadInstructions.trim()) {
      setError('名称和 Lead Instructions 不能为空')
      return
    }

    if (teammates.length === 0) {
      setError('至少需要添加一个队友')
      return
    }

    for (const t of teammates) {
      if (!t.role.trim() || !t.spawnPrompt.trim()) {
        setError('每个队友的 Role 和 Spawn Prompt 不能为空')
        return
      }
    }

    try {
      setLoading(true)
      setError(null)

      const tagsList = tags.split(',').map((t) => t.trim()).filter(Boolean)

      if (isEditing && teamId) {
        await agentTeamAPI.update(teamId, {
          name: name.trim(),
          description: description.trim(),
          category: category.trim(),
          displayMode,
          leadInstructions: leadInstructions.trim(),
          leadModel: leadModel.trim() || undefined,
          delegateMode,
          requirePlanApproval,
          teammates,
          taskTemplate: taskTemplate.trim() || undefined,
          qualityGates: qualityGates.trim() || undefined,
          maxTeammates,
          tags: tagsList.length > 0 ? tagsList : undefined,
        })
      } else {
        const id = `team-v-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        await agentTeamAPI.create({
          id,
          teamId: teamVersionId || undefined,
          name: name.trim(),
          description: description.trim(),
          category: category.trim(),
          displayMode,
          leadInstructions: leadInstructions.trim(),
          leadModel: leadModel.trim() || undefined,
          delegateMode,
          requirePlanApproval,
          teammates,
          taskTemplate: taskTemplate.trim() || undefined,
          qualityGates: qualityGates.trim() || undefined,
          maxTeammates,
          tags: tagsList.length > 0 ? tagsList : undefined,
        })
      }

      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setLoading(false)
    }
  }

  if (loading && isEditing && !name) {
    return <div className="form-loading">Loading...</div>
  }

  return (
    <div className="team-form-container">
      <div className="form-header">
        <h2>{isEditing ? 'Edit Team' : teamVersionId ? 'New Version' : 'Create Team'}</h2>
        {!isEditing && !teamVersionId && (
          <button
            className="btn-template"
            onClick={() => setShowTemplates(!showTemplates)}
          >
            {showTemplates ? 'Hide Templates' : 'Use Template'}
          </button>
        )}
      </div>

      {/* Template Picker */}
      {showTemplates && (
        <div className="template-picker">
          <h3>Choose a Template</h3>
          <div className="template-grid">
            {TEAM_TEMPLATES.map((template, idx) => (
              <div
                key={idx}
                className="template-card"
                onClick={() => handleApplyTemplate(template)}
              >
                <h4>{template.name}</h4>
                <p>{template.description}</p>
                <div className="template-meta">
                  <span>{template.category}</span>
                  <span>{template.teammates.length} teammates</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <div className="form-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* Basic Info */}
        <div className="form-section">
          <h3>Basic Information</h3>
          <div className="form-row">
            <div className="form-group flex-2">
              <label>Team Name *</label>
              <div className="input-with-voice">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Parallel Code Review"
                />
                <VoiceButton
                  onTranscribed={(text) => setName((prev) => prev + text)}
                  disabled={loading}
                />
              </div>
            </div>
            <div className="form-group flex-1">
              <label>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Select...</option>
                {TEAM_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <div className="textarea-with-voice">
              <div className="textarea-voice-toolbar">
                <VoiceButton
                  onTranscribed={(text) => setDescription((prev) => prev + text)}
                  mode="append"
                  disabled={loading}
                />
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of what this team does..."
                rows={2}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Tags (comma separated)</label>
            <div className="input-with-voice">
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., review, security, performance"
              />
              <VoiceButton
                onTranscribed={(text) => setTags((prev) => prev + text)}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Lead Config */}
        <div className="form-section">
          <h3>Lead Configuration</h3>
          <div className="form-group">
            <label>Lead Instructions *</label>
            <div className="textarea-with-voice">
              <div className="textarea-voice-toolbar">
                <VoiceButton
                  onTranscribed={(text) => setLeadInstructions((prev) => prev + text)}
                  mode="append"
                  disabled={loading}
                />
              </div>
              <textarea
                value={leadInstructions}
                onChange={(e) => setLeadInstructions(e.target.value)}
                placeholder="Instructions for the team lead that coordinates work, assigns tasks, and synthesizes results..."
                rows={6}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Lead Model</label>
              <input
                type="text"
                value={leadModel}
                onChange={(e) => setLeadModel(e.target.value)}
                placeholder="e.g., sonnet, opus"
              />
            </div>
            <div className="form-group flex-1">
              <label>Display Mode</label>
              <select
                value={displayMode}
                onChange={(e) => setDisplayMode(e.target.value as TeamDisplayMode)}
              >
                {DISPLAY_MODES.map((mode) => (
                  <option key={mode.value} value={mode.value}>
                    {mode.label} - {mode.desc}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group flex-1">
              <label>Max Teammates</label>
              <input
                type="number"
                value={maxTeammates}
                onChange={(e) => setMaxTeammates(parseInt(e.target.value) || 5)}
                min={1}
                max={10}
              />
            </div>
          </div>

          <div className="form-row checkboxes">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={delegateMode}
                onChange={(e) => setDelegateMode(e.target.checked)}
              />
              <span>Delegate Mode</span>
              <span className="checkbox-desc">Lead only coordinates, doesn't implement</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={requirePlanApproval}
                onChange={(e) => setRequirePlanApproval(e.target.checked)}
              />
              <span>Require Plan Approval</span>
              <span className="checkbox-desc">Teammates must get plan approved before coding</span>
            </label>
          </div>
        </div>

        {/* Teammates */}
        <div className="form-section">
          <div className="section-header">
            <h3>Teammates ({teammates.length})</h3>
            <button type="button" className="btn-add" onClick={handleAddTeammate}>
              <Plus size={14} /> Add Teammate
            </button>
          </div>

          {teammates.length === 0 && (
            <div className="teammates-empty">
              No teammates defined. Add at least one teammate to create a team.
            </div>
          )}

          {teammates.map((teammate, idx) => (
            <div key={idx} className="teammate-card">
              <div
                className="teammate-header"
                onClick={() => setExpandedTeammate(expandedTeammate === idx ? null : idx)}
              >
                <div className="teammate-title">
                  <span className="teammate-number">{idx + 1}</span>
                  <span>{teammate.role || 'Unnamed Teammate'}</span>
                </div>
                <div className="teammate-actions">
                  <button
                    type="button"
                    className="btn-remove"
                    onClick={(e) => { e.stopPropagation(); handleRemoveTeammate(idx) }}
                  >
                    <Trash2 size={14} />
                  </button>
                  {expandedTeammate === idx
                    ? <ChevronUp size={16} />
                    : <ChevronDown size={16} />
                  }
                </div>
              </div>

              {expandedTeammate === idx && (
                <div className="teammate-body">
                  <div className="form-row">
                    <div className="form-group flex-2">
                      <label>Role *</label>
                      <div className="input-with-voice">
                        <input
                          type="text"
                          value={teammate.role}
                          onChange={(e) => handleUpdateTeammate(idx, 'role', e.target.value)}
                          placeholder="e.g., Security Reviewer"
                        />
                        <VoiceButton
                          onTranscribed={(text) => handleUpdateTeammate(idx, 'role', teammate.role + text)}
                          disabled={loading}
                        />
                      </div>
                    </div>
                    <div className="form-group flex-1">
                      <label>Model</label>
                      <input
                        type="text"
                        value={teammate.model || ''}
                        onChange={(e) => handleUpdateTeammate(idx, 'model', e.target.value)}
                        placeholder="e.g., sonnet"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Description</label>
                    <div className="input-with-voice">
                      <input
                        type="text"
                        value={teammate.description || ''}
                        onChange={(e) => handleUpdateTeammate(idx, 'description', e.target.value)}
                        placeholder="Brief description of this teammate's role"
                      />
                      <VoiceButton
                        onTranscribed={(text) => handleUpdateTeammate(idx, 'description', (teammate.description || '') + text)}
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Spawn Prompt *</label>
                    <div className="textarea-with-voice">
                      <div className="textarea-voice-toolbar">
                        <VoiceButton
                          onTranscribed={(text) => handleUpdateTeammate(idx, 'spawnPrompt', teammate.spawnPrompt + text)}
                          mode="append"
                          disabled={loading}
                        />
                      </div>
                      <textarea
                        value={teammate.spawnPrompt}
                        onChange={(e) => handleUpdateTeammate(idx, 'spawnPrompt', e.target.value)}
                        placeholder="Detailed instructions for this teammate when spawned..."
                        rows={5}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Tools (comma separated)</label>
                    <input
                      type="text"
                      value={(teammate.tools || []).join(', ')}
                      onChange={(e) => handleUpdateTeammate(idx, 'tools',
                        e.target.value.split(',').map((t) => t.trim()).filter(Boolean)
                      )}
                      placeholder="e.g., Read, Write, Grep, Glob, Shell"
                    />
                  </div>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={teammate.requirePlanApproval || false}
                      onChange={(e) => handleUpdateTeammate(idx, 'requirePlanApproval', e.target.checked)}
                    />
                    <span>Require Plan Approval for this teammate</span>
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Task & Quality */}
        <div className="form-section">
          <h3>Task & Quality Configuration</h3>
          <div className="form-group">
            <label>Task Template</label>
            <div className="textarea-with-voice">
              <div className="textarea-voice-toolbar">
                <VoiceButton
                  onTranscribed={(text) => setTaskTemplate((prev) => prev + text)}
                  mode="append"
                  disabled={loading}
                />
              </div>
              <textarea
                value={taskTemplate}
                onChange={(e) => setTaskTemplate(e.target.value)}
                placeholder="Describe how the team should break down and coordinate tasks..."
                rows={4}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Quality Gates</label>
            <div className="textarea-with-voice">
              <div className="textarea-voice-toolbar">
                <VoiceButton
                  onTranscribed={(text) => setQualityGates((prev) => prev + text)}
                  mode="append"
                  disabled={loading}
                />
              </div>
              <textarea
                value={qualityGates}
                onChange={(e) => setQualityGates(e.target.value)}
                placeholder="Rules for quality checks before tasks are marked complete..."
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="form-actions">
          <button type="button" className="btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? 'Saving...' : isEditing ? 'Update Team' : 'Create Team'}
          </button>
        </div>
      </form>

      <style jsx>{`
        .team-form-container {
          max-width: 900px;
          animation: fadeInOpacity 0.35s ease;
        }

        .form-loading {
          text-align: center;
          padding: 3rem;
          color: var(--text-secondary);
        }

        .form-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--border-color);
        }

        .form-header h2 {
          font-size: 1.4rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.03em;
        }

        .btn-template {
          background: var(--bg-glass);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          padding: 7px 14px;
          border-radius: var(--radius-md);
          cursor: pointer;
          font-size: 0.82rem;
          font-weight: 500;
          transition: all var(--transition-fast);
        }

        .btn-template:hover {
          background: var(--bg-item-hover);
          color: var(--text-primary);
        }

        .template-picker {
          margin-bottom: 1.5rem;
          padding: 1.25rem;
          background: var(--bg-glass);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
        }

        .template-picker h3 {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin-bottom: 1rem;
          font-weight: 600;
        }

        .template-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 0.75rem;
        }

        .template-card {
          padding: 1rem;
          background: var(--bg-content);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .template-card:hover {
          border-color: var(--accent-color);
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.1);
        }

        .template-card h4 {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 0.35rem;
        }

        .template-card p {
          font-size: 0.78rem;
          color: var(--text-tertiary);
          line-height: 1.5;
          margin-bottom: 0.5rem;
        }

        .template-meta {
          display: flex;
          gap: 0.5rem;
          font-size: 0.7rem;
          color: var(--text-tertiary);
        }

        .template-meta span {
          background: var(--bg-glass);
          padding: 2px 8px;
          border-radius: var(--radius-full);
          border: 1px solid var(--border-color);
        }

        .form-error {
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: var(--danger-color);
          padding: 0.75rem 1rem;
          border-radius: var(--radius-md);
          font-size: 0.85rem;
          margin-bottom: 1rem;
        }

        .form-section {
          margin-bottom: 2rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid var(--border-color);
        }

        .form-section:last-of-type {
          border-bottom: none;
        }

        .form-section h3 {
          font-size: 0.85rem;
          color: var(--text-secondary);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 1rem;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .section-header h3 {
          margin-bottom: 0;
        }

        .form-row {
          display: flex;
          gap: 1rem;
          margin-bottom: 0.75rem;
        }

        .form-row.checkboxes {
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-group {
          margin-bottom: 0.75rem;
        }

        .flex-1 { flex: 1; }
        .flex-2 { flex: 2; }

        .form-group label {
          display: block;
          font-size: 0.78rem;
          font-weight: 500;
          color: var(--text-secondary);
          margin-bottom: 0.35rem;
        }

        .form-group input[type="text"],
        .form-group input[type="number"],
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 9px 12px;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          background: var(--bg-glass);
          color: var(--text-primary);
          font-size: 0.88rem;
          font-family: inherit;
          outline: none;
          transition: border-color var(--transition-fast);
          resize: vertical;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          border-color: var(--accent-color);
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
        }

        .form-group textarea {
          font-family: 'SF Mono', ui-monospace, Menlo, Consolas, monospace;
          font-size: 0.82rem;
          line-height: 1.6;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          color: var(--text-primary);
          cursor: pointer;
        }

        .checkbox-label input[type="checkbox"] {
          width: 16px;
          height: 16px;
          accent-color: var(--accent-color);
        }

        .checkbox-desc {
          font-size: 0.75rem;
          color: var(--text-tertiary);
          margin-left: 0.25rem;
        }

        .teammates-empty {
          text-align: center;
          padding: 2rem;
          color: var(--text-tertiary);
          font-size: 0.85rem;
          background: var(--bg-glass);
          border: 1px dashed var(--border-color);
          border-radius: var(--radius-md);
        }

        .btn-add {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--bg-glass);
          border: 1px solid var(--border-color);
          color: var(--accent-color);
          padding: 7px 14px;
          border-radius: var(--radius-md);
          cursor: pointer;
          font-size: 0.82rem;
          font-weight: 500;
          transition: all var(--transition-fast);
        }

        .btn-add:hover {
          background: rgba(99, 102, 241, 0.08);
          border-color: var(--accent-color);
        }

        .teammate-card {
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          margin-bottom: 0.75rem;
          overflow: hidden;
          transition: border-color var(--transition-fast);
        }

        .teammate-card:hover {
          border-color: var(--border-light);
        }

        .teammate-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          background: var(--bg-glass);
          cursor: pointer;
          user-select: none;
        }

        .teammate-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.88rem;
          font-weight: 500;
          color: var(--text-primary);
        }

        .teammate-number {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent-color);
          color: white;
          border-radius: 50%;
          font-size: 0.72rem;
          font-weight: 700;
        }

        .teammate-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--text-tertiary);
        }

        .btn-remove {
          background: none;
          border: none;
          color: var(--text-tertiary);
          cursor: pointer;
          padding: 4px;
          border-radius: var(--radius-sm);
          transition: color var(--transition-fast);
        }

        .btn-remove:hover {
          color: var(--danger-color);
        }

        .teammate-body {
          padding: 1rem;
          border-top: 1px solid var(--border-color);
          animation: slideDown 0.2s ease;
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--border-color);
        }

        .btn-cancel {
          padding: 9px 20px;
          background: var(--bg-glass);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          border-radius: var(--radius-md);
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .btn-cancel:hover {
          background: var(--bg-item-hover);
          color: var(--text-primary);
        }

        .btn-submit {
          padding: 9px 24px;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          border: none;
          color: white;
          border-radius: var(--radius-md);
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-normal);
        }

        .btn-submit:hover:not(:disabled) {
          box-shadow: 0 4px 16px rgba(245, 158, 11, 0.3);
          transform: translateY(-1px);
        }

        .btn-submit:active {
          transform: translateY(0);
        }

        .btn-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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
