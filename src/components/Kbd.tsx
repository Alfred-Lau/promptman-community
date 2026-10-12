"use client";

import React from "react";

interface KbdProps {
  children: React.ReactNode;
  size?: "sm" | "xs";
}

/**
 * <Kbd> renders a styled keyboard shortcut badge.
 * Usage: <Kbd>⌘F</Kbd>  <Kbd>↵</Kbd>
 */
export function Kbd({ children, size = "sm" }: KbdProps) {
  return (
    <kbd className={`kbd-badge kbd-${size}`}>
      {children}
      <style jsx>{`
        .kbd-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: 'SF Mono', 'Fira Code', ui-monospace, monospace;
          font-style: normal;
          font-weight: 500;
          line-height: 1;
          border-radius: 4px;
          border: 1px solid var(--kbd-border, rgba(255,255,255,0.15));
          background: var(--kbd-bg, rgba(255,255,255,0.06));
          color: var(--kbd-text, var(--text-tertiary));
          user-select: none;
          white-space: nowrap;
          box-shadow: 0 1px 0 var(--kbd-shadow, rgba(0,0,0,0.25));
        }
        .kbd-sm {
          font-size: 0.65rem;
          padding: 2px 5px;
          min-width: 18px;
        }
        .kbd-xs {
          font-size: 0.58rem;
          padding: 1px 4px;
          min-width: 14px;
        }
        @media (prefers-color-scheme: light) {
          .kbd-badge {
            --kbd-border: rgba(0,0,0,0.15);
            --kbd-bg: rgba(0,0,0,0.04);
            --kbd-shadow: rgba(0,0,0,0.12);
          }
        }
      `}</style>
    </kbd>
  );
}

interface ShortcutHintProps {
  hints: Array<{ keys: string[]; label: string }>;
  className?: string;
}

/**
 * <ShortcutHint> renders a horizontal row of kbd+label pairs.
 * Usage:
 *   <ShortcutHint hints={[
 *     { keys: ["↑", "↓"], label: "导航" },
 *     { keys: ["↵"],       label: "选中" },
 *     { keys: ["Esc"],     label: "退出" },
 *   ]} />
 */
export function ShortcutHint({ hints, className = "" }: ShortcutHintProps) {
  return (
    <div className={`shortcut-hint-row ${className}`}>
      {hints.map((h, i) => (
        <span key={i} className="shortcut-hint-item">
          <span className="shortcut-keys">
            {h.keys.map((k, ki) => (
              <React.Fragment key={ki}>
                {ki > 0 && <span className="key-sep">/</span>}
                <Kbd size="xs">{k}</Kbd>
              </React.Fragment>
            ))}
          </span>
          <span className="shortcut-label">{h.label}</span>
        </span>
      ))}
      <style jsx>{`
        .shortcut-hint-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .shortcut-hint-item {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .shortcut-keys {
          display: inline-flex;
          align-items: center;
          gap: 2px;
        }
        .key-sep {
          font-size: 0.58rem;
          color: var(--text-tertiary);
          opacity: 0.5;
          margin: 0 1px;
        }
        .shortcut-label {
          font-size: 0.65rem;
          color: var(--text-tertiary);
          letter-spacing: 0.01em;
        }
      `}</style>
    </div>
  );
}
