"use client";

import { useState, useId, useCallback } from "react";
import { Loader2, Eye, EyeOff, Mail, Lock, User, ArrowRight, ShieldCheck } from "lucide-react";
import type { EmailLoginPayload, EmailRegisterPayload } from "./types";
import { useLocale } from "@/lib/i18n";

interface EmailLoginFormProps {
  loading?: boolean;
  oauthInProgress?: boolean;
  mode?: "login" | "register";
  showForgotPassword?: boolean;
  onForgotPassword?: () => void;
  onSubmit: (payload: EmailLoginPayload) => Promise<void> | void;
  onRegister?: (payload: EmailRegisterPayload) => Promise<void> | void;
  onSendCode?: (email: string, purpose?: "register") => Promise<{ success: boolean; error?: string }>;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type PwdStrengthLevel = { score: number; label: string; color: string };

function getPasswordStrength(
  pw: string,
  labels: { weak: string; medium: string; strong: string; veryStrong?: string },
): PwdStrengthLevel {
  if (!pw) return { score: 0, label: "", color: "" };
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { score: 1, label: labels.weak, color: "#ef4444" };
  if (s === 2) return { score: 2, label: labels.medium, color: "#f59e0b" };
  if (s === 3) return { score: 3, label: labels.strong, color: "#22d3ee" };
  return { score: 4, label: labels.veryStrong || labels.strong, color: "#34d399" };
}

export default function EmailLoginForm({
  loading = false,
  oauthInProgress = false,
  mode = "login",
  showForgotPassword = false,
  onForgotPassword,
  onSubmit,
  onRegister,
  onSendCode,
}: EmailLoginFormProps) {
  const { t } = useLocale();
  const lp = t.loginPage;
  const uid = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [errField, setErrField] = useState("");
  const [focusedField, setFocusedField] = useState("");

  // 注册两步流程状态
  const [registerStep, setRegisterStep] = useState<"form" | "code">("form");
  const [verifyCode, setVerifyCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);

  const isRegister = mode === "register";
  const formDisabled = loading || oauthInProgress || sendingCode;
  const pwStrength = isRegister
    ? getPasswordStrength(password, {
        weak: lp.pwStrengthWeak,
        medium: lp.pwStrengthMedium,
        strong: lp.pwStrengthStrong,
      })
    : { score: 0, label: "", color: "" };

  const validate = () => {
    const em = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(em)) {
      setErrField("email");
      setLocalError(lp.errorInvalidEmail);
      return null;
    }
    if (password.length < 8) {
      setErrField("password");
      setLocalError(lp.errorPasswordTooShort);
      return null;
    }
    if (isRegister && password !== confirmPassword) {
      setErrField("confirm");
      setLocalError(lp.errorPasswordMismatch);
      return null;
    }
    setLocalError(null);
    setErrField("");
    return em;
  };

