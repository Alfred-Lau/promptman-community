'use client'

import { useState, useEffect } from 'react'
import { componentAPI, siteAPI } from '@/lib/seekdb/api'
import type {
  CreateComponentInput,
  UpdateComponentInput,
  ComponentMetadata,
} from '@/lib/seekdb/types'

interface ComponentFormProps {
  componentId?: string
  siteId?: string
  onSuccess?: () => void
  onCancel?: () => void
}

export default function ComponentForm({
  componentId,
  siteId: initialSiteId,
  onSuccess,
  onCancel,
}: ComponentFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sites, setSites] = useState<Array<{ id: string; name: string }>>([])
  const [formData, setFormData] = useState<CreateComponentInput>({
    id: '',
    siteId: initialSiteId || '',
    siteName: '',
    name: '',
    description: '',
    category: '',
    codeExample: '',
    docUrl: '',
    tags: [],
  })
  const [tagInput, setTagInput] = useState('')

  // 加载站点列表
  useEffect(() => {
    loadSites()
  }, [])

  // 如果是编辑模式，加载组件数据
  useEffect(() => {
    if (componentId) {
      loadComponent()
    }
  }, [componentId])

  // 当站点ID改变时，更新站点名称
  useEffect(() => {
    if (formData.siteId) {
      const site = sites.find((s) => s.id === formData.siteId)
      if (site) {
        setFormData({ ...formData, siteName: site.name })
      }
    }
  }, [formData.siteId])

  const loadSites = async () => {
    try {
      const result = await siteAPI.getAll()
      const sitesList = result.metadatas.map((meta, index) => ({
        id: result.ids[index],
        name: (meta as { name: string }).name,
      }))
      setSites(sitesList)
    } catch (err) {
      console.error('加载站点列表失败:', err)
    }
  }

  const loadComponent = async () => {
    if (!componentId) return

    try {
      setLoading(true)
      const component = await componentAPI.get(componentId)
      if (component) {
        setFormData({
          id: componentId,
          siteId: component.siteId,
          siteName: component.siteName,
          name: component.name,
          description: component.description,
          category: component.category || '',
          codeExample: component.codeExample || '',
          docUrl: component.docUrl,
          tags: Array.isArray(component.tags) ? component.tags : [],
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载组件失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.siteId) {
      setError('请选择站点')
      return
    }

    try {
      setLoading(true)

      if (componentId) {
        // 更新组件
        const updateData: UpdateComponentInput = {
          name: formData.name,
          description: formData.description,
          category: formData.category || undefined,
          codeExample: formData.codeExample || undefined,
          docUrl: formData.docUrl,
          tags: formData.tags,
        }
        await componentAPI.update(componentId, updateData)
      } else {
        // 创建组件
        if (!formData.id.trim()) {
          // 如果没有提供ID，自动生成
          formData.id = `${formData.siteId}-${formData.name
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')}`
        }
        await componentAPI.create(formData)
      }

      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setLoading(false)
    }
  }

  const addTag = () => {
    if (tagInput.trim() && !(formData.tags || []).includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...(formData.tags || []), tagInput.trim()],
      })
      setTagInput('')
    }
  }

  const removeTag = (index: number) => {
    setFormData({
      ...formData,
      tags: (formData.tags || []).filter((_, i) => i !== index),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="component-form">
      <h2>{componentId ? '编辑组件' : '创建组件'}</h2>

      {error && <div className="error-message">{error}</div>}

      <div className="form-group">
        <label>
          ID {componentId && '(不可修改)'}
          {!componentId && (
            <span className="hint">（留空将自动生成）</span>
          )}
        </label>
        <input
          type="text"
          value={formData.id}
          onChange={(e) => setFormData({ ...formData, id: e.target.value })}
          disabled={!!componentId}
          placeholder="component-id"
        />
      </div>

      <div className="form-group">
        <label>所属站点 *</label>
        <select
          value={formData.siteId}
          onChange={(e) => {
            const selectedSite = sites.find((s) => s.id === e.target.value)
            setFormData({
              ...formData,
              siteId: e.target.value,
              siteName: selectedSite?.name || '',
            })
          }}
          required
          disabled={!!initialSiteId}
          className="select-input"
        >
          <option value="">请选择站点</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>名称 *</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          placeholder="组件名称"
        />
      </div>

      <div className="form-group">
        <label>描述 *</label>
        <textarea
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          required
          rows={3}
          placeholder="组件描述"
        />
      </div>

      <div className="form-group">
        <label>分类</label>
        <input
          type="text"
          value={formData.category}
          onChange={(e) =>
            setFormData({ ...formData, category: e.target.value })
          }
          placeholder="UI, Animation, Form..."
        />
      </div>

      <div className="form-group">
        <label>文档 URL *</label>
        <input
          type="url"
          value={formData.docUrl}
          onChange={(e) => setFormData({ ...formData, docUrl: e.target.value })}
          required
          placeholder="https://example.com/docs/component"
        />
      </div>

      <div className="form-group">
        <label>代码示例</label>
        <textarea
          value={formData.codeExample}
          onChange={(e) =>
            setFormData({ ...formData, codeExample: e.target.value })
          }
          rows={5}
          placeholder="import { Component } from 'library'..."
        />
      </div>

      <div className="form-group">
        <label>标签</label>
        <div className="tag-input-group">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTag()
              }
            }}
            placeholder="输入标签后按回车"
          />
          <button type="button" onClick={addTag} className="btn btn-small">
            添加
          </button>
        </div>
        <div className="tag-list">
          {(formData.tags || []).map((tag, index) => (
            <span key={index} className="tag">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(index)}
                className="tag-remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? '处理中...' : componentId ? '更新' : '创建'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary"
          >
            取消
          </button>
        )}
      </div>

      <style jsx>{`
        .component-form {
          border-radius: 0.75rem;
          padding: 2rem;
          border: 1px solid #e5e7eb;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
        }

        .component-form h2 {
          margin-top: 0;
          margin-bottom: 1.5rem;
          color: #111827;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
          color: #374151;
        }

        .hint {
          font-weight: normal;
          color: #6b7280;
          font-size: 0.9rem;
        }

        .form-group input[type='text'],
        .form-group input[type='url'],
        .form-group textarea,
        .select-input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          color: #111827;
          font-size: 1rem;
        }

        .select-input {
          cursor: pointer;
        }

        .select-input option {
          background: white;
          color: #111827;
        }

        .form-group input:focus,
        .form-group textarea:focus,
        .select-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .form-group input:disabled,
        .select-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          background-color: #f3f4f6;
        }

        .tag-input-group {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .tag-input-group input {
          flex: 1;
        }

        .tag-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .tag {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.25rem 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid #d1d5db;
          font-size: 0.9rem;
          color: #374151;
        }

        .tag-remove {
          background: transparent;
          border: none;
          color: #6b7280;
          cursor: pointer;
          font-size: 1.2rem;
          line-height: 1;
          padding: 0;
          width: 1.2rem;
          height: 1.2rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .tag-remove:hover {
          color: #ef4444;
          background: #fee2e2;
          border-radius: 50%;
        }

        .form-actions {
          display: flex;
          gap: 1rem;
          margin-top: 2rem;
        }

        .btn {
          padding: 0.75rem 1.5rem;
          border: 1px solid;
          border-radius: 0.5rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          border-color: #3b82f6;
          color: #3b82f6;
        }

        .btn-primary:hover:not(:disabled) {
          border-color: #2563eb;
          color: #2563eb;
        }

        .btn-secondary {
          border-color: #d1d5db;
          color: #374151;
        }

        .btn-secondary:hover {
          border-color: #9ca3af;
          color: #111827;
        }

        .btn-small {
          padding: 0.5rem 1rem;
          font-size: 0.9rem;
        }

        .error-message {
          border: 1px solid #fca5a5;
          border-radius: 0.5rem;
          padding: 1rem;
          margin-bottom: 1rem;
          color: #dc2626;
        }
      `}</style>
    </form>
  )
}

