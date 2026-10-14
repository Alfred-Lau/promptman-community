'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Search, X, Eye, Edit, History, Trash2, Copy, MoreVertical, FolderInput, FolderMinus, ChevronRight, Cloud } from 'lucide-react'
import { agentSkillAPI, libraryAPI } from '@/lib/seekdb/api'
import type { AgentSkillMetadata, GetResult, LibraryItem } from '@/lib/seekdb/types'
import { ShortcutHint } from '@/components/Kbd'
import StorageStatusBadge from '@/components/StorageStatusBadge'
import { useLocale } from '@/lib/i18n'
import { resolveLibraryOrCategoryLabel } from '@/lib/libraryLabel'
import { isExternalSyncedSkillId, partitionRowsByExternalSync } from '@/lib/externalSyncIds'

interface AgentSkillListProps {
  onSelectSkill?: (skillId: string) => void
  onEditSkill?: (skillId: string) => void
  onViewVersions?: (skillId: string) => void
  onDeleteSkill?: (skillId: string) => void
  variant?: 'table' | 'sidebar'
  selectedId?: string | null
  /** 主内容区宽布局：描述列更宽、完整展示文案 */
  embeddedInMain?: boolean
  /** 表格模式顶部标题 */
  listTitle?: string
  /** 按库过滤，null 表示全部 */
  libraryId?: string | null
  /** 多维正交标签筛选（tag_definitions id 列表），AND 语义；空数组表示不筛 */
  tagIds?: string[]
  /** 库列表，用于移动到库菜单 */
  libraries?: LibraryItem[]
  /** 移动到库后刷新 */
  onLibraryChanged?: () => void
  /** 加载完成后自动选中第一项 */
  autoSelectFirst?: boolean
  /** 不渲染内部搜索框 header（由父组件提供通栏搜索） */
  hideHeader?: boolean
  /** 受控搜索值：提供时将用作搜索查询，并自动去抖触发搜索 */
  searchValue?: string
  /** 受控搜索值变更回调 */
  onSearchValueChange?: (v: string) => void
}

interface AgentSkillRow {
  id: string
  metadata: AgentSkillMetadata
  document: string
}

