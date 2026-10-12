'use client'

import { useState, useEffect } from 'react'
import { componentAPI } from '@/lib/seekdb/api'
import type { ComponentMetadata, GetResult } from '@/lib/seekdb/types'

interface ComponentListProps {
  siteId?: string
  siteName?: string
  onEditComponent?: (componentId: string) => void
}

export default function ComponentList({
  siteId,
  siteName,
  onEditComponent,
}: ComponentListProps) {
  const [components, setComponents] = useState<GetResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<GetResult | null>(null)

  // 加载组件
  const loadComponents = async () => {
    try {
      setLoading(true)
      setError(null)
      let result: GetResult

      if (siteId) {
        result = await componentAPI.getBySiteId(siteId)
      } else {
        result = await componentAPI.getAll()
      }

      setComponents(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载组件失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadComponents()
  }, [siteId])

  // 搜索组件
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }

    try {
      setLoading(true)
      const results = await componentAPI.search({
        queryTexts: [searchQuery],
        nResults: 20,
        include: ['documents', 'metadatas', 'distances'],
      })

      // 转换搜索结果格式
      const formattedResults: GetResult = {
        ids: results.ids[0] || [],
        documents: results.documents?.[0] || [],
        metadatas: results.metadatas?.[0] || [],
      }

      // 如果指定了站点ID，过滤结果
      if (siteId) {
        const filtered = formattedResults.metadatas
          .map((meta, index) => ({
            id: formattedResults.ids[index],
            document: formattedResults.documents[index],
            metadata: meta as ComponentMetadata,
          }))
          .filter((item) => item.metadata.siteId === siteId)

        formattedResults.ids = filtered.map((item) => item.id)
        formattedResults.documents = filtered.map((item) => item.document)
        formattedResults.metadatas = filtered.map((item) => item.metadata)
      }

      setSearchResults(formattedResults)
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败')
    } finally {
      setLoading(false)
    }
  }

  // 删除组件
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个组件吗？')) {
      return
    }

    try {
      await componentAPI.delete(id)
      await loadComponents()
      if (searchResults) {
        await handleSearch()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  const displayComponents = searchResults || components
  const componentsData =
    (displayComponents?.metadatas as ComponentMetadata[]) || []

  return (
    <div className="component-list">
      <div className="component-list-header">
        <h2>
          {siteName ? `${siteName} - 组件列表` : '组件列表'}
        </h2>
        <div className="search-box">
          <input
            type="text"
            placeholder="搜索组件..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="search-input"
          />
          <button onClick={handleSearch} className="btn btn-primary">
            搜索
          </button>
          {searchResults && (
            <button
              onClick={() => {
                setSearchQuery('')
                setSearchResults(null)
              }}
              className="btn btn-secondary"
            >
              清除
            </button>
          )}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">加载中...</div>
      ) : componentsData.length === 0 ? (
        <div className="empty-state">
          {searchResults ? '未找到匹配的组件' : '暂无组件数据'}
        </div>
      ) : (
        <div className="components-grid">
          {componentsData.map((component, index) => {
            const componentId = displayComponents?.ids[index] || ''
            const tags = Array.isArray(component.tags) ? component.tags : []

            return (
              <div key={componentId} className="component-card">
                <div className="component-card-header">
                  <h3>{component.name}</h3>
                  {component.category && (
                    <span className="badge category">{component.category}</span>
                  )}
                </div>
                <p className="component-description">{component.description}</p>
                {component.siteName && (
                  <div className="component-site">
                    <span className="label">来源:</span>
                    <span className="value">{component.siteName}</span>
                  </div>
                )}
                {tags.length > 0 && (
                  <div className="component-tags">
                    {tags.map((tag, i) => (
                      <span key={i} className="tag tag-small">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {component.codeExample && (
                  <details className="code-example">
                    <summary>代码示例</summary>
                    <pre>
                      <code>{component.codeExample}</code>
                    </pre>
                  </details>
                )}
                <div className="component-card-actions">
                  {component.docUrl && (
                    <a
                      href={component.docUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-link"
                    >
                      文档
                    </a>
                  )}
                  {onEditComponent && (
                    <button
                      onClick={() => onEditComponent(componentId)}
                      className="btn btn-secondary"
                    >
                      编辑
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(componentId)}
                    className="btn btn-danger"
                  >
                    删除
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <style jsx>{`
        .component-list {
          width: 100%;
        }

        .component-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .component-list-header h2 {
          margin: 0;
          font-size: 1.5rem;
          color: #111827;
        }

        .search-box {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .search-input {
          padding: 0.5rem 1rem;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          color: #111827;
          font-size: 1rem;
          min-width: 200px;
        }

        .search-input::placeholder {
          color: #9ca3af;
        }

        .search-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .components-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }

        .component-card {
          border-radius: 0.75rem;
          padding: 1.5rem;
          border: 1px solid #e5e7eb;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
        }

        .component-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
          border-color: #d1d5db;
        }

        .component-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.75rem;
        }

        .component-card-header h3 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: #111827;
        }

        .badge {
          padding: 0.25rem 0.75rem;
          border-radius: 0.5rem;
          font-size: 0.75rem;
          font-weight: 600;
          border: 1px solid;
        }

        .badge.category {
          border-color: #60a5fa;
          color: #60a5fa;
        }

        .component-description {
          margin: 0.75rem 0;
          color: #4b5563;
          line-height: 1.5;
          font-size: 0.9rem;
        }

        .component-site {
          margin: 0.5rem 0;
          font-size: 0.85rem;
          color: #6b7280;
        }

        .component-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin: 0.75rem 0;
        }

        .tag {
          padding: 0.25rem 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid #d1d5db;
          font-size: 0.85rem;
          color: #6b7280;
        }

        .tag-small {
          font-size: 0.75rem;
          padding: 0.2rem 0.5rem;
        }

        .code-example {
          margin: 0.75rem 0;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          padding: 0.5rem;
        }

        .code-example summary {
          cursor: pointer;
          font-size: 0.85rem;
          color: #374151;
          margin-bottom: 0.5rem;
        }

        .code-example pre {
          margin: 0;
          padding: 0.5rem;
          overflow-x: auto;
          font-size: 0.8rem;
          background: #f9fafb;
          border-radius: 0.25rem;
        }

        .code-example code {
          color: #374151;
        }

        .component-card-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
          flex-wrap: wrap;
        }

        .btn {
          padding: 0.5rem 1rem;
          border: 1px solid;
          border-radius: 0.5rem;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-primary {
          border-color: #3b82f6;
          color: #3b82f6;
        }

        .btn-primary:hover {
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

        .btn-danger {
          border-color: #ef4444;
          color: #ef4444;
        }

        .btn-danger:hover {
          border-color: #dc2626;
          color: #dc2626;
        }

        .btn-link {
          border: none;
          color: #3b82f6;
          text-decoration: underline;
          padding: 0.5rem 0;
        }

        .btn-link:hover {
          color: #2563eb;
        }

        .loading,
        .empty-state,
        .error-message {
          text-align: center;
          padding: 2rem;
          color: #6b7280;
        }

        .error-message {
          border: 1px solid #fca5a5;
          border-radius: 0.5rem;
          color: #dc2626;
          margin-bottom: 1rem;
        }
      `}</style>
    </div>
  )
}

