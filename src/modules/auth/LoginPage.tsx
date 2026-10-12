"use client";

import { useState, useEffect } from "react";
import {
  AlertCircle,
  Zap,
  Search,
  Users,
} from "lucide-react";
import EmailLoginForm from "./EmailLoginForm";
import SocialLoginButtons from "./SocialLoginButtons";
import type { AuthProvider, EmailLoginPayload, EmailRegisterPayload } from "./types";
import { useLocale } from "@/lib/i18n";

interface AuthLoginPageProps {
  appName?: string;
  error?: string | null;
  loadingProvider?: AuthProvider | null;
  onEmailLogin: (payload: EmailLoginPayload) => Promise<void> | void;
  onEmailRegister?: (payload: EmailRegisterPayload) => Promise<void> | void;
  onSendCode?: (email: string, purpose?: "register") => Promise<{ success: boolean; error?: string }>;
  onOAuthLogin: (provider: "google" | "github") => Promise<void> | void;
  onOpenSettings?: () => void;
  onBack?: () => void;
  onClearError?: () => void;
}

export default function AuthLoginPage({
  error = null,
  loadingProvider = null,
  onEmailLogin,
  onEmailRegister,
  onSendCode,
  onOAuthLogin,
  onOpenSettings,
  onBack,
  onClearError,
}: AuthLoginPageProps) {
  const { t } = useLocale();
  const lp = t.loginPage;
  const [mode, setMode] = useState<"login" | "register">("login");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isRegister = mode === "register";
  const handleModeChange = (m: "login" | "register") => {
    setMode(m);
    onClearError?.();
  };

  const oauthInProgress =
    loadingProvider === "google" || loadingProvider === "github";

  const features = [
    { icon: <Zap size={14} />, text: lp.featurePrompts },
    { icon: <Search size={14} />, text: lp.featureVersions },
    { icon: <Users size={14} />, text: lp.featureSearch },
  ];

  return (
    <div className={`shell ${mounted ? "in" : ""}`}>
      {/* ── Left: Brand panel ── */}
      <aside className="brand" aria-hidden={false}>
        {/* Background layers */}
        <div className="brand-dot-grid" />
        <div className="brand-gradient" />
        <div className="brand-orb-tl" />
        <div className="brand-orb-br" />
        <div className="brand-line" />

        <div className="brand-inner">
          <div className="brand-top">
            {/* Logo */}
            <div className="brand-mark">
              {onBack ? (
                <button
                  type="button"
                  className="brand-logo-btn"
                  onClick={onBack}
                  aria-label={lp.backToHome}
                >
                  <img
                    src="/icon.png"
                    alt=""
                    className="brand-icon"
                    width={40}
                    height={40}
                  />
                </button>
              ) : (
                <img
                  src="/icon.png"
                  alt=""
                  className="brand-icon"
                  width={40}
                  height={40}
                />
              )}
              <span className="brand-wordmark">
                Prompt<span className="brand-accent">Man</span>
              </span>
            </div>

            {/* Tag */}
            <div className="brand-tag-row">
              <span className="brand-tag">{lp.badgeLocal}</span>
            </div>

            {/* Headline */}
            <h2 className="brand-headline">
              <span className="brand-headline-line1">{lp.brandTagline}</span>
              <span className="brand-headline-line2">
                {isRegister
                  ? lp.brandSubtitleRegister
                  : lp.brandSubtitleLogin}
              </span>
            </h2>

            {/* Features */}
            <div className="feature-list">
              {features.map((f, i) => (
                <div
                  key={i}
                  className="feature-item"
                  style={{ animationDelay: `${0.3 + i * 0.1}s` }}
                >
                  <div className="feature-icon">{f.icon}</div>
                  <span className="feature-text">{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="brand-foot">{lp.footerCopyright}</p>
        </div>
      </aside>

      {/* ── Right: Form panel ── */}
      <main className="panel">
        <div className="panel-bg-dot" />
        <div className="panel-bg-orb" />

        <div className="panel-card">
          <div className="panel-head">
            <h1 className="panel-title">
              {isRegister ? (
                <span className="preline">{lp.brandHeadlineRegister}</span>
              ) : (
                lp.brandHeadlineLogin
              )}
            </h1>
            <p className="panel-lead">
              {isRegister ? lp.registerSubtitle : lp.signInLead}
            </p>
            {onBack && (
              <button type="button" className="skip-local" onClick={onBack}>
                {lp.backBtn} · {lp.badgeLocal}
              </button>
            )}
          </div>

          <div className="tabs" role="tablist">
            <button
              role="tab"
              aria-selected={!isRegister}
              type="button"
              className={`tab ${!isRegister ? "active" : ""}`}
              onClick={() => handleModeChange("login")}
              disabled={loadingProvider !== null}
            >
              {lp.tabLogin}
            </button>
            <button
              role="tab"
              aria-selected={isRegister}
              type="button"
              className={`tab ${isRegister ? "active" : ""}`}
              onClick={() => handleModeChange("register")}
              disabled={loadingProvider !== null}
            >
              {lp.tabRegister}
            </button>
            <div className={`tab-bar ${isRegister ? "r" : "l"}`} />
          </div>

          {error && (
            <div className="err-banner">
              <AlertCircle size={14} />
              <span>{error}</span>
              {onOpenSettings && (
                <button
                  type="button"
                  className="err-cfg"
                  onClick={onOpenSettings}
                >
                  {lp.configureCredentials}
                </button>
              )}
            </div>
          )}

          <EmailLoginForm
            loading={loadingProvider === "email"}
            oauthInProgress={oauthInProgress}
            mode={mode}
            showForgotPassword={!isRegister}
            onForgotPassword={onOpenSettings}
            onSubmit={onEmailLogin}
            onRegister={onEmailRegister}
            onSendCode={onSendCode}
          />

          {!isRegister && (
            <>
              <div className="sep">
                <span>{lp.orContinueOAuth}</span>
              </div>
              <SocialLoginButtons
                loadingProvider={loadingProvider}
                onOAuthLogin={onOAuthLogin}
              />
            </>
          )}

          {isRegister && (
            <p className="legal">
              {lp.legalNote}{" "}
              <span className="legal-link">{lp.legalTerms}</span>{" "}
              {lp.legalAnd}{" "}
              <span className="legal-link">{lp.legalPrivacy}</span>
            </p>
          )}
        </div>
      </main>

      <style jsx>{`
        .shell {
          position: fixed;
          inset: 0;
          display: flex;
          flex-direction: row;
          align-items: stretch;
          min-height: 100vh;
          background: var(--bg-app, #08090e);
          overflow: auto;
          opacity: 0;
          transition: opacity 0.28s ease;
        }
        .shell.in {
          opacity: 1;
        }

        /* ── Brand Panel ── */
        .brand {
          position: relative;
          z-index: 1;
          width: 480px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 3.5rem 3rem;
          border-right: 1px solid var(--border-color);
          overflow: hidden;
        }
        .brand-dot-grid {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(
            circle,
            rgba(255, 255, 255, 0.04) 1px,
            transparent 1px
          );
          background-size: 20px 20px;
          opacity: 0.07;
        }
        .brand-gradient {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            rgba(245, 158, 11, 0.04) 0%,
            transparent 50%,
            rgba(110, 231, 247, 0.03) 100%
          );
        }
        .brand-orb-tl {
          position: absolute;
          top: -80px;
          left: -80px;
          width: 320px;
          height: 320px;
          border-radius: 50%;
          background: radial-gradient(
            ellipse,
            rgba(245, 158, 11, 0.08) 0%,
            transparent 70%
          );
          pointer-events: none;
        }
        .brand-orb-br {
          position: absolute;
          bottom: 40px;
          right: 40px;
          width: 240px;
          height: 240px;
          border-radius: 50%;
          background: radial-gradient(
            ellipse,
            rgba(110, 231, 247, 0.05) 0%,
            transparent 70%
          );
          pointer-events: none;
        }
        .brand-line {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 1px;
          background: linear-gradient(
            to bottom,
            transparent,
            rgba(245, 158, 11, 0.2) 30%,
            rgba(245, 158, 11, 0.2) 70%,
            transparent
          );
        }
        .brand-inner {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 100%;
        }
        .brand-top {
          display: flex;
          flex-direction: column;
        }
        .brand-mark {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 2.5rem;
        }
        .brand-logo-btn {
          display: block;
          padding: 0;
          margin: 0;
          border: none;
          background: transparent;
          cursor: pointer;
          border-radius: 12px;
          line-height: 0;
          transition: transform 0.15s ease, opacity 0.15s ease;
        }
        .brand-logo-btn:hover {
          opacity: 0.92;
          transform: scale(1.03);
        }
        .brand-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          object-fit: contain;
          display: block;
        }
        .brand-wordmark {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.03em;
        }
        .brand-accent {
          background: linear-gradient(135deg, #f59e0b, #d97706);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .brand-tag-row {
          margin-bottom: 1.5rem;
        }
        .brand-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.7rem;
          font-weight: 600;
          color: #f59e0b;
          padding: 0.3rem 0.65rem;
          border-radius: 999px;
          border: 1px solid rgba(245, 158, 11, 0.2);
          background: rgba(245, 158, 11, 0.06);
        }
        .brand-headline {
          margin: 0 0 1.25rem;
        }
        .brand-headline-line1 {
          display: block;
          font-size: clamp(1.6rem, 3vw, 2.6rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.1;
          color: var(--text-primary);
          margin-bottom: 0.5rem;
        }
        .brand-headline-line2 {
          display: block;
          font-size: 0.92rem;
          color: var(--text-tertiary);
          line-height: 1.55;
        }
        .feature-list {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          margin-top: 1.5rem;
        }
        .feature-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          animation: featureIn 0.5s ease both;
        }
        .feature-icon {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.2);
          color: #f59e0b;
        }
        .feature-text {
          font-size: 0.84rem;
          color: var(--text-secondary);
        }
        @keyframes featureIn {
          from {
            opacity: 0;
            transform: translateX(-16px);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
        .brand-foot {
          font-size: 0.66rem;
          color: var(--text-tertiary);
          opacity: 0.5;
          margin: 0;
          font-family: monospace;
        }

        /* ── Form Panel ── */
        .panel {
          position: relative;
          z-index: 1;
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4.5rem 1.5rem 2rem;
          background: var(--bg-app, #08090e);
          overflow: hidden;
        }
        .panel-bg-dot {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(
            circle,
            rgba(255, 255, 255, 0.04) 1px,
            transparent 1px
          );
          background-size: 20px 20px;
          opacity: 0.04;
          pointer-events: none;
        }
        .panel-bg-orb {
          position: absolute;
          top: 0;
          right: 0;
          width: 500px;
          height: 500px;
          background: radial-gradient(
            ellipse at top right,
            rgba(245, 158, 11, 0.03) 0%,
            transparent 60%
          );
          pointer-events: none;
        }
        .panel-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 400px;
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
          animation: cardUp 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes cardUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
        .panel-head {
          margin-bottom: 0.2rem;
        }
        .panel-title {
          font-size: 1.75rem;
          font-weight: 800;
          color: var(--text-primary);
          margin: 0 0 0.5rem;
          letter-spacing: -0.03em;
          line-height: 1.15;
        }
        .panel-title :global(.preline) {
          white-space: pre-line;
        }
        .panel-lead {
          font-size: 0.88rem;
          color: var(--text-tertiary);
          margin: 0;
          line-height: 1.45;
        }
        .skip-local {
          margin-top: 0.85rem;
          padding: 0;
          border: none;
          background: none;
          color: var(--accent, #818cf8);
          font-size: 0.82rem;
          cursor: pointer;
        }
        .skip-local:hover {
          text-decoration: underline;
        }

        /* ── Tabs ── */
        .tabs {
          position: relative;
          display: flex;
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 12px;
          padding: 3px;
        }
        .tab {
          flex: 1;
          padding: 0.52rem;
          font-size: 0.82rem;
          font-weight: 600;
          border: none;
          background: none;
          color: var(--text-tertiary);
          cursor: pointer;
          border-radius: 9px;
          position: relative;
          z-index: 1;
          transition: color 0.15s;
          font-family: inherit;
          letter-spacing: -0.01em;
        }
        .tab.active {
          color: var(--text-primary);
        }
        .tab:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }
        .tab-bar {
          position: absolute;
          top: 3px;
          bottom: 3px;
          width: calc(50% - 3px);
          background: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.15);
          border-radius: 9px;
          transition: left 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .tab-bar.l {
          left: 3px;
        }
        .tab-bar.r {
          left: calc(50%);
        }

        /* ── Error ── */
        .err-banner {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          padding: 0.65rem 0.85rem;
          border-radius: 12px;
          border: 1px solid rgba(239, 68, 68, 0.18);
          background: rgba(239, 68, 68, 0.07);
          color: #fca5a5;
          font-size: 0.8rem;
          animation: fadeIn 0.18s ease both;
        }
        .err-banner svg {
          flex-shrink: 0;
          color: #ef4444;
        }
        .err-cfg {
          margin-left: auto;
          background: none;
          border: none;
          color: #f43f5e;
          font-size: 0.72rem;
          font-weight: 600;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 2px;
          padding: 0;
          font-family: inherit;
        }

        /* ── Divider ── */
        .sep {
          display: flex;
          align-items: center;
          gap: 0;
          margin-top: 0.15rem;
        }
        .sep::before,
        .sep::after {
          content: "";
          flex: 1;
          height: 1px;
          background: rgba(255, 255, 255, 0.05);
        }
        .sep span {
          padding: 0 0.75rem;
          font-size: 0.66rem;
          font-family: monospace;
          color: rgba(74, 85, 104, 0.8);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        /* ── Legal ── */
        .legal {
          font-size: 0.66rem;
          color: var(--text-tertiary);
          text-align: center;
          line-height: 1.7;
          margin-top: -0.15rem;
        }
        .legal-link {
          color: rgba(245, 158, 11, 0.6);
          text-decoration: underline;
          text-underline-offset: 2px;
          cursor: pointer;
        }
        .legal-link:hover {
          color: #f59e0b;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-3px);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }

        @media (max-width: 960px) {
          .shell {
            flex-direction: column;
          }
          .brand {
            width: auto;
            border-right: none;
            border-bottom: 1px solid var(--border-color);
            padding: 1.75rem 1.25rem 1.25rem;
          }
          .brand-foot {
            display: none;
          }
          .feature-list {
            display: none;
          }
          .panel {
            padding: 1.5rem 1.25rem 2rem;
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
}
