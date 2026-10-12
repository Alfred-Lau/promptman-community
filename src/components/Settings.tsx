"use client";

import { useState, useEffect } from "react";
import {
  Github,
  Save,
  Eye,
  EyeOff,
  ExternalLink,
  User,
  Palette,
  Globe,
  Check,
  AlertCircle,
  RefreshCw,
  Download,
  RotateCw,
  Info,
  Building2,
  UserPlus,
  LogOut,
  Mail,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  KeyRound,
  Database,
  FolderOpen,
  Copy,
  Plus,
  Trash2,
  Boxes,
  Bell,
  Star,
} from "lucide-react";
import { orgAPI, skillPathSyncAPI, promptPathSyncAPI } from "@/lib/seekdb/api";
import type { UserOrganization, OrgInvitation } from "@/lib/seekdb/types";
import type { GitHubUser } from "./UserAvatar";
import { useLocale } from "@/lib/i18n";
import type { AiProvider, BailianCodingRegion } from "@/lib/aiProviderModels";
import {
  getModelsForProvider,
  normalizeModelOnProviderChange,
  resolveEffectiveAiProvider,
} from "@/lib/aiProviderModels";
import { normalizeUpdaterReleaseNotes } from "@/lib/updaterReleaseNotes";
import {
  PROMPTMAN_GITHUB_URL,
  PROMPTMAN_WEB_URL,
} from "@/lib/productLinks";

export interface SkillAppSettings {
  installMethod: "symlink" | "copy";
  customScanPaths: string[];
  watchExternalFolders: boolean;
}

export interface PromptAppSettings {
  customScanPaths: string[];
  autoScanOnStartup: boolean;
}

function defaultSkillSettings(): SkillAppSettings {
  return {
    installMethod: "symlink",
    customScanPaths: [],
    watchExternalFolders: true,
  };
}

function defaultPromptSettings(): PromptAppSettings {
  return {
    customScanPaths: [],
    autoScanOnStartup: true,
  };
}

export interface NotificationAppSettings {
  enabled: boolean;
  copySuccess: boolean;
  saveSuccess: boolean;
}

function defaultNotificationSettings(): NotificationAppSettings {
  return {
    enabled: true,
    copySuccess: true,
    saveSuccess: true,
  };
}

function normalizeAppLanguage(value: unknown): "zh" | "en" {
  return value === "zh" || value === "en" ? value : "en";
}

export interface AppSettings {
  github: {
    clientId: string;
    clientSecret: string;
  };
  google: {
    clientId: string;
    clientSecret: string;
  };
  theme: "dark" | "light" | "system";
  language: "zh" | "en";
  marketRegistryUrl?: string;
  ai?: {
    provider: AiProvider;
    apiKey: string;
    baseUrl?: string;
    model?: string;
    bailianCodingRegion?: BailianCodingRegion;
  };
  skills?: SkillAppSettings;
  prompts?: PromptAppSettings;
  notifications?: NotificationAppSettings;
}

export type DataRootMode = "appUserData" | "homeDotPromptman";

export interface AppDataPaths {
  /** 与 dataRoot 相同，保留兼容 */
  userData: string;
  home: string;
  dataRoot: string;
  dataRootMode: DataRootMode;
  electronUserData: string;
  dotPromptmanDir: string;
  preferenceFile: string;
  storeFile: string;
  dbFile: string;
  skillsDir: string;
  modelsDir: string;
}

export type SettingsNavSection =
  | "account"
  | "appearance"
  | "data"
  | "skill"
  | "prompt"
  | "notifications"
  | "update"
  | "organization"
  | "ai";

interface SettingsProps {
  user: GitHubUser | null;
  onLogin: () => void;
  onLogout: () => void;
  /** 打开设置时选中的侧栏分区（例如从首页「打开 AI 设置」直达 AI） */
  initialSection?: SettingsNavSection;
}

