'use client'

import { useState, useEffect } from 'react'
import { Save, X } from 'lucide-react'
import { subAgentAPI } from '@/lib/seekdb/api'
import type { SubAgentMetadata, CreateSubAgentInput, SubAgentType } from '@/lib/seekdb/types'
import VoiceButton from '@/components/VoiceButton'

interface SubAgentFormProps {
  agentId?: string
  agentVersionId?: string
  onSuccess?: () => void
  onCancel?: () => void
}

const SUB_AGENT_TYPES: { value: SubAgentType; label: string; desc: string }[] = [
  { value: 'generalPurpose', label: '通用型', desc: '处理复杂多步骤任务' },
  { value: 'explore', label: '代码探索', desc: '快速搜索和理解代码库' },
  { value: 'shell', label: '命令执行', desc: '运行 shell 命令和终端操作' },
  { value: 'codeReview', label: '代码审查', desc: '审查代码质量和最佳实践' },
  { value: 'testing', label: '测试', desc: '编写和运行测试' },
  { value: 'documentation', label: '文档', desc: '生成和维护文档' },
  { value: 'refactoring', label: '重构', desc: '代码重构和优化' },
  { value: 'custom', label: '自定义', desc: '自定义子代理' },
]

export default function SubAgentForm({ agentId, agentVersionId, onSuccess, onCancel }: SubAgentFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    type: 'generalPurpose' as SubAgentType,
    model: '',
    instructions: '',
    tools: '',
    handoffConditions: '',
    inputSchema: '',
    outputFormat: '',
    maxTokens: '',
    temperature: '',
    tags: '',
  })
  const [existingAgent, setExistingAgent] = useState<SubAgentMetadata | null>(null)

  useEffect(() => {
    if (agentId) {
      loadAgent()
    } else if (agentVersionId) {
      loadAgentVersion()
    }
  }, [agentId, agentVersionId])

  const loadAgent = async () => {
    if (!agentId) return
    try {
      setLoading(true)
      const agent = await subAgentAPI.get(agentId)
      if (agent) {
        setExistingAgent(agent)
        setFormData({
          name: agent.name,
          description: agent.description || '',
          category: agent.category || '',
          type: agent.type,
          model: agent.model || '',
          instructions: agent.instructions,
          tools: Array.isArray(agent.tools) ? agent.tools.join(', ') : '',
          handoffConditions: agent.handoffConditions || '',
          inputSchema: agent.inputSchema && Object.keys(agent.inputSchema).length > 0
            ? JSON.stringify(agent.inputSchema, null, 2) : '',
          outputFormat: agent.outputFormat || '',
          maxTokens: agent.maxTokens ? String(agent.maxTokens) : '',
          temperature: agent.temperature ? String(agent.temperature) : '',
          tags: Array.isArray(agent.tags) ? agent.tags.join(', ') : '',
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载 SubAgent 失败')
    } finally {
      setLoading(false)
    }
  }

  const loadAgentVersion = async () => {
    if (!agentVersionId) return
    try {
      setLoading(true)
      const agent = await subAgentAPI.get(agentVersionId)
      if (agent) {
        setExistingAgent(agent)
        setFormData({
          name: agent.name,
          description: agent.description || '',
          category: agent.category || '',
          type: agent.type,
          model: agent.model || '',
          instructions: agent.instructions,
          tools: Array.isArray(agent.tools) ? agent.tools.join(', ') : '',
          handoffConditions: agent.handoffConditions || '',
          inputSchema: agent.inputSchema && Object.keys(agent.inputSchema).length > 0
            ? JSON.stringify(agent.inputSchema, null, 2) : '',
          outputFormat: agent.outputFormat || '',
          maxTokens: agent.maxTokens ? String(agent.maxTokens) : '',
          temperature: agent.temperature ? String(agent.temperature) : '',
          tags: Array.isArray(agent.tags) ? agent.tags.join(', ') : '',
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载 SubAgent 版本失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.name.trim() || !formData.instructions.trim()) {
      setError('名称和系统指令不能为空')
      return
    }

    try {
      setLoading(true)

      let inputSchemaObj: Record<string, unknown> = {}
      if (formData.inputSchema.trim()) {
        try {
          inputSchemaObj = JSON.parse(formData.inputSchema)
        } catch {
          setError('输入 Schema 格式不正确，必须是有效的 JSON')
          setLoading(false)
          return
        }
      }

      const toolsArray = formData.tools
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      const tagsArray = formData.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      const commonData = {
        name: formData.name,
        description: formData.description || undefined,
        category: formData.category || undefined,
        type: formData.type,
        model: formData.model || undefined,
        instructions: formData.instructions,
        tools: toolsArray.length > 0 ? toolsArray : undefined,
        handoffConditions: formData.handoffConditions || undefined,
        inputSchema: Object.keys(inputSchemaObj).length > 0 ? inputSchemaObj : undefined,
        outputFormat: formData.outputFormat || undefined,
        maxTokens: formData.maxTokens ? parseInt(formData.maxTokens, 10) : undefined,
        temperature: formData.temperature ? parseFloat(formData.temperature) : undefined,
        tags: tagsArray.length > 0 ? tagsArray : undefined,
      }

      if (agentId) {
        // 更新现有 SubAgent
        await subAgentAPI.update(agentId, commonData)
      } else if (agentVersionId && existingAgent) {
        // 创建新版本
        const newId = `subagent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const input: CreateSubAgentInput = {
          id: newId,
          subAgentId: existingAgent.subAgentId,
          ...commonData,
        }
        await subAgentAPI.create(input)
      } else {
        // 创建新 SubAgent
        const newId = `subagent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const input: CreateSubAgentInput = {
          id: newId,
          ...commonData,
        }
        await subAgentAPI.create(input)
      }

      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="subagent-form">
      <h2>{agentId ? '编辑 SubAgent' : agentVersionId ? '创建新版本' : '创建 SubAgent'}</h2>

      {error && (
        <div className="error-message">
          {error}
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
              placeholder="输入 SubAgent 名称"
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
              placeholder="简要描述该子代理的职责"
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
            <label htmlFor="type">类型 *</label>
            <select
              id="type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as SubAgentType })}
              disabled={loading}
              className="type-select"
            >
              {SUB_AGENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label} - {t.desc}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="model">模型</label>
            <select
              id="model"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              disabled={loading}
              className="type-select"
            >
              <option value="">默认模型</option>
              <option value="fast">fast (快速, 低成本)</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="category">分类</label>
            <div className="input-with-voice">
              <input
                id="category"
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="如：开发、测试、DevOps"
                disabled={loading}
              />
              <VoiceButton
                onTranscribed={(text) => setFormData((prev) => ({ ...prev, category: prev.category + text }))}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="tags">标签</label>
            <div className="input-with-voice">
              <input
                id="tags"
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="用逗号分隔多个标签"
                disabled={loading}
              />
              <VoiceButton
                onTranscribed={(text) => setFormData((prev) => ({ ...prev, tags: prev.tags + text }))}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="instructions">系统指令 *</label>
          <div className="textarea-with-voice">
            <div className="textarea-voice-toolbar">
              <VoiceButton
                onTranscribed={(text) => setFormData((prev) => ({ ...prev, instructions: prev.instructions + text }))}
                mode="append"
                disabled={loading}
              />
            </div>
            <textarea
              id="instructions"
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              placeholder="定义子代理的行为指令和系统提示词..."
              rows={12}
              required
              disabled={loading}
              className="code-textarea"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="tools">可用工具</label>
          <div className="input-with-voice">
            <input
              id="tools"
              type="text"
              value={formData.tools}
              onChange={(e) => setFormData({ ...formData, tools: e.target.value })}
              placeholder="用逗号分隔工具名称，如：Read, Write, Shell, Grep"
              disabled={loading}
            />
            <VoiceButton
              onTranscribed={(text) => setFormData((prev) => ({ ...prev, tools: prev.tools + text }))}
              disabled={loading}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="handoffConditions">移交条件</label>
          <div className="textarea-with-voice">
            <div className="textarea-voice-toolbar">
              <VoiceButton
                onTranscribed={(text) => setFormData((prev) => ({ ...prev, handoffConditions: prev.handoffConditions + text }))}
                mode="append"
                disabled={loading}
              />
            </div>
            <textarea
              id="handoffConditions"
              value={formData.handoffConditions}
              onChange={(e) => setFormData({ ...formData, handoffConditions: e.target.value })}
              placeholder="描述何时将任务移交给此子代理..."
              rows={3}
              disabled={loading}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="outputFormat">输出格式</label>
            <div className="input-with-voice">
              <input
                id="outputFormat"
                type="text"
                value={formData.outputFormat}
                onChange={(e) => setFormData({ ...formData, outputFormat: e.target.value })}
                placeholder="如：JSON、Markdown、纯文本"
                disabled={loading}
              />
              <VoiceButton
                onTranscribed={(text) => setFormData((prev) => ({ ...prev, outputFormat: prev.outputFormat + text }))}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="maxTokens">最大 Token 数</label>
            <input
              id="maxTokens"
              type="number"
              value={formData.maxTokens}
              onChange={(e) => setFormData({ ...formData, maxTokens: e.target.value })}
              placeholder="如：4096"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="temperature">温度</label>
            <input
              id="temperature"
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={formData.temperature}
              onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
              placeholder="0.0 - 2.0"
              disabled={loading}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="inputSchema">输入 Schema (JSON)</label>
          <textarea
            id="inputSchema"
            value={formData.inputSchema}
            onChange={(e) => setFormData({ ...formData, inputSchema: e.target.value })}
            placeholder='{"task": {"type": "string", "description": "任务描述"}}'
            rows={6}
            disabled={loading}
            className="code-textarea"
          />
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
        .subagent-form {
          width: 100%;
          max-width: 900px;
          animation: fadeInOpacity 0.35s ease;
        }

        .subagent-form h2 {
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
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
        .form-group textarea,
        .form-group select {
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
        .form-group textarea:focus,
        .form-group select:focus {
          outline: none;
          border-color: var(--border-focus);
          box-shadow: 0 0 0 3px var(--input-focus-shadow);
          background: var(--bg-item-hover);
        }

        .form-group input:disabled,
        .form-group textarea:disabled,
        .form-group select:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          background: var(--input-disabled-bg);
        }

        .type-select {
          appearance: auto;
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