  const handleSendCode = useCallback(async () => {
    const em = validate();
    if (!em || !onSendCode) return;
    setSendingCode(true);
    setLocalError(null);
    try {
      const result = await onSendCode(em, "register");
      if (result.success) {
        setRegisterStep("code");
      } else {
        setLocalError(result.error || lp.codeSendFailed);
      }
    } catch {
      setLocalError(lp.codeSendFailed);
    } finally {
      setSendingCode(false);
    }
  }, [email, password, confirmPassword, name, onSendCode, lp]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegister) {
      if (registerStep === "form") {
        await handleSendCode();
        return;
      }
      // Step 2: submit with code
      const em = email.trim().toLowerCase();
      if (verifyCode.length !== 6 || !/^\d{6}$/.test(verifyCode)) {
        setLocalError(lp.codeInvalid);
        return;
      }
      setLocalError(null);
      await onRegister?.({ email: em, password, name: name.trim(), code: verifyCode });
    } else {
      const em = validate();
      if (!em) return;
      await onSubmit({ email: em, password });
    }
  };

  const handleResendCode = useCallback(async () => {
    const em = email.trim().toLowerCase();
    if (!em || !onSendCode) return;
    setSendingCode(true);
    setLocalError(null);
    try {
      const result = await onSendCode(em, "register");
      if (!result.success) {
        setLocalError(result.error || lp.codeSendFailed);
      }
    } catch {
      setLocalError(lp.codeSendFailed);
    } finally {
      setSendingCode(false);
    }
  }, [email, onSendCode, lp]);

  const confirmMismatch =
    isRegister && confirmPassword && password !== confirmPassword;

  const showRegisterCodeStep = isRegister && registerStep === "code";

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      {/* Step 1: Registration form fields (hidden when showing code step) */}
      {(!isRegister || registerStep === "form") && (
        <>
          {/* Name (register only) */}
          {isRegister && (
            <div className="field">
              <label
                htmlFor={`${uid}-name`}
                className={`field-label ${focusedField === "name" ? "focused" : ""}`}
              >
                {lp.namePlaceholder}
              </label>
              <div className={`field-input-wrap ${focusedField === "name" ? "focused" : ""}`}>
                <span className={`field-icon ${focusedField === "name" ? "focused" : ""}`}>
                  <User size={14} />
                </span>
                <input
                  id={`${uid}-name`}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={lp.namePlaceholder}
                  autoComplete="name"
                  disabled={formDisabled}
                  className="field-input"
                  onFocus={() => setFocusedField("name")}
                  onBlur={() => setFocusedField("")}
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div className="field">
            <label
              htmlFor={`${uid}-email`}
              className={`field-label ${focusedField === "email" ? "focused" : ""} ${errField === "email" ? "err" : ""}`}
            >
              {lp.emailPlaceholder}
            </label>
            <div
              className={`field-input-wrap ${focusedField === "email" ? "focused" : ""} ${errField === "email" ? "err" : ""}`}
            >
              <span className={`field-icon ${focusedField === "email" ? "focused" : ""}`}>
                <Mail size={14} />
              </span>
              <input
                id={`${uid}-email`}
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errField === "email") setErrField("");
                }}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={formDisabled}
                className="field-input"
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField("")}
              />
            </div>
          </div>

          {/* Password */}
          <div className="field">
            <label
              htmlFor={`${uid}-pw`}
              className={`field-label ${focusedField === "password" ? "focused" : ""} ${errField === "password" ? "err" : ""}`}
            >
              {lp.passwordPlaceholder}
            </label>
            <div
              className={`field-input-wrap ${focusedField === "password" ? "focused" : ""} ${errField === "password" ? "err" : ""}`}
            >
              <span className={`field-icon ${focusedField === "password" ? "focused" : ""}`}>
                <Lock size={14} />
              </span>
              <input
                id={`${uid}-pw`}
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errField === "password") setErrField("");
                }}
                placeholder="••••••••"
                autoComplete={isRegister ? "new-password" : "current-password"}
                disabled={formDisabled}
                className="field-input"
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField("")}
              />
              <button
                type="button"
                className="eye-btn"
                onClick={() => setShowPw((s) => !s)}
                tabIndex={-1}
                disabled={formDisabled}
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            {/* Password strength meter (register only) */}
            {isRegister && password.length > 0 && (
              <div className="pw-strength">
                <div className="pw-bars">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="pw-bar"
                      style={
                        pwStrength.score >= i
                          ? { background: pwStrength.color }
                          : {}
                      }
                    />
                  ))}
                </div>
                <span className="pw-label" style={{ color: pwStrength.color }}>
                  {pwStrength.label}
                </span>
              </div>
            )}
          </div>

          {/* Confirm Password (register only) */}
          {isRegister && (
            <div className="field">
              <label
                htmlFor={`${uid}-confirm`}
                className={`field-label ${focusedField === "confirm" ? "focused" : ""} ${errField === "confirm" || confirmMismatch ? "err" : ""}`}
              >
                {lp.confirmPasswordPlaceholder}
              </label>
              <div
                className={`field-input-wrap ${focusedField === "confirm" ? "focused" : ""} ${errField === "confirm" || confirmMismatch ? "err" : ""}`}
              >
                <span className={`field-icon ${focusedField === "confirm" ? "focused" : ""}`}>
                  <Lock size={14} />
                </span>
                <input
                  id={`${uid}-confirm`}
                  type={showConfirmPw ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errField === "confirm") setErrField("");
                  }}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={formDisabled}
                  className="field-input"
                  onFocus={() => setFocusedField("confirm")}
                  onBlur={() => setFocusedField("")}
                />
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setShowConfirmPw((s) => !s)}
                  tabIndex={-1}
                  disabled={formDisabled}
                >
                  {showConfirmPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {confirmMismatch && (
                <p className="field-err">{lp.errorPasswordMismatch}</p>
              )}
            </div>
          )}
        </>
      )}

      {/* Step 2: Verification code input (register only) */}
      {showRegisterCodeStep && (
        <>
          <div className="code-sent-header">
            <h3 className="code-sent-title">{lp.codeSentTitle}</h3>
            <p className="code-sent-desc">
              {lp.codeSentDesc}{" "}
              <span className="code-sent-email">{email}</span>
            </p>
          </div>

          <div className="field">
            <label
              htmlFor={`${uid}-code`}
              className={`field-label ${focusedField === "code" ? "focused" : ""}`}
            >
              {lp.codeLabel}
            </label>
            <div className={`field-input-wrap ${focusedField === "code" ? "focused" : ""}`}>
              <span className={`field-icon ${focusedField === "code" ? "focused" : ""}`}>
                <ShieldCheck size={14} />
              </span>
              <input
                id={`${uid}-code`}
                type="text"
                inputMode="numeric"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder={lp.codePlaceholder}
                autoComplete="one-time-code"
                disabled={formDisabled}
                className="field-input"
                onFocus={() => setFocusedField("code")}
                onBlur={() => setFocusedField("")}
                autoFocus
              />
            </div>
          </div>
        </>
      )}

      {/* Forgot password link */}
      {!isRegister && showForgotPassword && onForgotPassword && (
        <div className="forgot-row">
          <button
            type="button"
            className="forgot-link"
            onClick={onForgotPassword}
            disabled={formDisabled}
          >
            {lp.forgotPassword}
          </button>
        </div>
      )}

      {/* Error message */}
      {localError && (
        <p className="err-msg" role="alert">
          {localError}
        </p>
      )}

      {/* Submit button */}
      <button
        type="submit"
        className="submit-btn"
        disabled={formDisabled || (showRegisterCodeStep && verifyCode.length !== 6)}
      >
        <span className="submit-shimmer" />
        {loading || sendingCode ? (
          <>
            <Loader2 size={15} className="spin" />
            <span style={{ opacity: 0.8 }}>
              {sendingCode ? lp.sendingCode : isRegister ? lp.registering : lp.loggingIn}
            </span>
          </>
        ) : (
          <>
            <span>
              {isRegister
                ? registerStep === "form"
                  ? lp.sendCode
                  : lp.registerBtn
                : lp.emailLoginBtn}
            </span>
            <ArrowRight size={15} />
          </>
        )}
      </button>

      {/* Resend code / back to form */}
      {showRegisterCodeStep && (
        <div className="code-actions">
          <button
            type="button"
            className="resend-link"
            onClick={handleResendCode}
            disabled={sendingCode}
          >
            {lp.resendCode}
          </button>
          <button
            type="button"
            className="back-link"
            onClick={() => { setRegisterStep("form"); setVerifyCode(""); setLocalError(null); }}
          >
            {lp.backToHome}
          </button>
        </div>
      )}

      <style jsx>{`
        .form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        /* ── Field wrapper ── */
        .field {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .field-label {
          display: block;
          font-size: 0.68rem;
          font-family: monospace;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(74, 85, 104, 0.9);
          margin-bottom: 0.45rem;
          transition: color 0.2s;
        }
        .field-label.focused {
          color: rgba(245, 158, 11, 0.7);
        }
        .field-label.err {
          color: rgba(239, 68, 68, 0.7);
        }
        .field-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 12px;
          transition: all 0.2s;
        }
        .field-input-wrap.focused {
          background: rgba(245, 158, 11, 0.03);
          border-color: rgba(245, 158, 11, 0.35);
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.06);
        }
        .field-input-wrap.err {
          border-color: rgba(239, 68, 68, 0.4);
        }
        .field-icon {
          position: absolute;
          left: 0.85rem;
          color: #4a5568;
          display: flex;
          pointer-events: none;
          transition: color 0.2s;
        }
        .field-icon.focused {
          color: #f59e0b;
        }
        .field-input {
          flex: 1;
          padding: 0.75rem 2.7rem 0.75rem 2.4rem;
          background: transparent;
          border: none;
          outline: none;
          color: var(--text-primary, #eeeef0);
          font-size: 0.88rem;
          font-family: monospace;
        }
        .field-input::placeholder {
          opacity: 0.25;
        }
        .field-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .eye-btn {
          position: absolute;
          right: 0.85rem;
          background: none;
          border: none;
          color: var(--text-tertiary);
          cursor: pointer;
          display: flex;
          padding: 4px;
          border-radius: 4px;
          transition: color 0.15s;
        }
        .eye-btn:hover:not(:disabled) {
          color: var(--text-secondary);
        }
        .eye-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .field-err {
          margin: 0.3rem 0 0;
          font-size: 0.7rem;
          font-family: monospace;
          color: #f87171;
        }

        /* ── Forgot password ── */
        .forgot-row {
          display: flex;
          justify-content: flex-end;
          margin-top: -0.35rem;
        }
        .forgot-link {
          background: none;
          border: none;
          padding: 0;
          font-size: 0.76rem;
          color: rgba(245, 158, 11, 0.5);
          cursor: pointer;
          font-family: inherit;
          transition: color 0.15s;
        }
        .forgot-link:hover:not(:disabled) {
          color: #f59e0b;
        }
        .forgot-link:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        /* ── Password strength ── */
        .pw-strength {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }
        .pw-bars {
          display: flex;
          gap: 3px;
          flex: 1;
        }
        .pw-bar {
          flex: 1;
          height: 3px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.07);
          transition: background 0.4s;
        }
        .pw-label {
          font-size: 0.68rem;
          font-family: monospace;
          font-weight: 600;
          min-width: 1.5rem;
          text-align: right;
          transition: color 0.25s;
        }

        /* ── Error ── */
        .err-msg {
          font-size: 0.75rem;
          color: #fb7185;
          margin: 0;
          animation: errIn 0.18s ease both;
        }
        @keyframes errIn {
          from {
            opacity: 0;
            transform: translateY(-3px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* ── Code verification step ── */
        .code-sent-header {
          text-align: center;
          margin-bottom: 0.25rem;
        }
        .code-sent-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary, #eeeef0);
          margin: 0 0 0.35rem;
        }
        .code-sent-desc {
          font-size: 0.78rem;
          color: var(--text-secondary, #a0aec0);
          margin: 0;
          line-height: 1.5;
        }
        .code-sent-email {
          color: #f59e0b;
          font-family: monospace;
          font-weight: 600;
        }
        .code-actions {
          display: flex;
          justify-content: center;
          gap: 1.2rem;
        }
        .resend-link,
        .back-link {
          background: none;
          border: none;
          padding: 0;
          font-size: 0.74rem;
          font-family: monospace;
          cursor: pointer;
          transition: color 0.15s;
        }
        .resend-link {
          color: rgba(245, 158, 11, 0.5);
        }
        .resend-link:hover:not(:disabled) {
          color: #f59e0b;
        }
        .back-link {
          color: rgba(160, 174, 192, 0.5);
        }
        .back-link:hover:not(:disabled) {
          color: #a0aec0;
        }
        .resend-link:disabled,
        .back-link:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* ── Submit button ── */
        .submit-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          width: 100%;
          padding: 0.85rem;
          border: none;
          border-radius: 12px;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: #0a0a0b;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          letter-spacing: -0.01em;
          transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s;
          overflow: hidden;
        }
        .submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(245, 158, 11, 0.3);
        }
        .submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
        .submit-shimmer {
          position: absolute;
          inset: 0;
          opacity: 0;
          background: linear-gradient(
            105deg,
            transparent 40%,
            rgba(255, 255, 255, 0.15) 50%,
            transparent 60%
          );
          background-size: 200% 100%;
          transition: opacity 0.5s;
          pointer-events: none;
        }
        .submit-btn:hover:not(:disabled) .submit-shimmer {
          opacity: 1;
        }
        .spin {
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </form>
  );
}
