'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { Copy, Check, ChevronDown, Code2, Globe, X, Play, FileText, AlertCircle } from 'lucide-react'
import {
  ALL_MODELS,
  renderSkill,
  renderAll,
  validateSpec,
  SAMPLE_SPEC,
  type CanonicalSkillSpec,
  type ModelFamily,
  type RenderedSkill,
} from '@/lib/adapters'

interface AdaptersPlaygroundProps {
  onClose?: () => void
}

type TabView = 'single' | 'all'

export default function AdaptersPlayground({ onClose }: AdaptersPlaygroundProps) {
  const [specJson, setSpecJson] = useState(() => JSON.stringify(SAMPLE_SPEC, null, 2))
  const [parseError, setParseError] = useState<string | null>(null)
  const [selectedFamily, setSelectedFamily] = useState<ModelFamily>(ALL_MODELS[0]?.family ?? 'claude')
  const [tabView, setTabView] = useState<TabView>('single')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const parsedSpec = useMemo<CanonicalSkillSpec | null>(() => {
    try {
      const obj = JSON.parse(specJson)
      validateSpec(obj)
      setParseError(null)
      return obj as CanonicalSkillSpec
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'JSON 解析失败')
      return null
    }
  }, [specJson])

  const singleResult = useMemo<RenderedSkill | null>(() => {
    if (!parsedSpec) return null
    try {
      return renderSkill(parsedSpec, selectedFamily)
    } catch {
      return null
    }
  }, [parsedSpec, selectedFamily])

  const allResults = useMemo<Record<ModelFamily, RenderedSkill> | null>(() => {
    if (!parsedSpec || tabView !== 'all') return null
    try {
      return renderAll(parsedSpec)
    } catch {
      return null
    }
  }, [parsedSpec, tabView])

  const handleLoadSample = useCallback(() => {
    setSpecJson(JSON.stringify(SAMPLE_SPEC, null, 2))
  }, [])

  const handleCopy = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch { /* clipboard access denied */ }
  }, [])

  const selectedDescriptor = ALL_MODELS.find((m) => m.family === selectedFamily)

  const internationalModels = ALL_MODELS.filter((m) => m.origin === 'international')
  const chinaModels = ALL_MODELS.filter((m) => m.origin === 'china')

  const renderResult = (result: RenderedSkill, keyPrefix: string) => (
    <div className="render-result">
      <div className="result-section">
        <div className="section-header">
          <span className="section-label">System Prompt</span>
          <button
            className="btn-copy"
            onClick={() => handleCopy(result.system, `${keyPrefix}-system`)}
          >
            {copiedKey === `${keyPrefix}-system` ? <Check size={13} /> : <Copy size={13} />}
            <span>{copiedKey === `${keyPrefix}-system` ? '已复制' : '复制'}</span>
          </button>
        </div>
        <pre className="code-block">{result.system}</pre>
      </div>

      {result.user && (
        <div className="result-section">
          <div className="section-header">
            <span className="section-label">User Prompt</span>
            <button
              className="btn-copy"
              onClick={() => handleCopy(result.user!, `${keyPrefix}-user`)}
            >
              {copiedKey === `${keyPrefix}-user` ? <Check size={13} /> : <Copy size={13} />}
              <span>{copiedKey === `${keyPrefix}-user` ? '已复制' : '复制'}</span>
            </button>
          </div>
          <pre className="code-block">{result.user}</pre>
        </div>
      )}

      {result.notes.length > 0 && (
        <div className="result-section">
          <div className="section-header">
            <span className="section-label">使用提示</span>
          </div>
          <ul className="notes-list">
            {result.notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {result.artifacts && result.artifacts.length > 0 && (
        <div className="result-section">
          <div className="section-header">
            <span className="section-label">附加产物</span>
          </div>
          {result.artifacts.map((art, i) => (
            <div key={i} className="artifact-block">
              <div className="artifact-header">
                <FileText size={13} />
                <span className="artifact-filename">{art.filename}</span>
                {art.description && (
                  <span className="artifact-desc">{art.description}</span>
                )}
                <button
                  className="btn-copy"
                  onClick={() => handleCopy(art.content, `${keyPrefix}-art-${i}`)}
                >
                  {copiedKey === `${keyPrefix}-art-${i}` ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
              <pre className="code-block artifact-code">{art.content}</pre>
            </div>
          ))}
        </div>
      )}

      {result.recommendedParameters && (
        <div className="result-section">
          <div className="section-header">
            <span className="section-label">推荐参数</span>
          </div>
          <pre className="code-block params-block">
            {JSON.stringify(result.recommendedParameters, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )

  return (
    <div className="playground-root">
      <div className="playground-header">
        <div className="header-left">
          <Code2 size={18} />
          <h2>Adapters Playground</h2>
        </div>
        {onClose && (
          <button className="btn-close" onClick={onClose}>
            <X size={16} />
          </button>
        )}
      </div>

      <div className="playground-body">
        {/* Left: Spec Editor */}
        <div className="panel panel-editor">
          <div className="panel-toolbar">
            <span className="panel-title">Canonical Skill Spec</span>
            <button className="btn-sample" onClick={handleLoadSample}>
              加载示例
            </button>
          </div>
          <div className="editor-status">
            {parseError ? (
              <span className="status-error">
                <AlertCircle size={12} />
                {parseError}
              </span>
            ) : (
              <span className="status-ok">
                <Check size={12} />
                Spec 有效
              </span>
            )}
          </div>
          <textarea
            className="spec-editor"
            value={specJson}
            onChange={(e) => setSpecJson(e.target.value)}
            spellCheck={false}
          />
        </div>

        {/* Right: Render Results */}
        <div className="panel panel-result">
          <div className="panel-toolbar">
            <div className="view-tabs">
              <button
                className={`view-tab ${tabView === 'single' ? 'active' : ''}`}
                onClick={() => setTabView('single')}
              >
                单模型
              </button>
              <button
                className={`view-tab ${tabView === 'all' ? 'active' : ''}`}
                onClick={() => setTabView('all')}
              >
                <Play size={12} />
                渲染全部
              </button>
            </div>

            {tabView === 'single' && (
              <div className="model-selector" ref={dropdownRef}>
                <button
                  className="model-selector-btn"
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                >
                  <span className={`origin-dot ${selectedDescriptor?.origin ?? 'international'}`} />
                  <span>{selectedDescriptor?.label ?? selectedFamily}</span>
                  <ChevronDown size={14} />
                </button>
                {showModelDropdown && (
                  <div className="model-dropdown">
                    {internationalModels.length > 0 && (
                      <div className="model-group">
                        <div className="model-group-label">
                          <Globe size={11} />
                          国际模型
                        </div>
                        {internationalModels.map((m) => (
                          <button
                            key={m.family}
                            className={`model-option ${m.family === selectedFamily ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedFamily(m.family)
                              setShowModelDropdown(false)
                            }}
                          >
                            <span className="origin-dot international" />
                            <span className="model-option-label">{m.label}</span>
                            {m.reasoning && <span className="badge-reasoning">推理</span>}
                            <span className="model-option-format">{m.preferredFormat}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {chinaModels.length > 0 && (
                      <div className="model-group">
                        <div className="model-group-label">
                          <span className="flag-cn">🇨🇳</span>
                          国产模型
                        </div>
                        {chinaModels.map((m) => (
                          <button
                            key={m.family}
                            className={`model-option ${m.family === selectedFamily ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedFamily(m.family)
                              setShowModelDropdown(false)
                            }}
                          >
                            <span className="origin-dot china" />
                            <span className="model-option-label">{m.label}</span>
                            {m.reasoning && <span className="badge-reasoning">推理</span>}
                            <span className="model-option-format">{m.preferredFormat}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="result-body">
            {!parsedSpec ? (
              <div className="empty-state">
                <Code2 size={32} strokeWidth={1.2} />
                <p>请在左侧输入有效的 Canonical Skill Spec</p>
              </div>
            ) : tabView === 'single' && singleResult ? (
              renderResult(singleResult, selectedFamily)
            ) : tabView === 'all' && allResults ? (
              <div className="all-results">
                {ALL_MODELS.map((m) => {
                  const r = allResults[m.family]
                  if (!r) return null
                  return (
                    <div key={m.family} className="all-result-item">
                      <div className="all-result-header">
                        <span className={`origin-dot ${m.origin}`} />
                        <span className="all-result-label">{m.label}</span>
                        <span className="all-result-format">{m.preferredFormat}</span>
                        {m.reasoning && <span className="badge-reasoning">推理</span>}
                      </div>
                      {renderResult(r, m.family)}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="empty-state">
                <Code2 size={32} strokeWidth={1.2} />
                <p>等待渲染…</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .playground-root {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
          background: var(--background);
          color: var(--foreground);
        }

        .playground-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
          flex-shrink: 0;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-primary);
        }

        .header-left h2 {
          margin: 0;
          font-size: 1rem;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .btn-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border: none;
          border-radius: var(--radius-md);
          background: transparent;
          color: var(--text-tertiary);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-close:hover {
          background: var(--bg-item-hover);
          color: var(--text-primary);
        }

        .playground-body {
          display: flex;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }

        .panel {
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .panel-editor {
          width: 38%;
          min-width: 320px;
          border-right: 1px solid var(--border-color);
        }

        .panel-result {
          flex: 1;
          min-width: 0;
        }

        .panel-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          border-bottom: 1px solid var(--border-color);
          flex-shrink: 0;
          gap: 8px;
        }

        .panel-title {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .btn-sample {
          padding: 4px 10px;
          font-size: 0.72rem;
          font-weight: 600;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          background: var(--bg-glass);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-sample:hover {
          background: var(--bg-item-hover);
          color: var(--text-primary);
          border-color: var(--border-focus);
        }

        .editor-status {
          padding: 4px 12px;
          font-size: 0.72rem;
          border-bottom: 1px solid var(--border-color);
          flex-shrink: 0;
        }

        .status-ok {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: #4ade80;
        }

        .status-error {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: #f87171;
          word-break: break-all;
        }

        .spec-editor {
          flex: 1;
          width: 100%;
          padding: 12px;
          border: none;
          background: transparent;
          color: var(--text-primary);
          font-family: 'SF Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 0.8rem;
          line-height: 1.6;
          resize: none;
          outline: none;
          min-height: 0;
          overflow: auto;
        }

        .spec-editor::placeholder {
          color: var(--text-tertiary);
        }

        /* View tabs */
        .view-tabs {
          display: flex;
          gap: 2px;
          background: rgba(255, 255, 255, 0.04);
          border-radius: var(--radius-md);
          padding: 2px;
        }

        .view-tab {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          font-size: 0.72rem;
          font-weight: 600;
          border: none;
          border-radius: calc(var(--radius-md) - 1px);
          background: transparent;
          color: var(--text-tertiary);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .view-tab:hover {
          color: var(--text-secondary);
        }

        .view-tab.active {
          background: var(--accent-color);
          color: #fff;
        }

        /* Model selector */
        .model-selector {
          position: relative;
        }

        .model-selector-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          font-size: 0.78rem;
          font-weight: 500;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          background: var(--bg-glass);
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .model-selector-btn:hover {
          border-color: var(--border-focus);
          background: var(--bg-item-hover);
        }

        .origin-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .origin-dot.international {
          background: #818cf8;
        }

        .origin-dot.china {
          background: #f97316;
        }

        .model-dropdown {
          position: absolute;
          top: calc(100% + 4px);
          right: 0;
          z-index: 50;
          min-width: 260px;
          max-height: 400px;
          overflow-y: auto;
          background: var(--bg-elevated, var(--background));
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg, 8px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
          padding: 4px;
        }

        .model-group {
          padding: 4px 0;
        }

        .model-group + .model-group {
          border-top: 1px solid var(--border-color);
          margin-top: 4px;
          padding-top: 8px;
        }

        .model-group-label {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          font-size: 0.68rem;
          font-weight: 600;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .flag-cn {
          font-size: 0.72rem;
        }

        .model-option {
          display: flex;
          align-items: center;
          gap: 6px;
          width: 100%;
          padding: 6px 10px;
          border: none;
          border-radius: calc(var(--radius-md) - 1px);
          background: transparent;
          color: var(--text-secondary);
          font-size: 0.78rem;
          cursor: pointer;
          transition: all 0.12s ease;
          text-align: left;
        }

        .model-option:hover {
          background: var(--bg-item-hover);
          color: var(--text-primary);
        }

        .model-option.selected {
          background: rgba(99, 102, 241, 0.12);
          color: #a5b4fc;
        }

        .model-option-label {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .model-option-format {
          font-size: 0.65rem;
          color: var(--text-tertiary);
          padding: 1px 5px;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.05);
          flex-shrink: 0;
        }

        .badge-reasoning {
          font-size: 0.6rem;
          font-weight: 700;
          color: #fbbf24;
          background: rgba(251, 191, 36, 0.1);
          border: 1px solid rgba(251, 191, 36, 0.2);
          padding: 0 4px;
          border-radius: 3px;
          flex-shrink: 0;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        /* Result body */
        .result-body {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          min-height: 0;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 12px;
          color: var(--text-tertiary);
          font-size: 0.85rem;
        }

        .empty-state p {
          margin: 0;
        }

        /* Render result blocks */
        .render-result {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .result-section {
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          overflow: hidden;
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 10px;
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid var(--border-color);
        }

        .section-label {
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .btn-copy {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: transparent;
          color: var(--text-tertiary);
          font-size: 0.68rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.12s ease;
        }

        .btn-copy:hover {
          background: var(--bg-item-hover);
          color: var(--text-primary);
          border-color: var(--border-focus);
        }

        .code-block {
          margin: 0;
          padding: 10px 12px;
          font-family: 'SF Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 0.76rem;
          line-height: 1.6;
          color: var(--text-secondary);
          white-space: pre-wrap;
          word-break: break-word;
          overflow-x: auto;
          max-height: 400px;
          overflow-y: auto;
        }

        .params-block {
          max-height: 120px;
        }

        .notes-list {
          margin: 0;
          padding: 8px 12px 8px 28px;
          font-size: 0.78rem;
          color: var(--text-secondary);
          line-height: 1.6;
        }

        .notes-list li + li {
          margin-top: 4px;
        }

        /* Artifacts */
        .artifact-block {
          border-top: 1px solid var(--border-color);
        }

        .artifact-block:first-child {
          border-top: none;
        }

        .artifact-header {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid var(--border-color);
          color: var(--text-tertiary);
          font-size: 0.72rem;
        }

        .artifact-filename {
          font-weight: 600;
          color: var(--text-secondary);
          font-family: 'SF Mono', ui-monospace, monospace;
        }

        .artifact-desc {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--text-tertiary);
        }

        .artifact-code {
          max-height: 300px;
        }

        /* All results view */
        .all-results {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .all-result-item {
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg, 8px);
          overflow: hidden;
        }

        .all-result-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid var(--border-color);
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .all-result-label {
          flex: 1;
        }

        .all-result-format {
          font-size: 0.65rem;
          color: var(--text-tertiary);
          padding: 1px 5px;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.05);
        }

        .all-result-item .render-result {
          padding: 12px;
        }
      `}</style>
    </div>
  )
}
