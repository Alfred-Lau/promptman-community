'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Search, X, Eye, Edit, History, Trash2, Copy, MoreVertical, Upload, FolderInput, FolderMinus, ChevronRight, Star, Cloud } from 'lucide-react'
import { promptAPI, libraryAPI } from '@/lib/seekdb/api'
import type { PromptMetadata, GetResult, LibraryItem } from '@/lib/seekdb/types'
import { ShortcutHint } from '@/components/Kbd'
import { useLocale } from '@/lib/i18n'
import { showDesktopNotification } from '@/lib/desktopNotify'
import StorageStatusBadge from '@/components/StorageStatusBadge'
import { resolveLibraryOrCategoryLabel } from '@/lib/libraryLabel'
import { isExternalSyncedPromptId, partitionRowsByExternalSync } from '@/lib/externalSyncIds'

interface PromptListProps {
  onSelectPrompt?: (promptId: string) => void
  onEditPrompt?: (promptId: string) => void
  onViewVersions?: (promptId: string) => void
  onDeletePrompt?: (promptId: string) => void
  variant?: 'table' | 'sidebar'
  selectedId?: string | null
  embeddedInMain?: boolean
  listTitle?: string
  /** 按库过滤，null 表示全部 */
  libraryId?: string | null
  /** 按标签过滤（tag_definitions id），null 表示不按标签筛 */
  tagId?: string | null
  /** 库列表，用于移动到库菜单 */
  libraries?: LibraryItem[]
  /** 移动到库后刷新库计数 */
  onLibraryChanged?: () => void
  /** 加载完成后自动选中第一项 */
  autoSelectFirst?: boolean
  currentUser?: { id?: string | number; name?: string | null } | null
  /** 不渲染内部搜索框 header（由父组件提供通栏搜索） */
  hideHeader?: boolean
  /** 受控搜索值：提供时将用作搜索查询，并自动去抖触发搜索 */
  searchValue?: string
  /** 受控搜索值变更回调 */
  onSearchValueChange?: (v: string) => void
}

interface PromptRow {
  id: string
  metadata: PromptMetadata
  document: string
}

