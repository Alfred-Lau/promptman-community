'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Search, X, Eye, Edit, History, Trash2, Copy, MoreVertical } from 'lucide-react'
import { subAgentAPI } from '@/lib/seekdb/api'
import type { SubAgentMetadata, GetResult } from '@/lib/seekdb/types'
import { ShortcutHint } from '@/components/Kbd'
import StorageStatusBadge from '@/components/StorageStatusBadge'

interface SubAgentListProps {
  onSelectAgent?: (agentId: string) => void
  onEditAgent?: (agentId: string) => void
  onViewVersions?: (agentId: string) => void
  onDeleteAgent?: (agentId: string) => void
  variant?: 'table' | 'sidebar'
  selectedId?: string | null
  embeddedInMain?: boolean
  listTitle?: string
}

interface SubAgentRow {
  id: string
  metadata: SubAgentMetadata
  document: string
}

const TYPE_LABELS: Record<string, string> = {
  generalPurpose: '通用',
  explore: '探索',
  shell: '命令',
  codeReview: '审查',
  testing: '测试',
  documentation: '文档',
  refactoring: '重构',
  custom: '自定义',
}

export default function SubAgentList({
  onSelectAgent,
  onEditAgent,
  onViewVersions,
  onDeleteAgent,
  variant = 'table',
  selectedId,
  embeddedInMain = false,
  listTitle,
}: SubAgentListProps) {
  const [agents, setAgents] = useState<GetResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<GetResult | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState<string | null>(null)
  const [focusedIdx, setFocusedIdx] = useState(-1)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  const loadAgents = async () => {
    try {
      setLoading(true)
      setError(null)
      const result = variant === 'sidebar'
        ? await subAgentAPI.getCurrent()
        : await subAgentAPI.getAll()
      setAgents(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载 SubAgents 失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAgents()
  }, [variant])

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }

    try {
      setLoading(true)
      const results = await subAgentAPI.search({
        queryTexts: [searchQuery],
        nResults: 20,
        include: ['documents', 'metadatas', 'distances'],
      })

      const formattedResults: GetResult = {
        ids: results.ids[0] || [],
        documents: results.documents?.[0] || [],
        metadatas: results.metadatas?.[0] || [],
      }
      setSearchResults(formattedResults)
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, subAgentId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setMenuOpenId(null)
    if (!confirm('确定要删除这个 SubAgent 吗？')) {
      return
    }

    try {
      await subAgentAPI.delete(id)
      await loadAgents()
      if (searchResults) {
        await handleSearch()
      }
      onDeleteAgent?.(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  const handleCopy = async (agent: SubAgentMetadata, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setMenuOpenId(null)
    try {
      await navigator.clipboard.writeText(agent.instructions)
      setCopySuccess(agent.name)
      setTimeout(() => setCopySuccess(null), 2000)
    } catch {
      setError('复制失败')
    }
  }

  const toggleMenu = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpenId(menuOpenId === id ? null : id)
  }

  const agentRows = useMemo(() => {
    const displayAgents = searchResults || agents
    if (!displayAgents) return []

    const rows: SubAgentRow[] = displayAgents.ids.map((id, index) => ({
      id,
      metadata: displayAgents.metadatas[index] as SubAgentMetadata,
      document: displayAgents.documents[index] || '',
    }))

    const grouped = new Map<string, SubAgentRow[]>()
    rows.forEach((row) => {
      const subAgentId = row.metadata.subAgentId
      if (!grouped.has(subAgentId)) {
        grouped.set(subAgentId, [])
      }
      grouped.get(subAgentId)!.push(row)
    })

    grouped.forEach((versions) => {
      versions.sort((a, b) => b.metadata.version - a.metadata.version)
    })

    const result: SubAgentRow[] = []
    grouped.forEach((versions) => {
      result.push(...versions)
    })

    return result
  }, [agents, searchResults])

  const handleListKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (variant !== 'sidebar') return
    const len = agentRows.length
    if (len === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIdx((i) => { const next = Math.min(i + 1, len - 1); itemRefs.current[next]?.scrollIntoView({ block: 'nearest' }); return next })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIdx((i) => { const prev = Math.max(i - 1, 0); itemRefs.current[prev]?.scrollIntoView({ block: 'nearest' }); return prev })
    } else if (e.key === 'Enter' && focusedIdx >= 0) {
      e.preventDefault()
      onSelectAgent?.(agentRows[focusedIdx].id)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setFocusedIdx(-1)
      listRef.current?.blur()
    }
  }, [variant, agentRows, focusedIdx, onSelectAgent])

  useEffect(() => {
    if (variant !== 'sidebar' && !(variant === 'table' && embeddedInMain)) return
    const onGlobalKey = (e: KeyboardEvent) => {
      if (variant === 'sidebar' && !listRef.current) return
      const isMeta = e.metaKey || e.ctrlKey
      if ((isMeta && e.key === 'f') || e.key === '/') {
        const active = document.activeElement
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onGlobalKey)
    return () => window.removeEventListener('keydown', onGlobalKey)
  }, [variant, embeddedInMain])

  return (
    <div className={`subagent-list ${variant}${embeddedInMain ? ' main-panel' : ''}`}>
      <div className="subagent-list-header">
        {variant === 'table' && (
          <h2 className="table-list-title">{listTitle ?? 'SubAgents'}</h2>
        )}
        <div className="search-box">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="搜索 Agent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch()
              else if (e.key === 'Escape') { setSearchQuery(''); setSearchResults(null); setFocusedIdx(-1); listRef.current?.focus() }
              else if (e.key === 'ArrowDown') { e.preventDefault(); listRef.current?.focus(); setFocusedIdx(0) }
            }}
            className="search-input"
          />
          {(variant === 'sidebar' || (variant === 'table' && embeddedInMain)) && !searchQuery && (
            <span className="search-kbd-hint">
              <kbd className="skbd">⌘F</kbd>
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : agentRows.length === 0 ? (
        <div className="empty-state">
          {searchResults ? 'No matches' : 'No agents'}
        </div>
      ) : variant === 'sidebar' ? (
        <div
          className="sidebar-list"
          ref={listRef}
          tabIndex={0}
          onKeyDown={handleListKeyDown}
          onFocus={() => { if (focusedIdx < 0 && agentRows.length > 0) setFocusedIdx(0) }}
        >
          {copySuccess && (
            <div className="copy-toast">
              ✓ 已复制 "{copySuccess}"
            </div>
          )}
          {agentRows.map((row, idx) => {
            const agent = row.metadata
            const isSelected = selectedId === row.id
            const isMenuOpen = menuOpenId === row.id
            const isFocused = focusedIdx === idx

            return (
              <div
                key={row.id}
                ref={(el) => { itemRefs.current[idx] = el }}
                className={`sidebar-item ${isSelected ? 'selected' : ''} ${isFocused ? 'keyboard-focused' : ''}`}
                onClick={() => { onSelectAgent?.(row.id); setFocusedIdx(idx) }}
              >
                <div className="item-header">
                  <span className="item-title">{agent.name}</span>
                  <div className="item-actions">
                    <StorageStatusBadge isCloud={false} compact />
                    <span className="type-tag">{TYPE_LABELS[agent.type] || agent.type}</span>
                    <button
                      className="action-menu-btn"
                      onClick={(e) => toggleMenu(row.id, e)}
                      title="更多操作"
                    >
                      <MoreVertical size={14} />
                    </button>
                    {isMenuOpen && (
                      <div className="action-menu">
                        <button
                          className="menu-item"
                          onClick={(e) => handleCopy(agent, e)}
                        >
                          <Copy size={14} />
                          复制指令
                        </button>
                        <button
                          className="menu-item danger"
                          onClick={(e) => handleDelete(row.id, agent.subAgentId, e)}
                        >
                          <Trash2 size={14} />
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="item-meta">
                  {agent.description && (
                    <span className="item-desc">
                      {agent.description.length > 40
                        ? agent.description.substring(0, 40) + '...'
                        : agent.description}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
          {agentRows.length > 0 && (
            <div className="list-kbd-bar">
              <ShortcutHint hints={[
                { keys: ["↑", "↓"], label: "导航" },
                { keys: ["↵"],      label: "选中" },
                { keys: ["Esc"],    label: "退出" },
              ]} />
            </div>
          )}
        </div>
      ) : (
        <div className="agents-table-container">
          <table className="agents-table">
            <thead>
              <tr>
                <th className="col-name">名称</th>
                <th className="col-type">类型</th>
                <th className="col-version">版本</th>
                <th className="col-description">描述</th>
                <th className="col-category">分类</th>
                <th className="col-tags">标签</th>
                <th className="col-actions">操作</th>
              </tr>
            </thead>
            <tbody>
              {agentRows.map((row, index) => {
                const agent = row.metadata
                const tags = Array.isArray(agent.tags) ? agent.tags : []
                const prevRow = index > 0 ? agentRows[index - 1] : null
                const isSameAgent = prevRow?.metadata.subAgentId === agent.subAgentId
                const isFirstVersion = !isSameAgent
                const isRowSelected = selectedId === row.id

                return (
                  <tr
                    key={row.id}
                    className={`agent-row ${isSameAgent ? 'same-agent' : ''} ${agent.isCurrentVersion ? 'current-version' : ''} ${isRowSelected ? 'row-selected' : ''}`}
                    onClick={() => onSelectAgent?.(row.id)}
                    style={{ cursor: onSelectAgent ? 'pointer' : undefined }}
                  >
                    <td className="col-name">
                      {isFirstVersion ? (
                        <div className="agent-name-main table-cell-clamp-2">{agent.name}</div>
                      ) : (
                        <div className="agent-name-version table-cell-clamp-2">{agent.name}</div>
                      )}
                    </td>
                    <td className="col-type">
                      <span className="type-badge">{TYPE_LABELS[agent.type] || agent.type}</span>
                    </td>
                    <td className="col-version">
                      <div className="version-info">
                        <span className="version-number">v{agent.version}</span>
                        {agent.isCurrentVersion && (
                          <span className="badge current">当前</span>
                        )}
                        <StorageStatusBadge isCloud={false} />
                      </div>
                    </td>
                    <td className="col-description">
                      <div className="table-cell-clamp-3">
                        {agent.description || '-'}
                      </div>
                    </td>
                    <td className="col-category">
                      {agent.category || '-'}
                    </td>
                    <td className="col-tags">
                      {tags.length > 0 ? (
                        <div className="tags-list table-tags-cell">
                          {tags.slice(0, 3).map((tag, i) => (
                            <span key={i} className="tag">
                              {tag}
                            </span>
                          ))}
                          {tags.length > 3 && (
                            <span className="tag-more">+{tags.length - 3}</span>
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                      <div className="action-buttons">
                        {onSelectAgent && (
                          <button
                            type="button"
                            onClick={() => onSelectAgent(row.id)}
                            className="btn-icon"
                            title="查看"
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        {onViewVersions && (
                          <button
                            type="button"
                            onClick={() => onViewVersions(agent.subAgentId)}
                            className="btn-icon"
                            title="版本历史"
                          >
                            <History size={16} />
                          </button>
                        )}
                        {onEditAgent && (
                          <button
                            type="button"
                            onClick={() => onEditAgent(row.id)}
                            className="btn-icon"
                            title="编辑"
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(row.id, agent.subAgentId)}
                          className="btn-icon btn-danger"
                          title="删除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <style jsx>{`
        .subagent-list {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .subagent-list.sidebar {
          padding: 0;
        }

        .subagent-list.table.main-panel .subagent-list-header {
          flex-direction: column;
          align-items: stretch;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .table-list-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.03em;
          margin: 0;
        }

        .subagent-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0;
          padding: ${variant === 'sidebar' ? '0 16px 12px' : '0'};
          flex-wrap: wrap;
          gap: 1rem;
          background: transparent;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .search-box {
          display: flex;
          gap: 0.5rem;
          width: 100%;
          position: relative;
          align-items: center;
        }

        .search-input {
          padding: 8px 36px 8px 12px;
          border: 1px solid var(--border-color);
          background: var(--bg-glass);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: 0.82rem;
          width: 100%;
          transition: all var(--transition-fast);
        }

        .search-input::placeholder {
          color: var(--text-tertiary);
        }

        .search-kbd-hint {
          position: absolute;
          right: 8px;
          pointer-events: none;
          display: flex;
          align-items: center;
        }

        .skbd {
          font-family: 'SF Mono', ui-monospace, monospace;
          font-size: 0.6rem;
          font-weight: 500;
          font-style: normal;
          padding: 2px 5px;
          border-radius: 4px;
          border: 1px solid rgba(255,255,255,0.13);
          background: rgba(255,255,255,0.05);
          color: var(--text-tertiary);
          box-shadow: 0 1px 0 rgba(0,0,0,0.2);
          line-height: 1;
          user-select: none;
        }

        .list-kbd-bar {
          padding: 7px 10px 5px;
          border-top: 1px solid var(--border-color);
          opacity: 0.7;
        }

        .search-input:focus {
          outline: none;
          border-color: var(--border-focus);
          background: var(--bg-item-hover);
          box-shadow: 0 0 0 3px var(--input-focus-shadow);
        }

        /* Sidebar List Styles */
        .sidebar-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          padding: 0 8px;
        }

        .sidebar-item {
          padding: 10px 12px;
          margin-bottom: 2px;
          cursor: pointer;
          transition: all var(--transition-fast);
          display: flex;
          flex-direction: column;
          gap: 4px;
          height: 56px;
          min-height: 56px;
          max-height: 56px;
          box-sizing: border-box;
          border-radius: var(--radius-md);
          border: 1px solid transparent;
        }

        .sidebar-item:hover {
          background: var(--bg-item-hover);
          border-color: var(--border-color);
        }

        .sidebar-item.selected {
          background: var(--accent-muted);
          border-color: rgba(99, 102, 241, 0.15);
        }

        .sidebar-item.keyboard-focused {
          background: var(--bg-item-hover);
          border-color: rgba(99, 102, 241, 0.3);
          outline: none;
        }

        .sidebar-item.keyboard-focused .item-title {
          color: var(--accent-color);
        }

        .sidebar-list:focus {
          outline: none;
        }

        .item-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          height: 20px;
        }

        .item-title {
          font-weight: 600;
          color: var(--text-primary);
          font-size: 0.82rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
          min-width: 0;
          letter-spacing: -0.01em;
        }

        .sidebar-item.selected .item-title {
          color: var(--accent-color);
        }

        .type-tag {
          font-size: 0.65rem;
          padding: 1px 6px;
          border-radius: var(--radius-full);
          background: var(--accent-muted);
          color: var(--accent-hover);
          white-space: nowrap;
          flex-shrink: 0;
          font-weight: 500;
        }

        .item-meta {
          display: flex;
          align-items: center;
          font-size: 0.75rem;
          color: var(--text-tertiary);
          height: 18px;
        }

        .item-actions {
          display: flex;
          align-items: center;
          gap: 4px;
          position: relative;
        }

        .action-menu-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border: none;
          background: transparent;
          color: var(--text-tertiary);
          cursor: pointer;
          border-radius: var(--radius-sm);
          opacity: 0;
          transition: all var(--transition-fast);
        }

        .sidebar-item:hover .action-menu-btn {
          opacity: 1;
        }

        .action-menu-btn:hover {
          background: var(--bg-item-active);
          color: var(--text-primary);
        }

        .action-menu {
          position: absolute;
          top: 100%;
          right: 0;
          min-width: 140px;
          background: var(--bg-elevated);
          backdrop-filter: blur(var(--blur-lg));
          -webkit-backdrop-filter: blur(var(--blur-lg));
          border: 1px solid var(--border-light);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          z-index: 100;
          overflow: hidden;
          padding: 4px;
          animation: fadeInScale 0.15s ease;
        }

        .menu-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 10px;
          border: none;
          background: transparent;
          color: var(--text-primary);
          font-size: 0.78rem;
          cursor: pointer;
          text-align: left;
          border-radius: var(--radius-sm);
          transition: background var(--transition-fast);
        }

        .menu-item:hover {
          background: var(--bg-item-hover);
        }

        .menu-item.danger {
          color: var(--danger-color);
        }

        .menu-item.danger:hover {
          background: var(--danger-muted);
        }

        .copy-toast {
          position: sticky;
          top: 0;
          z-index: 50;
          background: var(--success-color);
          color: white;
          padding: 8px 12px;
          font-size: 0.78rem;
          text-align: center;
          margin: 0 8px;
          border-radius: var(--radius-md);
          animation: slideUp 0.2s ease;
        }

        .item-desc {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
          line-height: 18px;
        }

        /* Table Styles */
        .agents-table-container {
          overflow-x: auto;
          border: 1px solid var(--table-border);
          border-radius: var(--radius-lg);
          background: var(--table-bg);
          backdrop-filter: blur(var(--blur-sm));
          box-shadow: 0 2px 16px rgba(0, 0, 0, 0.06);
        }

        .agents-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
        }

        .agents-table thead {
          background: var(--table-header-bg);
          border-bottom: 2px solid rgba(99, 102, 241, 0.08);
        }

        .agents-table th {
          padding: 0.85rem 1rem;
          text-align: left;
          font-weight: 600;
          color: var(--text-tertiary);
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .agents-table th:first-child {
          padding-left: 1.25rem;
        }

        .agents-table tbody tr {
          border-bottom: 1px solid var(--table-border);
          transition: all var(--transition-fast);
        }

        .agents-table tbody tr:hover {
          background: rgba(99, 102, 241, 0.04);
          box-shadow: inset 3px 0 0 rgba(99, 102, 241, 0.35);
        }

        .agents-table tbody tr.row-selected {
          background: var(--accent-muted);
          box-shadow: inset 3px 0 0 var(--accent-color);
        }

        .agents-table tbody tr.row-selected:hover {
          background: var(--accent-muted);
        }

        .agents-table tbody tr.same-agent {
          background: var(--table-row-same);
        }

        .agents-table tbody tr.current-version {
          background: var(--table-row-current);
        }

        .agents-table td {
          padding: 0.85rem 1rem;
          vertical-align: top;
          color: var(--text-primary);
        }

        .agents-table td:first-child {
          padding-left: 1.25rem;
        }

        .col-name {
          min-width: 150px;
          font-weight: 500;
        }

        .agent-name-main {
          font-weight: 600;
          color: var(--text-primary);
        }

        .agent-name-version {
          color: var(--text-secondary);
          font-size: 0.82rem;
          padding-left: 1rem;
          position: relative;
        }

        .agent-name-version::before {
          content: '└';
          position: absolute;
          left: 0;
          color: var(--text-tertiary);
        }

        .col-type {
          min-width: 80px;
        }

        .type-badge {
          padding: 0.15rem 0.5rem;
          border-radius: var(--radius-full);
          font-size: 0.7rem;
          font-weight: 600;
          background: var(--accent-muted);
          color: var(--accent-hover);
          white-space: nowrap;
        }

        .col-version {
          min-width: 80px;
        }

        .version-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .version-number {
          font-weight: 600;
          color: var(--accent-color);
          font-size: 0.82rem;
        }

        .badge {
          padding: 0.15rem 0.5rem;
          border-radius: var(--radius-full);
          font-size: 0.7rem;
          font-weight: 600;
          white-space: nowrap;
        }

        .badge.current {
          background: var(--success-muted);
          color: var(--success-color);
          border: none;
        }

        .col-description {
          min-width: 200px;
          max-width: 300px;
          color: var(--text-secondary);
          font-size: 0.82rem;
        }

        .subagent-list.table.main-panel .col-description {
          max-width: none;
          min-width: min(100%, 420px);
          line-height: 1.45;
        }

        .col-category {
          min-width: 100px;
          color: var(--text-secondary);
          font-size: 0.82rem;
        }

        .col-tags {
          min-width: 150px;
        }

        .tags-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.25rem;
        }

        .tag {
          padding: 0.15rem 0.55rem;
          border-radius: var(--radius-full);
          border: 1px solid rgba(99, 102, 241, 0.12);
          font-size: 0.68rem;
          color: var(--accent-hover);
          background: rgba(99, 102, 241, 0.06);
          font-weight: 500;
          letter-spacing: 0.01em;
        }

        .tag-more {
          padding: 0.15rem 0.55rem;
          border-radius: var(--radius-full);
          font-size: 0.68rem;
          color: var(--text-tertiary);
          font-style: italic;
        }

        .col-actions {
          min-width: 150px;
        }

        .action-buttons {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .btn-icon {
          padding: 0.375rem;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .btn-icon:hover {
          border-color: var(--border-light);
          background: var(--bg-item-hover);
          color: var(--text-primary);
        }

        .btn-icon.btn-danger {
          border-color: transparent;
          color: var(--text-tertiary);
        }

        .btn-icon.btn-danger:hover {
          border-color: transparent;
          background: var(--danger-muted);
          color: var(--danger-color);
        }

        .loading,
        .empty-state,
        .error-message {
          text-align: center;
          padding: 2rem;
          color: var(--text-tertiary);
          font-size: 0.85rem;
        }

        .loading {
          animation: pulse-soft 1.5s ease infinite;
        }

        .error-message {
          border: 1px solid rgba(244, 63, 94, 0.2);
          border-radius: var(--radius-lg);
          color: var(--danger-color);
          margin-bottom: 1rem;
          background: var(--danger-muted);
          font-size: 0.85rem;
        }
      `}</style>
    </div>
  )
}
