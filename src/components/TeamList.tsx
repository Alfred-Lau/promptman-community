'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Search, X, Trash2, Copy, MoreVertical, Users, Eye, Edit, History } from 'lucide-react'
import { agentTeamAPI } from '@/lib/seekdb/api'
import type { AgentTeamMetadata, GetResult, TeammateDef } from '@/lib/seekdb/types'
import { ShortcutHint } from '@/components/Kbd'
import StorageStatusBadge from '@/components/StorageStatusBadge'

interface TeamListProps {
  onSelectTeam?: (teamId: string) => void
  onEditTeam?: (teamId: string) => void
  onViewVersions?: (teamId: string) => void
  onDeleteTeam?: (teamId: string) => void
  variant?: 'table' | 'sidebar'
  selectedId?: string | null
  embeddedInMain?: boolean
  listTitle?: string
}

interface TeamRow {
  id: string
  metadata: AgentTeamMetadata
  document: string
}

const DISPLAY_MODE_LABELS: Record<string, string> = {
  auto: '自动',
  'in-process': '进程内',
  'split-panes': '分屏',
}

export default function TeamList({
  onSelectTeam,
  onEditTeam,
  onViewVersions,
  onDeleteTeam,
  variant = 'table',
  selectedId,
  embeddedInMain = false,
  listTitle,
}: TeamListProps) {
  const [teams, setTeams] = useState<GetResult | null>(null)
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

  const loadTeams = async () => {
    try {
      setLoading(true)
      setError(null)
      const result = variant === 'sidebar'
        ? await agentTeamAPI.getCurrent()
        : await agentTeamAPI.getAll()
      setTeams(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载 Agent Teams 失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTeams()
  }, [variant])

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }

    try {
      setLoading(true)
      const results = await agentTeamAPI.search({
        queryTexts: [searchQuery],
        nResults: 20,
        include: ['documents', 'metadatas', 'distances'],
      })

      if (results.ids.length > 0 && results.ids[0].length > 0) {
        setSearchResults({
          ids: results.ids[0],
          documents: results.documents?.[0] || [],
          metadatas: results.metadatas?.[0] || [],
        })
      } else {
        setSearchResults({ ids: [], documents: [], metadatas: [] })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此 Team 吗？')) return
    try {
      await agentTeamAPI.delete(id)
      await loadTeams()
      if (onDeleteTeam) onDeleteTeam(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  const handleCopyTeamMd = async (row: TeamRow) => {
    try {
      const { generateTeamMd } = await import('@/lib/teamTemplates')
      let teammates: TeammateDef[] = []
      try {
        teammates = typeof row.metadata.teammates === 'string'
          ? JSON.parse(row.metadata.teammates)
          : row.metadata.teammates
      } catch { teammates = [] }

      const content = generateTeamMd({
        name: row.metadata.name,
        description: row.metadata.description,
        displayMode: row.metadata.displayMode,
        leadInstructions: row.metadata.leadInstructions,
        leadModel: row.metadata.leadModel,
        delegateMode: row.metadata.delegateMode,
        requirePlanApproval: row.metadata.requirePlanApproval,
        teammates,
        taskTemplate: row.metadata.taskTemplate,
        qualityGates: row.metadata.qualityGates,
        maxTeammates: row.metadata.maxTeammates,
      })
      await navigator.clipboard.writeText(content)
      setCopySuccess(row.id)
      setTimeout(() => setCopySuccess(null), 2000)
    } catch {
      // fallback
    }
  }

  const displayData = searchResults || teams

  const rows: TeamRow[] = useMemo(() => {
    if (!displayData) return []
    return displayData.ids.map((id, index) => ({
      id,
      metadata: displayData.metadatas[index] as AgentTeamMetadata,
      document: displayData.documents[index] || '',
    }))
  }, [displayData])

  const handleListKeyDown = useCallback((e: React.KeyboardEvent) => {
    const len = rows.length
    if (len === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIdx((i) => { const next = Math.min(i + 1, len - 1); itemRefs.current[next]?.scrollIntoView({ block: 'nearest' }); return next })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIdx((i) => { const prev = Math.max(i - 1, 0); itemRefs.current[prev]?.scrollIntoView({ block: 'nearest' }); return prev })
    } else if (e.key === 'Enter' && focusedIdx >= 0) {
      e.preventDefault()
      onSelectTeam?.(rows[focusedIdx].id)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setFocusedIdx(-1)
      listRef.current?.blur()
    }
  }, [rows, focusedIdx, onSelectTeam])

  useEffect(() => {
    if (variant !== 'sidebar') return
    const onGlobalKey = (e: KeyboardEvent) => {
      if (!listRef.current) return
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
  }, [variant])

  useEffect(() => {
    if (variant !== 'table' || !embeddedInMain) return
    const onGlobalKey = (e: KeyboardEvent) => {
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

  const getTeammatesCount = (metadata: AgentTeamMetadata): number => {
    try {
      const teammates = typeof metadata.teammates === 'string'
        ? JSON.parse(metadata.teammates)
        : metadata.teammates
      return Array.isArray(teammates) ? teammates.length : 0
    } catch {
      return 0
    }
  }

  // Sidebar variant
  if (variant === 'sidebar') {
    return (
      <div className="team-sidebar-list">
        {/* Search */}
        <div className="sidebar-search">
          <div className="search-input-wrap">
            <Search size={14} className="search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="搜索团队... (/ 或 ⌘F)"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                if (!e.target.value.trim()) setSearchResults(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch()
                else if (e.key === 'Escape') { setSearchQuery(''); setSearchResults(null); setFocusedIdx(-1); listRef.current?.focus() }
                else if (e.key === 'ArrowDown') { e.preventDefault(); listRef.current?.focus(); setFocusedIdx(0) }
              }}
            />
            {searchQuery ? (
              <button
                onClick={() => { setSearchQuery(''); setSearchResults(null) }}
                className="clear-btn"
              >
                <X size={12} />
              </button>
            ) : (
              <kbd className="search-kbd">⌘F</kbd>
            )}
          </div>
        </div>

        {/* List */}
        <div
          className="sidebar-items"
          ref={listRef}
          tabIndex={0}
          onKeyDown={handleListKeyDown}
          onFocus={() => { if (focusedIdx < 0 && rows.length > 0) setFocusedIdx(0) }}
        >
          {loading && rows.length === 0 && (
            <div className="sidebar-loading">Loading...</div>
          )}
          {error && <div className="sidebar-error">{error}</div>}
          {!loading && rows.length === 0 && !error && (
            <div className="sidebar-empty">
              <Users size={24} className="empty-icon" />
              <span>No teams yet</span>
            </div>
          )}
          {rows.map((row, idx) => (
            <div
              key={row.id}
              ref={(el) => { itemRefs.current[idx] = el }}
              className={`sidebar-item ${selectedId === row.id ? 'active' : ''} ${focusedIdx === idx ? 'keyboard-focused' : ''}`}
              onClick={() => { onSelectTeam?.(row.id); setFocusedIdx(idx) }}
            >
              <div className="item-main">
                <div className="item-title-row">
                  <div className="item-title">{row.metadata.name}</div>
                  <StorageStatusBadge isCloud={false} compact />
                </div>
                <div className="item-meta">
                  <span className="item-badge team-badge">
                    <Users size={10} /> {getTeammatesCount(row.metadata)} members
                  </span>
                  <span className="item-badge mode-badge">
                    {DISPLAY_MODE_LABELS[row.metadata.displayMode] || row.metadata.displayMode}
                  </span>
                  {row.metadata.delegateMode && (
                    <span className="item-badge delegate-badge">Delegate</span>
                  )}
                </div>
              </div>
              <div className="item-actions">
                <button
                  className="item-menu-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuOpenId(menuOpenId === row.id ? null : row.id)
                  }}
                >
                  <MoreVertical size={14} />
                </button>
                {menuOpenId === row.id && (
                  <div className="item-menu" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => { handleCopyTeamMd(row); setMenuOpenId(null) }}>
                      <Copy size={12} /> {copySuccess === row.id ? 'Copied!' : 'Copy TEAM.md'}
                    </button>
                    <button
                      className="danger"
                      onClick={() => { handleDelete(row.id); setMenuOpenId(null) }}
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {rows.length > 0 && (
            <div className="list-kbd-bar">
              <ShortcutHint hints={[
                { keys: ["↑", "↓"], label: "导航" },
                { keys: ["↵"],      label: "选中" },
                { keys: ["Esc"],    label: "退出" },
              ]} />
            </div>
          )}
        </div>

        <style jsx>{`
          .team-sidebar-list {
            display: flex;
            flex-direction: column;
            height: 100%;
            overflow: hidden;
          }

          .sidebar-search {
            padding: 0 16px 12px;
          }

          .search-input-wrap {
            position: relative;
            display: flex;
            align-items: center;
          }

          .search-input-wrap :global(.search-icon) {
            position: absolute;
            left: 10px;
            color: var(--text-tertiary);
          }

          .search-input-wrap input {
            width: 100%;
            padding: 8px 28px 8px 32px;
            border: 1px solid var(--border-color);
            border-radius: var(--radius-md);
            background: var(--bg-glass);
            color: var(--text-primary);
            font-size: 0.82rem;
            outline: none;
            transition: border-color var(--transition-fast);
          }

          .search-input-wrap input:focus {
            border-color: var(--accent-color);
          }

          .clear-btn {
            position: absolute;
            right: 8px;
            background: none;
            border: none;
            color: var(--text-tertiary);
            cursor: pointer;
            padding: 2px;
          }

          .search-kbd {
            position: absolute;
            right: 8px;
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
            pointer-events: none;
          }

          .list-kbd-bar {
            padding: 7px 10px 5px;
            border-top: 1px solid var(--border-color);
            opacity: 0.7;
          }

          .sidebar-items {
            flex: 1;
            overflow-y: auto;
            padding: 0 8px;
          }

          .sidebar-loading,
          .sidebar-error,
          .sidebar-empty {
            text-align: center;
            padding: 2rem 1rem;
            font-size: 0.82rem;
            color: var(--text-tertiary);
          }

          .sidebar-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.5rem;
          }

          .sidebar-empty :global(.empty-icon) {
            opacity: 0.3;
          }

          .sidebar-error {
            color: var(--danger-color);
          }

          .sidebar-item {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            padding: 10px 12px;
            margin-bottom: 2px;
            border-radius: var(--radius-md);
            cursor: pointer;
            transition: all var(--transition-fast);
            position: relative;
          }

          .sidebar-item:hover {
            background: var(--bg-item-hover);
          }

          .sidebar-item.active {
            background: rgba(99, 102, 241, 0.08);
            border-left: 2px solid var(--accent-color);
          }

          .sidebar-item.keyboard-focused {
            background: var(--bg-item-hover, rgba(255,255,255,0.05));
            border-left: 2px solid rgba(99, 102, 241, 0.6);
            outline: none;
          }

          .sidebar-item.keyboard-focused .item-title {
            color: var(--accent-color);
          }

          .sidebar-items:focus {
            outline: none;
          }

          .item-main {
            flex: 1;
            min-width: 0;
          }

          .item-title-row {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 4px;
          }

          .item-title {
            font-size: 0.85rem;
            font-weight: 500;
            color: var(--text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .item-meta {
            display: flex;
            gap: 4px;
            flex-wrap: wrap;
          }

          .item-badge {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            font-size: 0.68rem;
            padding: 1px 6px;
            border-radius: var(--radius-full);
            font-weight: 500;
          }

          .team-badge {
            background: var(--accent-muted);
            color: var(--accent-hover);
            border: 1px solid rgba(99, 102, 241, 0.2);
          }

          .mode-badge {
            background: var(--bg-glass);
            color: var(--text-tertiary);
            border: 1px solid var(--border-color);
          }

          .delegate-badge {
            background: rgba(99, 102, 241, 0.1);
            color: var(--accent-color);
            border: 1px solid rgba(99, 102, 241, 0.2);
          }

          .item-actions {
            position: relative;
            flex-shrink: 0;
          }

          .item-menu-btn {
            background: none;
            border: none;
            color: var(--text-tertiary);
            cursor: pointer;
            padding: 4px;
            border-radius: var(--radius-sm);
            opacity: 0;
            transition: opacity var(--transition-fast);
          }

          .sidebar-item:hover .item-menu-btn {
            opacity: 1;
          }

          .item-menu-btn:hover {
            color: var(--text-primary);
            background: var(--bg-glass);
          }

          .item-menu {
            position: absolute;
            right: 0;
            top: 100%;
            background: var(--bg-sidebar);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-md);
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
            z-index: 50;
            min-width: 150px;
            padding: 4px;
          }

          .item-menu button {
            display: flex;
            align-items: center;
            gap: 8px;
            width: 100%;
            padding: 8px 12px;
            background: none;
            border: none;
            color: var(--text-primary);
            font-size: 0.8rem;
            cursor: pointer;
            border-radius: var(--radius-sm);
            transition: background var(--transition-fast);
          }

          .item-menu button:hover {
            background: var(--bg-item-hover);
          }

          .item-menu button.danger {
            color: var(--danger-color);
          }

          .item-menu button.danger:hover {
            background: rgba(239, 68, 68, 0.08);
          }
        `}</style>
      </div>
    )
  }

  // Table variant (default)
  return (
    <div className={`team-table-list${embeddedInMain ? ' main-panel' : ''}`}>
      <div className="table-header">
        <h2 className="table-list-title">{listTitle ?? 'Agent Teams'}</h2>
        <div className={`search-wrap${embeddedInMain ? ' search-wrap-wide' : ''}`}>
          <Search size={14} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              if (!e.target.value.trim()) setSearchResults(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          {embeddedInMain && !searchQuery ? (
            <kbd className="search-kbd-table">⌘F</kbd>
          ) : null}
        </div>
      </div>

      {loading && <div className="loading">Loading...</div>}
      {error && <div className="error">{error}</div>}

      {!loading && rows.length === 0 && !error && (
        <div className="empty">No teams found</div>
      )}

      {rows.length > 0 && (
        <div className="teams-table-scroll">
          <table className="teams-data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Category</th>
                <th>Teammates</th>
                <th>Display Mode</th>
                <th>Version</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const sel = selectedId === row.id
                return (
                  <tr
                    key={row.id}
                    className={sel ? 'row-selected' : ''}
                    onClick={() => onSelectTeam?.(row.id)}
                    style={{ cursor: onSelectTeam ? 'pointer' : undefined }}
                  >
                    <td className="col-name">
                      <div className="table-cell-clamp-2">{row.metadata.name}</div>
                    </td>
                    <td className="col-desc">
                      <div className="table-cell-clamp-3">{row.metadata.description || '—'}</div>
                    </td>
                    <td>{row.metadata.category || '-'}</td>
                    <td>{getTeammatesCount(row.metadata)}</td>
                    <td>{DISPLAY_MODE_LABELS[row.metadata.displayMode] || row.metadata.displayMode}</td>
                    <td>
                      v{row.metadata.version} <StorageStatusBadge isCloud={false} compact />
                    </td>
                    <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                      <div className="team-action-btns">
                        {onSelectTeam && (
                          <button type="button" className="btn-icon" title="View" onClick={() => onSelectTeam(row.id)}>
                            <Eye size={16} />
                          </button>
                        )}
                        {onViewVersions && (
                          <button
                            type="button"
                            className="btn-icon"
                            title="Versions"
                            onClick={() => onViewVersions(row.metadata.teamId)}
                          >
                            <History size={16} />
                          </button>
                        )}
                        {onEditTeam && (
                          <button type="button" className="btn-icon" title="Edit" onClick={() => onEditTeam(row.id)}>
                            <Edit size={16} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-icon"
                          title="Copy TEAM.md"
                          onClick={() => handleCopyTeamMd(row)}
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon btn-danger"
                          title="Delete"
                          onClick={() => handleDelete(row.id)}
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
        .team-table-list {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .team-table-list.main-panel .table-header {
          flex-direction: column;
          align-items: stretch;
          gap: 0.75rem;
        }

        .table-list-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.03em;
          margin: 0;
        }

        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .search-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          position: relative;
          flex: 1;
          max-width: 400px;
        }

        .search-wrap-wide {
          max-width: none;
        }

        .search-wrap :global(svg) {
          position: absolute;
          left: 10px;
          color: var(--text-tertiary);
          pointer-events: none;
        }

        .search-wrap input {
          width: 100%;
          padding: 8px 12px 8px 32px;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          background: var(--bg-glass);
          color: var(--text-primary);
          font-size: 0.82rem;
        }

        .search-wrap-wide input {
          padding-right: 48px;
        }

        .search-kbd-table {
          position: absolute;
          right: 10px;
          font-family: 'SF Mono', ui-monospace, monospace;
          font-size: 0.6rem;
          padding: 2px 5px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.13);
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-tertiary);
          pointer-events: none;
        }

        .teams-table-scroll {
          overflow-x: auto;
          border: 1px solid var(--table-border, var(--border-color));
          border-radius: var(--radius-lg);
          background: var(--table-bg, var(--bg-glass));
          box-shadow: 0 2px 16px rgba(0, 0, 0, 0.06);
        }

        .teams-data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
        }

        .teams-data-table thead {
          background: var(--table-header-bg, var(--bg-item-hover));
          border-bottom: 2px solid rgba(99, 102, 241, 0.08);
        }

        .teams-data-table th {
          padding: 0.85rem 1rem;
          text-align: left;
          font-weight: 600;
          color: var(--text-tertiary);
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .teams-data-table th:first-child {
          padding-left: 1.25rem;
        }

        .teams-data-table td {
          padding: 0.85rem 1rem;
          border-top: 1px solid var(--border-color);
          vertical-align: top;
          color: var(--text-primary);
        }

        .teams-data-table td:first-child {
          padding-left: 1.25rem;
        }

        .teams-data-table tbody tr {
          transition: all var(--transition-fast);
        }

        .teams-data-table tbody tr:hover {
          background: rgba(99, 102, 241, 0.04);
          box-shadow: inset 3px 0 0 rgba(99, 102, 241, 0.35);
        }

        .teams-data-table tbody tr.row-selected {
          background: var(--accent-muted);
          box-shadow: inset 3px 0 0 var(--accent-color);
        }

        .col-name {
          font-weight: 600;
          min-width: 0;
          max-width: 280px;
        }

        .team-table-list.main-panel .col-name {
          max-width: 360px;
        }

        .col-desc {
          color: var(--text-secondary);
          font-size: 0.82rem;
          line-height: 1.45;
          max-width: 420px;
        }

        .team-table-list.main-panel .col-desc {
          max-width: none;
          min-width: min(100%, 480px);
        }

        .team-action-btns {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          align-items: center;
        }

        .btn-icon {
          padding: 0.375rem;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .btn-icon:hover {
          background: var(--bg-item-hover);
          color: var(--text-primary);
        }

        .btn-icon.btn-danger {
          color: var(--danger-color);
          border-color: rgba(239, 68, 68, 0.35);
        }

        .loading,
        .error,
        .empty {
          padding: 1rem;
          font-size: 0.85rem;
          color: var(--text-tertiary);
        }

        .error {
          color: var(--danger-color);
        }
      `}</style>
    </div>
  )
}
