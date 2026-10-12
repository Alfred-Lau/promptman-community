"use client";

import { useState, useEffect } from "react";
import { User, LogOut, Settings, Github, ChevronDown, Building2 /*, Languages*/ } from "lucide-react";
import { orgAPI } from "@/lib/seekdb/api";
import type { AuthUser } from "@/modules/auth";
import { useLocale } from "@/lib/i18n";

export type GitHubUser = AuthUser;

const DEFAULT_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' fill='%23374151'/%3E%3Ccircle cx='40' cy='30' r='14' fill='%239CA3AF'/%3E%3Cpath d='M16 70c2-13 10-20 24-20s22 7 24 20' fill='%239CA3AF'/%3E%3C/svg%3E";

/** PromptMan 云同步状态（由父组件传入，仅已登录时展示在下拉菜单内） */
export type HubSyncMenuState = {
  syncing: boolean;
  error: string | null;
  lastSyncAt: string | null;
  syncCount: number | null;
};

interface UserAvatarProps {
  user: GitHubUser | null;
  loading?: boolean;
  /** 收起侧栏等窄布局：图标竖排、隐藏登录文案 */
  compact?: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onOpenSettings: () => void;
  /** 已登录应用时：是否已在本地保存 PromptHub 凭据（与头像所示账号不是同一套登录） */
  promptHubCloudLinked?: boolean | null;
  /** 已登录时：云端同步状态；不传则不显示同步条 */
  hubSync?: HubSyncMenuState | null;
  onHubSync?: () => void;
  /** 菜单在按钮上方展开（侧栏底部等，避免被裁切） */
  openMenuAbove?: boolean;
}

