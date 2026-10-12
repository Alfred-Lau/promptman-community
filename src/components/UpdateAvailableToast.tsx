"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Download } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { normalizeUpdaterReleaseNotes } from "@/lib/updaterReleaseNotes";
import {
  PROMPTMAN_OPEN_SETTINGS_EVENT,
  type PromptmanOpenSettingsDetail,
} from "@/lib/promptmanEvents";

type UpdaterStatusPayload = {
  status: string;
  version?: string;
  releaseNotes?: unknown;
};

export function UpdateAvailableToast() {
  const { t } = useLocale();
  const s = t.settings;
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  const [notesText, setNotesText] = useState<string | null>(null);
  const lastToastVersionRef = useRef<string | null>(null);

  const dismiss = useCallback(() => setOpen(false), []);

  const openUpdateSettings = useCallback(() => {
    dismiss();
    window.dispatchEvent(
      new CustomEvent<PromptmanOpenSettingsDetail>(PROMPTMAN_OPEN_SETTINGS_EVENT, {
        detail: { section: "update" },
      }),
    );
  }, [dismiss]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI) return;

    const onStatus = (data: UpdaterStatusPayload) => {
      if (data.status !== "available") return;
      const v = typeof data.version === "string" ? data.version : null;
      if (!v) return;
      if (lastToastVersionRef.current === v) return;
      lastToastVersionRef.current = v;

      const notes = normalizeUpdaterReleaseNotes(data.releaseNotes);
      setVersion(v);
      setNotesText(notes);
      setOpen(true);
    };

    window.electronAPI.on("updater:status", onStatus);
    return () => {
      window.electronAPI.removeListener("updater:status", onStatus);
    };
  }, []);

  if (!open) return null;

  return (
    <div
      className="update-available-toast"
      role="status"
      aria-live="polite"
    >
      <div className="update-available-toast__header">
        <div className="update-available-toast__title-row">
          <Download size={18} className="update-available-toast__icon" aria-hidden />
          <span className="update-available-toast__title">{s.updateAvailable}</span>
        </div>
        <button
          type="button"
          className="update-available-toast__close"
          onClick={dismiss}
          aria-label={s.updateToastDismiss}
        >
          <X size={16} />
        </button>
      </div>
      <p className="update-available-toast__version">
        {s.updateAvailableDesc} <strong>v{version}</strong> {s.updateAvailableDesc2}
      </p>
      <div className="update-available-toast__notes">
        <span className="update-available-toast__notes-label">{s.updateReleaseNotesLabel}</span>
        <pre className="update-available-toast__notes-body">
          {notesText ?? s.updateToastNoNotes}
        </pre>
      </div>
      <div className="update-available-toast__actions">
        <button type="button" className="update-available-toast__btn update-available-toast__btn--primary" onClick={openUpdateSettings}>
          {s.updateToastOpenSettings}
        </button>
        <button type="button" className="update-available-toast__btn update-available-toast__btn--ghost" onClick={dismiss}>
          {s.updateToastDismiss}
        </button>
      </div>
      <style jsx>{`
        .update-available-toast {
          position: fixed;
          right: 20px;
          bottom: 20px;
          z-index: 10000;
          width: min(400px, calc(100vw - 40px));
          max-height: min(70vh, 520px);
          display: flex;
          flex-direction: column;
          padding: 16px;
          border-radius: 12px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-light);
          box-shadow: var(--shadow-lg);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .update-available-toast__header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
        }
        .update-available-toast__title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .update-available-toast__icon {
          flex-shrink: 0;
          color: var(--accent-color);
        }
        .update-available-toast__title {
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--text-primary);
        }
        .update-available-toast__close {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
        }
        .update-available-toast__close:hover {
          background: var(--bg-item-hover);
          color: var(--text-primary);
        }
        .update-available-toast__version {
          margin: 0 0 10px;
          font-size: 0.8125rem;
          color: var(--text-secondary);
          line-height: 1.45;
        }
        .update-available-toast__version strong {
          color: var(--text-primary);
        }
        .update-available-toast__notes {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 12px;
        }
        .update-available-toast__notes-label {
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-tertiary);
        }
        .update-available-toast__notes-body {
          margin: 0;
          padding: 10px 12px;
          border-radius: 8px;
          background: var(--code-bg);
          border: 1px solid var(--border-color);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 0.75rem;
          line-height: 1.5;
          color: var(--text-secondary);
          white-space: pre-wrap;
          word-break: break-word;
          overflow: auto;
          max-height: 220px;
        }
        .update-available-toast__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
        }
        .update-available-toast__btn {
          font-size: 0.8125rem;
          padding: 6px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          border: none;
        }
        .update-available-toast__btn--primary {
          background: var(--accent-color);
          color: #fff;
        }
        .update-available-toast__btn--primary:hover {
          background: var(--accent-hover);
        }
        .update-available-toast__btn--ghost {
          background: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
        }
        .update-available-toast__btn--ghost:hover {
          background: var(--bg-item-hover);
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}