export default function AgentSkillList({ 
  onSelectSkill, 
  onEditSkill, 
  onViewVersions,
  onDeleteSkill,
  variant = 'table',
  selectedId,
  embeddedInMain = false,
  listTitle,
  libraryId,
  tagIds,
  libraries = [],
  onLibraryChanged,
  autoSelectFirst = false,
  hideHeader = false,
  searchValue,
  onSearchValueChange,
}: AgentSkillListProps) {
  const { t } = useLocale()
  const [skills, setSkills] = useState<GetResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [internalSearchQuery, setInternalSearchQuery] = useState('')
  const isSearchControlled = searchValue !== undefined
  const searchQuery = isSearchControlled ? (searchValue as string) : internalSearchQuery
  const setSearchQuery = useCallback((v: string) => {
    if (isSearchControlled) onSearchValueChange?.(v)
    else setInternalSearchQuery(v)
  }, [isSearchControlled, onSearchValueChange])
  const [searchResults, setSearchResults] = useState<GetResult | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState<string | null>(null)
  const [focusedIdx, setFocusedIdx] = useState(-1)
  const [showMoveMenu, setShowMoveMenu] = useState<string | null>(null)
  const [externalSyncExpanded, setExternalSyncExpanded] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  // 加载 Agent Skills - 侧边栏模式只加载当前版本，表格模式加载所有版本
  const loadSkills = async () => {
    try {
      setLoading(true)
      setError(null)
      // 侧边栏只显示当前版本，表格显示所有版本
      const result = variant === 'sidebar'
        ? await agentSkillAPI.getCurrent()
        : await agentSkillAPI.getAll()
      setSkills(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载 Agent Skills 失败')
    } finally {
      setLoading(false)
    }
  }

  const isCloudFolder = typeof libraryId === 'string' && libraryId.startsWith('cloud:')
  const cloudFolderId = isCloudFolder ? libraryId.slice(6) : null
  const [cloudFolderSkills, setCloudFolderSkills] = useState<Array<{ id: string; name: string; description?: string; accent?: string; updated_at?: string }>>([])

  useEffect(() => {
    loadSkills()
  }, [variant, libraryId, tagIds])

  useEffect(() => {
    if (!cloudFolderId) { setCloudFolderSkills([]); return }
    libraryAPI.listCloudItems(cloudFolderId).then(items => {
      setCloudFolderSkills(items.filter(i => i.kind === 'skill').map(i => ({
        id: i.id,
        name: i.name,
        description: i.description ?? undefined,
        accent: i.accent,
        updated_at: i.updated_at,
      })))
    }).catch(() => setCloudFolderSkills([]))
  }, [cloudFolderId])

  // 搜索 Agent Skills
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }

    try {
      setLoading(true)
      const results = await agentSkillAPI.search({
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
      setSearchResults(formattedResults)
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败')
    } finally {
      setLoading(false)
    }
  }

  // 受控搜索模式下：去抖自动触发搜索；空串时立即清空结果
  useEffect(() => {
    if (!isSearchControlled) return
    const q = searchQuery.trim()
    if (!q) {
      setSearchResults(null)
      return
    }
    const timer = setTimeout(() => {
      handleSearch()
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSearchControlled, searchQuery])

  // 删除 Agent Skill
  const handleDelete = async (id: string, skillId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setMenuOpenId(null)
    // 外部 fs-scan 技能：sourcePath 命中磁盘文件时，confirm 必须含完整路径与磁盘影响提示
    const row = skillRows.find((r) => r.id === id)
    const diskSourcePath = row?.metadata?.sourcePath
    const touchesDisk = isExternalSyncedSkillId(skillId) && !!diskSourcePath
    const baseMsg = '确定要删除这个 Agent Skill 吗？'
    if (touchesDisk) {
      if (!confirm(`${baseMsg}\n\n该技能来自外部目录，将同时删除磁盘文件：\n${diskSourcePath}\n\n删除后会影响使用该技能的 agent。`)) {
        return
      }
    } else if (!confirm(baseMsg)) {
      return
    }

    try {
      await agentSkillAPI.delete(id, touchesDisk ? { confirmDisk: true } : undefined)
      await loadSkills()
      if (searchResults) {
        await handleSearch()
      }
      onDeleteSkill?.(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  // 打开编辑器：外部 fs-scan 条目先警告将写回磁盘源文件
  const handleEditClick = (row: AgentSkillRow) => {
    const meta = row.metadata
    if (isExternalSyncedSkillId(meta.skillId) && meta.sourcePath) {
      const ok = confirm(`该技能来自外部目录，保存修改将写回磁盘文件：\n${meta.sourcePath}\n\n修改会影响使用该技能的 agent。是否继续？`)
      if (!ok) return
    }
    onEditSkill?.(row.id)
  }

  // 复制 Skill 内容到剪贴板
  const handleCopy = async (skill: AgentSkillMetadata, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setMenuOpenId(null)
    try {
      await navigator.clipboard.writeText(skill.template)
      setCopySuccess(skill.name)
      setTimeout(() => setCopySuccess(null), 2000)
    } catch (err) {
      setError('复制失败')
    }
  }

  // 切换菜单
  const toggleMenu = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpenId(menuOpenId === id ? null : id)
  }

  // 移动到库
  const handleMoveToLibrary = async (skillGroupId: string, targetLibraryId: string | null, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setMenuOpenId(null)
    setShowMoveMenu(null)
    try {
      await libraryAPI.moveSkill(skillGroupId, targetLibraryId)
      await loadSkills()
      onLibraryChanged?.()
    } catch {
      // silently fail
    }
  }

  // 处理数据：将 Agent Skill 按 skillId 分组，同一 skill 的不同版本放在一起
  const skillRows = useMemo(() => {
    const displaySkills = searchResults || skills
    if (!displaySkills) return []

    const rows: AgentSkillRow[] = displaySkills.ids.map((id, index) => ({
      id,
      metadata: displaySkills.metadatas[index] as AgentSkillMetadata,
      document: displaySkills.documents[index] || '',
    }))

    // 按 skillId 分组，然后按版本号排序
    const grouped = new Map<string, AgentSkillRow[]>()
    rows.forEach((row) => {
      const skillId = row.metadata.skillId
      if (!grouped.has(skillId)) {
        grouped.set(skillId, [])
      }
      grouped.get(skillId)!.push(row)
    })

    // 对每个 skillId 的版本按版本号降序排序
    grouped.forEach((versions) => {
      versions.sort((a, b) => b.metadata.version - a.metadata.version)
    })

    // 展平为数组，但保持同一 skillId 的版本相邻
    let out: AgentSkillRow[] = []
    grouped.forEach((versions) => {
      out.push(...versions)
    })

    // 按库过滤（云端文件夹不过滤本地数据）
    if (libraryId !== undefined && libraryId !== null && !isCloudFolder) {
      out = out.filter((r) => r.metadata.libraryId === libraryId)
    }

    if (tagIds && tagIds.length > 0) {
      out = out.filter((r) => tagIds.every(id => r.metadata.tagIds?.includes(id)))
    }

    return out
  }, [skills, searchResults, libraryId, tagIds, isCloudFolder])

  const { userRows: userSkillRows, externalRows: externalSkillRows } = useMemo(
    () =>
      partitionRowsByExternalSync(
        skillRows,
        (r) => r.metadata.skillId,
        isExternalSyncedSkillId,
      ),
    [skillRows],
  )

  const showExternalSkillRows =
    externalSkillRows.length > 0 &&
    (userSkillRows.length === 0 || externalSyncExpanded)

  const displaySkillRows = useMemo(
    () => [...userSkillRows, ...(showExternalSkillRows ? externalSkillRows : [])],
    [userSkillRows, externalSkillRows, showExternalSkillRows],
  )

  // 自动选中第一项（优先用户创建）
  useEffect(() => {
    if (autoSelectFirst && !loading && !selectedId && skillRows.length > 0 && onSelectSkill) {
      const first = userSkillRows[0]?.id ?? externalSkillRows[0]?.id
      if (first) onSelectSkill(first)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSelectFirst, loading, skillRows.length, selectedId])

  // 键盘导航 (仅侧边栏模式)
  const handleListKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (variant !== 'sidebar') return
    const len = displaySkillRows.length
    if (len === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIdx((i) => { const next = Math.min(i + 1, len - 1); itemRefs.current[next]?.scrollIntoView({ block: 'nearest' }); return next })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIdx((i) => { const prev = Math.max(i - 1, 0); itemRefs.current[prev]?.scrollIntoView({ block: 'nearest' }); return prev })
    } else if (e.key === 'Enter' && focusedIdx >= 0) {
      e.preventDefault()
      onSelectSkill?.(displaySkillRows[focusedIdx].id)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setFocusedIdx(-1)
      listRef.current?.blur()
    }
  }, [variant, displaySkillRows, focusedIdx, onSelectSkill])

  useEffect(() => {
    setFocusedIdx((i) => {
      if (displaySkillRows.length === 0) return -1
      if (i >= displaySkillRows.length) return displaySkillRows.length - 1
      return i
    })
  }, [displaySkillRows.length])

  useEffect(() => {
    if (hideHeader || isSearchControlled) return
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
  }, [variant, embeddedInMain, hideHeader, isSearchControlled])

  return (
    <div className={`agent-skill-list ${variant}${embeddedInMain ? ' main-panel' : ''}${hideHeader ? ' headerless' : ''}`}>
      {!hideHeader && (
        <div className="agent-skill-list-header">
          {variant === 'table' && (listTitle ? <h2 className="table-list-title">{listTitle}</h2> : <h2 className="table-list-title">Agent Skills</h2>)}
          <div className="search-box">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="搜索技能..."
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
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : skillRows.length === 0 ? (
        <div className="empty-state">
          {searchResults ? 'No matches' : 'No skills'}
        </div>
      ) : variant === 'sidebar' ? (
        <div
          className="sidebar-list"
          ref={listRef}
          tabIndex={0}
          onKeyDown={handleListKeyDown}
          onFocus={() => { if (focusedIdx < 0 && displaySkillRows.length > 0) setFocusedIdx(0) }}
        >
          {copySuccess && (
            <div className="copy-toast">
              ✓ 已复制 "{copySuccess}"
            </div>
          )}
          {userSkillRows.map((row, idx) => {
            const skill = row.metadata
            const isSelected = selectedId === row.id
            const isMenuOpen = menuOpenId === row.id
            const isFocused = focusedIdx === idx

            return (
              <div
                key={row.id}
                ref={(el) => { itemRefs.current[idx] = el }}
                className={`sidebar-item ${isSelected ? 'selected' : ''} ${isFocused ? 'keyboard-focused' : ''}`}
                onClick={() => { onSelectSkill?.(row.id); setFocusedIdx(idx) }}
              >
                <div className="item-header">
                  <span className="item-title">{skill.name}</span>
                  <div className="item-actions">
                    <StorageStatusBadge isCloud={false} compact />
                    {(() => {
                      const libLabel = resolveLibraryOrCategoryLabel(libraries, skill.libraryId, skill.category)
                      return libLabel ? (
                      <span className="category-tag">{libLabel}</span>
                      ) : null
                    })()}
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
                          onClick={(e) => handleCopy(skill, e)}
                        >
                          <Copy size={14} />
                          复制内容
                        </button>
                        {libraries.length > 0 && (
                          <div className="menu-item-group">
                            {skill.libraryId ? (
                              <button
                                className="menu-item"
                                onClick={(e) => handleMoveToLibrary(skill.skillId, null, e)}
                              >
                                <FolderMinus size={14} />
                                {t.library.removeFromLibrary}
                              </button>
                            ) : null}
                            <button
                              className="menu-item"
                              onClick={(e) => { e.stopPropagation(); setShowMoveMenu(showMoveMenu === row.id ? null : row.id) }}
                            >
                              <FolderInput size={14} />
                              {t.library.moveToLibrary}
                            </button>
                            {showMoveMenu === row.id && (
                              <div className="move-submenu">
                                {libraries.map(lib => (
                                  <button
                                    key={lib.id}
                                    className={`menu-item ${skill.libraryId === lib.id ? 'active' : ''}`}
                                    onClick={(e) => handleMoveToLibrary(skill.skillId, lib.id, e)}
                                  >
                                    <span>{lib.icon}</span>
                                    {lib.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <button
                          className="menu-item danger"
                          onClick={(e) => handleDelete(row.id, skill.skillId, e)}
                        >
                          <Trash2 size={14} />
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="item-meta">
                   {skill.description && (
                     <span className="item-desc">
                       {skill.description.length > 40 
                         ? skill.description.substring(0, 40) + '...' 
                         : skill.description}
                     </span>
                   )}
                </div>
              </div>
            )
          })}
          {externalSkillRows.length > 0 && userSkillRows.length > 0 && (
            <button
              type="button"
              className="external-sync-group-header"
              onClick={() => setExternalSyncExpanded((v) => !v)}
              aria-expanded={externalSyncExpanded}
            >
              <ChevronRight size={16} className={externalSyncExpanded ? 'external-sync-chevron-open' : undefined} />
              <span>{t.promptList.externalSyncGroupTitle}</span>
              <span className="external-sync-count">({externalSkillRows.length})</span>
            </button>
          )}
          {showExternalSkillRows && externalSkillRows.map((row, idx) => {
            const skill = row.metadata
            const rowIdx = userSkillRows.length + idx
            const isSelected = selectedId === row.id
            const isMenuOpen = menuOpenId === row.id
            const isFocused = focusedIdx === rowIdx

            return (
              <div
                key={row.id}
                ref={(el) => { itemRefs.current[rowIdx] = el }}
                className={`sidebar-item ${isSelected ? 'selected' : ''} ${isFocused ? 'keyboard-focused' : ''}`}
                onClick={() => { onSelectSkill?.(row.id); setFocusedIdx(rowIdx) }}
              >
                <div className="item-header">
                  <span className="item-title">{skill.name}</span>
                  <div className="item-actions">
                    <StorageStatusBadge isCloud={false} compact />
                    {(() => {
                      const libLabel = resolveLibraryOrCategoryLabel(libraries, skill.libraryId, skill.category)
                      return libLabel ? (
                      <span className="category-tag">{libLabel}</span>
                      ) : null
                    })()}
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
                          onClick={(e) => handleCopy(skill, e)}
                        >
                          <Copy size={14} />
                          复制内容
                        </button>
                        {libraries.length > 0 && (
                          <div className="menu-item-group">
                            {skill.libraryId ? (
                              <button
                                className="menu-item"
                                onClick={(e) => handleMoveToLibrary(skill.skillId, null, e)}
                              >
                                <FolderMinus size={14} />
                                {t.library.removeFromLibrary}
                              </button>
                            ) : null}
                            <button
                              className="menu-item"
                              onClick={(e) => { e.stopPropagation(); setShowMoveMenu(showMoveMenu === row.id ? null : row.id) }}
                            >
                              <FolderInput size={14} />
                              {t.library.moveToLibrary}
                            </button>
                            {showMoveMenu === row.id && (
                              <div className="move-submenu">
                                {libraries.map(lib => (
                                  <button
                                    key={lib.id}
                                    className={`menu-item ${skill.libraryId === lib.id ? 'active' : ''}`}
                                    onClick={(e) => handleMoveToLibrary(skill.skillId, lib.id, e)}
                                  >
                                    <span>{lib.icon}</span>
                                    {lib.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <button
                          className="menu-item danger"
                          onClick={(e) => handleDelete(row.id, skill.skillId, e)}
                        >
                          <Trash2 size={14} />
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="item-meta">
                   {skill.description && (
                     <span className="item-desc">
                       {skill.description.length > 40
                         ? skill.description.substring(0, 40) + '...'
                         : skill.description}
                     </span>
                   )}
                </div>
              </div>
            )
          })}
          {isCloudFolder && cloudFolderSkills.length > 0 && (
            <>
              <div className="cloud-section-header">
                <Cloud size={12} /> 云端文件夹内容 ({cloudFolderSkills.length})
              </div>
              {cloudFolderSkills.map(cs => (
                <div key={`cfs-${cs.id}`} className="cloud-skill-item">
                  <div className="cloud-skill-dot" style={{ background: cs.accent || '#6ee7f7' }} />
                  <span className="cloud-skill-name">{cs.name}</span>
                  {cs.description && <span className="cloud-skill-desc">{cs.description}</span>}
                  <span className="cloud-skill-badge">cloud</span>
                </div>
              ))}
            </>
          )}
          {displaySkillRows.length > 0 && (
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
        <div className="skills-table-container">
          <table className="skills-table">
            {/* ... table content ... */}
            <thead>
              <tr>
                <th className="col-name">名称</th>
                <th className="col-version">版本</th>
                <th className="col-description">描述</th>
                <th className="col-category">{t.promptList.colLibrary}</th>
                <th className="col-tags">标签</th>
                <th className="col-actions">操作</th>
              </tr>
            </thead>
            <tbody>
              {userSkillRows.map((row, index) => {
                const skill = row.metadata
                const tags = Array.isArray(skill.tags) ? skill.tags : []
                const prevRow = index > 0 ? userSkillRows[index - 1] : null
                const isSameSkill = prevRow?.metadata.skillId === skill.skillId
                const isFirstVersion = !isSameSkill

                const isRowSelected = selectedId === row.id
                return (
                  <tr
                    key={row.id}
                    className={`skill-row ${isSameSkill ? 'same-skill' : ''} ${skill.isCurrentVersion ? 'current-version' : ''} ${isRowSelected ? 'row-selected' : ''}`}
                    onClick={() => onSelectSkill?.(row.id)}
                    style={{ cursor: onSelectSkill ? 'pointer' : undefined }}
                  >
                    <td className="col-name">
                      {isFirstVersion ? (
                        <div className="skill-name-main table-cell-clamp-2">{skill.name}</div>
                      ) : (
                        <div className="skill-name-version table-cell-clamp-2">{skill.name}</div>
                      )}
                    </td>
                    <td className="col-version">
                      <div className="version-info">
                        <span className="version-number">v{skill.version}</span>
                        {skill.isCurrentVersion && (
                          <span className="badge current">当前</span>
                        )}
                        {(skill.fileCount ?? 0) > 0 && (
                          <span className="badge package-badge" title={t.skillPackage.packageLabel}>
                            {t.skillPackage.badge.replace('{count}', String(skill.fileCount))}
                          </span>
                        )}
                        <StorageStatusBadge isCloud={false} />
                      </div>
                    </td>
                    <td className="col-description">
                      <div className="table-cell-clamp-3">
                        {skill.description || '-'}
                      </div>
                    </td>
                    <td className="col-category">
                      {resolveLibraryOrCategoryLabel(libraries, skill.libraryId, skill.category) || '-'}
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
                        {onSelectSkill && (
                          <button
                            type="button"
                            onClick={() => onSelectSkill(row.id)}
                            className="btn-icon"
                            title="查看"
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        {onViewVersions && (
                          <button
                            type="button"
                            onClick={() => onViewVersions(skill.skillId)}
                            className="btn-icon"
                            title="版本历史"
                          >
                            <History size={16} />
                          </button>
                        )}
                        {onEditSkill && (
                          <button
                            type="button"
                            onClick={() => handleEditClick(row)}
                            className="btn-icon"
                            title="编辑"
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(row.id, skill.skillId)}
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
              {externalSkillRows.length > 0 && userSkillRows.length > 0 && (
                <tr className="external-sync-group-row">
                  <td colSpan={6}>
                    <button
                      type="button"
                      className="external-sync-group-header external-sync-group-header-table"
                      onClick={() => setExternalSyncExpanded((v) => !v)}
                      aria-expanded={externalSyncExpanded}
                    >
                      <ChevronRight size={16} className={externalSyncExpanded ? 'external-sync-chevron-open' : undefined} />
                      <span>{t.promptList.externalSyncGroupTitle}</span>
                      <span className="external-sync-count">({externalSkillRows.length})</span>
                    </button>
                  </td>
                </tr>
              )}
              {showExternalSkillRows && externalSkillRows.map((row, index) => {
                const skill = row.metadata
                const tags = Array.isArray(skill.tags) ? skill.tags : []
                const prevRow = index === 0
                  ? (userSkillRows.length > 0 ? userSkillRows[userSkillRows.length - 1] : null)
                  : externalSkillRows[index - 1]
                const isSameSkill = prevRow?.metadata.skillId === skill.skillId
                const isFirstVersion = !isSameSkill

                const isRowSelected = selectedId === row.id
                return (
                  <tr
                    key={row.id}
                    className={`skill-row ${isSameSkill ? 'same-skill' : ''} ${skill.isCurrentVersion ? 'current-version' : ''} ${isRowSelected ? 'row-selected' : ''}`}
                    onClick={() => onSelectSkill?.(row.id)}
                    style={{ cursor: onSelectSkill ? 'pointer' : undefined }}
                  >
                    <td className="col-name">
                      {isFirstVersion ? (
                        <div className="skill-name-main table-cell-clamp-2">{skill.name}</div>
                      ) : (
                        <div className="skill-name-version table-cell-clamp-2">{skill.name}</div>
                      )}
                    </td>
                    <td className="col-version">
                      <div className="version-info">
                        <span className="version-number">v{skill.version}</span>
                        {skill.isCurrentVersion && (
                          <span className="badge current">当前</span>
                        )}
                        {(skill.fileCount ?? 0) > 0 && (
                          <span className="badge package-badge" title={t.skillPackage.packageLabel}>
                            {t.skillPackage.badge.replace('{count}', String(skill.fileCount))}
                          </span>
                        )}
                        <StorageStatusBadge isCloud={false} />
                      </div>
                    </td>
                    <td className="col-description">
                      <div className="table-cell-clamp-3">
                        {skill.description || '-'}
                      </div>
                    </td>
                    <td className="col-category">
                      {resolveLibraryOrCategoryLabel(libraries, skill.libraryId, skill.category) || '-'}
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
                        {onSelectSkill && (
                          <button
                            type="button"
                            onClick={() => onSelectSkill(row.id)}
                            className="btn-icon"
                            title="查看"
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        {onViewVersions && (
                          <button
                            type="button"
                            onClick={() => onViewVersions(skill.skillId)}
                            className="btn-icon"
                            title="版本历史"
                          >
                            <History size={16} />
                          </button>
                        )}
                        {onEditSkill && (
                          <button
                            type="button"
                            onClick={() => handleEditClick(row)}
                            className="btn-icon"
                            title="编辑"
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(row.id, skill.skillId)}
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
        .agent-skill-list {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .agent-skill-list.sidebar {
          padding: 0;
        }

        .agent-skill-list.table.main-panel .agent-skill-list-header {
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

        .agent-skill-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0;
          padding: ${variant === 'sidebar' ? '12px 16px 12px' : '0'};
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

        .search-input:focus {
          outline: none;
          border-color: var(--border-focus);
          background: var(--bg-item-hover);
          box-shadow: 0 0 0 3px var(--input-focus-shadow);
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

        .cloud-section-header {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px 4px;
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--accent-color);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .cloud-skill-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          cursor: default;
          transition: background var(--transition-fast);
        }

        .cloud-skill-item:hover {
          background: var(--bg-item-hover);
        }

        .cloud-skill-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .cloud-skill-name {
          font-size: 0.82rem;
          color: var(--text-primary);
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .cloud-skill-desc {
          font-size: 0.72rem;
          color: var(--text-tertiary);
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .cloud-skill-badge {
          font-size: 0.6rem;
          padding: 1px 5px;
          border-radius: 4px;
          background: rgba(99,102,241,0.15);
          color: #818cf8;
          flex-shrink: 0;
        }

        .external-sync-group-header {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          width: calc(100% - 4px);
          margin: 4px 2px 6px;
          padding: 8px 10px;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          background: var(--bg-glass);
          color: var(--text-secondary);
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          text-align: left;
          transition: background var(--transition-fast), color var(--transition-fast);
        }

        .external-sync-group-header:hover {
          background: var(--bg-item-hover);
          color: var(--text-primary);
        }

        .external-sync-group-header :global(.external-sync-chevron-open) {
          transform: rotate(90deg);
        }

        .external-sync-group-header :global(svg) {
          flex-shrink: 0;
          transition: transform var(--transition-fast);
        }

        .external-sync-count {
          font-weight: 500;
          color: var(--text-tertiary);
        }

        .external-sync-group-header-table {
          width: 100%;
          margin: 0;
          padding: 10px 12px;
          border: none;
          border-radius: 0;
          background: transparent;
        }

        .external-sync-group-row td {
          padding: 0 !important;
          background: rgba(0, 0, 0, 0.04);
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

        .category-tag {
          font-size: 0.65rem;
          padding: 1px 6px;
          border-radius: var(--radius-full);
          background: var(--category-tag-bg);
          color: var(--accent-color);
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

        .menu-item.active {
          color: var(--accent-color);
        }

        .menu-item-group {
          border-top: 1px solid var(--border-color);
          margin-top: 4px;
          padding-top: 4px;
        }

        .move-submenu {
          padding-left: 8px;
          border-left: 2px solid var(--border-color);
          margin: 2px 0 2px 4px;
          max-height: 140px;
          overflow-y: auto;
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
        .skills-table-container {
          overflow-x: auto;
          border: 1px solid var(--table-border);
          border-radius: var(--radius-lg);
          background: var(--table-bg);
          backdrop-filter: blur(var(--blur-sm));
          box-shadow: 0 2px 16px rgba(0, 0, 0, 0.06);
        }

        .skills-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
        }

        .skills-table thead {
          background: var(--table-header-bg);
          border-bottom: 2px solid rgba(99, 102, 241, 0.08);
        }

        .skills-table th {
          padding: 0.85rem 1rem;
          text-align: left;
          font-weight: 600;
          color: var(--text-tertiary);
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .skills-table th:first-child {
          padding-left: 1.25rem;
        }

        .skills-table tbody tr {
          border-bottom: 1px solid var(--table-border);
          transition: all var(--transition-fast);
        }

        .skills-table tbody tr:hover {
          background: rgba(99, 102, 241, 0.04);
          box-shadow: inset 3px 0 0 rgba(99, 102, 241, 0.35);
        }

        .skills-table tbody tr.row-selected {
          background: var(--accent-muted);
          box-shadow: inset 3px 0 0 var(--accent-color);
        }

        .skills-table tbody tr.row-selected:hover {
          background: var(--accent-muted);
        }

        .skills-table tbody tr.same-skill {
          background: var(--table-row-same);
        }

        .skills-table tbody tr.same-skill:hover {
          background: var(--table-row-same-hover);
        }

        .skills-table tbody tr.current-version {
          background: var(--table-row-current);
        }

        .skills-table tbody tr.current-version:hover {
          background: var(--table-row-current-hover);
        }

        .skills-table tbody tr.current-version.same-skill {
          background: var(--table-row-current-hover);
        }

        .skills-table tbody tr.current-version.same-skill:hover {
          background: var(--table-row-current-hover);
        }

        .skills-table td {
          padding: 0.85rem 1rem;
          vertical-align: top;
          color: var(--text-primary);
        }

        .skills-table td:first-child {
          padding-left: 1.25rem;
        }

        .col-name {
          min-width: 150px;
          font-weight: 500;
        }

        .skill-name-main {
          font-weight: 600;
          color: var(--text-primary);
        }

        .skill-name-version {
          color: var(--text-secondary);
          font-size: 0.82rem;
          padding-left: 1rem;
          position: relative;
        }

        .skill-name-version::before {
          content: '└';
          position: absolute;
          left: 0;
          color: var(--text-tertiary);
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

        .package-badge {
          background: rgba(110, 231, 247, 0.16);
          color: #22d3ee;
          border: 1px solid rgba(110, 231, 247, 0.32);
          border-radius: 4px;
          padding: 1px 5px;
          font-size: 10px;
          white-space: nowrap;
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

        .agent-skill-list.table.main-panel .col-description {
          max-width: none;
          min-width: min(100%, 420px);
          line-height: 1.45;
        }

        .col-category {
          min-width: 120px;
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