export default function Settings({
  user,
  onLogin,
  onLogout,
  initialSection,
}: SettingsProps) {
  const { t, setTheme, setLocale } = useLocale();
  const s = t.settings
  const [settings, setSettings] = useState<AppSettings>({
    github: { clientId: "", clientSecret: "" },
    google: { clientId: "", clientSecret: "" },
    theme: "system",
    language: "en",
    skills: defaultSkillSettings(),
    notifications: defaultNotificationSettings(),
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsNavSection>(
    () => initialSection ?? "data",
  );

  useEffect(() => {
    setActiveSection(initialSection ?? "data");
  }, [initialSection]);

  // 组织相关状态
  const [currentOrg, setCurrentOrg] = useState<UserOrganization | null>(null);
  const [invitations, setInvitations] = useState<OrgInvitation[]>([]);
  const [sentInvites, setSentInvites] = useState<OrgInvitation[]>([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [inviteSlug, setInviteSlug] = useState("");
  const [inviteTarget, setInviteTarget] = useState("");

  // 自动更新相关状态
  const [updateStatus, setUpdateStatus] = useState<string>("idle");
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateProgress, setUpdateProgress] = useState<number>(0);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>("0.0.0");
  const [updateReleaseNotes, setUpdateReleaseNotes] = useState<string | null>(null);

  const [dataPaths, setDataPaths] = useState<AppDataPaths | null>(null);
  const [dataRootModeChoice, setDataRootModeChoice] =
    useState<DataRootMode>("appUserData");
  const [dataRootApplyMsg, setDataRootApplyMsg] = useState<string | null>(null);
  const [skillScanInput, setSkillScanInput] = useState("");
  const [promptScanInput, setPromptScanInput] = useState("");
  const [dataPathCopied, setDataPathCopied] = useState(false);
  const [dataMaintenanceMsg, setDataMaintenanceMsg] = useState<string | null>(null);
  const [skillSyncMsg, setSkillSyncMsg] = useState<string | null>(null);
  const [skillSyncing, setSkillSyncing] = useState(false);
  const [promptSyncMsg, setPromptSyncMsg] = useState<string | null>(null);
  const [promptSyncing, setPromptSyncing] = useState(false);

  useEffect(() => {
    loadSettings();
    loadCurrentVersion();
    loadOrgData();

    // 监听自动更新状态事件
    if (typeof window !== "undefined" && window.electronAPI) {
      const handleUpdateStatus = (data: Record<string, unknown>) => {
        const status = data.status as string;
        setUpdateStatus(status);

        if (status === "available") {
          setUpdateVersion(data.version as string);
          setUpdateReleaseNotes(normalizeUpdaterReleaseNotes(data.releaseNotes));
        } else if (status === "downloading") {
          setUpdateProgress(data.percent as number || 0);
        } else if (status === "downloaded") {
          setUpdateVersion(data.version as string);
        } else if (status === "error") {
          setUpdateError(data.error as string);
        }
      };

      window.electronAPI.on("updater:status", handleUpdateStatus);

      return () => {
        window.electronAPI.removeListener("updater:status", handleUpdateStatus);
      };
    }
  }, []);

  const loadDataPaths = async () => {
    try {
      if (typeof window === "undefined" || !window.electronAPI) return;
      const result = await window.electronAPI.invoke("app:getDataPaths");
      if (result.success && result.data) {
        const d = result.data as AppDataPaths;
        setDataPaths(d);
        setDataRootModeChoice(d.dataRootMode ?? "appUserData");
      }
    } catch (e) {
      console.error("Failed to load data paths:", e);
    }
  };

  useEffect(() => {
    if (activeSection === "data" || activeSection === "skill" || activeSection === "prompt") {
      void loadDataPaths();
    }
  }, [activeSection]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      if (typeof window !== "undefined" && window.electronAPI) {
        const result = await window.electronAPI.invoke("settings:get");
        if (result.success && result.data) {
          const d = result.data as AppSettings;
          const aiNormalized =
            d.ai &&
            resolveEffectiveAiProvider(d.ai) !== (d.ai.provider || "openai")
              ? {
                  ...d.ai,
                  provider: resolveEffectiveAiProvider(d.ai),
                }
              : d.ai;
          setSettings({
            ...d,
            language: normalizeAppLanguage(d.language),
            ai: aiNormalized,
            github: {
              clientId: d.github?.clientId ?? "",
              clientSecret: d.github?.clientSecret ?? "",
            },
            google: {
              clientId: d.google?.clientId ?? "",
              clientSecret: d.google?.clientSecret ?? "",
            },
            skills: {
              ...defaultSkillSettings(),
              ...d.skills,
              customScanPaths: d.skills?.customScanPaths?.length
                ? [...d.skills.customScanPaths]
                : [],
            },
            prompts: {
              ...defaultPromptSettings(),
              ...d.prompts,
              customScanPaths: d.prompts?.customScanPaths?.length
                ? [...d.prompts.customScanPaths]
                : [],
            },
            notifications: {
              ...defaultNotificationSettings(),
              ...d.notifications,
            },
          });
        }
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentVersion = async () => {
    try {
      if (typeof window !== "undefined" && window.electronAPI) {
        const result = await window.electronAPI.invoke("updater:getVersion");
        if (result.success) {
          setCurrentVersion(result.data);
        }
      }
    } catch (err) {
      console.error("Failed to get version:", err);
    }
  };

  const handleCheckUpdate = async () => {
    try {
      setUpdateError(null);
      setUpdateStatus("checking");
      if (typeof window !== "undefined" && window.electronAPI) {
        const result = await window.electronAPI.invoke("updater:check");
        if (!result.success) {
          setUpdateError(result.error || s.errorCheckUpdate);
          setUpdateStatus("error");
        }
      }
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : s.errorCheckUpdate);
      setUpdateStatus("error");
    }
  };

  const handleDownloadUpdate = async () => {
    try {
      setUpdateError(null);
      if (typeof window !== "undefined" && window.electronAPI) {
        const result = await window.electronAPI.invoke("updater:download");
        if (!result.success) {
          setUpdateError(result.error || s.errorDownloadUpdate);
          setUpdateStatus("error");
        }
      }
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : s.errorDownloadUpdate);
      setUpdateStatus("error");
    }
  };

  const handleInstallUpdate = async () => {
    try {
      if (typeof window !== "undefined" && window.electronAPI) {
        await window.electronAPI.invoke("updater:install");
      }
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : s.errorInstallUpdate);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      if (typeof window !== "undefined" && window.electronAPI) {
        const result = await window.electronAPI.invoke(
          "settings:update",
          settings
        );
        if (result.success) {
          setTheme(settings.theme);
          setLocale(normalizeAppLanguage(settings.language));
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        } else {
          setError(result.error || s.errorSave);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : s.errorSave);
    } finally {
      setSaving(false);
    }
  };

  const skillSettings = { ...defaultSkillSettings(), ...settings.skills };
  const promptSettings = { ...defaultPromptSettings(), ...settings.prompts };
  const notifSettings = {
    ...defaultNotificationSettings(),
    ...settings.notifications,
  };

  const expandTildePath = (tilde: string, home: string) =>
    tilde.startsWith("~/") ? `${home}${tilde.slice(1)}` : tilde;

  const builtinSkillScanRows = () => {
    const rows: { label: string; tilde: string }[] = [
      { label: s.skillBuiltinClaude, tilde: "~/.claude/skills" },
      { label: s.skillBuiltinCopilot, tilde: "~/.copilot/skills" },
      { label: s.skillBuiltinCursor, tilde: "~/.cursor/skills" },
      { label: s.skillBuiltinWindsurf, tilde: "~/.codeium/windsurf/skills" },
      { label: s.skillBuiltinKiro, tilde: "~/.kiro/skills" },
      { label: s.skillBuiltinGemini, tilde: "~/.gemini/skills" },
      { label: s.skillBuiltinTrae, tilde: "~/.trae/skills" },
      { label: s.skillBuiltinOpenCode, tilde: "~/.config/opencode/skills" },
      { label: s.skillBuiltinCodex, tilde: "~/.codex/skills" },
      { label: s.skillBuiltinDevin, tilde: "~/.devin/skills" },
    ];
    return rows;
  };

  const effectiveDataRoot =
    dataPaths?.dataRoot ?? dataPaths?.userData ?? "";

  const handleOpenDataRoot = async () => {
    if (!effectiveDataRoot || typeof window === "undefined" || !window.electronAPI)
      return;
    const result = await window.electronAPI.invoke("app:openPath", effectiveDataRoot);
    if (!result.success && result.error) {
      setError(result.error);
    }
  };

  const handleCopyDataRoot = async () => {
    if (!effectiveDataRoot) return;
    try {
      await navigator.clipboard.writeText(effectiveDataRoot);
      setDataPathCopied(true);
      setTimeout(() => setDataPathCopied(false), 2000);
    } catch {
      setError("Failed to copy path");
    }
  };

  const handleApplyDataRootMode = async () => {
    if (
      typeof window === "undefined" ||
      !window.electronAPI ||
      !dataPaths ||
      dataRootModeChoice === dataPaths.dataRootMode
    ) {
      return;
    }
    try {
      setDataRootApplyMsg(null);
      const result = await window.electronAPI.invoke(
        "app:setDataRootMode",
        dataRootModeChoice
      );
      if (result.success) {
        setDataRootApplyMsg(s.dataRootRestartHint);
        await loadDataPaths();
      } else {
        setError(result.error || s.errorSave);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : s.errorSave);
    }
  };

  const handleClearEmbeddingCache = async () => {
    setDataMaintenanceMsg(null);
    if (typeof window === "undefined" || !window.electronAPI) return;
    const result = await window.electronAPI.invoke("app:clearEmbeddingCache");
    if (result.success) {
      setDataMaintenanceMsg(s.dataClearEmbedDone);
    } else {
      setDataMaintenanceMsg(result.error || s.dataClearEmbedFail);
    }
  };

  const addSkillScanPath = () => {
    const v = skillScanInput.trim();
    if (!v) return;
    setSettings((prev) => {
      const sk = { ...defaultSkillSettings(), ...prev.skills };
      if (sk.customScanPaths.includes(v)) return prev;
      return {
        ...prev,
        skills: { ...sk, customScanPaths: [...sk.customScanPaths, v] },
      };
    });
    setSkillScanInput("");
  };

  const removeSkillScanPath = (index: number) => {
    setSettings((prev) => {
      const sk = { ...defaultSkillSettings(), ...prev.skills };
      const next = sk.customScanPaths.filter((_, i) => i !== index);
      return { ...prev, skills: { ...sk, customScanPaths: next } };
    });
  };

  const handleSkillAddAllKnown = async () => {
    try {
      const paths = await skillPathSyncAPI.getKnownPaths();
      if (paths.length === 0) return;
      setSettings((prev) => {
        const sk = { ...defaultSkillSettings(), ...prev.skills };
        const existing = new Set(sk.customScanPaths);
        const toAdd = paths.filter((p) => !existing.has(p));
        if (toAdd.length === 0) return prev;
        return { ...prev, skills: { ...sk, customScanPaths: [...sk.customScanPaths, ...toAdd] } };
      });
    } catch (err) {
      console.error("Failed to get known skill paths:", err);
    }
  };

  const handleSkillSyncNow = async () => {
    try {
      setSkillSyncing(true);
      setSkillSyncMsg(null);
      const result = await skillPathSyncAPI.syncPaths();
      setSkillSyncMsg(s.skillSyncResult(result.imported, result.skippedUnchanged));
      setTimeout(() => setSkillSyncMsg(null), 4000);
    } catch (err) {
      setSkillSyncMsg(s.skillSyncError);
      setTimeout(() => setSkillSyncMsg(null), 4000);
      console.error("Skill sync failed:", err);
    } finally {
      setSkillSyncing(false);
    }
  };

  const addPromptScanPath = () => {
    const v = promptScanInput.trim();
    if (!v) return;
    setSettings((prev) => {
      const pm = { ...defaultPromptSettings(), ...prev.prompts };
      if (pm.customScanPaths.includes(v)) return prev;
      return { ...prev, prompts: { ...pm, customScanPaths: [...pm.customScanPaths, v] } };
    });
    setPromptScanInput("");
  };

  const removePromptScanPath = (index: number) => {
    setSettings((prev) => {
      const pm = { ...defaultPromptSettings(), ...prev.prompts };
      const next = pm.customScanPaths.filter((_, i) => i !== index);
      return { ...prev, prompts: { ...pm, customScanPaths: next } };
    });
  };

  const handlePromptAddAllKnown = async () => {
    try {
      const paths = await promptPathSyncAPI.getKnownPaths();
      if (paths.length === 0) return;
      setSettings((prev) => {
        const pm = { ...defaultPromptSettings(), ...prev.prompts };
        const existing = new Set(pm.customScanPaths);
        const toAdd = paths.filter((p) => !existing.has(p));
        if (toAdd.length === 0) return prev;
        return { ...prev, prompts: { ...pm, customScanPaths: [...pm.customScanPaths, ...toAdd] } };
      });
    } catch (err) {
      console.error("Failed to get known prompt paths:", err);
    }
  };

  const handlePromptSyncNow = async () => {
    try {
      setPromptSyncing(true);
      setPromptSyncMsg(null);
      const result = await promptPathSyncAPI.syncPaths();
      setPromptSyncMsg(s.promptSyncResult(result.imported, result.skippedUnchanged));
      setTimeout(() => setPromptSyncMsg(null), 4000);
    } catch (err) {
      setPromptSyncMsg(s.promptSyncError);
      setTimeout(() => setPromptSyncMsg(null), 4000);
      console.error("Prompt sync failed:", err);
    } finally {
      setPromptSyncing(false);
    }
  };

  const builtinPromptScanRows = () => {
    const rows: { label: string; tilde: string }[] = [
      { label: s.promptBuiltinCursor, tilde: "~/.cursor/rules" },
      { label: s.promptBuiltinClaude, tilde: "~/.claude/rules" },
      { label: s.promptBuiltinOpenCode, tilde: "~/.config/opencode/rules" },
      { label: s.promptBuiltinGemini, tilde: "~/.gemini/rules" },
    ];
    return rows;
  };

  // ==================== Organization 相关方法 ====================

  const loadOrgData = async () => {
    try {
      setOrgLoading(true);
      const data = await orgAPI.getData();
      setCurrentOrg(data.currentOrg);
      setInvitations(data.invitations);
      setSentInvites(data.sentInvites);
    } catch (err) {
      console.error("Failed to load org data:", err);
    } finally {
      setOrgLoading(false);
    }
  };

  const handleJoinOrg = async () => {
    if (!inviteSlug.trim()) return;
    try {
      const org: UserOrganization = {
        id: crypto.randomUUID(),
        name: inviteSlug.trim(),
        slug: inviteSlug.trim().toLowerCase().replace(/\s+/g, '-'),
        role: 'member',
        joinedAt: new Date().toISOString(),
      };
      await orgAPI.setCurrentOrg(org);
      setCurrentOrg(org);
      setInviteSlug("");
    } catch (err) {
      console.error("Failed to join org:", err);
      setError(err instanceof Error ? err.message : s.errorJoinOrg);
    }
  };

  const handleLeaveOrg = async () => {
    try {
      await orgAPI.leaveOrg();
      setCurrentOrg(null);
    } catch (err) {
      console.error("Failed to leave org:", err);
      setError(err instanceof Error ? err.message : s.errorLeaveOrg);
    }
  };

  const handleSendInvite = async () => {
    if (!inviteTarget.trim() || !currentOrg) return;
    try {
      const invitation: OrgInvitation = {
        id: crypto.randomUUID(),
        orgId: currentOrg.id,
        orgName: currentOrg.name,
        orgSlug: currentOrg.slug,
        invitedBy: user?.login || 'unknown',
        invitedByAvatar: user?.avatar_url,
        invitedAt: new Date().toISOString(),
        status: 'pending',
      };
      await orgAPI.sendInvite(invitation);
      setSentInvites(prev => [...prev, invitation]);
      setInviteTarget("");
    } catch (err) {
      console.error("Failed to send invite:", err);
      setError(err instanceof Error ? err.message : s.errorSendInvite);
    }
  };

  const handleRespondInvite = async (id: string, status: 'accepted' | 'declined') => {
    try {
      const inv = await orgAPI.respondInvite(id, status);
      setInvitations(prev => prev.map(i => i.id === id ? { ...i, status } : i));
      // 如果接受邀请，自动设为当前组织
      if (status === 'accepted' && inv) {
        const org: UserOrganization = {
          id: inv.orgId,
          name: inv.orgName,
          slug: inv.orgSlug,
          role: 'member',
          joinedAt: new Date().toISOString(),
        };
        await orgAPI.setCurrentOrg(org);
        setCurrentOrg(org);
      }
    } catch (err) {
      console.error("Failed to respond to invite:", err);
      setError(err instanceof Error ? err.message : s.errorRespondInvite);
    }
  };

  if (loading) {
    return (
      <div className="settings-container">
        <div className="settings-loading">Loading...</div>
        <style jsx>{`
          .settings-container {
            padding-bottom: 3rem;
            animation: fadeIn 0.35s ease;
          }
          .settings-loading {
            text-align: center;
            padding: 4rem 2rem;
            color: var(--text-secondary);
            animation: pulse-soft 1.5s ease infinite;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="settings-container">
      <div className="settings-header">
        <div className="settings-title">
          <h1>{s.title}</h1>
          <p>{s.subtitle}</p>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="settings-layout">
        {/* 左侧导航 */}
        <nav className="settings-nav">
          <button
            className={`nav-item ${activeSection === "data" ? "active" : ""}`}
            onClick={() => setActiveSection("data")}
          >
            <Database size={16} />
            <span>{s.navData}</span>
          </button>
          <button
            className={`nav-item ${activeSection === "appearance" ? "active" : ""}`}
            onClick={() => setActiveSection("appearance")}
          >
            <Palette size={16} />
            <span>{s.navAppearance}</span>
          </button>
          <button
            className={`nav-item ${activeSection === "ai" ? "active" : ""}`}
            onClick={() => setActiveSection("ai")}
          >
            <Sparkles size={16} />
            <span>{s.navAI}</span>
          </button>
          <button
            className={`nav-item ${activeSection === "skill" ? "active" : ""}`}
            onClick={() => setActiveSection("skill")}
          >
            <Boxes size={16} />
            <span>{s.navSkill}</span>
          </button>
          <button
            className={`nav-item ${activeSection === "prompt" ? "active" : ""}`}
            onClick={() => setActiveSection("prompt")}
          >
            <FolderOpen size={16} />
            <span>{s.navPrompt}</span>
          </button>
          <button
            className={`nav-item ${activeSection === "notifications" ? "active" : ""}`}
            onClick={() => setActiveSection("notifications")}
          >
            <Bell size={16} />
            <span>{s.navNotifications}</span>
          </button>
          <button
            className={`nav-item ${activeSection === "update" ? "active" : ""}`}
            onClick={() => setActiveSection("update")}
          >
            <RefreshCw size={16} />
            <span>{s.navUpdate}</span>
            {updateStatus === "available" || updateStatus === "downloaded" ? (
              <span className="nav-badge" />
            ) : null}
          </button>
          <button
            className={`nav-item ${activeSection === "account" ? "active" : ""}`}
            onClick={() => setActiveSection("account")}
          >
            <User size={16} />
            <span>{s.navAccount}</span>
          </button>
          <button
            className={`nav-item ${activeSection === "organization" ? "active" : ""}`}
            onClick={() => setActiveSection("organization")}
          >
            <Building2 size={16} />
            <span>{s.navOrganization}</span>
          </button>
        </nav>

        {/* 右侧内容 */}
        <div className="settings-content">
          {/* Account Section */}
          {activeSection === "account" && (
            <div className="section">
              <div className="section-header">
                <h2>{s.accountTitle}</h2>
                <p>{s.accountSubtitle}</p>
              </div>

              {user ? (
                <div className="account-card">
                  <div className="account-info">
                    <img
                      src={user.avatar_url}
                      alt={user.login}
                      className="account-avatar"
                    />
                    <div className="account-details">
                      <h3>{user.name || user.login}</h3>
                      <span className="account-login">@{user.login}</span>
                      <span className="account-provider">
                        {s.accountProvider}: {user.provider}
                      </span>
                      {user.email && (
                        <span className="account-email">{user.email}</span>
                      )}
                      {currentOrg && (
                        <span className="account-org-badge">
                          <Building2 size={12} />
                          {currentOrg.name}
                        </span>
                      )}
                      {user.bio && <p className="account-bio">{user.bio}</p>}
                    </div>
                  </div>
                  <div className="account-actions">
                    {user.html_url ? (
                      <a
                        href={user.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-outline"
                      >
                        <ExternalLink size={14} />
                        {user.provider === "github" ? s.accountViewGitHub : s.accountViewProfile}
                      </a>
                    ) : null}
                    <button className="btn btn-danger" onClick={onLogout}>
                      {s.accountSignOut}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="login-card">
                  <div className="login-icon">
                    <Github size={40} />
                  </div>
                  <h3>{s.accountLoginTitle}</h3>
                  <p>
                    {s.accountLoginDesc}
                  </p>
                  <button className="btn btn-github" onClick={onLogin}>
                    <Github size={16} />
                    {s.accountLoginBtn}
                  </button>
                  <div className="login-hint">
                    <AlertCircle size={13} />
                    <span>{s.accountLoginHint}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Appearance Section */}
          {activeSection === "appearance" && (
            <div className="section">
              <div className="section-header">
                <h2>{s.appearanceTitle}</h2>
                <p>{s.appearanceSubtitle}</p>
              </div>

              <div className="form-group">
                <label>
                  <Palette size={14} />
                  {s.appearanceTheme}
                </label>
                <div className="theme-options">
                  <button
                    className={`theme-option ${settings.theme === "system" ? "active" : ""}`}
                    onClick={() =>
                      setSettings((prev) => ({ ...prev, theme: "system" }))
                    }
                  >
                    <div className="theme-preview system-preview">
                      <div className="tp-sidebar" />
                      <div className="tp-content" />
                    </div>
                    <span>{s.appearanceSystem}</span>
                  </button>
                  <button
                    className={`theme-option ${settings.theme === "dark" ? "active" : ""}`}
                    onClick={() =>
                      setSettings((prev) => ({ ...prev, theme: "dark" }))
                    }
                  >
                    <div className="theme-preview dark-preview">
                      <div className="tp-sidebar" />
                      <div className="tp-content" />
                    </div>
                    <span>{s.appearanceDark}</span>
                  </button>
                  <button
                    className={`theme-option ${settings.theme === "light" ? "active" : ""}`}
                    onClick={() =>
                      setSettings((prev) => ({ ...prev, theme: "light" }))
                    }
                  >
                    <div className="theme-preview light-preview">
                      <div className="tp-sidebar" />
                      <div className="tp-content" />
                    </div>
                    <span>{s.appearanceLight}</span>
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>
                  <Globe size={14} />
                  {s.appearanceLanguage}
                </label>
                <div className="language-options">
                  <button
                    type="button"
                    className={`lang-option ${settings.language === "zh" ? "active" : ""}`}
                    onClick={() => {
                      setSettings((prev) => ({ ...prev, language: "zh" }));
                      setLocale("zh");
                    }}
                  >
                    中文
                  </button>
                  <button
                    type="button"
                    className={`lang-option ${settings.language === "en" ? "active" : ""}`}
                    onClick={() => {
                      setSettings((prev) => ({ ...prev, language: "en" }));
                      setLocale("en");
                    }}
                  >
                    English
                  </button>
                </div>
              </div>

              <div className="form-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saved ? (
                    <>
                      <Check size={16} /> {s.btnSaved}
                    </>
                  ) : (
                    <>
                      <Save size={16} /> {saving ? s.btnSaving : s.btnSave}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Data Section */}
          {activeSection === "data" && (
            <div className="section">
              <div className="section-header">
                <h2>{s.dataTitle}</h2>
                <p>{s.dataSubtitle}</p>
              </div>

              <div className="settings-panel local-first-banner">
                <div className="settings-group-title">
                  <Database size={14} />
                  <span>{s.localFirstTitle}</span>
                </div>
                <p className="settings-group-desc">{s.localFirstDesc}</p>
              </div>

              <div className="settings-panel">
                <div className="settings-group-title">
                  <FolderOpen size={14} />
                  <span>{s.dataRootModeGroup}</span>
                </div>
                <p className="settings-group-desc">{s.dataRootModeDesc}</p>
                <div className="data-root-mode-options">
                  <label className="data-root-mode-row">
                    <input
                      type="radio"
                      name="dataRootMode"
                      checked={dataRootModeChoice === "appUserData"}
                      onChange={() => setDataRootModeChoice("appUserData")}
                    />
                    <span>{s.dataRootModeApp}</span>
                  </label>
                  <label className="data-root-mode-row">
                    <input
                      type="radio"
                      name="dataRootMode"
                      checked={dataRootModeChoice === "homeDotPromptman"}
                      onChange={() => setDataRootModeChoice("homeDotPromptman")}
                    />
                    <span>{s.dataRootModeHome}</span>
                  </label>
                </div>
                <div className="form-actions" style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => void handleApplyDataRootMode()}
                    disabled={
                      !dataPaths ||
                      dataRootModeChoice === dataPaths.dataRootMode
                    }
                  >
                    {s.dataRootApply}
                  </button>
                </div>
                {dataRootApplyMsg ? (
                  <p className="settings-group-desc" style={{ marginTop: 8 }}>
                    {dataRootApplyMsg}
                  </p>
                ) : null}
              </div>

              <div className="settings-panel">
                <div className="settings-group-title">
                  <FolderOpen size={14} />
                  <span>{s.dataDirGroup}</span>
                </div>
                <p className="settings-group-desc">{s.dataDirDesc}</p>
                <div className="data-path-box">
                  <code className="data-path-text">
                    {effectiveDataRoot || "—"}
                  </code>
                  <div className="data-path-actions">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => void handleOpenDataRoot()}
                      disabled={!effectiveDataRoot}
                    >
                      <FolderOpen size={14} />
                      {s.dataDirOpen}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => void handleCopyDataRoot()}
                      disabled={!effectiveDataRoot}
                    >
                      <Copy size={14} />
                      {dataPathCopied ? s.dataDirCopied : s.dataDirCopy}
                    </button>
                  </div>
                </div>
              </div>

              <div className="settings-panel">
                <div className="settings-group-title">
                  <Database size={14} />
                  <span>{s.dataPathsGroup}</span>
                </div>
                <ul className="data-path-list">
                  <li>
                    <span className="data-path-label">{s.dataPathUserData}</span>
                    <code>{dataPaths?.dataRoot ?? dataPaths?.userData ?? "—"}</code>
                  </li>
                  <li>
                    <span className="data-path-label">{s.dataPathElectronUserData}</span>
                    <code>{dataPaths?.electronUserData ?? "—"}</code>
                  </li>
                  <li>
                    <span className="data-path-label">{s.dataPathPreferenceFile}</span>
                    <code>{dataPaths?.preferenceFile ?? "—"}</code>
                  </li>
                  <li>
                    <span className="data-path-label">{s.dataPathStore}</span>
                    <code>{dataPaths?.storeFile ?? "—"}</code>
                  </li>
                  <li>
                    <span className="data-path-label">{s.dataPathDb}</span>
                    <code>{dataPaths?.dbFile ?? "—"}</code>
                  </li>
                  <li>
                    <span className="data-path-label">{s.dataPathSkills}</span>
                    <code>{dataPaths?.skillsDir ?? "—"}</code>
                  </li>
                  <li>
                    <span className="data-path-label">{s.dataPathModels}</span>
                    <code>{dataPaths?.modelsDir ?? "—"}</code>
                  </li>
                </ul>
              </div>

              <div className="settings-panel">
                <div className="settings-group-title">
                  <AlertCircle size={14} />
                  <span>{s.dataMaintenanceGroup}</span>
                </div>
                <div className="settings-toggle-row flat">
                  <div>
                    <div className="settings-toggle-title">{s.dataClearEmbedCache}</div>
                    <p className="settings-toggle-desc">{s.dataClearEmbedCacheDesc}</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => void handleClearEmbeddingCache()}
                  >
                    {s.dataClearEmbedCache}
                  </button>
                </div>
                {dataMaintenanceMsg ? (
                  <p className={`field-hint ${dataMaintenanceMsg === s.dataClearEmbedDone ? "ok" : "err"}`}>
                    {dataMaintenanceMsg}
                  </p>
                ) : null}
              </div>

              <div className="settings-panel muted">
                <div className="settings-group-title">
                  <Info size={14} />
                  <span>{s.dataDbInfoGroup}</span>
                </div>
                <p className="settings-info-text">{s.dataDbInfoLine}</p>
              </div>

              <div className="form-actions">
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saved ? (
                    <>
                      <Check size={16} /> {s.btnSaved}
                    </>
                  ) : (
                    <>
                      <Save size={16} /> {saving ? s.btnSaving : s.btnSave}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Skill Section */}
          {activeSection === "skill" && (
            <div className="section">
              <div className="section-header">
                <h2>{s.skillTitle}</h2>
                <p>{s.skillSubtitle}</p>
              </div>

              <div className="settings-panel">
                <div className="settings-group-title">
                  <Boxes size={14} />
                  <span>{s.skillInstallGroup}</span>
                </div>
                <div className="skill-install-options">
                  <button
                    type="button"
                    className={`skill-install-card ${skillSettings.installMethod === "symlink" ? "active" : ""}`}
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        skills: { ...defaultSkillSettings(), ...prev.skills, installMethod: "symlink" },
                      }))
                    }
                  >
                    <span className="skill-install-card-title">{s.skillInstallSymlink}</span>
                    <span className="skill-install-card-desc">{s.skillInstallSymlinkDesc}</span>
                  </button>
                  <button
                    type="button"
                    className={`skill-install-card ${skillSettings.installMethod === "copy" ? "active" : ""}`}
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        skills: { ...defaultSkillSettings(), ...prev.skills, installMethod: "copy" },
                      }))
                    }
                  >
                    <span className="skill-install-card-title">{s.skillInstallCopy}</span>
                    <span className="skill-install-card-desc">{s.skillInstallCopyDesc}</span>
                  </button>
                </div>
                <p className="field-hint">{s.skillInstallHint}</p>
              </div>

              <div className="settings-panel">
                <div className="settings-group-title">
                  <RefreshCw size={14} />
                  <span>{s.skillCustomScanGroup}</span>
                </div>
                <p className="settings-group-desc">{s.skillCustomScanDesc}</p>
                <div className="settings-toggle-row">
                  <div>
                    <div className="settings-toggle-title">{s.skillWatchFolders}</div>
                    <p className="settings-toggle-desc">{s.skillWatchFoldersDesc}</p>
                  </div>
                  <button
                    type="button"
                    className={`settings-switch ${skillSettings.watchExternalFolders ? "on" : ""}`}
                    role="switch"
                    aria-checked={skillSettings.watchExternalFolders}
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        skills: {
                          ...defaultSkillSettings(),
                          ...prev.skills,
                          watchExternalFolders: !skillSettings.watchExternalFolders,
                        },
                      }))
                    }
                  />
                </div>
                <div className="skill-scan-add-row">
                  <input
                    type="text"
                    className="settings-input"
                    value={skillScanInput}
                    onChange={(e) => setSkillScanInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addSkillScanPath()}
                    placeholder={s.skillCustomScanPlaceholder}
                    spellCheck={false}
                  />
                  <button type="button" className="btn btn-primary btn-sm" onClick={addSkillScanPath}>
                    <Plus size={14} />
                    {s.skillCustomScanAdd}
                  </button>
                </div>
                {skillSettings.customScanPaths.length === 0 ? (
                  <p className="skill-scan-empty">{s.skillCustomScanEmpty}</p>
                ) : (
                  <ul className="skill-scan-list">
                    {skillSettings.customScanPaths.map((p, i) => (
                      <li key={`${p}-${i}`}>
                        <code>{p}</code>
                        <button
                          type="button"
                          className="icon-btn danger"
                          title={s.skillCustomScanRemove}
                          onClick={() => removeSkillScanPath(i)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="settings-panel">
                <div className="settings-group-title">
                  <Globe size={14} />
                  <span>{s.skillBuiltinGroup}</span>
                </div>
                <p className="settings-group-desc">{s.skillBuiltinDesc}</p>
                <ul className="skill-builtin-list">
                  {builtinSkillScanRows().map((row) => (
                    <li key={row.tilde}>
                      <span className="skill-builtin-label">{row.label}</span>
                      <code>
                        {dataPaths?.home
                          ? expandTildePath(row.tilde, dataPaths.home)
                          : row.tilde}
                      </code>
                    </li>
                  ))}
                </ul>
                <div className="skill-scan-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleSkillAddAllKnown}
                    title={s.skillAddAllKnownDesc}
                  >
                    <Plus size={14} />
                    {s.skillAddAllKnown}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleSkillSyncNow}
                    disabled={skillSyncing}
                  >
                    <RefreshCw size={14} className={skillSyncing ? "spin" : ""} />
                    {s.skillSyncNow}
                  </button>
                  {skillSyncMsg && (
                    <span className="skill-sync-msg">{skillSyncMsg}</span>
                  )}
                </div>
              </div>

              <div className="form-actions">
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saved ? (
                    <>
                      <Check size={16} /> {s.btnSaved}
                    </>
                  ) : (
                    <>
                      <Save size={16} /> {saving ? s.btnSaving : s.btnSave}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Prompt 扫描 */}
          {activeSection === "prompt" && (
            <div className="section">
              <div className="section-header">
                <h2>{s.promptTitle}</h2>
                <p>{s.promptSubtitle}</p>
              </div>

              <div className="settings-panel">
                <div className="settings-group-title">
                  <RefreshCw size={14} />
                  <span>{s.promptCustomScanGroup}</span>
                </div>
                <p className="settings-group-desc">{s.promptCustomScanDesc}</p>
                <div className="settings-toggle-row">
                  <div>
                    <div className="settings-toggle-title">{s.promptAutoScanOnStartup}</div>
                    <p className="settings-toggle-desc">{s.promptAutoScanOnStartupDesc}</p>
                  </div>
                  <button
                    type="button"
                    className={`settings-switch ${promptSettings.autoScanOnStartup ? "on" : ""}`}
                    role="switch"
                    aria-checked={promptSettings.autoScanOnStartup}
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        prompts: {
                          ...defaultPromptSettings(),
                          ...prev.prompts,
                          autoScanOnStartup: !promptSettings.autoScanOnStartup,
                        },
                      }))
                    }
                  />
                </div>
                <div className="skill-scan-add-row">
                  <input
                    type="text"
                    className="settings-input"
                    value={promptScanInput}
                    onChange={(e) => setPromptScanInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addPromptScanPath()}
                    placeholder={s.promptCustomScanPlaceholder}
                    spellCheck={false}
                  />
                  <button type="button" className="btn btn-primary btn-sm" onClick={addPromptScanPath}>
                    <Plus size={14} />
                    {s.promptCustomScanAdd}
                  </button>
                </div>
                {promptSettings.customScanPaths.length === 0 ? (
                  <p className="skill-scan-empty">{s.promptCustomScanEmpty}</p>
                ) : (
                  <ul className="skill-scan-list">
                    {promptSettings.customScanPaths.map((p, i) => (
                      <li key={`${p}-${i}`}>
                        <code>{p}</code>
                        <button
                          type="button"
                          className="icon-btn danger"
                          title={s.promptCustomScanRemove}
                          onClick={() => removePromptScanPath(i)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="settings-panel">
                <div className="settings-group-title">
                  <Globe size={14} />
                  <span>{s.promptBuiltinGroup}</span>
                </div>
                <p className="settings-group-desc">{s.promptBuiltinDesc}</p>
                <ul className="skill-builtin-list">
                  {builtinPromptScanRows().map((row) => (
                    <li key={row.tilde}>
                      <span className="skill-builtin-label">{row.label}</span>
                      <code>
                        {dataPaths?.home
                          ? expandTildePath(row.tilde, dataPaths.home)
                          : row.tilde}
                      </code>
                    </li>
                  ))}
                </ul>
                <div className="skill-scan-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handlePromptAddAllKnown}
                    title={s.promptAddAllKnownDesc}
                  >
                    <Plus size={14} />
                    {s.promptAddAllKnown}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handlePromptSyncNow}
                    disabled={promptSyncing}
                  >
                    <RefreshCw size={14} className={promptSyncing ? "spin" : ""} />
                    {s.promptSyncNow}
                  </button>
                  {promptSyncMsg && (
                    <span className="skill-sync-msg">{promptSyncMsg}</span>
                  )}
                </div>
              </div>

              <div className="form-actions">
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saved ? (
                    <>
                      <Check size={16} /> {s.btnSaved}
                    </>
                  ) : (
                    <>
                      <Save size={16} /> {saving ? s.btnSaving : s.btnSave}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Notifications / 消息设置 */}
          {activeSection === "notifications" && (
            <div className="section">
              <div className="section-header">
                <h2>{s.notifTitle}</h2>
                <p>{s.notifSubtitle}</p>
              </div>

              <div className="settings-panel notifications-card">
                <div className="notifications-card-label">{s.notifTitle}</div>
                <div className="settings-toggle-row">
                  <div>
                    <div className="settings-toggle-title">{s.notifEnable}</div>
                    <p className="settings-toggle-desc">{s.notifEnableDesc}</p>
                  </div>
                  <button
                    type="button"
                    className={`settings-switch ${notifSettings.enabled ? "on" : ""}`}
                    role="switch"
                    aria-checked={notifSettings.enabled}
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        notifications: {
                          ...defaultNotificationSettings(),
                          ...prev.notifications,
                          enabled: !notifSettings.enabled,
                        },
                      }))
                    }
                  />
                </div>
                <div
                  className={`settings-toggle-row ${!notifSettings.enabled ? "disabled-row" : ""}`}
                >
                  <div>
                    <div className="settings-toggle-title">{s.notifCopySuccess}</div>
                    <p className="settings-toggle-desc">{s.notifCopySuccessDesc}</p>
                  </div>
                  <button
                    type="button"
                    className={`settings-switch ${notifSettings.copySuccess ? "on" : ""}`}
                    role="switch"
                    aria-checked={notifSettings.copySuccess}
                    disabled={!notifSettings.enabled}
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        notifications: {
                          ...defaultNotificationSettings(),
                          ...prev.notifications,
                          copySuccess: !notifSettings.copySuccess,
                        },
                      }))
                    }
                  />
                </div>
                <div
                  className={`settings-toggle-row ${!notifSettings.enabled ? "disabled-row" : ""}`}
                >
                  <div>
                    <div className="settings-toggle-title">{s.notifSaveSuccess}</div>
                    <p className="settings-toggle-desc">{s.notifSaveSuccessDesc}</p>
                  </div>
                  <button
                    type="button"
                    className={`settings-switch ${notifSettings.saveSuccess ? "on" : ""}`}
                    role="switch"
                    aria-checked={notifSettings.saveSuccess}
                    disabled={!notifSettings.enabled}
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        notifications: {
                          ...defaultNotificationSettings(),
                          ...prev.notifications,
                          saveSuccess: !notifSettings.saveSuccess,
                        },
                      }))
                    }
                  />
                </div>
              </div>

              <div className="form-actions">
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saved ? (
                    <>
                      <Check size={16} /> {s.btnSaved}
                    </>
                  ) : (
                    <>
                      <Save size={16} /> {saving ? s.btnSaving : s.btnSave}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Organization Section */}
          {activeSection === "organization" && (
            <div className="section">
              <div className="section-header">
                <h2>{s.orgTitle}</h2>
                <p>{s.orgSubtitle}</p>
              </div>

              {orgLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>Loading...</div>
              ) : (
                <>
                  {/* 当前所属组织 */}
                  <div className="org-current-card">
                    <div className="org-card-label">
                      <Building2 size={14} />
                      {s.orgCurrentLabel}
                    </div>
                    {currentOrg ? (
                      <div className="org-current-info">
                        <div className="org-current-detail">
                          <div className="org-current-name">{currentOrg.name}</div>
                          <div className="org-current-meta">
                            <span className="org-role-badge">{currentOrg.role}</span>
                            <span className="org-slug">@{currentOrg.slug}</span>
                          </div>
                        </div>
                        <button
                          className="btn btn-sm btn-danger-outline"
                          onClick={handleLeaveOrg}
                        >
                          <LogOut size={13} />
                          {s.orgLeave}
                        </button>
                      </div>
                    ) : (
                      <div className="org-empty">
                          <p>{s.orgNotMember}</p>
                          <div className="org-join-form">
                            <input
                              type="text"
                              value={inviteSlug}
                              onChange={(e) => setInviteSlug(e.target.value)}
                              placeholder={s.orgJoinPlaceholder}
                              className="form-input"
                              spellCheck={false}
                              onKeyDown={(e) => e.key === 'Enter' && handleJoinOrg()}
                            />
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={handleJoinOrg}
                              disabled={!inviteSlug.trim()}
                            >
                              <UserPlus size={14} />
                              {s.orgJoin}
                            </button>
                          </div>
                        </div>
                    )}
                  </div>

                  {/* 邀请他人加入 - 仅在已有组织且为 owner/admin 时显示 */}
                  {currentOrg && (currentOrg.role === 'owner' || currentOrg.role === 'admin') && (
                    <div className="org-invite-section">
                      <div className="org-card-label">
                        <UserPlus size={14} />
                        {s.orgInviteMembersLabel}
                      </div>
                      <div className="org-join-form">
                        <input
                          type="text"
                          value={inviteTarget}
                          onChange={(e) => setInviteTarget(e.target.value)}
                          placeholder={s.orgInvitePlaceholder}
                          className="form-input"
                          spellCheck={false}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendInvite()}
                        />
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={handleSendInvite}
                          disabled={!inviteTarget.trim()}
                        >
                          <Mail size={14} />
                          {s.orgSendInvite}
                        </button>
                      </div>
                      {/* 已发送的邀请列表 */}
                      {sentInvites.length > 0 && (
                        <div className="org-invite-list">
                          <div className="org-invite-list-label">{s.orgSentInvitationsLabel}</div>
                          {sentInvites.map((inv) => (
                            <div key={inv.id} className="org-invite-item sent">
                              <div className="org-invite-info">
                                <span className="org-invite-target">{inv.orgName}</span>
                                <span className="org-invite-time">{new Date(inv.invitedAt).toLocaleDateString()}</span>
                              </div>
                              <span className={`org-invite-status ${inv.status}`}>
                                {inv.status === 'pending' && <><Clock size={12} /> {s.orgStatusPending}</>}
                                {inv.status === 'accepted' && <><CheckCircle size={12} /> {s.orgStatusAccepted}</>}
                                {inv.status === 'declined' && <><XCircle size={12} /> {s.orgStatusDeclined}</>}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 收到的邀请列表 */}
                  {invitations.filter(i => i.status === 'pending').length > 0 && (
                    <div className="org-invite-section">
                      <div className="org-card-label">
                        <Mail size={14} />
                        {s.orgReceivedInvitationsLabel}
                      </div>
                      <div className="org-invite-list">
                        {invitations.filter(i => i.status === 'pending').map((inv) => (
                          <div key={inv.id} className="org-invite-item received">
                            <div className="org-invite-info">
                              {inv.invitedByAvatar && (
                                <img src={inv.invitedByAvatar} alt="" className="org-invite-avatar" />
                              )}
                              <div>
                                <span className="org-invite-org">{inv.orgName}</span>
                                <span className="org-invite-from">{s.orgInvitedBy} @{inv.invitedBy}</span>
                              </div>
                            </div>
                            <div className="org-invite-actions">
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => handleRespondInvite(inv.id, 'accepted')}
                              >
                                <Check size={13} />
                                {s.orgAccept}
                              </button>
                              <button
                                className="btn btn-sm btn-outline"
                                onClick={() => handleRespondInvite(inv.id, 'declined')}
                              >
                                <XCircle size={13} />
                                {s.orgDecline}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Market Registry URL */}
                  <div className="form-group" style={{ marginTop: '2rem' }}>
                    <label>
                      <Globe size={14} />
                      {s.orgMarketRegistryLabel}
                    </label>
                    <input
                      type="text"
                      value={settings.marketRegistryUrl || ''}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, marketRegistryUrl: e.target.value }))
                      }
                      placeholder="https://api.github.com/repos/owner/repo/contents/skills.json"
                      className="form-input"
                      spellCheck={false}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block', marginTop: '0.35rem' }}>
                      {s.orgMarketRegistryHint}
                    </span>
                  </div>

                  <div className="form-actions">
                    <button
                      className="btn btn-primary"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saved ? (
                        <>
                          <Check size={16} /> {s.btnSaved}
                        </>
                      ) : (
                        <>
                          <Save size={16} /> {saving ? s.btnSaving : s.btnSave}
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* AI 服务配置 Section */}
          {activeSection === "ai" && (
            <div className="section">
              <div className="section-header">
                <h2>{s.aiTitle}</h2>
                <p>{s.aiSubtitle}</p>
              </div>

              <div className="settings-group">
                <div className="settings-group-title">
                  <KeyRound size={14} />
                  <span>{s.aiApiConfigLabel}</span>
                </div>

                <div className="form-row">
                  <label>{s.aiProviderLabel}</label>
                  <select
                    className="settings-select"
                    value={settings.ai?.provider || "openai"}
                    onChange={(e) => {
                      const nextProvider = e.target.value as AiProvider;
                      setSettings((prev) => ({
                        ...prev,
                        ai: {
                          provider: nextProvider,
                          apiKey: prev.ai?.apiKey || "",
                          baseUrl: prev.ai?.baseUrl || "",
                          model: normalizeModelOnProviderChange(
                            prev.ai?.model,
                            nextProvider
                          ),
                          bailianCodingRegion:
                            prev.ai?.bailianCodingRegion || "cn",
                        },
                      }));
                    }}
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="bailian_coding">{s.aiProviderBailianCoding}</option>
                    <option value="custom">{s.aiProviderCustom}</option>
                  </select>
                </div>

                <div className="form-row">
                  <label>{s.aiApiKeyLabel}</label>
                  <div className="input-with-toggle">
                    <input
                      type={showSecret ? "text" : "password"}
                      className="settings-input"
                      value={settings.ai?.apiKey || ""}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          ai: {
                            provider: prev.ai?.provider || "openai",
                            apiKey: e.target.value,
                            baseUrl: prev.ai?.baseUrl || "",
                            model: prev.ai?.model || "",
                            bailianCodingRegion:
                              prev.ai?.bailianCodingRegion || "cn",
                          },
                        }))
                      }
                      placeholder={
                        (settings.ai?.provider || "openai") === "anthropic"
                          ? "sk-ant-..."
                          : (settings.ai?.provider || "openai") === "deepseek"
                          ? "sk-..."
                          : (settings.ai?.provider || "openai") === "bailian_coding"
                          ? "sk-sp-..."
                          : "sk-..."
                      }
                    />
                    <button
                      type="button"
                      className="toggle-btn"
                      onClick={() => setShowSecret((v) => !v)}
                    >
                      {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <p className="field-hint">
                    {(settings.ai?.provider || "openai") === "anthropic"
                      ? s.aiApiKeyHintAnthropic
                      : (settings.ai?.provider || "openai") === "deepseek"
                      ? s.aiApiKeyHintDeepSeek
                      : (settings.ai?.provider || "openai") === "bailian_coding"
                      ? s.aiApiKeyHintBailianCoding
                      : s.aiApiKeyHintOpenAI}
                  </p>
                </div>

                {(settings.ai?.provider || "openai") === "bailian_coding" && (
                  <div className="form-row">
                    <label>{s.aiBailianRegionLabel}</label>
                    <select
                      className="settings-select"
                      value={settings.ai?.bailianCodingRegion || "cn"}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          ai: {
                            provider: prev.ai?.provider || "bailian_coding",
                            apiKey: prev.ai?.apiKey || "",
                            baseUrl: prev.ai?.baseUrl || "",
                            model: prev.ai?.model || "",
                            bailianCodingRegion: e.target
                              .value as BailianCodingRegion,
                          },
                        }))
                      }
                    >
                      <option value="cn">{s.aiBailianRegionCn}</option>
                      <option value="intl">{s.aiBailianRegionIntl}</option>
                    </select>
                  </div>
                )}

                {(settings.ai?.provider || "openai") === "custom" && (
                  <div className="form-row">
                    <label>{s.aiBaseUrlLabel}</label>
                    <input
                      type="text"
                      className="settings-input"
                      value={settings.ai?.baseUrl || ""}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          ai: {
                            provider: prev.ai?.provider || "custom",
                            apiKey: prev.ai?.apiKey || "",
                            baseUrl: e.target.value,
                            model: prev.ai?.model || "",
                            bailianCodingRegion:
                              prev.ai?.bailianCodingRegion || "cn",
                          },
                        }))
                      }
                      placeholder="https://your-api-endpoint.com"
                    />
                    <p className="field-hint">
                      {s.aiBaseUrlHint}
                    </p>
                  </div>
                )}

                <div className="form-row">
                  <label>{s.aiModelLabel}</label>
                  {(() => {
                    const aiProvider = (settings.ai?.provider ||
                      "openai") as AiProvider;
                    const modelSuggestions = getModelsForProvider(aiProvider);
                    const listId = "settings-ai-model-suggestions";
                    return modelSuggestions ? (
                      <>
                        <input
                          type="text"
                          className="settings-input"
                          value={settings.ai?.model || ""}
                          list={listId}
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              ai: {
                                provider: prev.ai?.provider || "openai",
                                apiKey: prev.ai?.apiKey || "",
                                baseUrl: prev.ai?.baseUrl || "",
                                model: e.target.value,
                                bailianCodingRegion:
                                  prev.ai?.bailianCodingRegion || "cn",
                              },
                            }))
                          }
                          placeholder={
                            aiProvider === "anthropic"
                              ? "claude-3-5-sonnet-20241022"
                              : aiProvider === "deepseek"
                              ? "deepseek-chat"
                              : aiProvider === "bailian_coding"
                              ? "qwen3.6-plus"
                              : "gpt-4o"
                          }
                        />
                        <datalist id={listId}>
                          {modelSuggestions.map((m) => (
                            <option key={m} value={m} />
                          ))}
                        </datalist>
                        <p className="field-hint">
                          {s.aiModelHint} {s.aiModelPickOrTypeHint}
                        </p>
                      </>
                    ) : (
                      <>
                        <input
                          type="text"
                          className="settings-input"
                          value={settings.ai?.model || ""}
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              ai: {
                                provider: prev.ai?.provider || "openai",
                                apiKey: prev.ai?.apiKey || "",
                                baseUrl: prev.ai?.baseUrl || "",
                                model: e.target.value,
                                bailianCodingRegion:
                                  prev.ai?.bailianCodingRegion || "cn",
                              },
                            }))
                          }
                          placeholder="gpt-4o"
                        />
                        <p className="field-hint">{s.aiModelHint}</p>
                      </>
                    );
                  })()}
                </div>

                <div className="ai-info-box">
                  <Sparkles size={14} />
                  <div>
                    <p className="ai-info-title">{s.aiInfoTitle}</p>
                    <p className="ai-info-desc">
                      {s.aiInfoDesc}
                    </p>
                  </div>
                </div>
              </div>

              <div className="section-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <RotateCw size={14} className="spin" />
                      {s.btnSaving}
                    </>
                  ) : saved ? (
                    <>
                      <Check size={14} />
                      {s.btnSaved}
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      {s.btnSave}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Update Section */}
          {activeSection === "update" && (
            <div className="section">
              <div className="section-header">
                <h2>{s.updateTitle}</h2>
                <p>{s.updateSubtitle}</p>
              </div>

              {/* 当前版本信息 */}
              <div className="update-version-card">
                <div className="update-version-info">
                  <Info size={18} />
                  <div>
                    <div className="update-version-label">{s.updateCurrentVersionLabel}</div>
                    <div className="update-version-value">v{currentVersion}</div>
                  </div>
                </div>
              </div>

              <div className="community-card">
                <div className="community-card-header">
                  <Globe size={18} />
                  <div>
                    <div className="community-card-title">{s.communityTitle}</div>
                    <p className="community-card-subtitle">{s.communitySubtitle}</p>
                  </div>
                </div>
                <div className="community-links">
                  <a
                    className="community-link"
                    href={PROMPTMAN_WEB_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={16} />
                    <span>
                      <strong>{s.communityWebsite}</strong>
                      <em>{s.communityWebsiteDesc}</em>
                    </span>
                  </a>
                  <a
                    className="community-link"
                    href={PROMPTMAN_GITHUB_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Github size={16} />
                    <span>
                      <strong>{s.communityGitHub}</strong>
                      <em>{s.communityGitHubDesc}</em>
                    </span>
                  </a>
                </div>
                <p className="community-star-hint">
                  <Star size={14} />
                  {s.communityStarHint}
                </p>
              </div>

              {/* 更新状态面板 */}
              <div className="update-status-card">
                {/* 空闲状态 */}
                {updateStatus === "idle" && (
                  <div className="update-status-content">
                    <div className="update-status-icon idle">
                      <RefreshCw size={28} />
                    </div>
                    <h3>{s.updateIdle}</h3>
                    <p>{s.updateIdleDesc}</p>
                    <button className="btn btn-primary" onClick={handleCheckUpdate}>
                      <RefreshCw size={16} />
                      {s.updateIdleBtn}
                    </button>
                  </div>
                )}

                {/* 检查中 */}
                {updateStatus === "checking" && (
                  <div className="update-status-content">
                    <div className="update-status-icon checking">
                      <RotateCw size={28} className="spin" />
                    </div>
                    <h3>{s.updateChecking}</h3>
                    <p>{s.updateCheckingDesc}</p>
                  </div>
                )}

                {/* 有可用更新 */}
                {updateStatus === "available" && (
                  <div className="update-status-content">
                    <div className="update-status-icon available">
                      <Download size={28} />
                    </div>
                    <h3>{s.updateAvailable}</h3>
                    <p>
                      {s.updateAvailableDesc} <strong>v{updateVersion}</strong> {s.updateAvailableDesc2}
                    </p>
                    {updateReleaseNotes && (
                      <div className="update-release-notes">
                        <h4>{s.updateReleaseNotesLabel}</h4>
                        <div className="release-notes-content">{updateReleaseNotes}</div>
                      </div>
                    )}
                    <button className="btn btn-primary" onClick={handleDownloadUpdate}>
                      <Download size={16} />
                      {s.updateDownloadBtn}
                    </button>
                  </div>
                )}

                {/* 下载中 */}
                {updateStatus === "downloading" && (
                  <div className="update-status-content">
                    <div className="update-status-icon downloading">
                      <Download size={28} />
                    </div>
                    <h3>{s.updateDownloading}</h3>
                    <p>{s.updateDownloadingDesc} v{updateVersion}</p>
                    <div className="update-progress">
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${Math.round(updateProgress)}%` }}
                        />
                      </div>
                      <span className="progress-text">{Math.round(updateProgress)}%</span>
                    </div>
                  </div>
                )}

                {/* 下载完成 */}
                {updateStatus === "downloaded" && (
                  <div className="update-status-content">
                    <div className="update-status-icon downloaded">
                      <Check size={28} />
                    </div>
                    <h3>{s.updateDownloaded}</h3>
                    <p>
                      {s.updateDownloadedDesc} <strong>v{updateVersion}</strong> {s.updateDownloadedDesc2}
                    </p>
                    <button className="btn btn-primary" onClick={handleInstallUpdate}>
                      <RotateCw size={16} />
                      {s.updateInstallBtn}
                    </button>
                  </div>
                )}

                {/* 已是最新 */}
                {updateStatus === "not-available" && (
                  <div className="update-status-content">
                    <div className="update-status-icon up-to-date">
                      <Check size={28} />
                    </div>
                    <h3>{s.updateUpToDate}</h3>
                    <p>{s.updateUpToDateDesc.replace('{version}', currentVersion)}</p>
                    <button className="btn btn-outline" onClick={handleCheckUpdate}>
                      <RefreshCw size={16} />
                      {s.updateCheckAgainBtn}
                    </button>
                  </div>
                )}

                {/* 错误状态 */}
                {updateStatus === "error" && (
                  <div className="update-status-content">
                    <div className="update-status-icon error">
                      <AlertCircle size={28} />
                    </div>
                    <h3>{s.updateError}</h3>
                    <p className="error-text">{updateError || s.updateErrorDefault}</p>
                    <button className="btn btn-primary" onClick={handleCheckUpdate}>
                      <RefreshCw size={16} />
                      {s.updateRetryBtn}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .settings-container {
          padding-bottom: 3rem;
          animation: fadeIn 0.35s ease;
        }

        .settings-header {
          margin-bottom: 2rem;
        }

        .settings-title h1 {
          font-size: 1.6rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.03em;
          margin-bottom: 0.3rem;
        }

        .settings-title p {
          font-size: 0.88rem;
          color: var(--text-tertiary);
        }

        .error-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0.75rem 1rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: var(--radius-lg);
          color: #ef4444;
          font-size: 0.85rem;
          margin-bottom: 1.5rem;
          animation: fadeIn 0.3s ease;
        }

        /* Layout */
        .settings-layout {
          display: flex;
          gap: 2rem;
          min-height: 500px;
        }

        .settings-nav {
          width: 200px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: transparent;
          border: 1px solid transparent;
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: all var(--transition-fast);
          text-align: left;
        }

        .nav-item:hover {
          background: var(--bg-glass);
          color: var(--text-primary);
        }

        .nav-item.active {
          background: var(--accent-color);
          color: white;
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
        }

        .settings-content {
          flex: 1;
          min-width: 0;
        }

        /* Section */
        .section {
          animation: fadeIn 0.25s ease;
        }

        .section-header {
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--border-color);
        }

        .section-header h2 {
          font-size: 1.2rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.02em;
          margin-bottom: 0.3rem;
        }

        .section-header p {
          font-size: 0.85rem;
          color: var(--text-tertiary);
        }

        /* Account Card */
        .account-card {
          background: var(--bg-glass);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          padding: 1.5rem;
        }

        .account-info {
          display: flex;
          gap: 1.25rem;
          margin-bottom: 1.5rem;
        }

        .account-avatar {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          border: 3px solid var(--border-color);
          flex-shrink: 0;
        }

        .account-details h3 {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 0.15rem;
        }

        .account-login {
          display: block;
          font-size: 0.82rem;
          color: var(--text-tertiary);
          margin-bottom: 0.25rem;
        }

        .account-provider {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.72rem;
          color: var(--text-tertiary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-full);
          padding: 1px 8px;
          margin-bottom: 0.35rem;
          text-transform: capitalize;
        }

        .account-email {
          display: block;
          font-size: 0.82rem;
          color: var(--text-secondary);
          margin-bottom: 0.4rem;
        }

        .account-bio {
          font-size: 0.85rem;
          color: var(--text-secondary);
          line-height: 1.5;
          margin-top: 0.5rem;
        }

        .account-org-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-top: 0.35rem;
          padding: 3px 10px;
          background: rgba(99, 102, 241, 0.12);
          border: 1px solid rgba(99, 102, 241, 0.25);
          border-radius: var(--radius-full);
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--accent-color);
        }

        .account-actions {
          display: flex;
          gap: 0.75rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border-color);
        }

        /* Login Card */
        .login-card {
          background: var(--bg-glass);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          padding: 2.5rem;
          text-align: center;
        }

        .login-icon {
          color: var(--text-tertiary);
          margin-bottom: 1rem;
          opacity: 0.5;
        }

        .login-card h3 {
          font-size: 1.1rem;
          color: var(--text-primary);
          font-weight: 600;
          margin-bottom: 0.5rem;
        }

        .login-card > p {
          font-size: 0.88rem;
          color: var(--text-tertiary);
          margin-bottom: 1.5rem;
          max-width: 400px;
          margin-left: auto;
          margin-right: auto;
        }

        .login-hint {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 1rem;
          font-size: 0.78rem;
          color: var(--text-tertiary);
        }

        /* Form */
        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-group label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 0.5rem;
        }

        .form-input {
          width: 100%;
          padding: 10px 14px;
          background: var(--bg-glass);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: 0.88rem;
          font-family: "SF Mono", ui-monospace, monospace;
          transition: all var(--transition-fast);
          outline: none;
        }

        .form-input:focus {
          border-color: var(--accent-color);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
        }

        .form-input::placeholder {
          color: var(--text-tertiary);
          font-family: inherit;
        }

        .input-with-toggle {
          position: relative;
        }

        .input-with-toggle .form-input {
          padding-right: 44px;
        }

        .toggle-visibility {
          position: absolute;
          right: 4px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: var(--text-tertiary);
          padding: 8px;
          cursor: pointer;
          border-radius: var(--radius-sm);
          transition: color var(--transition-fast);
        }

        .toggle-visibility:hover {
          color: var(--text-primary);
        }

        .form-actions {
          margin-top: 2rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--border-color);
        }

        /* Theme Options */
        .theme-options {
          display: flex;
          gap: 1rem;
        }

        .theme-option {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: var(--bg-glass);
          border: 2px solid var(--border-color);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all var(--transition-fast);
          color: var(--text-secondary);
          font-size: 0.82rem;
          font-weight: 500;
        }

        .theme-option:hover {
          border-color: var(--border-light);
        }

        .theme-option.active {
          border-color: var(--accent-color);
          color: var(--accent-color);
        }

        .theme-preview {
          width: 80px;
          height: 50px;
          border-radius: 6px;
          display: flex;
          overflow: hidden;
          border: 1px solid var(--border-color);
        }

        .dark-preview {
          background: #0f1117;
        }

        .dark-preview .tp-sidebar {
          width: 25px;
          background: #1a1b26;
          border-right: 1px solid #2a2b3a;
        }

        .dark-preview .tp-content {
          flex: 1;
          background: #16171e;
        }

        .light-preview {
          background: #ffffff;
        }

        .light-preview .tp-sidebar {
          width: 25px;
          background: #f5f5f5;
          border-right: 1px solid #e5e5e5;
        }

        .light-preview .tp-content {
          flex: 1;
          background: #fafafa;
        }

        .system-preview {
          background: linear-gradient(135deg, #0f1117 50%, #ffffff 50%);
        }

        .system-preview .tp-sidebar {
          width: 25px;
          background: linear-gradient(180deg, #1a1b26 50%, #f5f5f5 50%);
          border-right: 1px solid #2a2b3a;
        }

        .system-preview .tp-content {
          flex: 1;
          background: linear-gradient(180deg, #16171e 50%, #fafafa 50%);
        }

        /* Language Options */
        .language-options {
          display: flex;
          gap: 0.75rem;
        }

        .lang-option {
          padding: 9px 20px;
          background: var(--bg-glass);
          border: 2px solid var(--border-color);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .lang-option:hover {
          border-color: var(--border-light);
          color: var(--text-primary);
        }

        .lang-option.active {
          border-color: var(--accent-color);
          color: var(--accent-color);
          background: rgba(99, 102, 241, 0.08);
        }

        /* Buttons */
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 18px;
          border-radius: var(--radius-md);
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all var(--transition-normal);
          letter-spacing: -0.01em;
          border: 1px solid transparent;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: var(--accent-color);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: var(--accent-hover);
          box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
          transform: translateY(-1px);
        }

        .btn-primary:active:not(:disabled) {
          transform: translateY(0);
        }

        .btn-github {
          background: #24292e;
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 11px 24px;
          font-size: 0.9rem;
        }

        .btn-github:hover {
          background: #2f363d;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
          transform: translateY(-1px);
        }

        .btn-outline {
          background: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
        }

        .btn-outline:hover {
          background: var(--bg-item-hover);
          color: var(--text-primary);
          border-color: var(--border-light);
        }

        .btn-danger {
          background: transparent;
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
        }

        .btn-danger:hover {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.5);
        }

        /* Navigation Badge (for update available) */
        .nav-badge {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ef4444;
          margin-left: auto;
          animation: pulse-badge 2s ease infinite;
        }

        @keyframes pulse-badge {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        /* Update Section Styles */
        .update-version-card {
          background: var(--bg-glass);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 1.25rem 1.5rem;
          margin-bottom: 1.5rem;
        }

        .update-version-info {
          display: flex;
          align-items: center;
          gap: 14px;
          color: var(--text-secondary);
        }

        .update-version-label {
          font-size: 0.78rem;
          color: var(--text-tertiary);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 2px;
        }

        .update-version-value {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text-primary);
          font-family: "SF Mono", ui-monospace, monospace;
        }

        .community-card {
          background: var(--bg-glass);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 1.25rem 1.5rem;
          margin-bottom: 1.5rem;
        }

        .community-card-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 0.85rem;
          color: var(--text-secondary);
        }

        .community-card-title {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .community-card-subtitle {
          margin: 0.15rem 0 0;
          font-size: 0.78rem;
          color: var(--text-tertiary);
        }

        .community-links {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .community-link {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 0.7rem 0.85rem;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color);
          background: var(--bg-primary, transparent);
          color: var(--text-secondary);
          text-decoration: none;
          transition: border-color 0.15s ease, background 0.15s ease;
        }

        .community-link:hover {
          border-color: var(--accent-color, #6366f1);
        }

        .community-link span {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .community-link strong {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .community-link em {
          font-style: normal;
          font-size: 0.75rem;
          color: var(--text-tertiary);
        }

        .community-star-hint {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin: 0.85rem 0 0;
          font-size: 0.78rem;
          line-height: 1.45;
          color: var(--text-tertiary);
        }

        .update-status-card {
          background: var(--bg-glass);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          padding: 2.5rem;
        }

        .update-status-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 0.75rem;
        }

        .update-status-content h3 {
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }

        .update-status-content > p {
          font-size: 0.88rem;
          color: var(--text-tertiary);
          max-width: 400px;
          line-height: 1.5;
          margin-bottom: 0.5rem;
        }

        .update-status-icon {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 0.5rem;
        }

        .update-status-icon.idle {
          background: rgba(99, 102, 241, 0.1);
          color: var(--accent-color);
        }

        .update-status-icon.checking {
          background: rgba(99, 102, 241, 0.1);
          color: var(--accent-color);
        }

        .update-status-icon.available {
          background: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
        }

        .update-status-icon.downloading {
          background: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
        }

        .update-status-icon.downloaded {
          background: rgba(34, 197, 94, 0.1);
          color: #22c55e;
        }

        .update-status-icon.up-to-date {
          background: rgba(34, 197, 94, 0.1);
          color: #22c55e;
        }

        .update-status-icon.error {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }

        .spin {
          animation: spin 1.2s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Release Notes */
        .update-release-notes {
          width: 100%;
          max-width: 500px;
          background: var(--bg-glass);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 1rem 1.25rem;
          margin: 0.5rem 0;
          text-align: left;
        }

        .update-release-notes h4 {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 0.5rem;
        }

        .release-notes-content {
          font-size: 0.85rem;
          color: var(--text-secondary);
          line-height: 1.6;
          white-space: pre-wrap;
          max-height: 160px;
          overflow-y: auto;
        }

        /* Progress Bar */
        .update-progress {
          width: 100%;
          max-width: 360px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .progress-bar {
          flex: 1;
          height: 6px;
          background: var(--border-color);
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--accent-color), #3b82f6);
          border-radius: 3px;
          transition: width 0.3s ease;
        }

        .progress-text {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text-secondary);
          font-family: "SF Mono", ui-monospace, monospace;
          min-width: 36px;
          text-align: right;
        }

        .error-text {
          color: #ef4444 !important;
        }

        /* Organization Section */
        .org-current-card {
          background: var(--bg-glass);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 1.25rem;
          margin-bottom: 1rem;
        }

        .org-card-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 0.75rem;
        }

        .org-current-info {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }

        .org-current-detail {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .org-current-name {
          font-size: 1.05rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .org-current-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.78rem;
        }

        .org-role-badge {
          display: inline-flex;
          padding: 2px 8px;
          border-radius: var(--radius-full);
          background: var(--accent-color);
          color: #fff;
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: capitalize;
        }

        .org-slug {
          color: var(--text-tertiary);
        }

        .org-empty {
          text-align: center;
          padding: 0.5rem 0;
        }

        .org-empty p {
          font-size: 0.88rem;
          color: var(--text-tertiary);
          margin-bottom: 1rem;
        }

        .org-join-form {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .org-join-form .form-input {
          flex: 1;
        }

        .btn-sm {
          padding: 6px 12px !important;
          font-size: 0.8rem !important;
          gap: 4px !important;
        }

        .btn-danger-outline {
          background: transparent !important;
          border: 1px solid rgba(239, 68, 68, 0.3) !important;
          color: #ef4444 !important;
        }

        .btn-danger-outline:hover {
          background: rgba(239, 68, 68, 0.1) !important;
          border-color: #ef4444 !important;
        }

        .org-invite-section {
          background: var(--bg-glass);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 1.25rem;
          margin-bottom: 1rem;
        }

        .org-invite-list {
          margin-top: 0.75rem;
        }

        .org-invite-list-label {
          font-size: 0.75rem;
          color: var(--text-tertiary);
          margin-bottom: 0.5rem;
          font-weight: 500;
        }

        .org-invite-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.65rem 0;
          border-bottom: 1px solid var(--border-color);
        }

        .org-invite-item:last-child {
          border-bottom: none;
        }

        .org-invite-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .org-invite-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          object-fit: cover;
        }

        .org-invite-org {
          font-size: 0.88rem;
          font-weight: 500;
          color: var(--text-primary);
          display: block;
        }

        .org-invite-from,
        .org-invite-time {
          font-size: 0.75rem;
          color: var(--text-tertiary);
        }

        .org-invite-target {
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .org-invite-status {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .org-invite-status.pending {
          color: #f59e0b;
        }

        .org-invite-status.accepted {
          color: #10b981;
        }

        .org-invite-status.declined {
          color: #ef4444;
        }

        .org-invite-actions {
          display: flex;
          gap: 0.35rem;
        }

        @media (max-width: 768px) {
          .settings-layout {
            flex-direction: column;
          }

          .settings-nav {
            width: 100%;
            flex-direction: row;
            overflow-x: auto;
          }

          .nav-item {
            white-space: nowrap;
          }
        }

        /* AI 服务配置相关样式 */
        .settings-select {
          width: 100%;
          padding: 9px 12px;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          background: var(--bg-glass);
          color: var(--text-primary);
          font-size: 0.88rem;
          font-family: inherit;
          cursor: pointer;
          transition: all var(--transition-fast);
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 32px;
        }

        .settings-select:focus {
          outline: none;
          border-color: var(--border-focus);
          box-shadow: 0 0 0 3px var(--input-focus-shadow);
        }

        .settings-select option {
          background: var(--bg-primary);
          color: var(--text-primary);
        }

        .settings-input {
          width: 100%;
          padding: 9px 12px;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          background: var(--bg-glass);
          color: var(--text-primary);
          font-size: 0.88rem;
          font-family: inherit;
          transition: all var(--transition-fast);
        }

        .settings-input:focus {
          outline: none;
          border-color: var(--border-focus);
          box-shadow: 0 0 0 3px var(--input-focus-shadow);
        }

        .settings-input::placeholder {
          color: var(--text-tertiary);
        }

        .input-with-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .input-with-toggle .settings-input {
          flex: 1;
        }

        .toggle-btn {
          padding: 9px 10px;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          background: var(--bg-glass);
          color: var(--text-tertiary);
          cursor: pointer;
          transition: all var(--transition-fast);
          flex-shrink: 0;
          display: flex;
          align-items: center;
        }

        .toggle-btn:hover {
          background: var(--bg-item-hover);
          color: var(--text-secondary);
        }

        .form-row {
          margin-bottom: 1.25rem;
        }

        .form-row label {
          display: block;
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--text-secondary);
          margin-bottom: 0.4rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .field-hint {
          margin-top: 0.35rem;
          font-size: 0.75rem;
          color: var(--text-tertiary);
          line-height: 1.4;
        }

        .settings-group-title {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 1.25rem;
        }

        .ai-info-box {
          display: flex;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.07) 0%, rgba(139, 92, 246, 0.07) 100%);
          border: 1px solid rgba(99, 102, 241, 0.18);
          border-radius: var(--radius-lg);
          margin-top: 1rem;
          color: #818cf8;
        }

        .ai-info-box svg {
          flex-shrink: 0;
          margin-top: 2px;
        }

        .ai-info-title {
          font-size: 0.85rem;
          font-weight: 600;
          color: #a5b4fc;
          margin-bottom: 0.3rem;
        }

        .ai-info-desc {
          font-size: 0.8rem;
          color: rgba(165, 180, 252, 0.75);
          line-height: 1.5;
        }

        .section-actions {
          margin-top: 2rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .settings-panel {
          background: var(--bg-glass);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          padding: 1.25rem 1.5rem;
          margin-bottom: 1.25rem;
        }

        .settings-panel.muted {
          opacity: 0.92;
        }

        .settings-panel.local-first-banner {
          border-color: color-mix(in srgb, var(--accent, #6366f1) 28%, var(--border-color));
          background: color-mix(in srgb, var(--accent, #6366f1) 8%, var(--bg-glass));
        }

        .settings-group-desc {
          font-size: 0.8rem;
          color: var(--text-tertiary);
          line-height: 1.45;
          margin: -0.35rem 0 1rem;
        }

        .settings-info-text {
          font-size: 0.82rem;
          color: var(--text-secondary);
          line-height: 1.5;
          margin: 0;
        }

        .data-path-box {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .data-path-text {
          display: block;
          font-size: 0.78rem;
          word-break: break-all;
          padding: 0.65rem 0.75rem;
          background: var(--bg-primary);
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
        }

        .data-path-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .data-root-mode-options {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .data-root-mode-row {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          cursor: pointer;
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .data-root-mode-row input {
          margin-top: 0.2rem;
        }

        .data-path-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }

        .data-path-list li {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .data-path-label {
          font-size: 0.72rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-tertiary);
        }

        .data-path-list code {
          font-size: 0.75rem;
          word-break: break-all;
          color: var(--text-secondary);
        }

        .settings-toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.85rem 0;
          border-bottom: 1px solid var(--border-color);
        }

        .settings-toggle-row:last-child {
          border-bottom: none;
        }

        .settings-toggle-row.flat {
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .settings-toggle-title {
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .settings-toggle-desc {
          font-size: 0.78rem;
          color: var(--text-tertiary);
          line-height: 1.4;
          margin: 0.2rem 0 0;
          max-width: 36rem;
        }

        .settings-switch {
          flex-shrink: 0;
          width: 44px;
          height: 26px;
          border-radius: 13px;
          border: none;
          background: var(--border-color);
          cursor: pointer;
          position: relative;
          transition: background var(--transition-fast);
        }

        .settings-switch::after {
          content: "";
          position: absolute;
          top: 3px;
          left: 3px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          transition: transform var(--transition-fast);
        }

        .settings-switch.on {
          background: var(--accent-color);
        }

        .settings-switch.on::after {
          transform: translateX(18px);
        }

        .settings-switch:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .form-row.tight {
          margin-bottom: 0.85rem;
        }

        .field-hint.ok {
          color: #22c55e;
        }

        .field-hint.err {
          color: #ef4444;
        }

        .skill-install-options {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-bottom: 0.5rem;
        }

        .skill-install-card {
          flex: 1;
          min-width: 200px;
          text-align: left;
          padding: 0.85rem 1rem;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-color);
          background: var(--bg-primary);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .skill-install-card:hover {
          border-color: var(--border-light);
          background: var(--bg-item-hover);
        }

        .skill-install-card.active {
          border-color: var(--accent-color);
          box-shadow: 0 0 0 1px var(--accent-color);
        }

        .skill-install-card-title {
          display: block;
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 0.35rem;
        }

        .skill-install-card-desc {
          font-size: 0.76rem;
          color: var(--text-tertiary);
          line-height: 1.4;
        }

        .skill-scan-add-row {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.75rem;
          flex-wrap: wrap;
        }

        .skill-scan-add-row .settings-input {
          flex: 1;
          min-width: 180px;
        }

        .skill-scan-empty {
          font-size: 0.8rem;
          color: var(--text-tertiary);
          margin: 0.75rem 0 0;
        }

        .skill-scan-list {
          list-style: none;
          margin: 0.75rem 0 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .skill-scan-list li {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          padding: 0.45rem 0.55rem;
          background: var(--bg-primary);
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color);
        }

        .skill-scan-list code {
          font-size: 0.78rem;
          word-break: break-all;
          color: var(--text-secondary);
        }

        .icon-btn {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border: none;
          border-radius: var(--radius-md);
          background: transparent;
          color: var(--text-tertiary);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .icon-btn:hover {
          background: var(--bg-item-hover);
          color: var(--text-primary);
        }

        .icon-btn.danger:hover {
          color: #ef4444;
        }

        .skill-builtin-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .skill-builtin-list li {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          padding: 0.5rem 0;
          border-bottom: 1px solid var(--border-color);
        }

        .skill-builtin-list li:last-child {
          border-bottom: none;
        }

        .skill-builtin-label {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .skill-builtin-list code {
          font-size: 0.75rem;
          word-break: break-all;
          color: var(--text-tertiary);
        }

        .notifications-card {
          background: var(--bg-elevated);
          border: 1px solid var(--border-color);
        }

        .notifications-card-label {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.07em;
          margin-bottom: 0.5rem;
        }

        .settings-toggle-row.disabled-row {
          opacity: 0.48;
        }

        .skill-scan-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 0.75rem;
          flex-wrap: wrap;
        }

        .skill-sync-msg {
          font-size: 0.8rem;
          color: var(--text-secondary);
          padding: 4px 8px;
          background: var(--bg-glass);
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-color);
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .spin {
          animation: spin 0.8s linear infinite;
        }
      `}</style>
    </div>
  );
}
