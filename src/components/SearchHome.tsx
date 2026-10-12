"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  FileText,
  Sparkles,
  ArrowRight,
  Loader2,
  Wand2,
  X,
  Check,
  ChevronDown,
  RefreshCw,
  BookOpen,
  Code2,
  PenLine,
  MessageSquare,
  BarChart3,
  Globe,
  Lightbulb,
  Bot,
} from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { isMissingApiKeyError } from "@/lib/aiErrors";
import { buildPromptRecordFromGoal, buildSkillMdFromGoal, buildSkillRecordFromGoal } from '@/lib/intent-prompt-heuristics';

interface GeneratedResult {
  type: "prompt" | "skill";
  title: string;
  description: string;
  category: string;
  tags: string[];
  content: string;
}

interface SearchHomeProps {
  onNavigate: (type: "prompt" | "skill", id: string) => void;
  onSavePrompt?: (data: { title: string; description: string; category: string; tags: string[]; content: string }) => Promise<void>;
  onSaveSkill?: (data: { name: string; description: string; category: string; tags: string[]; instructions: string }) => Promise<void>;
  /** 未配置 API Key 时打开设置中的 AI 分区 */
  onOpenAiSettings?: () => void;
}

const QUICK_ICONS = [PenLine, Code2, MessageSquare, BarChart3, Globe, Lightbulb, BookOpen, Bot];

type GenerateType = "auto" | "prompt" | "skill";

