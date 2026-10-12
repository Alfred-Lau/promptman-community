"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Search, FileText, Sparkles, Bot, ArrowRight, Command } from "lucide-react";
import { promptAPI, agentSkillAPI, subAgentAPI } from "@/lib/seekdb/api";

// ===== 类型 =====

interface SearchResult {
  type: "prompt" | "skill" | "subagent";
  id: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}

type SlashCommand = "p" | "s" | "a" | null;

// ===== 常量 =====

const TYPE_CONFIG = {
  prompt:   { icon: FileText, label: "Prompt",   color: "var(--sl-type-prompt)" },
  skill:    { icon: Sparkles, label: "Skill",    color: "var(--sl-type-skill)" },
  subagent: { icon: Bot,      label: "SubAgent", color: "var(--sl-type-agent)" },
} as const;

const SLASH_COMMANDS = [
  { cmd: "/p", label: "搜索 Prompt",   type: "prompt"   as const, icon: FileText, color: "var(--sl-type-prompt)" },
  { cmd: "/s", label: "搜索 Skill",    type: "skill"    as const, icon: Sparkles, color: "var(--sl-type-skill)" },
  { cmd: "/a", label: "搜索 SubAgent", type: "subagent" as const, icon: Bot,      color: "var(--sl-type-agent)" },
];

// ===== 工具函数 =====

/** 解析输入，返回 { command, searchText } */
function parseInput(raw: string): { command: SlashCommand; searchText: string } {
  const trimmed = raw.trimStart();
  const match = trimmed.match(/^\/([psa])\s+(.*)/);
  if (match) {
    return { command: match[1] as SlashCommand, searchText: match[2] };
  }
  return { command: null, searchText: raw };
}

