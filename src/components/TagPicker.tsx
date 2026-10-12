'use client'

import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { tagAPI } from '@/lib/seekdb/api'
import type { TagDefinition } from '@/lib/seekdb/types'

interface TagPickerProps {
  value: string[]
  onChange: (ids: string[]) => void
  allTags: TagDefinition[]
  onTagsUpdated?: () => void
  disabled?: boolean
  labels: {
    selectPlaceholder: string
    newTagPlaceholder: string
    addNew: string
  }
}

export default function TagPicker({
  value,
  onChange,
  allTags,
  onTagsUpdated,
  disabled,
  labels,
}: TagPickerProps) {
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const idToTag = useMemo(() => {
    const m = new Map<string, TagDefinition>()
    allTags.forEach((t) => m.set(t.id, t))
    return m
  }, [allTags])

  const availableOptions = useMemo(
    () => allTags.filter((t) => !value.includes(t.id)),
    [allTags, value],
  )

  const addById = (id: string) => {
    if (!id || value.includes(id)) return
    onChange([...value, id])
  }

  const remove = (id: string) => {
    onChange(value.filter((x) => x !== id))
  }

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name || creating) return
    setCreating(true)
    try {
      const t = await tagAPI.create(name)
      onTagsUpdated?.()
      addById(t.id)
      setNewName('')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="tag-picker">
      <div className="tag-picker-row">
        <select
          className="tag-picker-select"
          value=""
          disabled={disabled}
          aria-label={labels.selectPlaceholder}
          onChange={(e) => {
            const v = e.target.value
            if (v) addById(v)
            e.target.value = ''
          }}
        >
          <option value="">{labels.selectPlaceholder}</option>
          {availableOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          className="tag-picker-new-input"
          placeholder={labels.newTagPlaceholder}
          value={newName}
          disabled={disabled}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void handleCreate()
            }
          }}
        />
        <button
          type="button"
          className="tag-picker-add-btn"
          disabled={disabled || creating || !newName.trim()}
          onClick={() => void handleCreate()}
        >
          <Plus size={14} />
          {labels.addNew}
        </button>
      </div>
      <div className="tag-picker-chips">
        {value.map((id) => {
          const tag = idToTag.get(id)
          return (
            <span key={id} className="tag-chip">
              {tag?.name ?? id}
              <button
                type="button"
                className="tag-chip-x"
                onClick={() => remove(id)}
                disabled={disabled}
                aria-label="remove"
              >
                <X size={12} />
              </button>
            </span>
          )
        })}
      </div>
      <style jsx>{`
        .tag-picker {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .tag-picker-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }
        .tag-picker-select {
          min-width: 140px;
          flex: 1;
          padding: 6px 8px;
          border: 1px solid var(--border-color);
          background: var(--bg-glass);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-size: 0.85rem;
        }
        .tag-picker-new-input {
          flex: 1;
          min-width: 120px;
          padding: 6px 8px;
          border: 1px solid var(--border-color);
          background: var(--bg-glass);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-size: 0.85rem;
        }
        .tag-picker-add-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          border: 1px solid var(--border-color);
          background: var(--bg-item-hover);
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          font-size: 0.8rem;
          cursor: pointer;
          white-space: nowrap;
        }
        .tag-picker-add-btn:hover:not(:disabled) {
          background: var(--bg-item-active);
          color: var(--text-primary);
        }
        .tag-picker-add-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .tag-picker-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .tag-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 6px 2px 8px;
          background: var(--accent-muted);
          color: var(--accent-color);
          border-radius: var(--radius-sm);
          font-size: 0.78rem;
        }
        .tag-chip-x {
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: transparent;
          color: inherit;
          cursor: pointer;
          padding: 0;
          opacity: 0.7;
        }
        .tag-chip-x:hover:not(:disabled) {
          opacity: 1;
        }
      `}</style>
    </div>
  )
}
