'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Pencil, Trash2, Check, X, FolderOpen, Folder, Tag, Cloud } from 'lucide-react'
import { libraryAPI, tagAPI } from '@/lib/seekdb/api'
import type { CloudLibraryFolder } from '@/lib/seekdb/api'
import type { LibraryItem, TagDefinition } from '@/lib/seekdb/types'
import { TAG_DIMENSIONS } from '@/lib/seekdb/types'
import { useLocale } from '@/lib/i18n'
import { LOCAL_FIRST } from '@/lib/localFirst'

const PRESET_ICONS = ['📁', '📂', '⭐', '🔥', '💡', '🎯', '🚀', '🛠️', '📝', '🎨', '🔬', '📊']
const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4', '#84cc16', '#6b7280',
]

interface LibrarySidebarProps {
  selectedLibraryId: string | null
  onSelectLibrary: (libraryId: string | null) => void
  /** 标签筛选（与库筛选同时生效时为 AND） */
  tags?: TagDefinition[]
  /** 多维正交标签筛选：选中的 tag id 列表，AND 语义 */
  selectedTagIds?: string[]
  /** 点击标签切换选中态 */
  onToggleTag?: (tagId: string) => void
  /** 清空标签筛选（「全部标签」项） */
  onClearTagFilter?: () => void
  onTagsChanged?: () => void
  currentUser?: { id?: string | number; name?: string | null } | null
  /** PromptHub 云端是否已关联（token 有效） */
  promptHubCloudLinked?: boolean | null
}

interface LibraryFormState {
  name: string
  description: string
  icon: string
  color: string
}

