'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  Check,
  CheckSquare,
  Copy,
  DownloadCloud,
  Loader2,
  Square,
  X,
} from 'lucide-react'
import { agentSkillAPI } from '@/lib/seekdb/api'
import type { RemoteDiscoveredSkill, RemoteInstallResultItem } from '@/lib/seekdb/api'
import { useLocale } from '@/lib/i18n'

type DuplicateStrategy = 'skip' | 'overwrite' | 'copy'

type PreviewData = {
  source: {
    display: string
    owner: string
    repo: string
    ref: string | null
    subpath: string | null
    skillHint: string | null
    cliEquivalent: string
  }
  commitSha: string | null
  defaultBranch: string | null
  skills: RemoteDiscoveredSkill[]
  cliEquivalent: string
}

interface RemoteSkillInstallPanelProps {
  open: boolean
  onClose: () => void
  libraryId?: string | null
  onInstalled?: () => void
}

export default function RemoteSkillInstallPanel({
  open,
  onClose,
  libraryId = null,
  onInstalled,
}: RemoteSkillInstallPanelProps) {
  const { t } = useLocale()
  const r = t.skillRemote
  const [source, setSource] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [strategy, setStrategy] = useState<DuplicateStrategy>('skip')
  const [results, setResults] = useState<RemoteInstallResultItem[] | null>(null)
  const [copied, setCopied] = useState(false)

  const reset = useCallback(() => {
    setSource('')
    setPreview(null)
    setSelected(new Set())
    setResults(null)
    setError(null)
    setStrategy('skip')
    setCopied(false)
  }, [])

  const handleClose = () => {
    reset()
    onClose()
  }

  const handlePreview = async () => {
    if (!source.trim()) return
    setPreviewing(true)
    setError(null)
    setResults(null)
    setPreview(null)
    try {
      const payload = await agentSkillAPI.previewRemoteSkills(source.trim())
      setPreview(payload)
      setSelected(new Set(payload.skills.map((s) => s.rootPath)))
    } catch (e) {
      setError(e instanceof Error ? e.message : r.errorPreview)
    } finally {
      setPreviewing(false)
    }
  }

  const toggle = (rootPath: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(rootPath)) next.delete(rootPath)
      else next.add(rootPath)
      return next
    })
  }

  const allSelected = useMemo(() => {
    if (!preview) return false
    return preview.skills.every((s) => selected.has(s.rootPath))
  }, [preview, selected])

  const toggleAll = () => {
    if (!preview) return
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(preview.skills.map((s) => s.rootPath)))
  }

  const cliText = useMemo(() => {
    if (!preview) {
      const s = source.trim()
      return s ? `npx skills add ${s}` : 'npx skills add owner/repo'
    }
    if (selected.size === 1) {
      const only = preview.skills.find((s) => selected.has(s.rootPath))
      if (only) {
        return `npx skills add ${preview.source.display} --skill ${JSON.stringify(only.name)}`
      }
    }
    if (selected.size === preview.skills.length) return preview.cliEquivalent
    const names = preview.skills.filter((s) => selected.has(s.rootPath)).map((s) => s.name)
    if (names.length === 0) return preview.cliEquivalent
    return `npx skills add ${preview.source.display} ${names
      .map((n) => `--skill ${JSON.stringify(n)}`)
      .join(' ')}`
  }, [preview, selected, source])

  const copyCli = async () => {
    try {
      await navigator.clipboard.writeText(cliText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // ignore
    }
  }

  const handleInstall = async () => {
    if (!preview || selected.size === 0) return
    setInstalling(true)
    setError(null)
    try {
      const payload = await agentSkillAPI.installRemoteSkills({
        source: source.trim(),
        rootPaths: [...selected],
        strategy,
        libraryId,
      })
      setResults(payload.results)
      if (payload.results.some((item) => item.status === 'created' || item.status === 'updated')) {
        onInstalled?.()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : r.errorInstall)
    } finally {
      setInstalling(false)
    }
  }

  if (!open) return null

  return (
    <div className="remote-mask" role="dialog" aria-modal="true">
      <div className="remote-panel">
        <div className="remote-head">
          <div>
            <h3>{r.title}</h3>
            <p>{r.subtitle}</p>
          </div>
          <button type="button" className="icon-btn" onClick={handleClose} aria-label={r.close}>
            <X size={16} />
          </button>
        </div>

        <label className="field-label" htmlFor="remote-source">
          {r.sourceLabel}
        </label>
        <div className="source-row">
          <input
            id="remote-source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder={r.sourcePlaceholder}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handlePreview()
            }}
          />
          <button type="button" className="primary-btn" onClick={() => void handlePreview()} disabled={previewing || !source.trim()}>
            {previewing ? <Loader2 size={14} className="spin" /> : <DownloadCloud size={14} />}
            {previewing ? r.previewing : r.preview}
          </button>
        </div>

        <div className="cli-row">
          <code>{cliText}</code>
          <button type="button" className="icon-btn" onClick={() => void copyCli()} title={r.copyCli}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>

        {error && <div className="remote-error">{error}</div>}

        {preview && (
          <>
            <div className="meta">
              {preview.source.display}
              {preview.commitSha ? ` @ ${preview.commitSha.slice(0, 7)}` : ''}
              {' · '}
              {preview.skills.length} skill{preview.skills.length === 1 ? '' : 's'}
            </div>

            <div className="select-bar">
              <button type="button" className="text-btn" onClick={toggleAll}>
                {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                {r.selectAll}
              </button>
              <label>
                {r.duplicate}
                <select
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value as DuplicateStrategy)}
                >
                  <option value="skip">{r.strategySkip}</option>
                  <option value="overwrite">{r.strategyOverwrite}</option>
                  <option value="copy">{r.strategyCopy}</option>
                </select>
              </label>
            </div>

            <ul className="skill-list">
              {preview.skills.map((skill) => {
                const checked = selected.has(skill.rootPath)
                return (
                  <li key={skill.rootPath || skill.name}>
                    <button type="button" className="skill-row" onClick={() => toggle(skill.rootPath)}>
                      {checked ? <CheckSquare size={15} /> : <Square size={15} />}
                      <span>
                        <strong>{skill.name}</strong>
                        <em>{skill.rootPath || '/'}</em>
                        {skill.description && <small>{skill.description}</small>}
                      </span>
                      <span className="count">{skill.fileCount}</span>
                    </button>
                  </li>
                )
              })}
            </ul>

            <button
              type="button"
              className="primary-btn install-btn"
              onClick={() => void handleInstall()}
              disabled={installing || selected.size === 0}
            >
              {installing ? <Loader2 size={14} className="spin" /> : <DownloadCloud size={14} />}
              {installing ? r.installing : r.install.replace('{count}', String(selected.size))}
            </button>
          </>
        )}

        {results && (
          <ul className="results">
            {results.map((item) => (
              <li key={`${item.rootPath}-${item.name}`} className={`st-${item.status}`}>
                <strong>{item.name}</strong> · {r[`status_${item.status}`]}
                {item.error ? ` — ${item.error}` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>

      <style jsx>{`
        .remote-mask {
          position: fixed;
          inset: 0;
          z-index: 80;
          background: rgba(15, 23, 42, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .remote-panel {
          width: min(640px, 100%);
          max-height: min(86vh, 760px);
          overflow: auto;
          background: var(--bg-app, #0f172a);
          color: var(--text-primary, #e2e8f0);
          border: 1px solid var(--border-color, rgba(148, 163, 184, 0.25));
          border-radius: 14px;
          padding: 18px 20px 20px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.28);
        }
        .remote-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }
        .remote-head h3 {
          margin: 0 0 4px;
          font-size: 1.05rem;
        }
        .remote-head p {
          margin: 0;
          font-size: 12.5px;
          opacity: 0.7;
        }
        .field-label {
          display: block;
          font-size: 11px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          opacity: 0.65;
          margin-bottom: 6px;
        }
        .source-row,
        .cli-row,
        .select-bar {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .source-row input,
        .select-bar select {
          flex: 1;
          min-width: 0;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid var(--border-color, rgba(148, 163, 184, 0.3));
          background: var(--bg-glass, transparent);
          color: inherit;
        }
        .cli-row {
          margin: 10px 0 12px;
          padding: 7px 8px;
          border-radius: 8px;
          background: rgba(148, 163, 184, 0.08);
          font-size: 12px;
        }
        .cli-row code {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .primary-btn,
        .icon-btn,
        .text-btn,
        .skill-row {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid var(--border-color, rgba(148, 163, 184, 0.3));
          background: transparent;
          color: inherit;
          cursor: pointer;
        }
        .primary-btn {
          padding: 8px 12px;
          border-radius: 8px;
          background: var(--accent-color, #6366f1);
          border-color: transparent;
          color: #fff;
          font-weight: 600;
          white-space: nowrap;
        }
        .primary-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .icon-btn {
          padding: 6px;
          border-radius: 8px;
        }
        .text-btn {
          border: none;
          font-size: 12px;
        }
        .remote-error {
          color: #ef4444;
          font-size: 12.5px;
          margin: 8px 0;
        }
        .meta,
        .select-bar {
          font-size: 12px;
          margin: 8px 0;
        }
        .select-bar {
          justify-content: space-between;
        }
        .skill-list,
        .results {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .skill-row {
          width: 100%;
          text-align: left;
          padding: 8px 6px;
          border: none;
          border-bottom: 1px solid var(--border-color, rgba(148, 163, 184, 0.12));
        }
        .skill-row span {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
          min-width: 0;
        }
        .skill-row em,
        .skill-row small {
          font-style: normal;
          opacity: 0.6;
          font-size: 11.5px;
        }
        .count {
          font-size: 11px;
          opacity: 0.55;
        }
        .install-btn {
          width: 100%;
          justify-content: center;
          margin-top: 12px;
        }
        .results {
          margin-top: 12px;
          font-size: 12.5px;
        }
        .st-created { color: #34d399; }
        .st-updated { color: #6ee7f7; }
        .st-skipped { opacity: 0.7; }
        .st-failed { color: #ef4444; }
        .spin {
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
