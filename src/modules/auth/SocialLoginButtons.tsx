"use client";

import { Github, Loader2 } from "lucide-react";
import type { AuthProvider } from "./types";
import { useLocale } from "@/lib/i18n";

interface SocialLoginButtonsProps {
  loadingProvider?: AuthProvider | null;
  onOAuthLogin: (provider: "google" | "github") => Promise<void> | void;
}

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function SocialLoginButtons({
  loadingProvider = null,
  onOAuthLogin,
}: SocialLoginButtonsProps) {
  const { t } = useLocale();
  const lp = t.loginPage;
  const busy = loadingProvider !== null;

  return (
    <div className="oauth-stack" role="group" aria-label={lp.orContinueOAuth}>
      <button
        type="button"
        className="oauth oauth-google"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void onOAuthLogin("google");
        }}
        disabled={busy}
        aria-busy={loadingProvider === "google"}
        aria-label={
          loadingProvider === "google" ? lp.connecting : lp.googleContinue
        }
        title={lp.googleContinue}
      >
        {loadingProvider === "google" ? (
          <Loader2 size={18} className="spin" aria-hidden />
        ) : (
          <GoogleIcon size={18} />
        )}
      </button>

      <button
        type="button"
        className="oauth oauth-github"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void onOAuthLogin("github");
        }}
        disabled={busy}
        aria-busy={loadingProvider === "github"}
        aria-label={
          loadingProvider === "github" ? lp.connecting : lp.githubContinue
        }
        title={lp.githubContinue}
      >
        {loadingProvider === "github" ? (
          <Loader2 size={18} className="spin" aria-hidden />
        ) : (
          <Github size={18} strokeWidth={2} aria-hidden />
        )}
      </button>

      <style jsx>{`
        .oauth-stack {
          display: flex;
          flex-direction: row;
          justify-content: center;
          align-items: center;
          gap: 0.75rem;
        }

        .oauth {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          padding: 0;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .oauth-google {
          border: 1px solid rgba(255, 255, 255, 0.09);
          background: rgba(255, 255, 255, 0.04);
          color: rgba(238, 238, 240, 0.75);
        }

        .oauth-google:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(245, 158, 11, 0.3);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        }

        .oauth-github {
          border: 1px solid rgba(255, 255, 255, 0.09);
          background: rgba(255, 255, 255, 0.04);
          color: rgba(238, 238, 240, 0.75);
        }

        .oauth-github:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(245, 158, 11, 0.3);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        }

        .oauth:focus-visible {
          outline: 2px solid rgba(245, 158, 11, 0.5);
          outline-offset: 2px;
        }

        .oauth:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .spin {
          animation: spin 0.75s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