export default function LibrarySidebar({
  selectedLibraryId,
  onSelectLibrary,
  tags = [],
  selectedTagIds = [],
  onToggleTag,
  onClearTagFilter,
  onTagsChanged,
  currentUser,
  promptHubCloudLinked,
}: LibrarySidebarProps) {
  const { t } = useLocale()
  const lib = t.library
  const [libraries, setLibraries] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<LibraryFormState>({ name: '', description: '', icon: '📁', color: '#6366f1' })
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [cloudFolders, setCloudFolders] = useState<CloudLibraryFolder[]>([])

  const loadLibraries = async () => {
    try {
      setLoading(true)
      const data = await libraryAPI.getAll()
      setLibraries(data)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLibraries()
  }, [])

  const [cloudLoading, setCloudLoading] = useState(false)
  const [cloudError, setCloudError] = useState<string | null>(null)

  const showCloudLibraries = Boolean(promptHubCloudLinked) && !LOCAL_FIRST

  useEffect(() => {
    if (!showCloudLibraries || !currentUser?.id) {
      setCloudFolders([])
      setCloudError(null)
      return
    }
    setCloudLoading(true)
    setCloudError(null)
    libraryAPI.listCloudFolders()
      .then(folders => {
        setCloudFolders(folders.filter(f => !f.parent_id))
      })
      .catch((err) => {
        console.error('[LibrarySidebar] listCloudFolders failed:', err)
        setCloudError(err instanceof Error ? err.message : String(err))
        setCloudFolders([])
      })
      .finally(() => setCloudLoading(false))
  }, [currentUser?.id, showCloudLibraries])

  useEffect(() => {
    if (showCreate || editingId) {
      setTimeout(() => nameInputRef.current?.focus(), 50)
    }
  }, [showCreate, editingId])

  const openCreate = () => {
    setForm({ name: '', description: '', icon: '📁', color: '#6366f1' })
    setEditingId(null)
    setShowCreate(true)
  }

  const openEdit = (lib: LibraryItem) => {
    setForm({ name: lib.name, description: lib.description || '', icon: lib.icon, color: lib.color })
    setEditingId(lib.id)
    setShowCreate(false)
  }

  const cancelForm = () => {
    setShowCreate(false)
    setEditingId(null)
    setShowIconPicker(false)
    setShowColorPicker(false)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    try {
      if (editingId) {
        await libraryAPI.update(editingId, { name: form.name.trim(), description: form.description, icon: form.icon, color: form.color })
      } else {
        const newLib = await libraryAPI.create({ name: form.name.trim(), description: form.description, icon: form.icon, color: form.color })
        onSelectLibrary(newLib.id)
      }
      await loadLibraries()
      cancelForm()
    } catch {
      // silently fail
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(lib.deleteConfirm)) return
    if (selectedLibraryId === id) onSelectLibrary(null)
    try {
      await libraryAPI.delete(id)
      await loadLibraries()
    } catch {
      // silently fail
    }
  }

  const isActive = (id: string | null) => selectedLibraryId === id
  const isTagActive = (id: string) => selectedTagIds.includes(id)
  const showTagFilter = typeof onToggleTag === 'function'
  /** 维度分组显示名（'' 通用组不显示组名） */
  const dimNames: Record<string, string> = {
    '': lib.tagDimGeneral,
    scene: lib.tagDimScene,
    style: lib.tagDimStyle,
    model: lib.tagDimModel,
  }

  const handleDeleteTag = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(lib.deleteTagConfirm)) return
    try {
      await tagAPI.delete(id)
      if (selectedTagIds.includes(id)) onToggleTag?.(id) // 从筛选中移除被删标签
      onTagsChanged?.()
    } catch {
      // silently fail
    }
  }

  return (
    <div className="lib-sidebar">
      {/* All items entry */}
      <div
        className={`lib-item lib-all ${isActive(null) ? 'active' : ''}`}
        onClick={() => onSelectLibrary(null)}
      >
        <span className="lib-icon">
          {isActive(null) ? <FolderOpen size={14} /> : <Folder size={14} />}
        </span>
        <span className="lib-name">{lib.allItems}</span>
      </div>

      {/* Library list */}
      {!loading && libraries.map((library) => (
        <div key={library.id} className={`lib-item ${isActive(library.id) ? 'active' : ''}`}>
          {editingId === library.id ? (
            <LibraryForm
              form={form}
              setForm={setForm}
              nameInputRef={nameInputRef}
              showIconPicker={showIconPicker}
              setShowIconPicker={setShowIconPicker}
              showColorPicker={showColorPicker}
              setShowColorPicker={setShowColorPicker}
              onSave={handleSave}
              onCancel={cancelForm}
              lib={lib}
            />
          ) : (
            <>
              <div
                className="lib-item-main"
                onClick={() => onSelectLibrary(library.id)}
              >
                <span className="lib-icon-emoji">{library.icon}</span>
                <span className="lib-name">{library.name}</span>
              </div>
              <div className="lib-item-actions">
                <button className="lib-action-btn" onClick={(e) => { e.stopPropagation(); openEdit(library) }} title={lib.editLibrary}>
                  <Pencil size={11} />
                </button>
                <button className="lib-action-btn danger" onClick={(e) => { e.stopPropagation(); handleDelete(library.id) }} title={lib.deleteLibrary}>
                  <Trash2 size={11} />
                </button>
              </div>
            </>
          )}
        </div>
      ))}

      {showCloudLibraries && (
        <>
          <div className="lib-section-label">
            <Cloud size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            云端资料库
          </div>
          {cloudLoading && (
            <div className="lib-item" style={{ opacity: 0.5, cursor: 'default' }}>
              <span className="lib-name" style={{ fontSize: '0.72rem' }}>加载中…</span>
            </div>
          )}
          {cloudError && (
            <div className="lib-item" style={{ cursor: 'default' }}>
              <span className="lib-name" style={{ fontSize: '0.72rem', color: 'var(--danger-color, #ef4444)' }}>
                加载失败
              </span>
            </div>
          )}
          {!cloudLoading && !cloudError && cloudFolders.length === 0 && (
            <div className="lib-item" style={{ opacity: 0.5, cursor: 'default' }}>
              <span className="lib-name" style={{ fontSize: '0.72rem' }}>暂无云端资料库</span>
            </div>
          )}
          {cloudFolders.map((folder) => (
            <div
              key={`cloud-${folder.id}`}
              className={`lib-item ${isActive(`cloud:${folder.id}`) ? 'active' : ''}`}
              onClick={() => onSelectLibrary(`cloud:${folder.id}`)}
            >
              <div className="lib-item-main">
                <span className="lib-icon" style={{ color: 'var(--accent-color)' }}>
                  <Cloud size={13} />
                </span>
                <span className="lib-name">{folder.name}</span>
              </div>
            </div>
          ))}
        </>
      )}

      {showTagFilter && (
        <>
          <div className="lib-section-label">{lib.tagsSection}</div>
          <div
            className={`lib-item lib-all ${selectedTagIds.length === 0 ? 'active' : ''}`}
            onClick={() => onClearTagFilter?.()}
          >
            <span className="lib-icon">
              <Tag size={14} />
            </span>
            <span className="lib-name">{lib.allTags}</span>
          </div>
          {TAG_DIMENSIONS.map((dim) => {
            const groupTags = tags.filter((t) => (t.dimension ?? '') === dim)
            if (groupTags.length === 0) return null
            return (
              <div key={dim || 'general'}>
                {dim && <div className="lib-section-label">{dimNames[dim]}</div>}
                {groupTags.map((tag) => (
                  <div key={tag.id} className={`lib-item ${isTagActive(tag.id) ? 'active' : ''}`}>
                    <div className="lib-item-main" onClick={() => onToggleTag!(tag.id)}>
                      <span
                        className="lib-tag-dot"
                        style={{ background: tag.color || 'var(--accent-color)' }}
                      />
                      <span className="lib-name">{tag.name}</span>
                    </div>
                    <div className="lib-item-actions">
                      <button
                        className="lib-action-btn danger"
                        type="button"
                        onClick={(e) => handleDeleteTag(tag.id, e)}
                        title={lib.deleteTag}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </>
      )}

      {/* Create form inline */}
      {showCreate && (
        <div className="lib-create-form">
          <LibraryForm
            form={form}
            setForm={setForm}
            nameInputRef={nameInputRef}
            showIconPicker={showIconPicker}
            setShowIconPicker={setShowIconPicker}
            showColorPicker={showColorPicker}
            setShowColorPicker={setShowColorPicker}
            onSave={handleSave}
            onCancel={cancelForm}
            lib={lib}
          />
        </div>
      )}

      {/* Add library button */}
      {!showCreate && !editingId && (
        <button className="lib-add-btn" onClick={openCreate}>
          <Plus size={13} />
          <span>{lib.newLibrary}</span>
        </button>
      )}

      <style jsx>{`
        .lib-sidebar {
          display: flex;
          flex-direction: column;
          gap: 1px;
          padding: 8px 12px;
          box-sizing: border-box;
          min-width: 0;
          max-width: 100%;
          overflow-x: hidden;
        }

        .lib-item {
          display: flex;
          flex-wrap: nowrap;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--transition-fast);
          min-height: 30px;
          position: relative;
          min-width: 0;
        }

        .lib-item:hover {
          background: var(--bg-item-hover);
        }

        .lib-item.active {
          background: var(--accent-muted);
        }

        .lib-item.active .lib-name {
          color: var(--accent-color);
          font-weight: 600;
        }

        .lib-item-main {
          display: flex;
          align-items: center;
          gap: 6px;
          flex: 1;
          min-width: 0;
        }

        .lib-icon {
          color: var(--text-tertiary);
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }

        .lib-item.active .lib-icon {
          color: var(--accent-color);
        }

        .lib-icon-emoji {
          font-size: 14px;
          line-height: 1;
          flex-shrink: 0;
        }

        .lib-name {
          font-size: 0.8rem;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
          min-width: 0;
        }

        .lib-item-actions {
          display: flex;
          gap: 2px;
          opacity: 0;
          transition: opacity var(--transition-fast);
          flex-shrink: 0;
        }

        .lib-item:hover .lib-item-actions {
          opacity: 1;
        }

        .lib-action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border: none;
          background: transparent;
          color: var(--text-tertiary);
          cursor: pointer;
          border-radius: var(--radius-sm);
          transition: all var(--transition-fast);
        }

        .lib-action-btn:hover {
          background: var(--bg-item-active);
          color: var(--text-primary);
        }

        .lib-action-btn.danger:hover {
          background: var(--danger-muted);
          color: var(--danger-color);
        }

        .lib-add-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border: none;
          background: transparent;
          color: var(--text-tertiary);
          font-size: 0.78rem;
          cursor: pointer;
          border-radius: var(--radius-md);
          width: 100%;
          transition: all var(--transition-fast);
          margin-top: 4px;
        }

        .lib-add-btn:hover {
          background: var(--bg-item-hover);
          color: var(--text-secondary);
        }

        .lib-create-form {
          padding: 6px 8px;
          background: var(--bg-item-hover);
          border-radius: var(--radius-md);
          margin: 2px 0;
          min-width: 0;
          max-width: 100%;
          overflow-x: hidden;
          box-sizing: border-box;
        }

        .lib-section-label {
          font-size: 0.65rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-tertiary);
          padding: 10px 12px 4px;
          margin-top: 4px;
        }

        .lib-tag-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  )
}

interface LibraryFormProps {
  form: LibraryFormState
  setForm: (f: LibraryFormState) => void
  nameInputRef: React.RefObject<HTMLInputElement | null>
  showIconPicker: boolean
  setShowIconPicker: (v: boolean) => void
  showColorPicker: boolean
  setShowColorPicker: (v: boolean) => void
  onSave: () => void
  onCancel: () => void
  lib: {
    namePlaceholder: string
    btnSave: string
    btnCancel: string
    iconLabel: string
    colorLabel: string
  }
}

function LibraryForm({
  form, setForm, nameInputRef,
  showIconPicker, setShowIconPicker,
  showColorPicker, setShowColorPicker,
  onSave, onCancel, lib
}: LibraryFormProps) {
  return (
    <div className="lf-root">
      <div className="lf-row">
        <button
          className="lf-icon-btn"
          style={{ background: form.color + '22', border: `1px solid ${form.color}44` }}
          onClick={() => { setShowIconPicker(!showIconPicker); setShowColorPicker(false) }}
          title={lib.iconLabel}
        >
          {form.icon}
        </button>
        <input
          ref={nameInputRef}
          className="lf-name-input"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder={lib.namePlaceholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave()
            else if (e.key === 'Escape') onCancel()
          }}
        />
        <button
          className="lf-color-btn"
          style={{ background: form.color }}
          onClick={() => { setShowColorPicker(!showColorPicker); setShowIconPicker(false) }}
          title={lib.colorLabel}
        />
        <div className="lf-actions">
          <button className="lf-save" onClick={onSave} disabled={!form.name.trim()} title={lib.btnSave}>
            <Check size={12} />
          </button>
          <button className="lf-cancel" onClick={onCancel} title={lib.btnCancel}>
            <X size={12} />
          </button>
        </div>
      </div>

      {showIconPicker && (
        <div className="lf-picker">
          {PRESET_ICONS.map((icon) => (
            <button
              key={icon}
              className={`lf-picker-item ${form.icon === icon ? 'selected' : ''}`}
              onClick={() => { setForm({ ...form, icon }); setShowIconPicker(false) }}
            >
              {icon}
            </button>
          ))}
        </div>
      )}

      {showColorPicker && (
        <div className="lf-picker">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              className="lf-color-swatch"
              style={{ background: color }}
              onClick={() => { setForm({ ...form, color }); setShowColorPicker(false) }}
            >
              {form.color === color && <Check size={10} color="#fff" />}
            </button>
          ))}
        </div>
      )}

      <style jsx>{`
        .lf-root {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
          min-width: 0;
          max-width: 100%;
          box-sizing: border-box;
        }

        .lf-row {
          display: flex;
          flex-wrap: nowrap;
          align-items: center;
          gap: 4px;
          min-width: 0;
          max-width: 100%;
        }

        .lf-icon-btn {
          width: 28px;
          height: 28px;
          border-radius: var(--radius-sm);
          border: none;
          font-size: 14px;
          cursor: pointer;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .lf-name-input {
          flex: 1 1 0;
          min-width: 0;
          max-width: 100%;
          padding: 4px 6px;
          border: 1px solid var(--border-color);
          background: var(--bg-glass);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-size: 0.78rem;
          box-sizing: border-box;
        }

        .lf-name-input:focus {
          outline: none;
          border-color: var(--border-focus);
        }

        .lf-color-btn {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.2);
          cursor: pointer;
          flex-shrink: 0;
        }

        .lf-picker {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          padding: 6px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-light);
          border-radius: var(--radius-md);
        }

        .lf-picker-item {
          width: 24px;
          height: 24px;
          border: none;
          background: transparent;
          cursor: pointer;
          border-radius: var(--radius-sm);
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .lf-picker-item:hover,
        .lf-picker-item.selected {
          background: var(--bg-item-hover);
        }

        .lf-color-swatch {
          width: 20px;
          height: 20px;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .lf-actions {
          display: flex;
          flex-shrink: 0;
          gap: 2px;
          align-items: center;
        }

        .lf-save, .lf-cancel {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: var(--radius-sm);
          border: none;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .lf-save {
          background: var(--accent-color);
          color: white;
        }

        .lf-save:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .lf-save:not(:disabled):hover {
          background: var(--accent-hover);
        }

        .lf-cancel {
          background: var(--bg-item-hover);
          color: var(--text-secondary);
        }

        .lf-cancel:hover {
          background: var(--bg-item-active);
        }
      `}</style>
    </div>
  )
}