// ===== 组件 =====

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { command, searchText } = useMemo(() => parseInput(query), [query]);

  // 检测是否正在输入斜杠命令（只输入了 / 或 /x 还没有空格）
  const isTypingSlash = useMemo(() => {
    const t = query.trimStart();
    return t === "/" || /^\/[psa]?$/.test(t);
  }, [query]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // ===== 窗口高度 =====
  const resizeWindow = useCallback((count: number, hasContent: boolean) => {
    try {
      const api = (window as any).electronAPI;
      if (!api) return;
      const INPUT_H = 56;
      if (!hasContent || count === 0) { api.invoke("search:resize", INPUT_H); return; }
      const ITEM_H = 52;
      const PAD = 8;
      const FOOTER_H = 32;
      const GAP = 6;
      const visible = Math.min(count, 7);
      const h = INPUT_H + GAP + PAD + visible * ITEM_H + PAD + FOOTER_H;
      api.invoke("search:resize", Math.min(h, 520));
    } catch { /* */ }
  }, []);

  // ===== 搜索逻辑 =====
  useEffect(() => {
    // 正在打斜杠命令，显示命令提示
    if (isTypingSlash) {
      setResults([]);
      // 命令提示的高度
      const hintCount = SLASH_COMMANDS.length;
      resizeWindow(hintCount, true);
      return;
    }

    const doSearch = async () => {
      if (!searchText.trim()) {
        setResults([]);
        resizeWindow(0, false);
        return;
      }
      setLoading(true);
      try {
        const opts = {
          queryTexts: [searchText],
          nResults: 10,
          include: ["documents", "metadatas", "distances"] as ("documents" | "metadatas" | "distances")[],
        };

        const parse = (res: any, type: SearchResult["type"]): SearchResult[] => {
          const ids = res.ids?.[0] || [];
          const docs = res.documents?.[0] || [];
          const metas = res.metadatas?.[0] || [];
          return ids.map((id: string, i: number) => ({
            type, id,
            title: (type === "prompt" ? metas[i]?.title : metas[i]?.name) || `${type} ${id.slice(0, 8)}`,
            content: docs[i] || "",
            metadata: metas[i],
          }));
        };

        let all: SearchResult[] = [];

        if (command === "p") {
          const res = await promptAPI.search(opts).catch(() => ({ ids: [[]], documents: [[]], metadatas: [[]] }));
          all = parse(res, "prompt");
        } else if (command === "s") {
          const res = await agentSkillAPI.search(opts).catch(() => ({ ids: [[]], documents: [[]], metadatas: [[]] }));
          all = parse(res, "skill");
        } else if (command === "a") {
          const res = await subAgentAPI.search(opts).catch(() => ({ ids: [[]], documents: [[]], metadatas: [[]] }));
          all = parse(res, "subagent");
        } else {
          // 无命令，搜索全部
          const [pRes, sRes, aRes] = await Promise.all([
            promptAPI.search(opts).catch(() => ({ ids: [[]], documents: [[]], metadatas: [[]] })),
            agentSkillAPI.search(opts).catch(() => ({ ids: [[]], documents: [[]], metadatas: [[]] })),
            subAgentAPI.search(opts).catch(() => ({ ids: [[]], documents: [[]], metadatas: [[]] })),
          ]);
          all = [...parse(pRes, "prompt"), ...parse(sRes, "skill"), ...parse(aRes, "subagent")];
        }

        setResults(all);
        setSelectedIndex(0);
        resizeWindow(all.length, true);
      } catch {
        setResults([]);
        resizeWindow(0, true);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(doSearch, 250);
    return () => clearTimeout(timer);
  }, [query, command, searchText, isTypingSlash, resizeWindow]);

  // ===== 操作 =====
  const closeWindow = useCallback(() => {
    try { (window as any).electronAPI?.send("search:close"); } catch { /* */ }
  }, []);

  const navigateTo = useCallback((result: SearchResult) => {
    try {
      (window as any).electronAPI?.send("search:navigate", { type: result.type, id: result.id });
    } catch { /* */ }
  }, []);

  const handleSelect = useCallback((result: SearchResult) => {
    navigateTo(result);
  }, [navigateTo]);

  const handleSelectSlashCommand = useCallback((cmd: string) => {
    setQuery(cmd + " ");
    inputRef.current?.focus();
  }, []);

  // ===== 键盘导航 =====
  useEffect(() => {
    const totalItems = isTypingSlash ? SLASH_COMMANDS.length : results.length;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { closeWindow(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((p) => Math.min(p + 1, totalItems - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((p) => Math.max(p - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (isTypingSlash && SLASH_COMMANDS[selectedIndex]) {
          handleSelectSlashCommand(SLASH_COMMANDS[selectedIndex].cmd);
        } else if (results.length > 0 && results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [results, selectedIndex, isTypingSlash, handleSelect, handleSelectSlashCommand, closeWindow]);

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // ===== 渲染状态 =====
  const hasResults = results.length > 0 && !loading;
  const showEmpty = !loading && !isTypingSlash && searchText.trim() && results.length === 0;

  return (
    <div className="sl-root">
      {/* 搜索框 */}
      <div className="sl-input-row">
        <Search size={18} className="sl-search-icon" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
          placeholder="搜索... 输入 / 查看命令"
          className="sl-input"
          spellCheck={false}
          autoFocus
        />
        {command && (
          <span className="sl-active-cmd" style={{ color: TYPE_CONFIG[command === "p" ? "prompt" : command === "s" ? "skill" : "subagent"].color }}>
            {command === "p" ? "/p" : command === "s" ? "/s" : "/a"}
          </span>
        )}
        {loading && <div className="sl-spinner" />}
      </div>

      {/* 斜杠命令提示 */}
      {isTypingSlash && (
        <div className="sl-results" ref={listRef}>
          {SLASH_COMMANDS.map((sc, i) => {
            const Icon = sc.icon;
            return (
              <div
                key={sc.cmd}
                className={`sl-item ${i === selectedIndex ? "active" : ""}`}
                onClick={() => handleSelectSlashCommand(sc.cmd)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <div className="sl-item-icon" style={{ color: sc.color }}>
                  <Icon size={15} />
                </div>
                <div className="sl-item-body">
                  <span className="sl-item-title">{sc.label}</span>
                  <span className="sl-item-preview">
                    <kbd className="sl-inline-kbd">{sc.cmd}</kbd> + 关键词
                  </span>
                </div>
                <div className="sl-item-action"><Command size={12} /></div>
              </div>
            );
          })}
        </div>
      )}

      {/* 搜索结果 */}
      {hasResults && !isTypingSlash && (
        <div className="sl-results" ref={listRef}>
          {results.map((r, i) => {
            const cfg = TYPE_CONFIG[r.type];
            const Icon = cfg.icon;
            return (
              <div
                key={`${r.type}-${r.id}`}
                className={`sl-item ${i === selectedIndex ? "active" : ""}`}
                onClick={() => handleSelect(r)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <div className="sl-item-icon" style={{ color: cfg.color }}>
                  <Icon size={15} />
                </div>
                <div className="sl-item-body">
                  <span className="sl-item-title">{r.title}</span>
                  <span className="sl-item-preview">
                    {r.content.slice(0, 80)}{r.content.length > 80 ? "..." : ""}
                  </span>
                </div>
                <span className="sl-item-badge" style={{ background: `color-mix(in srgb, ${cfg.color} 12%, transparent)`, color: cfg.color }}>
                  {cfg.label}
                </span>
                {i === selectedIndex && (
                  <div className="sl-item-action"><ArrowRight size={12} /></div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showEmpty && (
        <div className="sl-empty">无匹配结果</div>
      )}

      {/* 底部提示 */}
      {(hasResults || showEmpty || isTypingSlash) && (
        <div className="sl-footer">
          <span><kbd>↑↓</kbd> 导航</span>
          <span><kbd>↵</kbd> {isTypingSlash ? "选择" : "打开"}</span>
          <span><kbd>/</kbd> 命令</span>
          <span><kbd>esc</kbd> 关闭</span>
        </div>
      )}

      <style jsx>{`
        /* ====== 主题变量 ====== */
        .sl-root {
          --sl-bg: rgba(28, 28, 36, 0.82);
          --sl-border: rgba(255, 255, 255, 0.10);
          --sl-border-inner: rgba(255, 255, 255, 0.06);
          --sl-text: rgba(255, 255, 255, 0.92);
          --sl-text-dim: rgba(255, 255, 255, 0.35);
          --sl-text-muted: rgba(255, 255, 255, 0.22);
          --sl-placeholder: rgba(255, 255, 255, 0.28);
          --sl-hover: rgba(255, 255, 255, 0.07);
          --sl-icon-bg: rgba(255, 255, 255, 0.05);
          --sl-shadow: 0 8px 40px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.2);
          --sl-inset: inset 0 0.5px 0 rgba(255,255,255,0.06);
          --sl-kbd-bg: rgba(255,255,255,0.06);
          --sl-kbd-border: rgba(255,255,255,0.08);
          --sl-caret: #818cf8;
          --sl-type-prompt: #818cf8;
          --sl-type-skill: #a5b4fc;
          --sl-type-agent: #93a3f8;
        }
        @media (prefers-color-scheme: light) {
          .sl-root {
            --sl-bg: rgba(255, 255, 255, 0.78);
            --sl-border: rgba(0, 0, 0, 0.10);
            --sl-border-inner: rgba(0, 0, 0, 0.05);
            --sl-text: rgba(0, 0, 0, 0.88);
            --sl-text-dim: rgba(0, 0, 0, 0.40);
            --sl-text-muted: rgba(0, 0, 0, 0.22);
            --sl-placeholder: rgba(0, 0, 0, 0.32);
            --sl-hover: rgba(0, 0, 0, 0.05);
            --sl-icon-bg: rgba(0, 0, 0, 0.04);
            --sl-shadow: 0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
            --sl-inset: inset 0 0.5px 0 rgba(255,255,255,0.6);
            --sl-kbd-bg: rgba(0,0,0,0.05);
            --sl-kbd-border: rgba(0,0,0,0.08);
            --sl-caret: #6366f1;
            --sl-type-prompt: #6366f1;
            --sl-type-skill: #818cf8;
            --sl-type-agent: #7c7ef8;
          }
        }

        /* ====== 根 ====== */
        .sl-root {
          width: 100%;
          display: flex;
          flex-direction: column;
          font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
          color: var(--sl-text);
          -webkit-font-smoothing: antialiased;
          user-select: none;
          -webkit-app-region: no-drag;
        }

        /* ====== 输入行 ====== */
        .sl-input-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 18px;
          height: 56px;
          background: var(--sl-bg);
          backdrop-filter: blur(50px) saturate(160%);
          -webkit-backdrop-filter: blur(50px) saturate(160%);
          border: 1px solid var(--sl-border);
          border-radius: 14px;
          box-shadow: var(--sl-shadow), var(--sl-inset);
          -webkit-app-region: drag; /* 允许拖动搜索窗口 */
        }
        .sl-search-icon { flex-shrink: 0; color: var(--sl-text-dim); }
        .sl-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: var(--sl-text);
          font-size: 15px;
          font-weight: 400;
          letter-spacing: -0.01em;
          caret-color: var(--sl-caret);
          -webkit-app-region: no-drag; /* 输入框不可拖拽，允许正常交互 */
        }
        .sl-input::placeholder { color: var(--sl-placeholder); font-weight: 400; }
        .sl-active-cmd {
          flex-shrink: 0;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 4px;
          background: var(--sl-icon-bg);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .sl-spinner {
          width: 16px; height: 16px;
          border: 2px solid var(--sl-border-inner);
          border-top-color: var(--sl-caret);
          border-radius: 50%;
          animation: sl-spin 0.6s linear infinite;
          flex-shrink: 0;
        }
        @keyframes sl-spin { to { transform: rotate(360deg); } }

        /* ====== 结果列表 ====== */
        .sl-results {
          margin-top: 6px;
          padding: 4px;
          background: var(--sl-bg);
          backdrop-filter: blur(50px) saturate(160%);
          -webkit-backdrop-filter: blur(50px) saturate(160%);
          border: 1px solid var(--sl-border);
          border-radius: 12px;
          box-shadow: var(--sl-shadow), var(--sl-inset);
          max-height: 370px;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-app-region: no-drag; /* 结果列表不可拖拽 */
        }
        .sl-results::-webkit-scrollbar { width: 4px; }
        .sl-results::-webkit-scrollbar-track { background: transparent; }
        .sl-results::-webkit-scrollbar-thumb { background: var(--sl-border-inner); border-radius: 4px; }

        /* ====== 结果项 ====== */
        .sl-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.1s;
        }
        .sl-item.active { background: var(--sl-hover); }
        .sl-item-icon {
          flex-shrink: 0;
          width: 28px; height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 7px;
          background: var(--sl-icon-bg);
        }
        .sl-item-body {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .sl-item-title {
          font-size: 13px;
          font-weight: 500;
          color: var(--sl-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sl-item-preview {
          font-size: 11px;
          color: var(--sl-text-dim);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.4;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .sl-inline-kbd {
          display: inline-block;
          padding: 0 4px;
          background: var(--sl-kbd-bg);
          border: 1px solid var(--sl-kbd-border);
          border-radius: 3px;
          font-family: 'SF Mono', 'Menlo', monospace;
          font-size: 10px;
          line-height: 1.5;
          font-weight: 500;
        }
        .sl-item-badge {
          flex-shrink: 0;
          font-size: 10px;
          font-weight: 600;
          padding: 2px 7px;
          border-radius: 4px;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }
        .sl-item-action {
          flex-shrink: 0;
          color: var(--sl-text-muted);
          display: flex;
          align-items: center;
        }

        /* ====== 空状态 ====== */
        .sl-empty {
          margin-top: 6px;
          padding: 20px;
          text-align: center;
          font-size: 13px;
          color: var(--sl-text-dim);
          background: var(--sl-bg);
          backdrop-filter: blur(50px) saturate(160%);
          -webkit-backdrop-filter: blur(50px) saturate(160%);
          border: 1px solid var(--sl-border);
          border-radius: 12px;
          box-shadow: var(--sl-shadow), var(--sl-inset);
        }

        /* ====== 底部 ====== */
        .sl-footer {
          margin-top: 6px;
          display: flex;
          justify-content: center;
          gap: 16px;
          padding: 6px 0;
          font-size: 11px;
          color: var(--sl-text-muted);
        }
        .sl-footer kbd {
          display: inline-block;
          padding: 1px 5px;
          margin-right: 3px;
          background: var(--sl-kbd-bg);
          border: 1px solid var(--sl-kbd-border);
          border-radius: 3px;
          font-family: inherit;
          font-size: 10px;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}
