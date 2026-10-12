'use client'

import { useState, useEffect } from 'react'
import { siteAPI } from '@/lib/seekdb/api'
import type { CreateSiteInput, UpdateSiteInput, SiteMetadata } from '@/lib/seekdb/types'

interface SiteFormProps {
  siteId?: string
  onSuccess?: () => void
  onCancel?: () => void
}

export default function SiteForm({ siteId, onSuccess, onCancel }: SiteFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<CreateSiteInput>({
    id: '',
    name: '',
    description: '',
    url: '',
    previewUrl: '',
    thumbnail: '',
    category: [],
    tags: [],
    framework: '',
    featured: false,
  })
  const [categoryInput, setCategoryInput] = useState('')
  const [tagInput, setTagInput] = useState('')

  // 如果是编辑模式，加载站点数据
  useEffect(() => {
    if (siteId) {
      loadSite()
    }
  }, [siteId])

  const loadSite = async () => {
    if (!siteId) return

    try {
      setLoading(true)
      const site = await siteAPI.get(siteId)
      if (site) {
        setFormData({
          id: siteId,
          name: site.name,
          description: site.description,
          url: site.url,
          previewUrl: site.previewUrl || '',
          thumbnail: site.thumbnail || '',
          category: Array.isArray(site.category) ? site.category : [],
          tags: Array.isArray(site.tags) ? site.tags : [],
          framework: site.framework || '',
          featured: site.featured || false,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载站点失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    try {
      setLoading(true)

      if (siteId) {
        // 更新站点
        const updateData: UpdateSiteInput = {
          name: formData.name,
          description: formData.description,
          url: formData.url,
          previewUrl: formData.previewUrl || undefined,
          thumbnail: formData.thumbnail || undefined,
          category: formData.category,
          tags: formData.tags,
          framework: formData.framework || undefined,
          featured: formData.featured,
        }
        await siteAPI.update(siteId, updateData)
      } else {
        // 创建站点
        if (!formData.id.trim()) {
          // 如果没有提供ID，自动生成
          formData.id = formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        }
        await siteAPI.create(formData)
      }

      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setLoading(false)
    }
  }

  const addCategory = () => {
    if (categoryInput.trim() && !formData.category.includes(categoryInput.trim())) {
      setFormData({
        ...formData,
        category: [...formData.category, categoryInput.trim()],
      })
      setCategoryInput('')
    }
  }

  const removeCategory = (index: number) => {
    setFormData({
      ...formData,
      category: formData.category.filter((_, i) => i !== index),
    })
  }

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()],
      })
      setTagInput('')
    }
  }

  const removeTag = (index: number) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((_, i) => i !== index),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="site-form">
      <h2>{siteId ? '编辑站点' : '创建站点'}</h2>

      {error && <div className="error-message">{error}</div>}

      <div className="form-group">
        <label>
          ID {siteId && '(不可修改)'}
          {!siteId && (
            <span className="hint">（留空将自动生成）</span>
          )}
        </label>
        <input
          type="text"
          value={formData.id}
          onChange={(e) => setFormData({ ...formData, id: e.target.value })}
          disabled={!!siteId}
          placeholder="site-id"
        />
      </div>

      <div className="form-group">
        <label>名称 *</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          placeholder="站点名称"
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
          placeholder="站点描述"
        />
      </div>

      <div className="form-group">
        <label>URL *</label>
        <input
          type="url"
          value={formData.url}
          onChange={(e) => setFormData({ ...formData, url: e.target.value })}
          required
          placeholder="https://example.com"
        />
      </div>

      <div className="form-group">
        <label>预览 URL</label>
        <input
          type="url"
          value={formData.previewUrl}
          onChange={(e) =>
            setFormData({ ...formData, previewUrl: e.target.value })
          }
          placeholder="https://example.com/preview"
        />
      </div>

      <div className="form-group">
        <label>缩略图 URL</label>
        <input
          type="url"
          value={formData.thumbnail}
          onChange={(e) =>
            setFormData({ ...formData, thumbnail: e.target.value })
          }
          placeholder="https://example.com/thumbnail.png"
        />
      </div>

      <div className="form-group">
        <label>框架</label>
        <input
          type="text"
          value={formData.framework}
          onChange={(e) =>
            setFormData({ ...formData, framework: e.target.value })
          }
          placeholder="React, Vue, Angular..."
        />
      </div>

      <div className="form-group">
        <label>分类</label>
        <div className="tag-input-group">
          <input
            type="text"
            value={categoryInput}
            onChange={(e) => setCategoryInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addCategory()
              }
            }}
            placeholder="输入分类后按回车"
          />
          <button type="button" onClick={addCategory} className="btn btn-small">
            添加
          </button>
        </div>
        <div className="tag-list">
          {formData.category.map((cat, index) => (
            <span key={index} className="tag">
              {cat}
              <button
                type="button"
                onClick={() => removeCategory(index)}
                className="tag-remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
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
          {formData.tags.map((tag, index) => (
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

      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={formData.featured}
            onChange={(e) =>
              setFormData({ ...formData, featured: e.target.checked })
            }
          />
          <span>推荐站点</span>
        </label>
      </div>

      <div className="form-actions">
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? '处理中...' : siteId ? '更新' : '创建'}
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
        .site-form {
          border-radius: 0.75rem;
          padding: 2rem;
          border: 1px solid #e5e7eb;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
        }

        .site-form h2 {
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
        .form-group textarea {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          color: #111827;
          font-size: 1rem;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .form-group input:disabled {
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

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
        }

        .checkbox-label input[type='checkbox'] {
          width: auto;
          margin: 0;
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