export default function PromptList({ 
  onSelectPrompt, 
  onEditPrompt, 
  onViewVersions,
  onDeletePrompt,
  variant = 'table',
  selectedId,
  embeddedInMain = false,
  listTitle,
  libraryId,
  tagId,
  libraries = [],
  onLibraryChanged,
  autoSelectFirst = false,
  currentUser,
  hideHeader = false,
  searchValue,
  onSearchValueChange,
}: PromptListProps) {
  const { t } = useLocale()
  const pl = t.promptList
  const st = t.settings
  const [prompts, setPrompts] = useState<GetResult | null>(null)
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
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [showMoveMenu, setShowMoveMenu] = useState<string | null>(null)
  /** 与「用户创建」并存时，外部同步项默认收起；仅外部项时不使用折叠（避免列表空白） */
  const [externalSyncExpanded, setExternalSyncExpanded] = useState(false)
  const [cloudPrompts, setCloudPrompts] = useState<Array<{ id: string; name: string; description?: string; content: string; category?: string; tags?: string[]; accent?: string; source: 'cloud' }>>([])
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  // 加载prompts - 侧边栏模式只加载当前版本，表格模式加载所有版本
  const loadPrompts = async () => {
    try {
      setLoading(true)
      setError(null)
      // 侧边栏只显示当前版本，表格显示所有版本
      const result = variant === 'sidebar' 
        ? await promptAPI.getCurrent()
        : await promptAPI.getAll()
      setPrompts(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : pl.errorLoad)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPrompts()
  }, [variant, libraryId, tagId])

  const isCloudFolder = typeof libraryId === 'string' && libraryId.startsWith('cloud:')
  const cloudFolderId = isCloudFolder ? libraryId.slice(6) : null

  const [cloudFolderPrompts, setCloudFolderPrompts] = useState<Array<{ id: string; name: string; description?: string; accent?: string; updated_at?: string }>>([])

  useEffect(() => {
    if (!currentUser?.id) { setCloudPrompts([]); return }
    promptAPI.listCloud().then((list: unknown[]) => {
      const items = (list as Array<Record<string, unknown>>).map(p => ({
        id: (p.id as string) || '',
        name: (p.name as string) || '',
        description: (p.description as string) || '',
        content: (p.content as string) || '',
        category: (p.category as string) || '',
        tags: Array.isArray(p.tags) ? p.tags as string[] : [],
        accent: (p.accent as string) || '#f59e0b',
        source: 'cloud' as const,
      }))
      setCloudPrompts(items)
    }).catch(() => {})
  }, [currentUser?.id])

  useEffect(() => {
    if (!cloudFolderId) { setCloudFolderPrompts([]); return }
    libraryAPI.listCloudItems(cloudFolderId).then(items => {
      setCloudFolderPrompts(items.filter(i => i.kind === 'prompt').map(i => ({
        id: i.id,
        name: i.name,
        description: i.description ?? undefined,
        accent: i.accent,
        updated_at: i.updated_at,
      })))
    }).catch(() => setCloudFolderPrompts([]))
  }, [cloudFolderId])

  // 搜索prompt
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }

    try {
      setLoading(true)
      const results = await promptAPI.search({
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
      setError(err instanceof Error ? err.message : pl.errorSearch)
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

  // 删除prompt
  const handleDelete = async (id: string, promptId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setMenuOpenId(null)
    if (!confirm(pl.confirmDelete)) {
      return
    }

    try {
      await promptAPI.delete(id)
      await loadPrompts()
      if (searchResults) {
        await handleSearch()
      }
      onDeletePrompt?.(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : pl.errorDelete)
    }
  }

  // 复制prompt内容到剪贴板
  const handleCopy = async (prompt: PromptMetadata, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setMenuOpenId(null)
    try {
      await navigator.clipboard.writeText(prompt.content)
      setCopySuccess(prompt.title)
      void showDesktopNotification({
        kind: 'copy',
        title: st.notifToastCopyTitle,
        body: st.notifToastCopyBody(prompt.title),
      })
      setTimeout(() => setCopySuccess(null), 2000)
    } catch (err) {
      setError(pl.errorCopy)
    }
  }

  // 切换菜单
  const toggleMenu = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpenId(menuOpenId === id ? null : id)
  }

  // 上传本地 prompt 到云端
  const handleUploadToCloud = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setMenuOpenId(null)
    setUploadingId(id)
    try {
      await promptAPI.uploadToCloud(id)
      await loadPrompts()
      if (searchResults) await handleSearch()
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传到云端失败')
    } finally {
      setUploadingId(null)
    }
  }

  // 移动到库
  const handleMoveToLibrary = async (promptGroupId: string, targetLibraryId: string | null, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setMenuOpenId(null)
    setShowMoveMenu(null)
    try {
      await libraryAPI.movePrompt(promptGroupId, targetLibraryId)
      await loadPrompts()
      onLibraryChanged?.()
    } catch {
      // silently fail
    }
  }

  // 处理数据：将prompt按promptId分组，同一prompt的不同版本放在一起
  const promptRows = useMemo(() => {
  const displayPrompts = searchResults || prompts
    if (!displayPrompts) return []

    const rows: PromptRow[] = displayPrompts.ids.map((id, index) => ({
      id,
      metadata: displayPrompts.metadatas[index] as PromptMetadata,
      document: displayPrompts.documents[index] || '',
    }))

    // 按promptId分组，然后按版本号排序
    const grouped = new Map<string, PromptRow[]>()
    rows.forEach((row) => {
      const promptId = row.metadata.promptId
      if (!grouped.has(promptId)) {
        grouped.set(promptId, [])
      }
      grouped.get(promptId)!.push(row)
    })

    // 对每个promptId的版本按版本号降序排序
    grouped.forEach((versions) => {
      versions.sort((a, b) => b.metadata.version - a.metadata.version)
    })

    // 展平为数组，但保持同一promptId的版本相邻
    let result: PromptRow[] = []
    grouped.forEach((versions) => {
      result.push(...versions)
    })

    // 按库过滤（云端文件夹不过滤本地数据）
    if (libraryId !== undefined && libraryId !== null && !isCloudFolder) {
      result = result.filter(r => r.metadata.libraryId === libraryId)
    }

    if (tagId !== undefined && tagId !== null) {
      result = result.filter(r => r.metadata.tagIds?.includes(tagId))
    }

    return result
  }, [prompts, searchResults, libraryId, tagId, isCloudFolder])

  const { userRows: userPromptRows, externalRows: externalPromptRows } = useMemo(
    () =>
      partitionRowsByExternalSync(
        promptRows,
        (r) => r.metadata.promptId,
        isExternalSyncedPromptId,
      ),
    [promptRows],
  )

  const showExternalPromptRows =
    externalPromptRows.length > 0 &&
    (userPromptRows.length === 0 || externalSyncExpanded)

  const displayPromptRows = useMemo(
    () => [...userPromptRows, ...(showExternalPromptRows ? externalPromptRows : [])],
    [userPromptRows, externalPromptRows, showExternalPromptRows],
  )

  // 自动选中第一项（过滤后的第一个可见项：优先用户创建）
  useEffect(() => {
    if (autoSelectFirst && !loading && !selectedId && promptRows.length > 0 && onSelectPrompt) {
      const first =
        userPromptRows[0]?.id ??
        externalPromptRows[0]?.id
      if (first) onSelectPrompt(first)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSelectFirst, loading, promptRows.length, selectedId])

  // 键盘导航 (仅侧边栏模式)
  const handleListKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (variant !== 'sidebar') return
    const len = displayPromptRows.length
    if (len === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIdx((i) => {
        const next = Math.min(i + 1, len - 1)
        itemRefs.current[next]?.scrollIntoView({ block: 'nearest' })
        return next
      })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIdx((i) => {
        const prev = Math.max(i - 1, 0)
        itemRefs.current[prev]?.scrollIntoView({ block: 'nearest' })
        return prev
      })
    } else if (e.key === 'Enter' && focusedIdx >= 0) {
      e.preventDefault()
      onSelectPrompt?.(displayPromptRows[focusedIdx].id)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setFocusedIdx(-1)
      listRef.current?.blur()
    }
  }, [variant, displayPromptRows, focusedIdx, onSelectPrompt])

  useEffect(() => {
    setFocusedIdx((i) => {
      if (displayPromptRows.length === 0) return -1
      if (i >= displayPromptRows.length) return displayPromptRows.length - 1
      return i
    })
  }, [displayPromptRows.length])

  // Cmd/Ctrl+F 或 "/" 聚焦搜索框；受控模式下由父组件接管，这里跳过
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
    <div className={`prompt-list ${variant}${embeddedInMain ? ' main-panel' : ''}${hideHeader ? ' headerless' : ''}`}>
      {!hideHeader && (
        <div className="prompt-list-header">
          {variant === 'table' && (
            <h2 className="table-list-title">{listTitle ?? pl.tableTitle}</h2>
          )}
          <div className="search-box">
            <input
              ref={searchInputRef}
              type="text"
              placeholder={pl.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch()
                else if (e.key === 'Escape') {
                  setSearchQuery('')
                  setSearchResults(null)
                  setFocusedIdx(-1)
                  listRef.current?.focus()
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  listRef.current?.focus()
                  setFocusedIdx(0)
                }
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
      ) : promptRows.length === 0 ? (
        <div className="empty-state">
          {searchResults ? 'No matches found' : 'No prompts'}
        </div>
      ) : variant === 'sidebar' ? (
        <div
          className="sidebar-list"
          ref={listRef}
          tabIndex={0}
          onKeyDown={handleListKeyDown}
          onFocus={() => { if (focusedIdx < 0 && displayPromptRows.length > 0) setFocusedIdx(0) }}
        >
          {copySuccess && (
            <div className="copy-toast">
              {pl.copySuccess(copySuccess)}
            </div>
          )}
          {userPromptRows.map((row, idx) => {
            const prompt = row.metadata
            const isSelected = selectedId === row.id
            const isMenuOpen = menuOpenId === row.id
            const isFocused = focusedIdx === idx
            
            return (
              <div
                key={row.id}
                ref={(el) => { itemRefs.current[idx] = el }}
                className={`sidebar-item ${isSelected ? 'selected' : ''} ${isFocused ? 'keyboard-focused' : ''}`}
                onClick={() => { onSelectPrompt?.(row.id); setFocusedIdx(idx) }}
              >
                <div className="item-header">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      promptAPI.toggleStar(row.id).then(() => loadPrompts())
                    }}
                    className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
                    title={prompt.isStarred ? '取消收藏' : '收藏'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                  >
                    <Star size={14} className={prompt.isStarred ? 'fill-amber-400 text-amber-400' : 'text-gray-500'} style={prompt.isStarred ? { fill: '#fbbf24', color: '#fbbf24' } : { color: '#6b7280' }} />
                  </button>
                  <span className="item-title">{prompt.title}</span>
                  <div className="item-actions">
                    <StorageStatusBadge
                      isCloud={!!prompt.cloudId}
                      uploading={uploadingId === row.id}
                      compact
                    />
                    {(() => {
                      const libLabel = resolveLibraryOrCategoryLabel(libraries, prompt.libraryId, prompt.category)
                      return libLabel ? (
                      <span className="category-tag">{libLabel}</span>
                      ) : null
                    })()}
                    <button
                      className="action-menu-btn"
                      onClick={(e) => toggleMenu(row.id, e)}
                      title={pl.moreActions}
                    >
                      <MoreVertical size={14} />
                    </button>
                    {isMenuOpen && (
                      <div className="action-menu">
                        <button
                          className="menu-item"
                          onClick={(e) => handleCopy(prompt, e)}
                        >
                          <Copy size={14} />
                          {pl.copyContent}
                        </button>
                        {!prompt.cloudId && (
                          <button
                            className="menu-item upload"
                            onClick={(e) => handleUploadToCloud(row.id, e)}
                            disabled={uploadingId === row.id}
                          >
                            <Upload size={14} />
                            推送到云端
                          </button>
                        )}
                        {libraries.length > 0 && (
                          <div className="menu-item-group">
                            {prompt.libraryId ? (
                              <button
                                className="menu-item"
                                onClick={(e) => handleMoveToLibrary(prompt.promptId, null, e)}
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
                                    className={`menu-item ${prompt.libraryId === lib.id ? 'active' : ''}`}
                                    onClick={(e) => handleMoveToLibrary(prompt.promptId, lib.id, e)}
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
                          onClick={(e) => handleDelete(row.id, prompt.promptId, e)}
                        >
                          <Trash2 size={14} />
                          {pl.delete}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="item-meta">
                   {prompt.description && (
                     <span className="item-desc">
                       {prompt.description.length > 40 
                         ? prompt.description.substring(0, 40) + '...' 
                         : prompt.description}
                     </span>
                   )}
                   {(prompt.uses ?? 0) > 0 && (
                     <span className="uses-count">{prompt.uses} 次使用</span>
                   )}
                </div>
              </div>
            )
          })}
          {externalPromptRows.length > 0 && userPromptRows.length > 0 && (
            <button
              type="button"
              className="external-sync-group-header"
              onClick={() => setExternalSyncExpanded((v) => !v)}
              aria-expanded={externalSyncExpanded}
            >
              <ChevronRight size={16} className={externalSyncExpanded ? 'external-sync-chevron-open' : undefined} />
              <span>{pl.externalSyncGroupTitle}</span>
              <span className="external-sync-count">({externalPromptRows.length})</span>
            </button>
          )}
          {showExternalPromptRows && externalPromptRows.map((row, idx) => {
            const prompt = row.metadata
            const rowIdx = userPromptRows.length + idx
            const isSelected = selectedId === row.id
            const isMenuOpen = menuOpenId === row.id
            const isFocused = focusedIdx === rowIdx

            return (
              <div
                key={row.id}
                ref={(el) => { itemRefs.current[rowIdx] = el }}
                className={`sidebar-item ${isSelected ? 'selected' : ''} ${isFocused ? 'keyboard-focused' : ''}`}
                onClick={() => { onSelectPrompt?.(row.id); setFocusedIdx(rowIdx) }}
              >
                <div className="item-header">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      promptAPI.toggleStar(row.id).then(() => loadPrompts())
                    }}
                    className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
                    title={prompt.isStarred ? '取消收藏' : '收藏'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                  >
                    <Star size={14} style={prompt.isStarred ? { fill: '#fbbf24', color: '#fbbf24' } : { color: '#6b7280' }} />
                  </button>
                  <span className="item-title">{prompt.title}</span>
                  <div className="item-actions">
                    <StorageStatusBadge
                      isCloud={!!prompt.cloudId}
                      uploading={uploadingId === row.id}
                      compact
                    />
                    {(() => {
                      const libLabel = resolveLibraryOrCategoryLabel(libraries, prompt.libraryId, prompt.category)
                      return libLabel ? (
                      <span className="category-tag">{libLabel}</span>
                      ) : null
                    })()}
                    <button
                      className="action-menu-btn"
                      onClick={(e) => toggleMenu(row.id, e)}
                      title={pl.moreActions}
                    >
                      <MoreVertical size={14} />
                    </button>
                    {isMenuOpen && (
                      <div className="action-menu">
                        <button
                          className="menu-item"
                          onClick={(e) => handleCopy(prompt, e)}
                        >
                          <Copy size={14} />
                          {pl.copyContent}
                        </button>
                        {!prompt.cloudId && (
                          <button
                            className="menu-item upload"
                            onClick={(e) => handleUploadToCloud(row.id, e)}
                            disabled={uploadingId === row.id}
                          >
                            <Upload size={14} />
                            推送到云端
                          </button>
                        )}
                        {libraries.length > 0 && (
                          <div className="menu-item-group">
                            {prompt.libraryId ? (
                              <button
                                className="menu-item"
                                onClick={(e) => handleMoveToLibrary(prompt.promptId, null, e)}
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
                                    className={`menu-item ${prompt.libraryId === lib.id ? 'active' : ''}`}
                                    onClick={(e) => handleMoveToLibrary(prompt.promptId, lib.id, e)}
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
                          onClick={(e) => handleDelete(row.id, prompt.promptId, e)}
                        >
                          <Trash2 size={14} />
                          {pl.delete}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="item-meta">
                   {prompt.description && (
                     <span className="item-desc">
                       {prompt.description.length > 40
                         ? prompt.description.substring(0, 40) + '...'
                         : prompt.description}
                     </span>
                   )}
                   {(prompt.uses ?? 0) > 0 && (
                     <span className="uses-count">{prompt.uses} 次使用</span>
                   )}
                </div>
              </div>
            )
          })}
          {isCloudFolder && cloudFolderPrompts.length > 0 && (
            <>
              <div className="cloud-section-header">
                <Cloud size={12} /> 云端文件夹内容 ({cloudFolderPrompts.length})
              </div>
              {cloudFolderPrompts.map(cp => (
                <div key={`cfp-${cp.id}`} className="cloud-prompt-item">
                  <div className="cloud-prompt-dot" style={{ background: cp.accent || '#f59e0b' }} />
                  <span className="cloud-prompt-name">{cp.name}</span>
                  {cp.description && <span className="cloud-prompt-desc">{cp.description}</span>}
                  <span className="cloud-prompt-badge">cloud</span>
                </div>
              ))}
            </>
          )}
          {!isCloudFolder && cloudPrompts.length > 0 && (
            <>
              <div className="cloud-section-header">
                <Cloud size={12} /> 云端 ({cloudPrompts.length})
              </div>
              {cloudPrompts.map(cp => (
                <div key={`cloud-${cp.id}`} className="cloud-prompt-item">
                  <div className="cloud-prompt-dot" style={{ background: cp.accent || '#f59e0b' }} />
                  <span className="cloud-prompt-name">{cp.name}</span>
                  <span className="cloud-prompt-badge">cloud</span>
                </div>
              ))}
            </>
          )}
          {displayPromptRows.length > 0 && (
            <div className="list-kbd-bar">
              <ShortcutHint hints={[
                { keys: ["↑", "↓"], label: pl.navLabel },
                { keys: ["↵"],      label: pl.selectLabel },
                { keys: ["Esc"],    label: pl.escLabel },
              ]} />
            </div>
          )}
        </div>
      ) : (
        <div className="prompts-table-container">
          <table className="prompts-table">
            {/* ... table content ... */}
            <thead>
              <tr>
                <th className="col-title">{pl.colTitle}</th>
                <th className="col-version">{pl.colVersion}</th>
                <th className="col-description">{pl.colDescription}</th>
                <th className="col-category">{pl.colLibrary}</th>
                <th className="col-tags">{pl.colTags}</th>
                <th className="col-content">{pl.colContent}</th>
                <th className="col-actions">{pl.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {userPromptRows.map((row, index) => {
                const prompt = row.metadata
            const tags = Array.isArray(prompt.tags) ? prompt.tags : []
                const prevRow = index > 0 ? userPromptRows[index - 1] : null
                const isSamePrompt = prevRow?.metadata.promptId === prompt.promptId
                const isFirstVersion = !isSamePrompt
                const isRowSelected = selectedId === row.id
                const contentPreviewLen = embeddedInMain ? 220 : 80

            return (
                  <tr
                    key={row.id}
                    className={`prompt-row ${isSamePrompt ? 'same-prompt' : ''} ${prompt.isCurrentVersion ? 'current-version' : ''} ${isRowSelected ? 'row-selected' : ''}`}
                    onClick={() => onSelectPrompt?.(row.id)}
                    style={{ cursor: onSelectPrompt ? 'pointer' : undefined }}
                  >
                    <td className="col-title">
                      {isFirstVersion ? (
                        <div className="prompt-title-main table-cell-clamp-2">{prompt.title}</div>
                      ) : (
                        <div className="prompt-title-version table-cell-clamp-2">{prompt.title}</div>
                      )}
                    </td>
                    <td className="col-version">
                      <div className="version-info">
                        <span className="version-number">v{prompt.version}</span>
                        {prompt.isCurrentVersion && (
                          <span className="badge current">{pl.badgeCurrent}</span>
                  )}
                  <StorageStatusBadge isCloud={!!prompt.cloudId} uploading={uploadingId === row.id} />
                </div>
                    </td>
                    <td className="col-description">
                      <div className="table-cell-clamp-3">
                        {prompt.description || '-'}
                      </div>
                    </td>
                    <td className="col-category">
                      {resolveLibraryOrCategoryLabel(libraries, prompt.libraryId, prompt.category) || '-'}
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
                    <td className="col-content">
                      <div className="content-preview table-cell-clamp-3">
                        {prompt.content.substring(0, contentPreviewLen)}
                        {prompt.content.length > contentPreviewLen && '...'}
                </div>
                    </td>
                    <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                      <div className="action-buttons">
                  {onSelectPrompt && (
                    <button
                            type="button"
                            onClick={() => onSelectPrompt(row.id)}
                            className="btn-icon"
                            title={pl.actionView}
                    >
                            <Eye size={16} />
                    </button>
                  )}
                  {onViewVersions && (
                    <button
                      type="button"
                      onClick={() => onViewVersions(prompt.promptId)}
                            className="btn-icon"
                            title={pl.actionHistory}
                    >
                            <History size={16} />
                    </button>
                  )}
                  {onEditPrompt && (
                    <button
                            type="button"
                            onClick={() => onEditPrompt(row.id)}
                            className="btn-icon"
                            title={pl.actionEdit}
                    >
                            <Edit size={16} />
                    </button>
                  )}
                  {!prompt.cloudId && (
                    <button
                      type="button"
                      onClick={() => handleUploadToCloud(row.id)}
                      className="btn-icon btn-upload"
                      title="推送到云端"
                      disabled={uploadingId === row.id}
                    >
                      <Upload size={16} />
                    </button>
                  )}
                  <button
                          type="button"
                          onClick={() => handleDelete(row.id, prompt.promptId)}
                          className="btn-icon btn-danger"
                          title={pl.actionDelete}
                  >
                          <Trash2 size={16} />
                  </button>
                </div>
                    </td>
                  </tr>
            )
          })}
          {externalPromptRows.length > 0 && userPromptRows.length > 0 && (
            <tr className="external-sync-group-row">
              <td colSpan={7}>
                <button
                  type="button"
                  className="external-sync-group-header external-sync-group-header-table"
                  onClick={() => setExternalSyncExpanded((v) => !v)}
                  aria-expanded={externalSyncExpanded}
                >
                  <ChevronRight size={16} className={externalSyncExpanded ? 'external-sync-chevron-open' : undefined} />
                  <span>{pl.externalSyncGroupTitle}</span>
                  <span className="external-sync-count">({externalPromptRows.length})</span>
                </button>
              </td>
            </tr>
          )}
          {showExternalPromptRows && externalPromptRows.map((row, index) => {
                const prompt = row.metadata
            const tags = Array.isArray(prompt.tags) ? prompt.tags : []
                const prevRow = index === 0
                  ? (userPromptRows.length > 0 ? userPromptRows[userPromptRows.length - 1] : null)
                  : externalPromptRows[index - 1]
                const isSamePrompt = prevRow?.metadata.promptId === prompt.promptId
                const isFirstVersion = !isSamePrompt
                const isRowSelected = selectedId === row.id
                const contentPreviewLen = embeddedInMain ? 220 : 80

            return (
                  <tr
                    key={row.id}
                    className={`prompt-row ${isSamePrompt ? 'same-prompt' : ''} ${prompt.isCurrentVersion ? 'current-version' : ''} ${isRowSelected ? 'row-selected' : ''}`}
                    onClick={() => onSelectPrompt?.(row.id)}
                    style={{ cursor: onSelectPrompt ? 'pointer' : undefined }}
                  >
                    <td className="col-title">
                      {isFirstVersion ? (
                        <div className="prompt-title-main table-cell-clamp-2">{prompt.title}</div>
                      ) : (
                        <div className="prompt-title-version table-cell-clamp-2">{prompt.title}</div>
                      )}
                    </td>
                    <td className="col-version">
                      <div className="version-info">
                        <span className="version-number">v{prompt.version}</span>
                        {prompt.isCurrentVersion && (
                          <span className="badge current">{pl.badgeCurrent}</span>
                  )}
                  <StorageStatusBadge isCloud={!!prompt.cloudId} uploading={uploadingId === row.id} />
                </div>
                    </td>
                    <td className="col-description">
                      <div className="table-cell-clamp-3">
                        {prompt.description || '-'}
                      </div>
                    </td>
                    <td className="col-category">
                      {resolveLibraryOrCategoryLabel(libraries, prompt.libraryId, prompt.category) || '-'}
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
                    <td className="col-content">
                      <div className="content-preview table-cell-clamp-3">
                        {prompt.content.substring(0, contentPreviewLen)}
                        {prompt.content.length > contentPreviewLen && '...'}
                </div>
                    </td>
                    <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                      <div className="action-buttons">
                  {onSelectPrompt && (
                    <button
                            type="button"
                            onClick={() => onSelectPrompt(row.id)}
                            className="btn-icon"
                            title={pl.actionView}
                    >
                            <Eye size={16} />
                    </button>
                  )}
                  {onViewVersions && (
                    <button
                      type="button"
                      onClick={() => onViewVersions(prompt.promptId)}
                            className="btn-icon"
                            title={pl.actionHistory}
                    >
                            <History size={16} />
                    </button>
                  )}
                  {onEditPrompt && (
                    <button
                            type="button"
                            onClick={() => onEditPrompt(row.id)}
                            className="btn-icon"
                            title={pl.actionEdit}
                    >
                            <Edit size={16} />
                    </button>
                  )}
                  {!prompt.cloudId && (
                    <button
                      type="button"
                      onClick={() => handleUploadToCloud(row.id)}
                      className="btn-icon btn-upload"
                      title="推送到云端"
                      disabled={uploadingId === row.id}
                    >
                      <Upload size={16} />
                    </button>
                  )}
                  <button
                          type="button"
                          onClick={() => handleDelete(row.id, prompt.promptId)}
                          className="btn-icon btn-danger"
                          title={pl.actionDelete}
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
        .prompt-list {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .prompt-list.sidebar {
          padding: 0;
        }

        .prompt-list.table.main-panel .prompt-list-header {
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

        .prompt-list-header {
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

        .uses-count {
          font-size: 10px;
          color: var(--text-tertiary);
          font-family: 'SF Mono', ui-monospace, monospace;
          margin-left: auto;
          flex-shrink: 0;
        }

        .cloud-section-header {
          padding: 8px 12px;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: var(--text-tertiary);
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          margin-top: 4px;
        }

        .cloud-prompt-item {
          padding: 8px 12px;
          font-size: 12px;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          border-radius: var(--radius-md);
          margin: 0 4px;
          transition: background var(--transition-fast);
        }

        .cloud-prompt-item:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .cloud-prompt-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .cloud-prompt-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
          min-width: 0;
        }

        .cloud-prompt-badge {
          margin-left: auto;
          font-size: 10px;
          color: var(--text-tertiary);
          flex-shrink: 0;
        }

        .cloud-prompt-desc {
          font-size: 0.72rem;
          color: var(--text-tertiary);
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Table Styles */
        .prompts-table-container {
          overflow-x: auto;
          border: 1px solid var(--table-border);
          border-radius: var(--radius-lg);
          background: var(--table-bg);
          backdrop-filter: blur(var(--blur-sm));
          box-shadow: 0 2px 16px rgba(0, 0, 0, 0.06);
        }

        .prompts-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
        }

        .prompts-table thead {
          background: var(--table-header-bg);
          border-bottom: 2px solid rgba(99, 102, 241, 0.08);
        }

        .prompts-table th {
          padding: 0.85rem 1rem;
          text-align: left;
          font-weight: 600;
          color: var(--text-tertiary);
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .prompts-table th:first-child {
          padding-left: 1.25rem;
        }

        .prompts-table tbody tr {
          border-bottom: 1px solid var(--table-border);
          transition: all var(--transition-fast);
        }

        .prompts-table tbody tr:hover {
          background: rgba(99, 102, 241, 0.04);
          box-shadow: inset 3px 0 0 rgba(99, 102, 241, 0.35);
        }

        .prompts-table tbody tr.row-selected {
          background: var(--accent-muted);
          box-shadow: inset 3px 0 0 var(--accent-color);
        }

        .prompts-table tbody tr.row-selected:hover {
          background: var(--accent-muted);
        }

        .prompts-table tbody tr.same-prompt {
          background: var(--table-row-same);
        }

        .prompts-table tbody tr.same-prompt:hover {
          background: var(--table-row-same-hover);
        }

        .prompts-table tbody tr.current-version {
          background: var(--table-row-current);
        }

        .prompts-table tbody tr.current-version:hover {
          background: var(--table-row-current-hover);
        }

        .prompts-table tbody tr.current-version.same-prompt {
          background: var(--table-row-current-hover);
        }

        .prompts-table tbody tr.current-version.same-prompt:hover {
          background: var(--table-row-current-hover);
        }

        .prompts-table td {
          padding: 0.85rem 1rem;
          vertical-align: top;
          color: var(--text-primary);
        }

        .prompts-table td:first-child {
          padding-left: 1.25rem;
        }

        .col-title {
          min-width: 150px;
          font-weight: 500;
        }

        .prompt-title-main {
          font-weight: 600;
          color: var(--text-primary);
        }

        .prompt-title-version {
          color: var(--text-secondary);
          font-size: 0.82rem;
          padding-left: 1rem;
          position: relative;
        }

        .prompt-title-version::before {
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
          min-width: 150px;
          max-width: 200px;
          color: var(--text-secondary);
          font-size: 0.82rem;
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

        .col-content {
          min-width: 200px;
          max-width: 300px;
        }

        .prompt-list.table.main-panel .col-description {
          max-width: none;
          min-width: min(100%, 360px);
          line-height: 1.45;
        }

        .prompt-list.table.main-panel .col-content {
          max-width: none;
          min-width: min(100%, 480px);
        }

        .content-preview {
          color: var(--text-secondary);
          font-size: 0.82rem;
          line-height: 1.5;
          word-break: break-word;
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

        .btn-icon.btn-upload {
          border-color: transparent;
          color: var(--text-tertiary);
        }

        .btn-icon.btn-upload:hover {
          border-color: transparent;
          background: var(--accent-muted);
          color: var(--accent-hover);
        }

        .btn-icon.btn-upload:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .menu-item.upload {
          color: var(--accent-color);
        }

        .menu-item.upload:hover {
          background: var(--accent-muted);
        }

        .menu-item.upload:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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