export default function UserAvatar({
  user,
  loading,
  compact = false,
  onLogin,
  onLogout,
  onOpenSettings,
  promptHubCloudLinked,
  hubSync,
  onHubSync,
  openMenuAbove = false,
}: UserAvatarProps) {
  const { t, locale } = useLocale();
  const ua = t.userAvatar;
  const cs = t.cloudSync;
  const [orgName, setOrgName] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const loadOrg = async () => {
      try {
        const data = await orgAPI.getData();
        setOrgName(data.currentOrg?.name || null);
      } catch {
        // ignore if org data not available
      }
    };
    if (user) loadOrg();
    else setOrgName(null);
  }, [user]);

  const handleLogout = () => {
    setMenuOpen(false);
    onLogout();
  };

  const handleSettings = () => {
    setMenuOpen(false);
    onOpenSettings();
  };

  const userDisplayName = user?.name || user?.login || user?.email || "User";
  const userHandle = user?.login || user?.email || "user";
  const avatarUrl = user?.avatar_url || DEFAULT_AVATAR;
  const profileUrl = user?.html_url || "";

  if (loading) {
    return (
      <div className={`ua-root${compact ? " ua-compact" : ""}`}>
        <div className="ua-skeleton" />
        <style jsx>{`
          .ua-root { position: relative; }
          .ua-skeleton {
            width: 26px;
            height: 26px;
            border-radius: 50%;
            background: var(--bg-glass);
            animation: pulse-soft 1.5s ease infinite;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className={`ua-root${compact ? " ua-compact" : ""}`}>
      <button
        className="ua-trigger"
        onClick={() => setMenuOpen(!menuOpen)}
        title={user ? userDisplayName : ua.localMode}
        aria-label={user ? undefined : ua.localMode}
        aria-expanded={menuOpen}
        aria-haspopup="true"
      >
        {user ? (
          <>
            <img
              src={avatarUrl}
              alt={userDisplayName}
              className="ua-avatar"
            />
            {!compact && (
              <ChevronDown
                size={10}
                className={`ua-chevron ${menuOpen ? "open" : ""}`}
              />
            )}
          </>
        ) : (
          <>
            <span className="ua-guest-avatar" aria-hidden>
              <User size={14} />
            </span>
            {!compact && (
              <ChevronDown
                size={10}
                className={`ua-chevron ${menuOpen ? "open" : ""}`}
              />
            )}
          </>
        )}
      </button>

      {menuOpen && (
        <>
          <div className="ua-backdrop" onClick={() => setMenuOpen(false)} />
          <div className={`ua-dropdown${openMenuAbove ? " ua-dropdown-above" : ""}`}>
            {!user ? (
              <>
                <button
                  type="button"
                  className="ua-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenSettings();
                  }}
                >
                  <Settings size={14} />
                  <span>{ua.settings}</span>
                </button>
                <button
                  type="button"
                  className="ua-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    onLogin();
                  }}
                >
                  <User size={14} />
                  <span>{ua.optionalCloud}</span>
                </button>
              </>
            ) : (
              <>
              {/* 用户信息头 */}
              <div className="ua-user-header">
                <img src={avatarUrl} alt={userDisplayName} className="ua-header-avatar" />
                <div className="ua-header-info">
                  <span className="ua-header-name">{userDisplayName}</span>
                  <span className="ua-header-login">@{userHandle}</span>
                  {orgName && (
                    <span className="ua-header-org">
                      <Building2 size={10} />
                      {orgName}
                    </span>
                  )}
                </div>
              </div>
              {hubSync ? (
                <div className="ua-hub-sync">
                  <div className="ua-hub-sync-info">
                    {hubSync.syncing ? (
                      <>
                        <span className="ua-hub-dot pulse" />
                        <span className="ua-hub-label">{cs.syncing}</span>
                      </>
                    ) : hubSync.error ? (
                      <>
                        <span className="ua-hub-dot error-dot" />
                        <span className="ua-hub-label error" title={hubSync.error}>
                          {hubSync.error}
                        </span>
                      </>
                    ) : hubSync.lastSyncAt ? (
                      <>
                        <span className="ua-hub-dot ok-dot" />
                        <span
                          className="ua-hub-label ok"
                          title={cs.lastSyncAt(
                            new Date(hubSync.lastSyncAt).toLocaleTimeString(
                              locale === "zh" ? "zh-CN" : "en-US",
                              { hour: "2-digit", minute: "2-digit" }
                            )
                          )}
                        >
                          {hubSync.syncCount !== null
                            ? cs.syncSuccess(hubSync.syncCount)
                            : cs.lastSyncAt(new Date(hubSync.lastSyncAt).toLocaleTimeString())}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="ua-hub-dot idle-dot" />
                        <span className="ua-hub-label idle">{cs.notSynced}</span>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    className={`ua-hub-sync-btn${hubSync.syncing ? " spinning" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onHubSync?.();
                    }}
                    disabled={hubSync.syncing}
                    title={cs.syncTitle}
                    aria-label={cs.syncNow}
                  >
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="ua-hub-sync-icon" aria-hidden>
                      <path
                        d="M13.65 2.35A8 8 0 1 0 15 8h-2a6 6 0 1 1-1.06-3.39L10 7h5V2l-1.35.35z"
                        fill="currentColor"
                      />
                    </svg>
                    {cs.syncNow}
                  </button>
                </div>
              ) : null}
              {user && promptHubCloudLinked === false ? (
                <p className="ua-hub-hint">{ua.promptHubNotLinkedHint}</p>
              ) : null}
              <div className="ua-divider" />
              {profileUrl ? (
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ua-menu-item"
                  onClick={() => setMenuOpen(false)}
                >
                  <Github size={14} />
                  <span>{user.provider === "github" ? ua.githubProfile : ua.openProfile}</span>
                </a>
              ) : null}
              <button className="ua-menu-item" onClick={handleSettings}>
                <Settings size={14} />
                <span>{ua.settings}</span>
              </button>
              {/* Language switcher menu item disabled
              <button className="ua-menu-item" onClick={() => { toggleLocale(); setMenuOpen(false); }}>
                <Languages size={14} />
                <span>{ua.switchLanguage}</span>
              </button>
              */}
              <div className="ua-divider" />
              <button className="ua-menu-item ua-danger" onClick={handleLogout}>
                <LogOut size={14} />
                <span>{ua.signOut}</span>
              </button>
              </>
            )}
          </div>
        </>
      )}

      <style jsx>{`
        .ua-root {
          position: relative;
        }

        /* 触发按钮 */
        .ua-trigger {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 3px;
          background: transparent;
          border: 1.5px solid transparent;
          border-radius: var(--radius-full);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .ua-trigger:hover {
          background: var(--bg-item-hover);
        }

        .ua-avatar {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          object-fit: cover;
          display: block;
        }

        .ua-guest-avatar {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-glass);
          border: 1px solid var(--border-color);
          color: var(--text-tertiary);
          flex-shrink: 0;
          box-sizing: border-box;
        }

        .ua-chevron {
          color: var(--text-tertiary);
          flex-shrink: 0;
          transition: transform var(--transition-fast);
        }

        .ua-chevron.open {
          transform: rotate(180deg);
        }

        /* 下拉菜单 */
        .ua-backdrop {
          position: fixed;
          inset: 0;
          z-index: 199;
        }

        .ua-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          min-width: 200px;
          width: max-content;
          max-width: 280px;
          background: var(--bg-app, #0f0f12);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 4px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
          z-index: 200;
          animation: uaSlideDown 0.15s ease;
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
        }

        .ua-compact .ua-dropdown {
          right: auto;
          left: 0;
        }

        .ua-dropdown.ua-dropdown-above {
          top: auto;
          bottom: calc(100% + 6px);
          animation: uaSlideUp 0.15s ease;
        }

        @keyframes uaSlideDown {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes uaSlideUp {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* 用户信息头 */
        .ua-user-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
        }

        .ua-header-avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid var(--border-color);
          flex-shrink: 0;
        }

        .ua-header-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .ua-header-name {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.3;
        }

        .ua-header-login {
          font-size: 0.72rem;
          color: var(--text-tertiary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.3;
        }

        .ua-header-org {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          margin-top: 2px;
          padding: 1px 7px;
          background: rgba(99, 102, 241, 0.12);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 10px;
          font-size: 0.65rem;
          font-weight: 500;
          color: var(--accent-color, #6366f1);
          line-height: 1.4;
        }

        .ua-hub-hint {
          margin: 0 10px 8px;
          padding: 8px 10px;
          font-size: 0.68rem;
          line-height: 1.45;
          color: var(--text-tertiary);
          background: rgba(251, 191, 36, 0.08);
          border: 1px solid rgba(251, 191, 36, 0.22);
          border-radius: var(--radius-md);
        }

        .ua-hub-sync {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin: 0 8px 8px;
          padding: 6px 8px;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.03);
          min-height: 28px;
        }

        .ua-hub-sync-info {
          display: flex;
          align-items: center;
          gap: 5px;
          flex: 1;
          min-width: 0;
          overflow: hidden;
        }

        .ua-hub-label {
          font-size: 0.65rem;
          color: var(--text-tertiary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: 0.01em;
        }

        .ua-hub-label.error {
          color: #f87171;
        }

        .ua-hub-label.ok {
          color: var(--text-tertiary);
        }

        .ua-hub-label.idle {
          color: var(--text-tertiary);
          opacity: 0.6;
        }

        .ua-hub-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .ua-hub-dot.pulse {
          background: #60a5fa;
          animation: uaSyncPulse 1s ease-in-out infinite;
        }

        .ua-hub-dot.ok-dot {
          background: #4ade80;
        }

        .ua-hub-dot.error-dot {
          background: #f87171;
        }

        .ua-hub-dot.idle-dot {
          background: var(--text-tertiary);
          opacity: 0.4;
        }

        .ua-hub-sync-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
          padding: 2px 7px;
          height: 20px;
          font-size: 0.62rem;
          font-weight: 600;
          font-family: inherit;
          letter-spacing: 0.02em;
          color: var(--text-secondary);
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-color);
          border-radius: 5px;
          cursor: pointer;
          transition: color 0.15s, background 0.15s, border-color 0.15s;
          white-space: nowrap;
        }

        .ua-hub-sync-btn:hover:not(:disabled) {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.08);
          border-color: var(--border-light);
        }

        .ua-hub-sync-btn:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .ua-hub-sync-icon {
          transition: transform 0.6s linear;
        }

        .ua-hub-sync-btn.spinning .ua-hub-sync-icon {
          animation: uaSpinCCW 0.7s linear infinite;
        }

        @keyframes uaSyncPulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.4;
            transform: scale(0.7);
          }
        }

        @keyframes uaSpinCCW {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(-360deg);
          }
        }

        /* 菜单项 */
        .ua-menu-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 9px 12px;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          font-size: 0.82rem;
          cursor: pointer;
          border-radius: var(--radius-md);
          transition: all var(--transition-fast);
          text-decoration: none;
        }

        .ua-menu-item:hover {
          background: var(--bg-item-hover);
          color: var(--text-primary);
        }

        .ua-menu-item.ua-danger:hover {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }

        .ua-divider {
          height: 1px;
          background: var(--border-color);
          margin: 4px 8px;
        }
      `}</style>
    </div>
  );
}