export default function SearchHome({
  onNavigate: _onNavigate,
  onSavePrompt,
  onSaveSkill,
  onOpenAiSettings,
}: SearchHomeProps) {
  const { t, locale } = useLocale();
  const g = t.generate;

  const [idea, setIdea] = useState("");
  const [generateType, setGenerateType] = useState<GenerateType>("auto");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 120);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (typeMenuRef.current && !typeMenuRef.current.contains(e.target as Node)) {
        setShowTypeMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [idea]);

  const handleGenerate = useCallback(async () => {
    if (!idea.trim() || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    setResult(null);
    setSavedSuccess(false);

    try {
      const electronAPI = (window as unknown as { electronAPI?: { invoke: (channel: string, ...args: unknown[]) => Promise<unknown> } }).electronAPI;
      if (!electronAPI) throw new Error(g.notAvailable);

      const res = await electronAPI.invoke("ai:generate", {
        idea: idea.trim(),
        type: generateType,
        language: g.language,
      }) as { success: boolean; data?: GeneratedResult; error?: string };

      if (!res.success) throw new Error(res.error || g.errorTitle);
      setResult(res.data!);
    } catch (err) {
      setError(err instanceof Error ? err.message : g.errorTitle);
    } finally {
      setIsGenerating(false);
    }
  }, [idea, generateType, isGenerating, g]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const handleQuickIdea = (item: typeof g.quickIdeas[0]) => {
    setIdea(item.idea);
    setGenerateType(item.type as GenerateType);
    setResult(null);
    setError(null);
    setSavedSuccess(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleSave = useCallback(async () => {
    if (!result || isSaving) return;
    setIsSaving(true);
    try {
      if (result.type === "prompt" && onSavePrompt) {
        await onSavePrompt({
          title: result.title,
          description: result.description,
          category: result.category,
          tags: result.tags,
          content: result.content,
        });
      } else if (result.type === "skill" && onSaveSkill) {
        await onSaveSkill({
          name: result.title,
          description: result.description,
          category: result.category,
          tags: result.tags,
          instructions: result.content,
        });
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : g.errorTitle);
    } finally {
      setIsSaving(false);
    }
  }, [result, isSaving, onSavePrompt, onSaveSkill, g.errorTitle]);

  const handleRegenerate = () => {
    setResult(null);
    setError(null);
    setSavedSuccess(false);
    handleGenerate();
  };

  const handleLocalGeneratePrompt = () => {
    const goal = idea.trim();
    if (!goal) return;
    setError(null);
    setSavedSuccess(false);
    const record = buildPromptRecordFromGoal(goal, locale);
    setResult({
      type: "prompt",
      title: record.name,
      description: record.description,
      category: record.category,
      tags: record.tags,
      content: record.content,
    });
  };

  const handleLocalGenerateSkill = () => {
    const goal = idea.trim();
    if (!goal) return;
    setError(null);
    setSavedSuccess(false);
    const record = buildSkillRecordFromGoal(goal, locale);
    setResult({
      type: "skill",
      title: record.name,
      description: record.description,
      category: "",
      tags: record.tags,
      content: buildSkillMdFromGoal(goal, locale, record.name, record.description),
    });
  };

  const typeMenuOptions: { value: GenerateType; label: string }[] = [
    { value: "auto",   label: g.typeAuto },
    { value: "prompt", label: g.typePrompt },
    { value: "skill",  label: g.typeSkill },
  ];

  const currentTypeLabel = typeMenuOptions.find(o => o.value === generateType)?.label ?? g.typeAuto;

  const TYPE_COLORS = {
    prompt: { color: "#818cf8", bg: "rgba(99,102,241,0.1)", border: "rgba(99,102,241,0.25)" },
    skill:  { color: "#a78bfa", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.25)" },
  };

  const missingApiKey = error ? isMissingApiKeyError(error) : false;
  const errorDisplay =
    missingApiKey ? g.errorMissingApiKey : error;

  return (
    <div className="sh-root">
      {/* Background */}
      <div className="sh-bg" aria-hidden>
        <div className="sh-noise" />
        <div className="sh-orb orb-a" />
        <div className="sh-orb orb-b" />
        <div className="sh-grid" />
      </div>

      <div className="sh-stage">
        {/* Hero */}
        <div className="sh-hero">
          <div className="sh-hero-badge">
            <Wand2 size={12} />
            <span>{g.badge}</span>
          </div>
          <h1 className="sh-title">{g.title}</h1>
          <p className="sh-sub">{g.subtitle}</p>
        </div>

        {/* Input area */}
        <div className="sh-input-card">
          <textarea
            ref={textareaRef}
            className="sh-textarea"
            placeholder={g.placeholder}
            value={idea}
            onChange={(e) => { setIdea(e.target.value); setError(null); }}
            onKeyDown={handleKeyDown}
            rows={3}
          />
          <div className="sh-input-footer">
            {/* Type selector */}
            <div className="sh-type-selector" ref={typeMenuRef}>
              <button
                className="sh-type-btn"
                onClick={() => setShowTypeMenu(v => !v)}
                type="button"
              >
                {generateType === "prompt" && <FileText size={13} />}
                {generateType === "skill"  && <Sparkles size={13} />}
                {generateType === "auto"   && <Wand2 size={13} />}
                <span>{currentTypeLabel}</span>
                <ChevronDown size={11} style={{ opacity: 0.6 }} />
              </button>
              {showTypeMenu && (
                <div className="sh-type-menu">
                  {typeMenuOptions.map(opt => (
                    <button
                      key={opt.value}
                      className={`sh-type-option ${generateType === opt.value ? "active" : ""}`}
                      onClick={() => { setGenerateType(opt.value); setShowTypeMenu(false); }}
                      type="button"
                    >
                      {opt.value === "prompt" && <FileText size={12} />}
                      {opt.value === "skill"  && <Sparkles size={12} />}
                      {opt.value === "auto"   && <Wand2 size={12} />}
                      {opt.label}
                      {generateType === opt.value && <Check size={11} className="sh-check" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="sh-footer-right">
              <span className="sh-kbd-hint">
                {g.kbdHint.split("↵").map((part, i) =>
                  i === 0
                    ? <span key={i}><kbd>{part}</kbd><kbd>↵</kbd></span>
                    : <span key={i}>{part}</span>
                )}
              </span>
              <button
                className="sh-generate-btn"
                onClick={handleGenerate}
                disabled={!idea.trim() || isGenerating}
                type="button"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={14} className="sh-spin" />
                    <span>{g.btnGenerating}</span>
                  </>
                ) : (
                  <>
                    <Wand2 size={14} />
                    <span>{g.btnGenerate}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Local generate buttons */}
        {idea.trim() && !result && !isGenerating && (
          <div className="sh-local-gen">
            <button
              onClick={handleLocalGeneratePrompt}
              className="sh-local-gen-btn sh-local-gen-prompt"
              type="button"
            >
              <Lightbulb size={13} />
              <span>{locale === 'zh' ? '智能生成提示词' : 'Smart Generate Prompt'}</span>
            </button>
            <button
              onClick={handleLocalGenerateSkill}
              className="sh-local-gen-btn sh-local-gen-skill"
              type="button"
            >
              <Sparkles size={13} />
              <span>{locale === 'zh' ? '智能生成技能' : 'Smart Generate Skill'}</span>
            </button>
            <span className="sh-local-gen-hint">
              {locale === 'zh' ? '无需 API，本地即时生成' : 'No API needed, instant local generation'}
            </span>
          </div>
        )}

        {/* Quick ideas */}
        {!result && !isGenerating && !error && (
          <div className="sh-quick-section">
            <p className="sh-quick-label">{g.quickLabel}</p>
            <div className="sh-quick-grid">
              {g.quickIdeas.map((item, idx) => {
                const Icon = QUICK_ICONS[idx % QUICK_ICONS.length];
                return (
                  <button
                    key={item.label}
                    className="sh-quick-item"
                    onClick={() => handleQuickIdea(item)}
                    type="button"
                  >
                    <span className="sh-quick-icon"><Icon size={14} /></span>
                    <span className="sh-quick-label-text">{item.label}</span>
                    <ArrowRight size={11} className="sh-quick-arrow" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Generating */}
        {isGenerating && (
          <div className="sh-generating">
            <div className="sh-gen-dots">
              <span /><span /><span />
            </div>
            <p>{g.generatingMsg}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="sh-error">
            <X size={15} className="sh-error-icon" />
            <div className="sh-error-body">
              <p className="sh-error-title">{g.errorTitle}</p>
              <p className="sh-error-msg">{errorDisplay}</p>
            </div>
            <div className="sh-error-actions">
              {missingApiKey && onOpenAiSettings && (
                <button
                  className="sh-error-open-settings"
                  onClick={onOpenAiSettings}
                  type="button"
                >
                  {g.btnOpenAiSettings}
                </button>
              )}
              <button className="sh-error-retry" onClick={handleGenerate} type="button">
                {g.errorRetry}
              </button>
            </div>
          </div>
        )}

        {/* Result */}
        {result && !isGenerating && (
          <div className="sh-result-card">
            <div className="sh-result-header">
              <div className="sh-result-type" style={{
                color: TYPE_COLORS[result.type].color,
                background: TYPE_COLORS[result.type].bg,
                border: `1px solid ${TYPE_COLORS[result.type].border}`,
              }}>
                {result.type === "prompt" ? <FileText size={11} /> : <Sparkles size={11} />}
                <span>{g.typeLabels[result.type]}</span>
              </div>
              <button className="sh-result-regen" onClick={handleRegenerate} type="button">
                <RefreshCw size={12} />
                <span>{g.btnRegen}</span>
              </button>
            </div>

            <h2 className="sh-result-title">{result.title}</h2>
            {result.description && (
              <p className="sh-result-desc">{result.description}</p>
            )}
            <div className="sh-result-meta">
              {result.category && (
                <span className="sh-result-category">{result.category}</span>
              )}
              {result.tags?.slice(0, 4).map((tag, i) => (
                <span key={i} className="sh-result-tag">{tag}</span>
              ))}
            </div>

            <div className="sh-result-content">
              <div className="sh-content-label">
                {result.type === "prompt" ? g.contentLabelPrompt : g.contentLabelSkill}
              </div>
              <pre className="sh-content-pre">{result.content}</pre>
            </div>

            <div className="sh-result-actions">
              <button
                className={`sh-save-btn ${savedSuccess ? "sh-save-btn--success" : ""}`}
                onClick={handleSave}
                disabled={isSaving || savedSuccess}
                type="button"
              >
                {isSaving ? (
                  <><Loader2 size={13} className="sh-spin" /><span>{g.btnSaving}</span></>
                ) : savedSuccess ? (
                  <><Check size={13} /><span>{g.btnSaved}</span></>
                ) : (
                  <><Check size={13} /><span>{result.type === "prompt" ? g.btnSavePrompt : g.btnSaveSkill}</span></>
                )}
              </button>
              <button className="sh-discard-btn" onClick={() => { setResult(null); setIdea(""); }} type="button">
                {g.btnDiscard}
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        /* ── Root ── */
        .sh-root {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 6vh 1.5rem 4rem;
        }

        /* ── Background ── */
        .sh-bg {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }

        .sh-noise {
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
          background-size: 200px 200px;
          opacity: 0.4;
          mix-blend-mode: overlay;
        }

        .sh-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
        }

        .orb-a {
          width: 500px; height: 500px;
          top: -180px; right: -80px;
          background: radial-gradient(circle, rgba(99,102,241,0.09) 0%, transparent 70%);
          animation: orbDrift 16s ease-in-out infinite;
        }

        .orb-b {
          width: 380px; height: 380px;
          bottom: -60px; left: -40px;
          background: radial-gradient(circle, rgba(167,139,250,0.07) 0%, transparent 70%);
          animation: orbDrift 20s ease-in-out infinite reverse;
        }

        .sh-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px);
          background-size: 44px 44px;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 30%, #000 10%, transparent 100%);
        }

        /* ── Stage ── */
        .sh-stage {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 720px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.75rem;
        }

        /* ── Hero ── */
        .sh-hero {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.7rem;
          animation: fadeUp 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }

        .sh-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 12px;
          border-radius: 9999px;
          background: rgba(99,102,241,0.08);
          border: 1px solid rgba(99,102,241,0.2);
          color: #818cf8;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.04em;
        }

        .sh-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(1.8rem, 4vw, 2.6rem);
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1.1;
          color: var(--text-primary);
          margin: 0;
        }

        .sh-sub {
          font-size: 0.82rem;
          color: var(--text-tertiary);
          letter-spacing: 0.01em;
          max-width: 480px;
          line-height: 1.6;
          margin: 0;
        }

        /* ── Input Card ── */
        .sh-input-card {
          width: 100%;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 18px;
          box-shadow: 0 4px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04);
          transition: border-color 0.18s, box-shadow 0.18s;
          animation: fadeUp 0.55s 0.06s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          overflow: hidden;
        }

        .sh-input-card:focus-within {
          border-color: rgba(99,102,241,0.4);
          box-shadow: 0 4px 32px rgba(0,0,0,0.3), 0 0 0 3px rgba(99,102,241,0.08), inset 0 1px 0 rgba(255,255,255,0.04);
        }

        .sh-textarea {
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          resize: none;
          padding: 20px 22px 8px;
          font-family: 'DM Sans', 'Inter', sans-serif;
          font-size: 0.95rem;
          font-weight: 400;
          color: var(--text-primary);
          line-height: 1.65;
          caret-color: #818cf8;
          min-height: 80px;
          max-height: 200px;
          overflow-y: auto;
          letter-spacing: -0.01em;
        }

        .sh-textarea::placeholder {
          color: var(--text-tertiary);
          opacity: 0.7;
        }

        .sh-input-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px 14px;
          gap: 10px;
        }

        /* Type selector */
        .sh-type-selector { position: relative; }

        .sh-type-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 10px;
          border-radius: 8px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: var(--text-secondary);
          font-size: 0.78rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }

        .sh-type-btn:hover {
          background: rgba(255,255,255,0.07);
          border-color: rgba(255,255,255,0.14);
          color: var(--text-primary);
        }

        .sh-type-menu {
          position: absolute;
          bottom: calc(100% + 6px);
          left: 0;
          min-width: 150px;
          background: var(--bg-elevated, rgba(18,18,24,0.96));
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          box-shadow: 0 16px 48px rgba(0,0,0,0.45);
          padding: 5px;
          z-index: 200;
          animation: fadeUp 0.14s ease both;
        }

        .sh-type-option {
          display: flex;
          align-items: center;
          gap: 7px;
          width: 100%;
          padding: 8px 10px;
          border: none;
          background: transparent;
          border-radius: 7px;
          color: var(--text-secondary);
          font-size: 0.8rem;
          cursor: pointer;
          transition: background 0.12s;
          text-align: left;
        }

        .sh-type-option:hover { background: rgba(255,255,255,0.05); color: var(--text-primary); }
        .sh-type-option.active { background: rgba(99,102,241,0.12); color: #818cf8; }

        .sh-check { margin-left: auto; }

        .sh-footer-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .sh-kbd-hint {
          display: flex;
          align-items: center;
          gap: 2px;
          color: var(--text-tertiary);
          font-size: 0.7rem;
          opacity: 0.7;
        }

        .sh-kbd-hint kbd {
          font-family: inherit;
          font-size: 0.65rem;
          padding: 1px 4px;
          border-radius: 4px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: var(--text-tertiary);
        }

        .sh-generate-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 18px;
          border-radius: 10px;
          background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%);
          border: none;
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.83rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 12px rgba(99,102,241,0.35);
        }

        .sh-generate-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #4f52c9 0%, #6366f1 100%);
          box-shadow: 0 4px 20px rgba(99,102,241,0.5);
          transform: translateY(-1px);
        }

        .sh-generate-btn:active:not(:disabled) { transform: translateY(0); }
        .sh-generate-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        .sh-spin { animation: spin 0.8s linear infinite; }

        /* ── Quick Ideas ── */
        .sh-quick-section {
          width: 100%;
          animation: fadeUp 0.5s 0.12s ease both;
        }

        .sh-quick-label {
          font-size: 0.68rem;
          font-weight: 700;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 0.7rem;
        }

        .sh-quick-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.5rem;
        }

        .sh-quick-item {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 10px 12px;
          border-radius: 10px;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.06);
          color: var(--text-secondary);
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.18s;
          text-align: left;
        }

        .sh-quick-item:hover {
          background: rgba(255,255,255,0.05);
          border-color: rgba(99,102,241,0.25);
          color: var(--text-primary);
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(0,0,0,0.2);
        }

        .sh-quick-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 7px;
          background: rgba(99,102,241,0.1);
          color: #818cf8;
          flex-shrink: 0;
        }

        .sh-quick-label-text {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sh-quick-arrow {
          color: var(--text-tertiary);
          opacity: 0;
          transition: opacity 0.14s, transform 0.14s;
          flex-shrink: 0;
        }

        .sh-quick-item:hover .sh-quick-arrow {
          opacity: 1;
          transform: translateX(2px);
        }

        /* ── Local Generate ── */
        .sh-local-gen {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          animation: fadeUp 0.3s ease both;
        }

        .sh-local-gen-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 7px 14px;
          border-radius: 9px;
          border: 1px solid transparent;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.18s;
        }

        .sh-local-gen-prompt {
          background: rgba(245,158,11,0.08);
          border-color: rgba(245,158,11,0.2);
          color: #fbbf24;
        }

        .sh-local-gen-prompt:hover {
          background: rgba(245,158,11,0.15);
          border-color: rgba(245,158,11,0.35);
          transform: translateY(-1px);
          box-shadow: 0 3px 12px rgba(245,158,11,0.15);
        }

        .sh-local-gen-skill {
          background: rgba(6,182,212,0.08);
          border-color: rgba(6,182,212,0.2);
          color: #22d3ee;
        }

        .sh-local-gen-skill:hover {
          background: rgba(6,182,212,0.15);
          border-color: rgba(6,182,212,0.35);
          transform: translateY(-1px);
          box-shadow: 0 3px 12px rgba(6,182,212,0.15);
        }

        .sh-local-gen-hint {
          margin-left: auto;
          font-size: 0.68rem;
          color: var(--text-tertiary);
          opacity: 0.6;
        }

        /* ── Generating ── */
        .sh-generating {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 2rem 0;
          color: var(--text-tertiary);
          font-size: 0.83rem;
          animation: fadeUp 0.3s ease both;
        }

        .sh-gen-dots { display: flex; gap: 6px; }
        .sh-gen-dots span {
          width: 6px; height: 6px; border-radius: 50%;
          background: #818cf8;
          animation: dotPulse 1.2s ease-in-out infinite;
        }
        .sh-gen-dots span:nth-child(2) { animation-delay: 0.2s; }
        .sh-gen-dots span:nth-child(3) { animation-delay: 0.4s; }

        /* ── Error ── */
        .sh-error {
          width: 100%;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 12px;
          background: rgba(239,68,68,0.06);
          border: 1px solid rgba(239,68,68,0.18);
          animation: fadeUp 0.3s ease both;
        }

        .sh-error-icon { color: #f87171; flex-shrink: 0; margin-top: 1px; }

        .sh-error-body {
          flex: 1;
          min-width: 0;
        }

        .sh-error-title {
          font-size: 0.83rem;
          font-weight: 600;
          color: #fca5a5;
          margin-bottom: 2px;
        }

        .sh-error-msg {
          font-size: 0.77rem;
          color: var(--text-tertiary);
        }

        .sh-error-actions {
          margin-left: auto;
          flex-shrink: 0;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
        }

        .sh-error-open-settings {
          padding: 5px 12px;
          border-radius: 7px;
          background: rgba(99,102,241,0.12);
          border: 1px solid rgba(99,102,241,0.28);
          color: #a5b4fc;
          font-size: 0.77rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.14s;
        }

        .sh-error-open-settings:hover {
          background: rgba(99,102,241,0.2);
        }

        .sh-error-retry {
          padding: 5px 12px;
          border-radius: 7px;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.2);
          color: #fca5a5;
          font-size: 0.77rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.14s;
        }

        .sh-error-retry:hover { background: rgba(239,68,68,0.2); }

        /* ── Result Card ── */
        .sh-result-card {
          width: 100%;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 20px;
          animation: fadeUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          box-shadow: 0 8px 40px rgba(0,0,0,0.25);
        }

        .sh-result-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .sh-result-type {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 9px;
          border-radius: 9999px;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.04em;
        }

        .sh-result-regen {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 5px 10px;
          border-radius: 7px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: var(--text-tertiary);
          font-size: 0.74rem;
          cursor: pointer;
          transition: all 0.14s;
        }

        .sh-result-regen:hover {
          background: rgba(255,255,255,0.07);
          color: var(--text-secondary);
        }

        .sh-result-title {
          font-family: 'DM Sans', sans-serif;
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.025em;
          margin: 0 0 6px;
        }

        .sh-result-desc {
          font-size: 0.82rem;
          color: var(--text-secondary);
          line-height: 1.55;
          margin: 0 0 10px;
        }

        .sh-result-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-bottom: 14px;
        }

        .sh-result-category {
          padding: 2px 8px;
          border-radius: 9999px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          font-size: 0.68rem;
          font-weight: 600;
          color: var(--text-secondary);
          letter-spacing: 0.03em;
        }

        .sh-result-tag {
          padding: 2px 8px;
          border-radius: 9999px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          font-size: 0.68rem;
          color: var(--text-tertiary);
        }

        .sh-result-content {
          background: rgba(0,0,0,0.25);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          padding: 14px 16px;
          margin-bottom: 14px;
        }

        .sh-content-label {
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 8px;
        }

        .sh-content-pre {
          margin: 0;
          font-family: 'DM Mono', 'Fira Code', 'Consolas', monospace;
          font-size: 0.8rem;
          line-height: 1.65;
          color: var(--text-secondary);
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 280px;
          overflow-y: auto;
        }

        .sh-result-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .sh-save-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 20px;
          border-radius: 10px;
          background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%);
          border: none;
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.83rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 12px rgba(99,102,241,0.35);
        }

        .sh-save-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #4f52c9 0%, #6366f1 100%);
          box-shadow: 0 4px 18px rgba(99,102,241,0.5);
        }

        .sh-save-btn--success {
          background: linear-gradient(135deg, #059669 0%, #10b981 100%) !important;
          box-shadow: 0 2px 12px rgba(5,150,105,0.35) !important;
        }

        .sh-save-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        .sh-discard-btn {
          padding: 9px 16px;
          border-radius: 10px;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.08);
          color: var(--text-tertiary);
          font-size: 0.83rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }

        .sh-discard-btn:hover {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.12);
          color: var(--text-secondary);
        }

        /* ── Animations ── */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes orbDrift {
          0%, 100% { transform: translate(0,0) scale(1); }
          40%       { transform: translate(20px,-20px) scale(1.04); }
          70%       { transform: translate(-14px,10px) scale(0.97); }
        }

        @keyframes dotPulse {
          0%, 80%, 100% { transform: scale(0.5); opacity: 0.3; }
          40%           { transform: scale(1); opacity: 1; }
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Light mode ── */
        @media (prefers-color-scheme: light) {
          .sh-input-card {
            background: rgba(255,255,255,0.85);
            border-color: rgba(0,0,0,0.08);
            box-shadow: 0 4px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9);
          }
          .sh-result-card {
            background: rgba(255,255,255,0.75);
            border-color: rgba(0,0,0,0.07);
          }
          .sh-result-content {
            background: rgba(0,0,0,0.03);
            border-color: rgba(0,0,0,0.07);
          }
          .sh-quick-item {
            background: rgba(255,255,255,0.7);
            border-color: rgba(0,0,0,0.06);
          }
        }

        /* ── Responsive ── */
        @media (max-width: 600px) {
          .sh-quick-grid { grid-template-columns: repeat(2, 1fr); }
          .sh-title { font-size: 1.6rem; }
        }
      `}</style>
    </div>
  );
}
