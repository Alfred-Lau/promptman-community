'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  File as FileIcon,
  FileText,
  Folder,
  FolderOpen,
  FolderInput,
  FolderOpenDot,
  Save,
  Trash2,
  Upload,
  Download,
} from 'lucide-react'
import { agentSkillAPI } from '@/lib/seekdb/api'
import {
  buildDisplayTree,
  formatFileSize,
  isNodeVisible,
  type SkillFileNode,
} from '@/lib/skillPackage'
import { useLocale } from '@/lib/i18n'

interface SkillPackagePanelProps {
  /** skill_id 分组 id（技能包挂在分组上，不是单个版本） */
  skillId: string
  disabled?: boolean
  /** 导入时主进程用包内 SKILL.md 回填了正文，通知外层同步表单状态 */
  onTemplateFilled?: (skillMd: string) => void
}

export default function SkillPackagePanel({
  skillId,
  disabled = false,
  onTemplateFilled,
}: SkillPackagePanelProps) {
  const { t } = useLocale()
  const sp = t.skillPackage

  const [tree, setTree] = useState<SkillFileNode[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ content: string; truncated: boolean } | null>(null)
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadTree = useCallback(async () => {
    try {
      const nodes = await agentSkillAPI.getPackageTree(skillId)
      setTree(nodes)
      // 默认展开第一层目录，深层保持折叠
      setExpanded(new Set(nodes.filter((n) => n.isDir && !n.path.includes('/')).map((n) => n.path)))
    } catch (err) {
      setError(err instanceof Error ? err.message : sp.errorLoadTree)
    }
  }, [skillId, sp.errorLoadTree])

  useEffect(() => {
    setSelectedPath(null)
    setPreview(null)
    void loadTree()
  }, [loadTree])

  const files = useMemo(() => tree.filter((n) => !n.isDir), [tree])
  const totalSize = useMemo(() => files.reduce((sum, n) => sum + (n.size || 0), 0), [files])
  const visibleEntries = useMemo(
    () => buildDisplayTree(tree).filter(({ node }) => isNodeVisible(node.path, expanded)),
    [tree, expanded],
  )

  const runImport = async (kind: 'zip' | 'folder') => {
    setError(null)
    setNotice(null)
    try {
      setBusy(true)
      const result =
        kind === 'zip'
          ? await agentSkillAPI.importPackageZip({ skillId })
          : await agentSkillAPI.importPackageFolder({ skillId })
      if (!result) return // 用户取消

      setTree(result.fileTree)
      setExpanded(
        new Set(result.fileTree.filter((n) => n.isDir && !n.path.includes('/')).map((n) => n.path)),
      )
      setSelectedPath(null)
      setPreview(null)
      setDraft('')
      setDirty(false)

      if (result.templateFilled && result.skillMd) {
        onTemplateFilled?.(result.skillMd)
      }
      setNotice(
        result.skipped > 0
          ? sp.importedWithSkipped
              .replace('{count}', String(result.fileCount))
              .replace('{skipped}', String(result.skipped))
          : sp.imported.replace('{count}', String(result.fileCount)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : sp.errorImport)
    } finally {
      setBusy(false)
    }
  }

  const handleSelectFile = async (node: SkillFileNode) => {
    if (node.isDir) {
      setExpanded((prev) => {
        const next = new Set(prev)
        if (next.has(node.path)) next.delete(node.path)
        else next.add(node.path)
        return next
      })
      return
    }
    if (!node.isText) return

    setSelectedPath(node.path)
    setError(null)
    try {
      const data = await agentSkillAPI.readPackageFile(skillId, node.path)
      setPreview(data)
      setDraft(data.content)
      setDirty(false)
    } catch (err) {
      setPreview(null)
      setDraft('')
      setDirty(false)
      setError(err instanceof Error ? err.message : sp.errorReadFile)
    }
  }

  const handleClear = async () => {
    setError(null)
    setNotice(null)
    try {
      setBusy(true)
      await agentSkillAPI.clearPackage(skillId)
      setTree([])
      setExpanded(new Set())
      setSelectedPath(null)
      setPreview(null)
      setDraft('')
      setDirty(false)
      setNotice(sp.cleared)
    } catch (err) {
      setError(err instanceof Error ? err.message : sp.errorClear)
    } finally {
      setBusy(false)
    }
  }

  const handleReveal = async () => {
    try {
      await agentSkillAPI.revealPackage(skillId)
    } catch (err) {
      setError(err instanceof Error ? err.message : sp.errorReveal)
    }
  }

  const handleSaveFile = async () => {
    if (!selectedPath || preview?.truncated) return
    setError(null)
    setNotice(null)
    try {
      setBusy(true)
      await agentSkillAPI.writePackageFile({ skillId, path: selectedPath, content: draft })
      setPreview({ content: draft, truncated: false })
      setDirty(false)
      if (selectedPath.split('/').pop()?.toLowerCase() === 'skill.md') {
        onTemplateFilled?.(draft)
      }
      setNotice(sp.saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : sp.errorSaveFile)
    } finally {
      setBusy(false)
    }
  }

  const handleExportZip = async () => {
    setError(null)
    try {
      setBusy(true)
      const path = await agentSkillAPI.exportPackageZip({ skillId })
      if (path) setNotice(sp.exported.replace('{path}', path))
    } catch (err) {
      setError(err instanceof Error ? err.message : sp.errorExportZip)
    } finally {
      setBusy(false)
    }
  }

  const hasPackage = files.length > 0
  const controlsDisabled = disabled || busy

  return (
    <div className="skill-package-panel">
      <div className="package-toolbar">
        <span className="package-summary">
          {hasPackage
            ? sp.summary
                .replace('{count}', String(files.length))
                .replace('{size}', formatFileSize(totalSize))
            : sp.empty}
        </span>
        <div className="package-actions">
          <button
            type="button"
            className="pkg-btn"
            onClick={() => void runImport('zip')}
            disabled={controlsDisabled}
          >
            <Upload size={14} /> {hasPackage ? sp.replaceZip : sp.importZip}
          </button>
          <button
            type="button"
            className="pkg-btn"
            onClick={() => void runImport('folder')}
            disabled={controlsDisabled}
          >
            <FolderInput size={14} /> {hasPackage ? sp.replaceFolder : sp.importFolder}
          </button>
          {hasPackage && (
            <button
              type="button"
              className="pkg-btn"
              onClick={() => void handleExportZip()}
              disabled={controlsDisabled}
            >
              <Download size={14} /> {sp.exportZip}
            </button>
          )}
          <button
            type="button"
            className="pkg-btn"
            onClick={() => void handleReveal()}
            disabled={controlsDisabled}
          >
            <FolderOpenDot size={14} /> {sp.reveal}
          </button>
          {hasPackage && (
            <button
              type="button"
              className="pkg-btn pkg-btn--danger"
              onClick={() => void handleClear()}
              disabled={controlsDisabled}
            >
              <Trash2 size={14} /> {sp.clear}
            </button>
          )}
        </div>
      </div>

      <p className="package-local-hint">{sp.localOnlyHint}</p>

      {error && <div className="package-error">{error}</div>}
      {notice && <div className="package-notice">{notice}</div>}

      {hasPackage && (
        <div className="package-body">
          <ul className="package-tree">
            {visibleEntries.map(({ node, depth }) => {
              const isSelected = node.path === selectedPath
              const isOpen = expanded.has(node.path)
              return (
                <li key={node.path}>
                  <button
                    type="button"
                    className={[
                      'tree-row',
                      isSelected ? 'tree-row--selected' : '',
                      !node.isDir && !node.isText ? 'tree-row--binary' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ paddingLeft: `${8 + depth * 14}px` }}
                    onClick={() => void handleSelectFile(node)}
                    disabled={!node.isDir && !node.isText}
                    title={!node.isDir && !node.isText ? sp.binaryNotPreviewable : node.path}
                  >
                    {node.isDir ? (
                      <>
                        {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        {isOpen ? <FolderOpen size={14} /> : <Folder size={14} />}
                      </>
                    ) : node.isText ? (
                      <FileText size={14} />
                    ) : (
                      <FileIcon size={14} />
                    )}
                    <span className="tree-name">{node.name}</span>
                    {!node.isDir && <span className="tree-size">{formatFileSize(node.size)}</span>}
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="package-preview">
            {selectedPath ? (
              <>
                <div className="preview-path">
                  <span>{selectedPath}</span>
                  {!preview?.truncated && (
                    <button
                      type="button"
                      className="pkg-btn"
                      onClick={() => void handleSaveFile()}
                      disabled={controlsDisabled || !dirty}
                    >
                      <Save size={13} /> {dirty ? sp.saveFile : sp.saved}
                    </button>
                  )}
                </div>
                {preview?.truncated && <div className="preview-truncated">{sp.truncated}</div>}
                {preview?.truncated ? (
                  <pre className="preview-content">{preview.content}</pre>
                ) : (
                  <textarea
                    className="preview-editor"
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value)
                      setDirty(true)
                    }}
                    disabled={controlsDisabled}
                    spellCheck={false}
                  />
                )}
              </>
            ) : (
              <div className="preview-placeholder">{sp.selectFileHint}</div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .skill-package-panel {
          border: 1px solid var(--border-color, rgba(148, 163, 184, 0.25));
          border-radius: 10px;
          padding: 10px 12px;
          background: rgba(148, 163, 184, 0.04);
        }
        .package-toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .package-summary {
          font-size: 12px;
          opacity: 0.85;
        }
        .package-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .pkg-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          padding: 4px 9px;
          border-radius: 6px;
          border: 1px solid var(--border-color, rgba(148, 163, 184, 0.3));
          background: transparent;
          color: inherit;
          cursor: pointer;
        }
        .pkg-btn:hover:not(:disabled) {
          background: rgba(148, 163, 184, 0.14);
        }
        .pkg-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .pkg-btn--danger:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.14);
          border-color: rgba(239, 68, 68, 0.45);
        }
        .package-local-hint,
        .package-error,
        .package-notice {
          margin: 8px 0 0;
          font-size: 11.5px;
        }
        .package-local-hint {
          opacity: 0.6;
        }
        .package-error {
          color: #ef4444;
        }
        .package-notice {
          color: #34d399;
        }
        .package-body {
          display: grid;
          grid-template-columns: minmax(180px, 260px) 1fr;
          gap: 10px;
          margin-top: 10px;
        }
        .package-tree {
          list-style: none;
          margin: 0;
          padding: 4px 0;
          max-height: 320px;
          overflow: auto;
          border: 1px solid var(--border-color, rgba(148, 163, 184, 0.2));
          border-radius: 8px;
        }
        .tree-row {
          display: flex;
          align-items: center;
          gap: 5px;
          width: 100%;
          padding: 3px 8px;
          border: none;
          background: transparent;
          color: inherit;
          font-size: 12px;
          text-align: left;
          cursor: pointer;
        }
        .tree-row:hover:not(:disabled) {
          background: rgba(148, 163, 184, 0.14);
        }
        .tree-row--selected {
          background: rgba(110, 231, 247, 0.18);
        }
        .tree-row--binary {
          opacity: 0.45;
          cursor: default;
        }
        .tree-name {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .tree-size {
          font-size: 10.5px;
          opacity: 0.55;
          flex-shrink: 0;
        }
        .package-preview {
          border: 1px solid var(--border-color, rgba(148, 163, 184, 0.2));
          border-radius: 8px;
          max-height: 320px;
          overflow: auto;
          padding: 8px 10px;
        }
        .preview-path {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 11px;
          opacity: 0.85;
          margin-bottom: 6px;
          word-break: break-all;
        }
        .preview-editor {
          width: 100%;
          min-height: 240px;
          resize: vertical;
          border: none;
          background: transparent;
          color: inherit;
          font-size: 11.5px;
          line-height: 1.55;
          font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
        }
        .preview-editor:focus {
          outline: none;
        }
        .preview-truncated {
          font-size: 11px;
          color: #f59e0b;
          margin-bottom: 6px;
        }
        .preview-content {
          margin: 0;
          font-size: 11.5px;
          line-height: 1.55;
          white-space: pre-wrap;
          word-break: break-word;
          font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
        }
        .preview-placeholder {
          font-size: 12px;
          opacity: 0.5;
          padding: 12px 0;
        }
        @media (max-width: 720px) {
          .package-body {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
