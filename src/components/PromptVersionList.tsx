'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Plus, Eye, CheckCircle, Trash2, ChevronDown, ChevronRight, GitCompare, FileText, Clock, ArrowUpDown } from 'lucide-react'
import { promptAPI } from '@/lib/seekdb/api'
import type { PromptVersion } from '@/lib/seekdb/types'

interface PromptVersionListProps {
  promptId: string
  onSelectVersion?: (versionId: string) => void
  onCreateVersion?: () => void
}

/**
 * 简单文本差异计算 - 按行对比，返回增删改统计和差异行
 */
function computeSimpleDiff(oldText: string, newText: string) {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  let added = 0
  let removed = 0
  let changed = 0

  const maxLen = Math.max(oldLines.length, newLines.length)
  const diffLines: { type: 'add' | 'remove' | 'change' | 'same'; old?: string; new?: string; line: number }[] = []

  for (let i = 0; i < maxLen; i++) {
    const oldLine = i < oldLines.length ? oldLines[i] : undefined
    const newLine = i < newLines.length ? newLines[i] : undefined

    if (oldLine === undefined && newLine !== undefined) {
      added++
      diffLines.push({ type: 'add', new: newLine, line: i + 1 })
    } else if (oldLine !== undefined && newLine === undefined) {
      removed++
      diffLines.push({ type: 'remove', old: oldLine, line: i + 1 })
    } else if (oldLine !== newLine) {
      changed++
      diffLines.push({ type: 'change', old: oldLine, new: newLine, line: i + 1 })
    } else {
      diffLines.push({ type: 'same', old: oldLine, new: newLine, line: i + 1 })
    }
  }

  return { added, removed, changed, diffLines, totalOld: oldLines.length, totalNew: newLines.length }
}

/**
 * 格式化相对时间
 */
function formatRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays < 7) return `${diffDays}天前`
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export default function PromptVersionList({ promptId, onSelectVersion, onCreateVersion }: PromptVersionListProps) {
  const [versions, setVersions] = useState<PromptVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [compareIds, setCompareIds] = useState<[string | null, string | null]>([null, null])

  useEffect(() => {
    loadVersions()
  }, [promptId])

  const loadVersions = async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await promptAPI.getVersions(promptId)
      setVersions(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载版本失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSetCurrent = async (versionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await promptAPI.setCurrentVersion(promptId, versionId)
      await loadVersions()
    } catch (err) {
      setError(err instanceof Error ? err.message : '设置当前版本失败')
    }
  }

  const handleDelete = async (versionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确定要删除这个版本吗？')) return
    try {
      await promptAPI.delete(versionId)
      setExpandedId(null)
      await loadVersions()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  const handleToggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const handleCompareToggle = useCallback((versionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setCompareIds(prev => {
      if (prev[0] === versionId) return [null, prev[1]]
      if (prev[1] === versionId) return [prev[0], null]
      if (!prev[0]) return [versionId, prev[1]]
      if (!prev[1]) return [prev[0], versionId]
      return [versionId, null]
    })
  }, [])

  const toggleCompareMode = () => {
    setCompareMode(!compareMode)
    if (compareMode) {
      setCompareIds([null, null])
    }
  }

  // 版本差异统计（相邻版本的内容长度变化）
  const versionStats = useMemo(() => {
    const stats: Record<string, { contentDelta: number; linesDelta: number }> = {}
    const sorted = [...versions].sort((a, b) => a.version - b.version)
    for (let i = 0; i < sorted.length; i++) {
      const prev = i > 0 ? sorted[i - 1] : null
      const curr = sorted[i]
      if (prev) {
        stats[curr.id] = {
          contentDelta: curr.content.length - prev.content.length,
          linesDelta: curr.content.split('\n').length - prev.content.split('\n').length,
        }
      } else {
        stats[curr.id] = { contentDelta: 0, linesDelta: 0 }
      }
    }
    return stats
  }, [versions])

  // 对比结果
  const compareResult = useMemo(() => {
    if (!compareIds[0] || !compareIds[1]) return null
    const v1 = versions.find(v => v.id === compareIds[0])
    const v2 = versions.find(v => v.id === compareIds[1])
    if (!v1 || !v2) return null

    const [older, newer] = v1.version < v2.version ? [v1, v2] : [v2, v1]
    return {
      older,
      newer,
      diff: computeSimpleDiff(older.content, newer.content),
      titleChanged: older.title !== newer.title,
      descChanged: older.description !== newer.description,
    }
  }, [compareIds, versions])

  const currentVersion = versions.find(v => v.isCurrentVersion)

  return (
    <div className="version-list">
      {/* 顶部概览 */}
      <div className="version-list-header">
        <div className="header-left">
          <h2>版本历史</h2>
          <span className="version-count">{versions.length} 个版本</span>
          {currentVersion && (
            <span className="current-badge">当前 v{currentVersion.version}</span>
          )}
        </div>
        <div className="header-actions">
          {versions.length >= 2 && (
            <button
              onClick={toggleCompareMode}
              className={`btn btn-sm ${compareMode ? 'btn-compare-active' : 'btn-ghost'}`}
            >
              <GitCompare size={14} /> {compareMode ? '退出对比' : '版本对比'}
            </button>
          )}
          {onCreateVersion && (
            <button onClick={onCreateVersion} className="btn btn-sm btn-primary">
              <Plus size={14} /> 新版本
            </button>
          )}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* 对比模式提示 */}
      {compareMode && (
        <div className="compare-hint">
          <GitCompare size={14} />
          <span>
            {!compareIds[0] && !compareIds[1] && '点击选择两个版本进行对比'}
            {compareIds[0] && !compareIds[1] && `已选 v${versions.find(v => v.id === compareIds[0])?.version}，再选一个版本`}
            {compareIds[0] && compareIds[1] && '对比结果如下 ↓'}
          </span>
        </div>
      )}

      {/* 对比结果面板 */}
      {compareResult && (
        <div className="compare-panel">
          <div className="compare-header">
            <span className="compare-label old">v{compareResult.older.version}</span>
            <ArrowUpDown size={14} className="compare-arrow" />
            <span className="compare-label new">v{compareResult.newer.version}</span>
            <div className="compare-stats">
              {compareResult.diff.added > 0 && <span className="stat-add">+{compareResult.diff.added}</span>}
              {compareResult.diff.removed > 0 && <span className="stat-remove">-{compareResult.diff.removed}</span>}
              {compareResult.diff.changed > 0 && <span className="stat-change">~{compareResult.diff.changed}</span>}
              {compareResult.titleChanged && <span className="stat-meta">标题变更</span>}
              {compareResult.descChanged && <span className="stat-meta">描述变更</span>}
            </div>
          </div>
          <div className="compare-diff">
            {compareResult.diff.diffLines
              .filter(d => d.type !== 'same')
              .slice(0, 20)
              .map((d, i) => (
                <div key={i} className={`diff-line diff-${d.type}`}>
                  <span className="diff-indicator">
                    {d.type === 'add' ? '+' : d.type === 'remove' ? '-' : '~'}
                  </span>
                  <span className="diff-num">L{d.line}</span>
                  {d.type === 'remove' && <span className="diff-text">{d.old}</span>}
                  {d.type === 'add' && <span className="diff-text">{d.new}</span>}
                  {d.type === 'change' && (
                    <span className="diff-text">
                      <del>{d.old}</del> → {d.new}
                    </span>
                  )}
                </div>
              ))}
            {compareResult.diff.diffLines.filter(d => d.type !== 'same').length > 20 && (
              <div className="diff-truncated">
                还有 {compareResult.diff.diffLines.filter(d => d.type !== 'same').length - 20} 处变更...
              </div>
            )}
            {compareResult.diff.diffLines.filter(d => d.type !== 'same').length === 0 && (
              <div className="diff-empty">内容完全相同</div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">加载中...</div>
      ) : versions.length === 0 ? (
        <div className="empty-state">暂无版本</div>
      ) : (
        <div className="versions-table">
          {/* 表头 */}
          <div className="table-header">
            {compareMode && <div className="col-check">选</div>}
            <div className="col-version">版本</div>
            <div className="col-title">标题 / 变更说明</div>
            <div className="col-delta">变更</div>
            <div className="col-time">时间</div>
            <div className="col-actions">操作</div>
          </div>

          {/* 版本行 */}
          {versions.map((version) => {
            const isExpanded = expandedId === version.id
            const stat = versionStats[version.id]
            const isCompareSelected = compareIds[0] === version.id || compareIds[1] === version.id

            return (
              <div key={version.id} className={`version-row-wrapper ${isExpanded ? 'expanded' : ''}`}>
                <div
                  className={`version-row ${version.isCurrentVersion ? 'current' : ''} ${isCompareSelected ? 'compare-selected' : ''}`}
                  onClick={() => handleToggleExpand(version.id)}
                >
                  {compareMode && (
                    <div className="col-check">
                      <input
                        type="checkbox"
                        checked={isCompareSelected}
                        onChange={() => {}}
                        onClick={(e) => handleCompareToggle(version.id, e)}
                        className="compare-checkbox"
                      />
                    </div>
                  )}
                  <div className="col-version">
                    <span className="version-num">v{version.version}</span>
                    {version.isCurrentVersion && <span className="badge-current">当前</span>}
                  </div>
                  <div className="col-title">
                    <span className="row-title">{version.title}</span>
                    {version.changeNotes && (
                      <span className="row-change-notes">{version.changeNotes}</span>
                    )}
                  </div>
                  <div className="col-delta">
                    {stat && version.version > 1 && (
                      <span className={`delta ${stat.contentDelta > 0 ? 'positive' : stat.contentDelta < 0 ? 'negative' : 'neutral'}`}>
                        {stat.contentDelta > 0 ? '+' : ''}{stat.contentDelta > 0 ? `${stat.linesDelta}行` : stat.contentDelta < 0 ? `${stat.linesDelta}行` : '—'}
                      </span>
                    )}
                    {version.version === 1 && <span className="delta neutral">初始</span>}
                  </div>
                  <div className="col-time" title={new Date(version.createdAt).toLocaleString('zh-CN')}>
                    {formatRelativeTime(version.createdAt)}
                  </div>
                  <div className="col-actions">
                    {onSelectVersion && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onSelectVersion(version.id); }}
                        className="action-btn"
                        title="查看详情"
                      >
                        <Eye size={14} />
                      </button>
                    )}
                    {!version.isCurrentVersion && (
                      <button
                        onClick={(e) => handleSetCurrent(version.id, e)}
                        className="action-btn action-promote"
                        title="设为当前版本"
                      >
                        <CheckCircle size={14} />
                      </button>
                    )}
                    {versions.length > 1 && (
                      <button
                        onClick={(e) => handleDelete(version.id, e)}
                        className="action-btn action-delete"
                        title="删除版本"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    <span className="expand-icon">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  </div>
                </div>

                {/* 展开详情 */}
                {isExpanded && (
                  <div className="version-detail">
                    {version.description && (
                      <div className="detail-section">
                        <span className="detail-label">描述</span>
                        <span className="detail-value">{version.description}</span>
                      </div>
                    )}
                    {version.changeNotes && (
                      <div className="detail-section">
                        <span className="detail-label">变更说明</span>
                        <span className="detail-value change-notes-full">{version.changeNotes}</span>
                      </div>
                    )}
                    <div className="detail-section">
                      <span className="detail-label">内容预览</span>
                      <div className="detail-content-preview">
                        {version.content.substring(0, 500)}
                        {version.content.length > 500 && '...'}
                      </div>
                    </div>
                    <div className="detail-meta">
                      <span><Clock size={12} /> 创建: {new Date(version.createdAt).toLocaleString('zh-CN')}</span>
                      <span><FileText size={12} /> {version.content.length} 字符 · {version.content.split('\n').length} 行</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <style jsx>{`
        .version-list {
          width: 100%;
          animation: fadeIn 0.25s ease;
        }

        /* ===== 头部 ===== */
        .version-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          gap: 1rem;
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .header-left h2 {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.03em;
        }
        .version-count {
          font-size: 0.75rem;
          color: var(--text-tertiary);
          background: var(--bg-glass);
          padding: 2px 8px;
          border-radius: var(--radius-full);
          border: 1px solid var(--border-color);
        }
        .current-badge {
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--badge-current-color);
          background: var(--badge-current-bg);
          border: 1px solid var(--badge-current-border);
          padding: 2px 8px;
          border-radius: var(--radius-full);
        }
        .header-actions {
          display: flex;
          gap: 0.5rem;
        }

        /* ===== 按钮 ===== */
        .btn {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          border: none;
          border-radius: var(--radius-md);
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-fast);
          letter-spacing: -0.01em;
        }
        .btn-sm {
          padding: 6px 12px;
        }
        .btn-primary {
          background: var(--accent-color);
          color: white;
        }
        .btn-primary:hover {
          background: var(--accent-hover);
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
        }
        .btn-ghost {
          background: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
        }
        .btn-ghost:hover {
          background: var(--bg-item-hover);
          color: var(--text-primary);
        }
        .btn-compare-active {
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.3);
          color: var(--accent-color);
        }

        /* ===== 对比提示 ===== */
        .compare-hint {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 8px 12px;
          margin-bottom: 0.75rem;
          border-radius: var(--radius-md);
          background: rgba(99, 102, 241, 0.06);
          border: 1px solid rgba(99, 102, 241, 0.15);
          font-size: 0.78rem;
          color: var(--accent-color);
        }

        /* ===== 对比面板 ===== */
        .compare-panel {
          margin-bottom: 1rem;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-color);
          overflow: hidden;
          background: var(--bg-card);
        }
        .compare-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 8px 12px;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-glass);
          font-size: 0.78rem;
        }
        .compare-label {
          padding: 2px 8px;
          border-radius: var(--radius-sm);
          font-weight: 600;
          font-size: 0.72rem;
        }
        .compare-label.old {
          background: rgba(244, 63, 94, 0.1);
          color: var(--danger-color);
        }
        .compare-label.new {
          background: rgba(34, 197, 94, 0.1);
          color: #16a34a;
        }
        .compare-arrow {
          color: var(--text-tertiary);
        }
        .compare-stats {
          display: flex;
          gap: 0.5rem;
          margin-left: auto;
          font-size: 0.72rem;
          font-weight: 600;
        }
        .stat-add { color: #16a34a; }
        .stat-remove { color: var(--danger-color); }
        .stat-change { color: #f59e0b; }
        .stat-meta {
          color: var(--text-tertiary);
          font-weight: 500;
        }
        .compare-diff {
          max-height: 300px;
          overflow-y: auto;
          font-family: 'SF Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 0.75rem;
          line-height: 1.6;
        }
        .diff-line {
          display: flex;
          gap: 0.5rem;
          padding: 2px 12px;
          border-bottom: 1px solid rgba(128, 128, 128, 0.05);
        }
        .diff-add { background: rgba(34, 197, 94, 0.06); }
        .diff-remove { background: rgba(244, 63, 94, 0.06); }
        .diff-change { background: rgba(245, 158, 11, 0.06); }
        .diff-indicator {
          width: 12px;
          text-align: center;
          flex-shrink: 0;
          font-weight: 700;
        }
        .diff-add .diff-indicator { color: #16a34a; }
        .diff-remove .diff-indicator { color: var(--danger-color); }
        .diff-change .diff-indicator { color: #f59e0b; }
        .diff-num {
          color: var(--text-tertiary);
          width: 32px;
          flex-shrink: 0;
          text-align: right;
        }
        .diff-text {
          flex: 1;
          white-space: pre-wrap;
          word-break: break-all;
          color: var(--text-secondary);
        }
        .diff-text del {
          color: var(--danger-color);
          text-decoration: line-through;
          opacity: 0.7;
        }
        .diff-truncated, .diff-empty {
          padding: 8px 12px;
          text-align: center;
          color: var(--text-tertiary);
          font-family: inherit;
          font-size: 0.75rem;
        }

        /* ===== 表格布局 ===== */
        .versions-table {
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          overflow: hidden;
          background: var(--bg-card);
        }
        .table-header {
          display: grid;
          grid-template-columns: ${compareMode ? '36px ' : ''}60px 1fr 72px 80px 100px;
          gap: 0;
          padding: 8px 12px;
          background: var(--bg-glass);
          border-bottom: 1px solid var(--border-color);
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        /* ===== 版本行 ===== */
        .version-row-wrapper {
          border-bottom: 1px solid rgba(128, 128, 128, 0.06);
        }
        .version-row-wrapper:last-child {
          border-bottom: none;
        }
        .version-row-wrapper.expanded {
          background: var(--bg-glass);
        }
        .version-row {
          display: grid;
          grid-template-columns: ${compareMode ? '36px ' : ''}60px 1fr 72px 80px 100px;
          gap: 0;
          padding: 10px 12px;
          cursor: pointer;
          transition: background var(--transition-fast);
          align-items: center;
          font-size: 0.82rem;
        }
        .version-row:hover {
          background: var(--bg-item-hover);
        }
        .version-row.current {
          border-left: 3px solid var(--accent-color);
          padding-left: 9px;
        }
        .version-row.compare-selected {
          background: rgba(99, 102, 241, 0.06);
        }

        /* ===== 列样式 ===== */
        .col-check {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .compare-checkbox {
          width: 14px;
          height: 14px;
          cursor: pointer;
          accent-color: var(--accent-color);
        }
        .col-version {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }
        .version-num {
          font-weight: 700;
          font-size: 0.82rem;
          color: var(--text-primary);
          font-family: 'SF Mono', ui-monospace, monospace;
        }
        .badge-current {
          font-size: 0.6rem;
          font-weight: 600;
          color: var(--badge-current-color);
          background: var(--badge-current-bg);
          border: 1px solid var(--badge-current-border);
          padding: 1px 5px;
          border-radius: var(--radius-full);
          white-space: nowrap;
        }
        .col-title {
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow: hidden;
          padding-right: 8px;
        }
        .row-title {
          font-weight: 500;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 0.82rem;
        }
        .row-change-notes {
          font-size: 0.72rem;
          color: var(--text-tertiary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .col-delta {
          font-size: 0.72rem;
          font-weight: 600;
          font-family: 'SF Mono', ui-monospace, monospace;
        }
        .delta.positive { color: #16a34a; }
        .delta.negative { color: var(--danger-color); }
        .delta.neutral { color: var(--text-tertiary); font-weight: 500; }
        .col-time {
          font-size: 0.72rem;
          color: var(--text-tertiary);
          white-space: nowrap;
        }
        .col-actions {
          display: flex;
          align-items: center;
          gap: 2px;
          justify-content: flex-end;
        }
        .action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border: none;
          border-radius: var(--radius-sm);
          background: transparent;
          color: var(--text-tertiary);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .action-btn:hover {
          background: var(--bg-item-hover);
          color: var(--accent-color);
        }
        .action-promote:hover {
          color: #16a34a;
        }
        .action-delete:hover {
          color: var(--danger-color);
          background: var(--danger-muted);
        }
        .expand-icon {
          display: flex;
          align-items: center;
          color: var(--text-tertiary);
        }

        /* ===== 展开详情 ===== */
        .version-detail {
          padding: 12px 16px 16px;
          border-top: 1px solid rgba(128, 128, 128, 0.08);
          animation: slideDown 0.2s ease;
        }
        .detail-section {
          margin-bottom: 10px;
        }
        .detail-label {
          display: block;
          font-size: 0.68rem;
          font-weight: 600;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 4px;
        }
        .detail-value {
          font-size: 0.82rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }
        .change-notes-full {
          color: var(--accent-color);
          font-style: italic;
        }
        .detail-content-preview {
          padding: 10px;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          font-size: 0.78rem;
          line-height: 1.6;
          color: var(--text-secondary);
          max-height: 200px;
          overflow: auto;
          background: var(--code-bg);
          font-family: 'SF Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .detail-meta {
          display: flex;
          gap: 1.5rem;
          margin-top: 8px;
          font-size: 0.72rem;
          color: var(--text-tertiary);
        }
        .detail-meta span {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        /* ===== 状态 ===== */
        .loading, .empty-state, .error-message {
          text-align: center;
          padding: 2rem;
          color: var(--text-tertiary);
          font-size: 0.82rem;
        }
        .loading {
          animation: pulse-soft 1.5s ease infinite;
        }
        .error-message {
          border: 1px solid rgba(244, 63, 94, 0.2);
          border-radius: var(--radius-lg);
          color: var(--danger-color);
          margin-bottom: 0.75rem;
          background: var(--danger-muted);
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
