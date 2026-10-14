"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { FileText, Plus, ArrowLeft, History, Sparkles, GitBranch, Settings as SettingsIcon, PlusCircle, Store, Zap, Copy, Check, Home as HomeIcon, ChevronLeft, ChevronRight, Code2, Package, FolderOpen, X, Search, DownloadCloud, Save } from "lucide-react";
import PromptList from "@/components/PromptList";
import PromptForm from "@/components/PromptForm";
import PromptVersionList from "@/components/PromptVersionList";
import AgentSkillList from "@/components/AgentSkillList";
import AgentSkillForm from "@/components/AgentSkillForm";
import SkillPackagePanel from "@/components/SkillPackagePanel";
import RemoteSkillInstallPanel from "@/components/RemoteSkillInstallPanel";
import { buildNpxSkillsAddCommand, formatSkillSourceLabel } from "@/lib/skillInstall";
import Market from "@/components/Market";
import UserAvatar from "@/components/UserAvatar";
import Settings, { type SettingsNavSection } from "@/components/Settings";
import SearchHome from "@/components/SearchHome";
import AdaptersPlayground from "@/components/AdaptersPlayground";
import LibrarySidebar from "@/components/LibrarySidebar";
import DiscoverSidebar, { type DiscoverSection } from "@/components/DiscoverSidebar";
import { AuthLoginPage } from "@/modules/auth";
import type { AuthProvider, EmailLoginPayload, EmailRegisterPayload, AuthUser } from "@/modules/auth";
import type { PromptMetadata, AgentSkillMetadata, LibraryItem, TagDefinition } from "@/lib/seekdb/types";
import type { CloudLibraryFolder, InstallableAgentInfo } from "@/lib/seekdb/api";
import { libraryAPI, tagAPI } from "@/lib/seekdb/api";
import { useLocale } from "@/lib/i18n";
import { showDesktopNotification } from "@/lib/desktopNotify";
import {
  mapPromptHubSyncErrorForDisplay,
  PROMPTHUB_SYNC_NOT_LOGGED_IN,
  PROMPTHUB_SESSION_EXPIRED,
} from "@/lib/prompthub/syncErrors";
import { resolveLibraryOrCategoryLabel } from "@/lib/libraryLabel";
import {
  PROMPTMAN_OPEN_SETTINGS_EVENT,
  type PromptmanOpenSettingsDetail,
} from "@/lib/promptmanEvents";
import { PROMPTMAN_WEB_URL } from "@/lib/productLinks";
import { LOCAL_FIRST } from "@/lib/localFirst";

type ViewMode =
  | "home"
  | "prompts"
  | "prompt-create"
  | "prompt-edit"
  | "prompt-versions"
  | "prompt-view"
  | "skills"
  | "skill-create"
  | "skill-edit"
  | "skill-versions"
  | "skill-view"
  | "discover"
  | "adapters"
  | "login"
  | "settings";
type ActiveTab = "home" | "prompts" | "skills" | "discover" | "adapters";

export default function Home() {
  const { t, locale } = useLocale();
  const pv = t.pageViews;
  const cs = t.cloudSync;
  const [activeTab, setActiveTab] = useState<ActiveTab>("home");
  const [viewMode, setViewMode] = useState<ViewMode>("home");
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [selectedVersionPromptId, setSelectedVersionPromptId] = useState<
    string | null
  >(null);
  const [selectedPromptVersionId, setSelectedPromptVersionId] = useState<
    string | null
  >(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedVersionSkillId, setSelectedVersionSkillId] = useState<
    string | null
  >(null);
  const [selectedSkillVersionId, setSelectedSkillVersionId] = useState<
    string | null
  >(null);
  
  // 用于强制刷新列表的 key
  const [listRefreshKey, setListRefreshKey] = useState(0);

  /** 打开设置时选中的侧栏分区（例如从首页直达 AI 设置） */
  const [settingsInitialSection, setSettingsInitialSection] =
    useState<SettingsNavSection>("data");

  // 侧边栏折叠状态
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // 记录列表面板宽度（拖拽调整）和折叠状态
  const [listPanelWidth, setListPanelWidth] = useState(320);
  const [listPanelCollapsed, setListPanelCollapsed] = useState(false);
  // email-layout 级别的通栏搜索（仅 Prompts / Skills 双栏视图使用）
  const [promptsSearch, setPromptsSearch] = useState("");
  const [skillsSearch, setSkillsSearch] = useState("");
  const [remoteInstallOpen, setRemoteInstallOpen] = useState(false);
  const promptsSearchInputRef = useRef<HTMLInputElement>(null);
  const skillsSearchInputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl+F 或 "/" 聚焦通栏搜索框（Prompts / Skills 双栏视图）
  useEffect(() => {
    const isPromptsLayout =
      activeTab === "prompts" &&
      (viewMode === "prompts" ||
        viewMode === "prompt-create" ||
        viewMode === "prompt-edit");
    const isSkillsLayout =
      activeTab === "skills" &&
      (viewMode === "skills" ||
        viewMode === "skill-create" ||
        viewMode === "skill-edit");
    if (!isPromptsLayout && !isSkillsLayout) return;

    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.isContentEditable)
      )
        return;
      const isMeta = e.metaKey || e.ctrlKey;
      if ((isMeta && e.key === "f") || e.key === "/") {
        e.preventDefault();
        const target = isPromptsLayout
          ? promptsSearchInputRef.current
          : skillsSearchInputRef.current;
        target?.focus();
        target?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTab, viewMode]);
  const listPanelWidthBeforeCollapse = useRef(320);
  const isDraggingListPanel = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const handleListPanelDragStart = useCallback((e: React.MouseEvent) => {
    if (listPanelCollapsed) return;
    isDraggingListPanel.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = listPanelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingListPanel.current) return;
      const delta = ev.clientX - dragStartX.current;
      const newWidth = Math.max(160, Math.min(480, dragStartWidth.current + delta));
      setListPanelWidth(newWidth);
    };
    const onMouseUp = () => {
      isDraggingListPanel.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    e.preventDefault();
  }, [listPanelCollapsed, listPanelWidth]);

  const toggleListPanel = useCallback(() => {
    if (listPanelCollapsed) {
      setListPanelCollapsed(false);
      setListPanelWidth(listPanelWidthBeforeCollapse.current);
    } else {
      listPanelWidthBeforeCollapse.current = listPanelWidth;
      setListPanelCollapsed(true);
    }
  }, [listPanelCollapsed, listPanelWidth]);

  // Library 状态
  const [libraries, setLibraries] = useState<LibraryItem[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(null);
  const [discoverSection, setDiscoverSection] = useState<DiscoverSection>("overview");
  const [discoverFocusId, setDiscoverFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (!LOCAL_FIRST) return;
    if (selectedLibraryId?.startsWith("cloud:")) {
      setSelectedLibraryId(null);
    }
    if (activeTab === "adapters") {
      setActiveTab("home");
      setViewMode("home");
    }
  }, [selectedLibraryId, activeTab]);
  const [tagList, setTagList] = useState<TagDefinition[]>([]);
  /** 多维正交标签筛选：跨维度可同时选中，AND 组合过滤 */
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  /** 顶层云端资料库（仅已登录 PromptHub 时非空），用于新建/编辑表单的归属库下拉 */
  const [cloudFolders, setCloudFolders] = useState<CloudLibraryFolder[]>([]);

  // 用户状态
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoadingProvider, setAuthLoadingProvider] = useState<AuthProvider | null>(null);
  // PromptHub 云同步状态
  const [hubSyncing, setHubSyncing] = useState(false);
  const [hubSyncError, setHubSyncError] = useState<string | null>(null);
  const [hubLastSyncAt, setHubLastSyncAt] = useState<string | null>(null);
  const [hubSyncCount, setHubSyncCount] = useState<number | null>(null);
  /** 应用已登录时：本地是否已有 PromptHub 凭据（与 OAuth/应用账号不同） */
  const [promptHubCloudLinked, setPromptHubCloudLinked] = useState<boolean | null>(null);

  // 加载库列表
  const loadLibraries = async () => {
    try {
      const data = await libraryAPI.getAll();
      setLibraries(data);
    } catch {
      // ignore
    }
  };

  const loadTags = async () => {
    try {
      const data = await tagAPI.getAll();
      setTagList(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && window.electronAPI) {
      void loadLibraries();
      void loadTags();
    }
  }, []);

  // 加载云端顶层资料库（仅在 PromptHub 已关联时请求；失败静默忽略）
  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI) return;
    if (LOCAL_FIRST || !currentUser?.id || !promptHubCloudLinked) {
      setCloudFolders([]);
      return;
    }
    let cancelled = false;
    libraryAPI
      .listCloudFolders()
      .then((folders) => {
        if (cancelled) return;
        setCloudFolders(folders.filter((f) => !f.parent_id));
      })
      .catch(() => {
        if (cancelled) return;
        setCloudFolders([]);
      });
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, promptHubCloudLinked]);

  // 触发 PromptHub 同步（登录后 / 启动时 / 聚焦窗口时）
  const triggerHubSync = async (forceFullSync = false) => {
    if (typeof window === "undefined" || !window.electronAPI) {
      console.warn("[PromptHub] sync pull skipped: not running in Electron (no window.electronAPI)");
      return;
    }
    try {
      setHubSyncing(true);
      setHubSyncError(null);
      console.log("[PromptHub] sync pull start", { forceFullSync });
      const result = await window.electronAPI.invoke("prompthub:sync:pull", { forceFullSync });
      if (result.success) {
        const promptsUpserted: number = result.data?.upserted ?? 0;

        // 技能与提示词游标独立，紧接着拉一次技能；技能失败不应让提示词同步显示为失败
        let skillsUpserted = 0;
        try {
          const skillResult = await window.electronAPI.invoke("prompthub:skill:syncPull", { forceFullSync });
          if (skillResult.success) {
            skillsUpserted = skillResult.data?.upserted ?? 0;
            console.log("[PromptHub] skill sync pull ok", {
              upserted: skillsUpserted,
              removed: skillResult.data?.removed,
              isFullSync: skillResult.data?.isFullSync,
            });
          } else if (skillResult.error) {
            console.warn("[PromptHub] skill sync pull failed:", skillResult.error);
          }
        } catch (skillErr) {
          console.error("[PromptHub] skill sync pull threw:", skillErr);
        }

        const upserted = promptsUpserted + skillsUpserted;
        setHubLastSyncAt(new Date().toISOString());
        setHubSyncCount(upserted);
        console.log("[PromptHub] sync pull ok", {
          promptsUpserted,
          skillsUpserted,
          isFullSync: result.data?.isFullSync,
        });
        // 有数据写入时刷新列表
        if (upserted > 0) {
          setListRefreshKey(prev => prev + 1);
        }
      } else if (result.error) {
        setHubSyncError(mapPromptHubSyncErrorForDisplay(result.error, cs));
        if (result.error === PROMPTHUB_SESSION_EXPIRED) {
          setCurrentUser(null);
          setPromptHubCloudLinked(null);
          setHubLastSyncAt(null);
          setHubSyncCount(null);
        } else if (result.error === PROMPTHUB_SYNC_NOT_LOGGED_IN) {
          setPromptHubCloudLinked(false);
        }
        console.warn("[PromptHub] sync pull failed:", result.error);
      }
    } catch (err) {
      console.error("[PromptHub] sync pull threw:", err);
    } finally {
      setHubSyncing(false);
    }
  };

  // 加载用户认证状态，同时验证 PromptHub Token
  useEffect(() => {
    const loadAuthStatus = async () => {
      try {
        if (typeof window !== "undefined" && window.electronAPI) {
          const result = await window.electronAPI.invoke("auth:status");
          if (result.success && result.data?.user) {
            setCurrentUser(result.data.user);
            setAuthError(null);

            // 验证 PromptHub Token 有效性，有效则触发增量同步
            const hubResult = await window.electronAPI.invoke("prompthub:auth:check");
            if (hubResult.success && hubResult.data) {
              triggerHubSync(false);
            }
            const hubUser = await window.electronAPI.invoke("prompthub:auth:user");
            setPromptHubCloudLinked(Boolean(hubUser.success && hubUser.data));
          } else if (result.success) {
            setCurrentUser(null);
            setPromptHubCloudLinked(null);
          }
        }
      } catch (err) {
        console.debug("Auth status check skipped:", err);
      } finally {
        setUserLoading(false);
      }
    };
    loadAuthStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // OAuth 登录（Google / GitHub）
  const handleOAuthLogin = async (provider: "google" | "github") => {
    const channel = provider === "google" ? "auth:google:login" : "auth:github:login";
    try {
      setAuthLoadingProvider(provider);
      setAuthError(null);
      if (typeof window !== "undefined" && window.electronAPI) {
        const result = await window.electronAPI.invoke(channel);
        if (result.success && result.data?.user) {
          setCurrentUser(result.data.user);
          setActiveTab("home");
          setViewMode("home");
          const hubUser = await window.electronAPI.invoke("prompthub:auth:user");
          setPromptHubCloudLinked(Boolean(hubUser.success && hubUser.data));
        } else if (result.error) {
          console.error(`${provider} login failed:`, result.error);
          setAuthError(result.error);
        }
      }
    } catch (err) {
      console.error(`${provider} login error:`, err);
      setAuthError(err instanceof Error ? err.message : pv.authErrorLogin);
    } finally {
      setAuthLoadingProvider(null);
    }
  };

  // 邮箱登录
  const handleEmailLogin = async (payload: EmailLoginPayload) => {
    try {
      setAuthLoadingProvider("email");
      setAuthError(null);
      if (typeof window !== "undefined" && window.electronAPI) {
        const result = await window.electronAPI.invoke("auth:email:login", payload);
        if (result.success && result.data?.user) {
          setCurrentUser(result.data.user);
          setActiveTab("home");
          setViewMode("home");
          setPromptHubCloudLinked(true);
          // 登录成功后全量拉取云端数据
          triggerHubSync(true);
        } else if (result.error) {
          setAuthError(result.error);
        }
      }
    } catch (err) {
      console.error("Email login error:", err);
      setAuthError(err instanceof Error ? err.message : pv.authErrorEmailLogin);
    } finally {
      setAuthLoadingProvider(null);
    }
  };

  // 发送邮箱验证码
  const handleSendEmailCode = async (email: string, purpose?: "register"): Promise<{ success: boolean; error?: string }> => {
    try {
      if (typeof window !== "undefined" && window.electronAPI) {
        const result = await window.electronAPI.invoke("auth:email:sendCode", { email, purpose });
        if (result.success) {
          return { success: true };
        }
        return { success: false, error: result.error || "发送失败" };
      }
      return { success: false, error: "应用未初始化" };
    } catch (err) {
      console.error("Send email code error:", err);
      return { success: false, error: err instanceof Error ? err.message : "发送验证码失败" };
    }
  };

  // 邮箱注册
  const handleEmailRegister = async (payload: EmailRegisterPayload) => {
    try {
      setAuthLoadingProvider("email");
      setAuthError(null);
      if (typeof window !== "undefined" && window.electronAPI) {
        const result = await window.electronAPI.invoke("auth:email:register", payload);
        if (result.success && result.data?.user) {
          setCurrentUser(result.data.user);
          setActiveTab("home");
          setViewMode("home");
          setPromptHubCloudLinked(true);
          // 注册后全量同步（通常没有云端数据，但保持一致性）
          triggerHubSync(true);
        } else if (result.error) {
          setAuthError(result.error);
        }
      }
    } catch (err) {
      console.error("Email register error:", err);
      setAuthError(err instanceof Error ? err.message : "注册失败，请稍后重试");
    } finally {
      setAuthLoadingProvider(null);
    }
  };

  // GitHub 登录（兼容旧调用）
  const handleGitHubLogin = async () => {
    await handleOAuthLogin("github");
  };

  // 登出
  const handleLogout = async () => {
    try {
      if (typeof window !== "undefined" && window.electronAPI) {
        // 统一会话：应用 + PromptHub + 同步位一次清除
        await window.electronAPI.invoke("auth:logout");
        setCurrentUser(null);
        setAuthError(null);
        setHubSyncError(null);
        setHubLastSyncAt(null);
        setPromptHubCloudLinked(null);
      }
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  // 打开设置页（可选 section：如 "ai" 直达 AI 服务配置）
  const handleOpenSettings = (section?: SettingsNavSection) => {
    setSettingsInitialSection(section ?? "data");
    setViewMode("settings");
  };

  // 右下角更新提示「前往更新」等：全局打开设置
  useEffect(() => {
    const onOpenSettings = (e: Event) => {
      const { detail } = e as CustomEvent<PromptmanOpenSettingsDetail>;
      setSettingsInitialSection(detail?.section ?? "data");
      setViewMode("settings");
    };
    window.addEventListener(PROMPTMAN_OPEN_SETTINGS_EVENT, onOpenSettings);
    return () =>
      window.removeEventListener(PROMPTMAN_OPEN_SETTINGS_EVENT, onOpenSettings);
  }, []);

  const getDefaultViewByTab = (tab: ActiveTab): ViewMode => {
    if (tab === "home") return "home";
    if (tab === "prompts") return "prompts";
    if (tab === "skills") return "skills";
    return "discover";
  };

  // 打开登录页（页面方式）
  const handleOpenLoginPage = () => {
    if (currentUser) return;
    setAuthError(null);
    setViewMode("login");
  };

  // 从登录页返回应用（不登录也可继续使用）
  const handleBackFromLogin = () => {
    setViewMode(getDefaultViewByTab(activeTab));
  };

  // 监听主进程的默认数据填充完成事件 + 主动查询（双保险）
  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI) return;

    const doRefresh = (result: { prompts: number; skills: number; subAgents: number }) => {
      if (result.prompts > 0 || result.skills > 0 || result.subAgents > 0) {
        console.log(`[SeedData] Refreshing lists: ${result.prompts} prompts, ${result.skills} skills, ${result.subAgents} subAgents`);
        setListRefreshKey(prev => prev + 1);
      }
    };

    // 方式1：监听主进程推送的事件（seed 在窗口加载后完成时）
    const handleDefaultDataSeeded = (result: { prompts: number; skills: number; subAgents: number }) => {
      doRefresh(result);
    };
    window.electronAPI.on("default-data:seeded", handleDefaultDataSeeded);

    // 方式2：主动查询 seed 状态（seed 在窗口加载前完成时）
    window.electronAPI.invoke("default-data:check").then((res: { success: boolean; data: { prompts: number; skills: number; subAgents: number } | null }) => {
      if (res.success && res.data) {
        doRefresh(res.data);
      }
    }).catch(() => {
      // 忽略查询失败
    });

    return () => {
      window.electronAPI.removeListener("default-data:seeded", handleDefaultDataSeeded);
    };
  }, []);

  // 窗口获得焦点时触发 PromptHub 增量同步（仅已登录时）
  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI) return;
    const handleFocus = () => {
      if (currentUser) {
        triggerHubSync(false);
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // 监听搜索窗口导航事件 —— 跳转到对应内容页
  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI) return;

    const handleSearchNavigate = (payload: { type: string; id: string }) => {
      const { type, id } = payload;
      if (type === "prompt") {
        setActiveTab("prompts");
        setSelectedPromptId(id);
        setViewMode("prompt-view");
      } else if (type === "skill") {
        setActiveTab("skills");
        setSelectedSkillId(id);
        setViewMode("skill-view");
      }
    };

    window.electronAPI.on("search:navigate", handleSearchNavigate);
    return () => {
      window.electronAPI.removeListener("search:navigate", handleSearchNavigate);
    };
  }, []);

  // 监听菜单导航事件 —— 通过菜单栏切换 Tab
  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI) return;

    const handleMenuNavigate = (payload: { tab: string }) => {
      const { tab } = payload;
      if (tab === "settings") {
        handleOpenSettings();
      } else if (["home", "prompts", "skills", "discover"].includes(tab)) {
        handleTabChange(tab as ActiveTab);
      }
    };

    window.electronAPI.on("menu:navigate", handleMenuNavigate);
    return () => {
      window.electronAPI.removeListener("menu:navigate", handleMenuNavigate);
    };
  }, [activeTab]);

  // 监听菜单动作事件 —— 通过菜单栏触发创建等操作
  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI) return;

    const handleMenuAction = (payload: { action: string }) => {
      const { action } = payload;
      switch (action) {
        case "new-prompt":
          handleCreatePrompt();
          break;
        case "new-skill":
          handleCreateSkill();
          break;
        // check-update 由主进程直接处理，此处无需额外操作
      }
    };

    window.electronAPI.on("menu:action", handleMenuAction);
    return () => {
      window.electronAPI.removeListener("menu:action", handleMenuAction);
    };
  }, []);

  // Prompt handlers
  const handleCreatePrompt = () => {
    setActiveTab("prompts");
    setSelectedPromptId(null);
    setSelectedVersionPromptId(null);
    setSelectedPromptVersionId(null);
    setViewMode("prompt-create");
  };

  const handleSelectPrompt = (promptId: string) => {
    setActiveTab("prompts");
    setSelectedPromptId(promptId);
    // 浏览 / 编辑：保持当前模式，仅切换选中项；新建时点选列表则回到浏览态
    if (viewMode === "prompts" || viewMode === "prompt-edit") {
      return;
    }
    if (viewMode === "prompt-create") {
      setViewMode("prompts");
      return;
    }
    setViewMode("prompts");
  };

  const handleEditPrompt = (promptId: string) => {
    setActiveTab("prompts");
    setSelectedPromptId(promptId);
    setViewMode("prompt-edit");
  };

  const handleViewPromptVersions = (promptId: string) => {
    setActiveTab("prompts");
    setSelectedVersionPromptId(promptId);
    setViewMode("prompt-versions");
  };

  const handleCreatePromptVersion = () => {
    if (selectedVersionPromptId) {
      setSelectedPromptVersionId(selectedVersionPromptId);
      setViewMode("prompt-create");
    }
  };

  const handlePromptFormSuccess = () => {
    setListRefreshKey((k) => k + 1);
    setViewMode("prompts");
  };

  const handlePromptFormCancel = () => {
    if (selectedVersionPromptId) {
      setViewMode("prompt-versions");
      setSelectedPromptVersionId(null);
    } else {
      setViewMode("prompts");
    }
  };

  const handleBackToPromptList = () => {
    setViewMode("prompts");
    setSelectedPromptId(null);
    setSelectedVersionPromptId(null);
    setSelectedPromptVersionId(null);
  };

  const handleBackToPromptVersions = () => {
    setViewMode("prompt-versions");
    setSelectedPromptVersionId(null);
  };

  const handlePromptDeletedFromList = (deletedVersionId: string) => {
    setListRefreshKey((k) => k + 1);
    if (selectedPromptId === deletedVersionId) {
      setSelectedPromptId(null);
      setSelectedVersionPromptId(null);
      setSelectedPromptVersionId(null);
      setViewMode("prompts");
    }
  };

  // Agent Skill handlers
  const handleSkillDeletedFromList = (deletedVersionId: string) => {
    setListRefreshKey((k) => k + 1);
    if (selectedSkillId === deletedVersionId) {
      setSelectedSkillId(null);
      setSelectedVersionSkillId(null);
      setSelectedSkillVersionId(null);
      setViewMode("skills");
    }
  };

  const handleCreateSkill = () => {
    setActiveTab("skills");
    setSelectedSkillId(null);
    setSelectedVersionSkillId(null);
    setSelectedSkillVersionId(null);
    setViewMode("skill-create");
  };

  const handleSelectSkill = (skillId: string) => {
    setActiveTab("skills");
    setSelectedSkillId(skillId);
    if (viewMode === "skills" || viewMode === "skill-edit") {
      return;
    }
    if (viewMode === "skill-create") {
      setViewMode("skills");
      return;
    }
    setViewMode("skills");
  };

  const handleEditSkill = (skillId: string) => {
    setActiveTab("skills");
    setSelectedSkillId(skillId);
    setViewMode("skill-edit");
  };

  const handleViewSkillVersions = (skillId: string) => {
    setActiveTab("skills");
    setSelectedVersionSkillId(skillId);
    setViewMode("skill-versions");
  };

  const handleCreateSkillVersion = () => {
    if (selectedVersionSkillId) {
      setSelectedSkillVersionId(selectedVersionSkillId);
      setViewMode("skill-create");
    }
  };

  const handleSkillFormSuccess = () => {
    setListRefreshKey((k) => k + 1);
    if (selectedSkillId) {
        setViewMode("skills");
    } else {
        setViewMode("skills");
    }
  };

  const handleSkillFormCancel = () => {
    if (selectedVersionSkillId) {
      setViewMode("skill-versions");
      setSelectedSkillVersionId(null);
    } else {
      setViewMode("skills");
    }
  };

  const handleBackToSkillList = () => {
    setViewMode("skills");
    setSelectedSkillId(null);
    setSelectedVersionSkillId(null);
    setSelectedSkillVersionId(null);
  };

  const handleBackToSkillVersions = () => {
    setViewMode("skill-versions");
    setSelectedSkillVersionId(null);
  };

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === "home") {
      setViewMode("home");
    } else if (tab === "prompts") {
      setViewMode("prompts");
      setSelectedPromptId(null);
    } else if (tab === "skills") {
      setViewMode("skills");
      setSelectedSkillId(null);
    } else if (tab === "discover") {
      setViewMode("discover");
    } else if (tab === "adapters") {
      setViewMode("adapters");
    }
  };

  const openDiscover = (section: DiscoverSection, focusId: string | null = null) => {
    setDiscoverSection(section);
    setDiscoverFocusId(focusId);
    handleTabChange("discover");
  };

  // 处理 Discover 导入成功 - 刷新对应的列表
  const handleMarketImportSuccess = (type: 'prompt' | 'skill', name: string) => {
    console.log(`Successfully imported ${type}: ${name}`);
    // 通过更新 key 强制刷新列表
    setListRefreshKey(prev => prev + 1);
  };

  if (viewMode === "login") {
    return (
      <AuthLoginPage
        appName="PromptMan"
        error={authError}
        loadingProvider={authLoadingProvider}
        onEmailLogin={handleEmailLogin}
        onEmailRegister={handleEmailRegister}
        onSendCode={handleSendEmailCode}
        onOAuthLogin={handleOAuthLogin}
        onOpenSettings={handleOpenSettings}
        onBack={handleBackFromLogin}
        onClearError={() => setAuthError(null)}
      />
    );
  }

  return (
    <div className="app-container">
      {/* Left Sidebar */}
      <aside className={`sidebar${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
        <div className="sidebar-header">
          <nav className="tab-nav">
            <button
                className={`tab-nav-item home-tab ${activeTab === "home" ? "active" : ""}${sidebarCollapsed ? " icon-only" : ""}`}
                onClick={() => handleTabChange("home")}
                title={sidebarCollapsed ? t.tabs.home : undefined}
            >
                <HomeIcon size={14} />
                {!sidebarCollapsed && <span>{t.tabs.home}</span>}
            </button>
            <button
                className={`tab-nav-item ${activeTab === "prompts" ? "active" : ""}${sidebarCollapsed ? " icon-only" : ""}`}
                onClick={() => handleTabChange("prompts")}
                title={sidebarCollapsed ? t.tabs.prompts : undefined}
            >
                <FileText size={14} />
                {!sidebarCollapsed && <span>{t.tabs.prompts}</span>}
            </button>
            <button
                className={`tab-nav-item ${activeTab === "skills" ? "active" : ""}${sidebarCollapsed ? " icon-only" : ""}`}
                onClick={() => handleTabChange("skills")}
                title={sidebarCollapsed ? t.tabs.skills : undefined}
            >
                <Sparkles size={14} />
                {!sidebarCollapsed && <span>{t.tabs.skills}</span>}
            </button>
            <button
                className={`tab-nav-item market-tab ${activeTab === "discover" && discoverSection === "overview" ? "active" : ""}${sidebarCollapsed ? " icon-only" : ""}`}
                onClick={() => openDiscover("overview")}
                title={sidebarCollapsed ? t.tabs.market : undefined}
            >
                <Store size={14} />
                {!sidebarCollapsed && <span>{t.tabs.market}</span>}
            </button>
            {!sidebarCollapsed && (
              <>
                <button
                  className={`tab-nav-item tab-nav-sub ${activeTab === "discover" && discoverSection === "prompts" ? "active" : ""}`}
                  onClick={() => openDiscover("prompts")}
                >
                  <FileText size={13} />
                  <span>{t.sidebar.discoverPrompts}</span>
                </button>
                <button
                  className={`tab-nav-item tab-nav-sub ${activeTab === "discover" && discoverSection === "skills" ? "active" : ""}`}
                  onClick={() => openDiscover("skills")}
                >
                  <Sparkles size={13} />
                  <span>{t.sidebar.discoverSkills}</span>
                </button>
              </>
            )}
            {!LOCAL_FIRST && (
              <button
                  className={`tab-nav-item ${activeTab === "adapters" ? "active" : ""}${sidebarCollapsed ? " icon-only" : ""}`}
                  onClick={() => handleTabChange("adapters")}
                  title={sidebarCollapsed ? "Adapters" : undefined}
              >
                  <Code2 size={14} />
                  {!sidebarCollapsed && <span>Adapters</span>}
              </button>
            )}
          </nav>
        </div>

        {!sidebarCollapsed && (
          <div className="sidebar-content">
            {activeTab === "home" || activeTab === "discover" ? (
              <DiscoverSidebar
                section={discoverSection}
                focusId={discoverFocusId}
                onSelectSection={(section) => openDiscover(section)}
                onSelectItem={(type, id) =>
                  openDiscover(type === "prompt" ? "prompts" : "skills", id)
                }
              />
            ) : (
              <LibrarySidebar
                selectedLibraryId={selectedLibraryId}
                onSelectLibrary={(id) => {
                  setSelectedLibraryId(id);
                  setSelectedPromptId(null);
                  setSelectedSkillId(null);
                  loadLibraries();
                  // 切换库时跳转到对应内容 tab
                  if (activeTab !== "prompts" && activeTab !== "skills") {
                    handleTabChange("prompts");
                  }
                }}
                tags={tagList}
                selectedTagIds={selectedTagIds}
                onToggleTag={
                  activeTab === "prompts" || activeTab === "skills"
                    ? (tagId) => {
                        setSelectedTagIds((prev) =>
                          prev.includes(tagId) ? prev.filter((x) => x !== tagId) : [...prev, tagId],
                        );
                        setSelectedPromptId(null);
                        setSelectedSkillId(null);
                      }
                    : undefined
                }
                onClearTagFilter={() => setSelectedTagIds([])}
                onTagsChanged={loadTags}
                currentUser={currentUser}
                promptHubCloudLinked={promptHubCloudLinked}
              />
            )}
          </div>
        )}
        
        {!sidebarCollapsed && viewMode !== "settings" && activeTab === "discover" && (
        <div className="sidebar-footer">
                <div className="market-footer-hint">
                    <Zap size={14} />
                    <span>{t.sidebar.marketFooter}</span>
                </div>
        </div>
        )}

        <div className={`sidebar-bottom-brand${sidebarCollapsed ? " collapsed" : ""}`}>
          <a
            className="sidebar-brand"
            href={PROMPTMAN_WEB_URL}
            target="_blank"
            rel="noopener noreferrer"
            title={t.sidebar.brandLinkAria}
            aria-label={t.sidebar.brandLinkAria}
          >
            <img src="/icon.png" alt="" className="sidebar-logo-img" />
            {!sidebarCollapsed && <span className="sidebar-brand-name">PromptMan</span>}
          </a>
          <UserAvatar
            user={currentUser}
            loading={userLoading}
            compact={sidebarCollapsed}
            openMenuAbove
            onLogin={handleOpenLoginPage}
            onLogout={handleLogout}
            onOpenSettings={handleOpenSettings}
            promptHubCloudLinked={currentUser ? promptHubCloudLinked : null}
            hubSync={
              currentUser
                ? {
                    syncing: hubSyncing,
                    error: hubSyncError,
                    lastSyncAt: hubLastSyncAt,
                    syncCount: hubSyncCount,
                  }
                : null
            }
            onHubSync={() => triggerHubSync(false)}
          />
        </div>
      </aside>

      {/* Sidebar collapse floating tab */}
      <button
        className="sidebar-toggle-floating"
        style={{ left: sidebarCollapsed ? 52 : 220 }}
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
      >
        {sidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Right Main Content */}
      <main className="main-content">
        <div
          className={`content-wrapper${
            (activeTab === "prompts" &&
              (viewMode === "prompts" ||
                viewMode === "prompt-create" ||
                viewMode === "prompt-edit")) ||
            (activeTab === "skills" &&
              (viewMode === "skills" ||
                viewMode === "skill-create" ||
                viewMode === "skill-edit"))
              ? " email-browse"
              : ""
          }`}
        >
          {/* Home / Search View */}
          {activeTab === "home" && viewMode === "home" && (
            <div className="home-view">
              <SearchHome
                onOpenAiSettings={() => handleOpenSettings("ai")}
                onNavigate={(type, id) => {
                  if (type === "prompt") {
                    setActiveTab("prompts");
                    setSelectedPromptId(id);
                    setViewMode("prompt-view");
                  } else if (type === "skill") {
                    setActiveTab("skills");
                    setSelectedSkillId(id);
                    setViewMode("skill-view");
                  }
                }}
                onSavePrompt={async (data) => {
                  const { promptAPI } = await import("@/lib/seekdb/api");
                  const id = `prompt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                  await promptAPI.create({
                    id,
                    title: data.title,
                    content: data.content,
                    description: data.description,
                    category: data.category,
                    tags: data.tags,
                  });
                  setListRefreshKey(k => k + 1);
                }}
                onSaveSkill={async (data) => {
                  const { agentSkillAPI } = await import("@/lib/seekdb/api");
                  const id = `skill_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                  await agentSkillAPI.create({
                    id,
                    name: data.name,
                    description: data.description,
                    category: data.category,
                    tags: data.tags,
                    template: data.instructions,
                  });
                  setListRefreshKey(k => k + 1);
                }}
              />
            </div>
          )}

          {/* Prompt Views */}
          {activeTab === "prompts" && (
            <>
              {(viewMode === "prompts" ||
                viewMode === "prompt-create" ||
                viewMode === "prompt-edit") && (
                <div className="email-workspace">
                  <div className="email-topbar">
                    <div className="email-topbar-inner">
                      <div className="email-topbar-search">
                        <Search size={16} className="email-topbar-search-icon" aria-hidden />
                        <input
                          ref={promptsSearchInputRef}
                          type="text"
                          className="email-topbar-input"
                          placeholder={t.promptList.searchPlaceholder}
                          value={promptsSearch}
                          onChange={(e) => setPromptsSearch(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              setPromptsSearch("");
                              (e.target as HTMLInputElement).blur();
                            } else if (e.key === "ArrowDown") {
                              e.preventDefault();
                              const el = document.querySelector(
                                ".email-list-panel .sidebar-list",
                              ) as HTMLElement | null;
                              el?.focus();
                            }
                          }}
                        />
                        {promptsSearch ? (
                          <button
                            type="button"
                            className="email-topbar-clear"
                            aria-label="clear"
                            onClick={() => {
                              setPromptsSearch("");
                              promptsSearchInputRef.current?.focus();
                            }}
                          >
                            <X size={14} />
                          </button>
                        ) : (
                          <span className="email-topbar-kbd">
                            <kbd className="skbd">⌘F</kbd>
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="email-topbar-new-btn"
                        onClick={handleCreatePrompt}
                      >
                        <PlusCircle size={16} />
                        <span>{t.newPrompt}</span>
                      </button>
                    </div>
                  </div>
                  <div className="email-layout">
                  {/* Left: compact list */}
                  <div
                    className={`email-list-panel${listPanelCollapsed ? " list-panel-collapsed" : ""}`}
                    style={!listPanelCollapsed ? { width: listPanelWidth, minWidth: listPanelWidth, maxWidth: listPanelWidth } : undefined}
                  >
                    {!listPanelCollapsed && (
                      <PromptList
                        key={`prompts-email-${listRefreshKey}`}
                        variant="sidebar"
                        listTitle={t.tabs.prompts}
                        selectedId={selectedPromptId}
                        onSelectPrompt={handleSelectPrompt}
                        onEditPrompt={handleEditPrompt}
                        onViewVersions={handleViewPromptVersions}
                        onDeletePrompt={handlePromptDeletedFromList}
                        libraryId={selectedLibraryId}
                        tagIds={selectedTagIds}
                        libraries={libraries}
                        onLibraryChanged={loadLibraries}
                        autoSelectFirst={viewMode === "prompts"}
                        currentUser={currentUser}
                        hideHeader
                        searchValue={promptsSearch}
                        onSearchValueChange={setPromptsSearch}
                      />
                    )}
                    <div className="list-resize-handle" onMouseDown={handleListPanelDragStart}>
                      <button
                        className="list-panel-toggle"
                        onClick={toggleListPanel}
                        title={listPanelCollapsed ? "展开列表" : "收起列表"}
                      >
                        {listPanelCollapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
                      </button>
                    </div>
                  </div>
                  {/* Right: 浏览为详情，新建/编辑为表单 */}
                  <div className="email-detail-panel">
                    {viewMode === "prompts" ? (
                      selectedPromptId ? (
                        <PromptView
                          promptId={selectedPromptId}
                          libraries={libraries}
                          onEdit={() => handleEditPrompt(selectedPromptId)}
                          onBack={() => setSelectedPromptId(null)}
                          onViewVersions={(versionGroupId) => handleViewPromptVersions(versionGroupId)}
                        />
                      ) : (
                        <div className="email-empty-detail">
                          <FileText size={40} className="empty-icon" />
                          <p>{t.empty.promptTitle}</p>
                          <span>{t.empty.promptDesc}</span>
                          <button className="btn btn-primary" onClick={handleCreatePrompt}>
                            {t.empty.promptCreate}
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="form-view form-view--panel">
                        <PromptForm
                          promptId={
                            viewMode === "prompt-edit"
                              ? selectedPromptId || undefined
                              : undefined
                          }
                          promptVersionId={selectedPromptVersionId || undefined}
                          libraries={libraries}
                          cloudFolders={cloudFolders}
                          defaultLibraryId={selectedLibraryId}
                          onTagsChanged={loadTags}
                          onSuccess={handlePromptFormSuccess}
                          onCancel={handlePromptFormCancel}
                        />
                      </div>
                    )}
                  </div>
                  </div>
                </div>
              )}

              {viewMode === "prompt-versions" && selectedVersionPromptId && (
                <div className="versions-view">
                  <div className="view-header">
                    <button
                      onClick={handleBackToPromptList}
                      className="btn-back"
                    >
                      <ArrowLeft size={16} /> {t.back}
                    </button>
                  </div>
                  <PromptVersionList
                    promptId={selectedVersionPromptId}
                    onSelectVersion={(versionId) => {
                      setSelectedPromptId(versionId);
                      setViewMode("prompts");
                    }}
                    onCreateVersion={handleCreatePromptVersion}
                  />
                </div>
              )}

              {viewMode === "prompt-view" && selectedPromptId && (
                <PromptView
                  promptId={selectedPromptId}
                  libraries={libraries}
                  onEdit={() => handleEditPrompt(selectedPromptId)}
                  onBack={handleBackToPromptList}
                  onViewVersions={(versionGroupId) => handleViewPromptVersions(versionGroupId)}
                />
              )}
            </>
          )}

          {/* Agent Skills Views */}
          {activeTab === "skills" && (
            <>
              {(viewMode === "skills" ||
                viewMode === "skill-create" ||
                viewMode === "skill-edit") && (
                <div className="email-workspace">
                  <div className="email-topbar">
                    <div className="email-topbar-inner">
                      <div className="email-topbar-search">
                        <Search size={16} className="email-topbar-search-icon" aria-hidden />
                        <input
                          ref={skillsSearchInputRef}
                          type="text"
                          className="email-topbar-input"
                          placeholder="搜索技能..."
                          value={skillsSearch}
                          onChange={(e) => setSkillsSearch(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              setSkillsSearch("");
                              (e.target as HTMLInputElement).blur();
                            } else if (e.key === "ArrowDown") {
                              e.preventDefault();
                              const el = document.querySelector(
                                ".email-list-panel .sidebar-list",
                              ) as HTMLElement | null;
                              el?.focus();
                            }
                          }}
                        />
                        {skillsSearch ? (
                          <button
                            type="button"
                            className="email-topbar-clear"
                            aria-label="clear"
                            onClick={() => {
                              setSkillsSearch("");
                              skillsSearchInputRef.current?.focus();
                            }}
                          >
                            <X size={14} />
                          </button>
                        ) : (
                          <span className="email-topbar-kbd">
                            <kbd className="skbd">⌘F</kbd>
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="email-topbar-new-btn"
                        onClick={() => setRemoteInstallOpen(true)}
                        title={t.skillRemote.openButton}
                      >
                        <DownloadCloud size={16} />
                        <span>{t.skillRemote.openButton}</span>
                      </button>
                      <button
                        type="button"
                        className="email-topbar-new-btn"
                        onClick={handleCreateSkill}
                      >
                        <PlusCircle size={16} />
                        <span>{t.newSkill}</span>
                      </button>
                    </div>
                  </div>
                  <div className="email-layout">
                  {/* Left: compact list */}
                  <div
                    className={`email-list-panel${listPanelCollapsed ? " list-panel-collapsed" : ""}`}
                    style={!listPanelCollapsed ? { width: listPanelWidth, minWidth: listPanelWidth, maxWidth: listPanelWidth } : undefined}
                  >
                    {!listPanelCollapsed && (
                      <AgentSkillList
                        key={`skills-email-${listRefreshKey}`}
                        variant="sidebar"
                        listTitle={t.tabs.skills}
                        selectedId={selectedSkillId}
                        onSelectSkill={handleSelectSkill}
                        onEditSkill={handleEditSkill}
                        onViewVersions={handleViewSkillVersions}
                        onDeleteSkill={handleSkillDeletedFromList}
                        libraryId={selectedLibraryId}
                        tagIds={selectedTagIds}
                        libraries={libraries}
                        onLibraryChanged={loadLibraries}
                        autoSelectFirst={viewMode === "skills"}
                        hideHeader
                        searchValue={skillsSearch}
                        onSearchValueChange={setSkillsSearch}
                      />
                    )}
                    <div className="list-resize-handle" onMouseDown={handleListPanelDragStart}>
                      <button
                        className="list-panel-toggle"
                        onClick={toggleListPanel}
                        title={listPanelCollapsed ? "展开列表" : "收起列表"}
                      >
                        {listPanelCollapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
                      </button>
                    </div>
                  </div>
                  {/* Right: 浏览为详情，新建/编辑为表单 */}
                  <div className="email-detail-panel">
                    {viewMode === "skills" ? (
                      selectedSkillId ? (
                        <AgentSkillView
                          skillId={selectedSkillId}
                          libraries={libraries}
                          onEdit={() => handleEditSkill(selectedSkillId)}
                          onBack={() => setSelectedSkillId(null)}
                          onViewVersions={(versionGroupId) => handleViewSkillVersions(versionGroupId)}
                        />
                      ) : (
                        <div className="email-empty-detail">
                          <Sparkles size={40} className="empty-icon" />
                          <p>{t.empty.skillTitle}</p>
                          <button className="btn btn-primary" onClick={handleCreateSkill}>
                            {t.empty.skillCreate}
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="form-view form-view--panel">
                        <AgentSkillForm
                          skillId={
                            viewMode === "skill-edit"
                              ? selectedSkillId || undefined
                              : undefined
                          }
                          skillVersionId={selectedSkillVersionId || undefined}
                          libraries={libraries}
                          cloudFolders={cloudFolders}
                          defaultLibraryId={selectedLibraryId}
                          onTagsChanged={loadTags}
                          onSuccess={handleSkillFormSuccess}
                          onCancel={handleSkillFormCancel}
                        />
                      </div>
                    )}
                  </div>
                  </div>
                  <RemoteSkillInstallPanel
                    open={remoteInstallOpen}
                    onClose={() => setRemoteInstallOpen(false)}
                    libraryId={selectedLibraryId?.startsWith("cloud:") ? null : selectedLibraryId}
                    onInstalled={() => {
                      setListRefreshKey((k) => k + 1);
                      setRemoteInstallOpen(false);
                    }}
                  />
                </div>
              )}
              
               {viewMode === "skill-view" && selectedSkillId && (
                   <AgentSkillView
                     skillId={selectedSkillId}
                     libraries={libraries}
                     onEdit={() => handleEditSkill(selectedSkillId)}
                     onBack={handleBackToSkillList}
                     onViewVersions={(versionGroupId) => handleViewSkillVersions(versionGroupId)}
                   />
               )}
            </>
          )}

          {/* Discover View */}
          {activeTab === "discover" && viewMode === "discover" && (
            <div className="market-view">
              <Market
                onImportSuccess={handleMarketImportSuccess}
                section={discoverSection}
                focusId={discoverFocusId}
              />
            </div>
          )}

          {/* Adapters View */}
          {!LOCAL_FIRST && activeTab === "adapters" && viewMode === "adapters" && (
            <div className="adapters-view" style={{ flex: 1, overflow: "auto" }}>
              <AdaptersPlayground />
            </div>
          )}

          {/* Settings View */}
          {viewMode === "settings" && (
            <Settings
              user={currentUser}
              onLogin={handleOpenLoginPage}
              onLogout={handleLogout}
              initialSection={settingsInitialSection}
            />
          )}
        </div>
      </main>

      <style jsx>{`
        .app-container {
          display: flex;
          height: 100vh;
          overflow: hidden;
          background: var(--bg-app);
          color: var(--text-primary);
          position: relative;
        }

        /* Sidebar Styles */
        .sidebar {
          width: 220px;
          min-width: 180px;
          max-width: 260px;
          background: var(--bg-sidebar);
          backdrop-filter: blur(var(--blur-lg));
          -webkit-backdrop-filter: blur(var(--blur-lg));
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          z-index: 2;
          transition: width 0.2s ease, min-width 0.2s ease;
          overflow: hidden;
        }

        .sidebar.sidebar-collapsed {
          width: 52px;
          min-width: 52px;
          max-width: 52px;
        }

        .sidebar.sidebar-collapsed .sidebar-header {
          padding: 28px 8px 10px;
        }

        .sidebar-bottom-brand {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 12px 12px 14px;
          border-top: 1px solid var(--border-color);
          background: rgba(0, 0, 0, 0.12);
          box-sizing: border-box;
        }

        .sidebar-bottom-brand .sidebar-brand {
          min-width: 0;
          flex: 1;
          align-items: center;
        }

        /* 底部品牌区：显式缩小图标与标题（避免 h1 落入浏览器默认大号样式） */
        .sidebar-bottom-brand .sidebar-logo-img {
          width: 18px;
          height: 18px;
          border-radius: 4px;
        }

        .sidebar-bottom-brand .sidebar-brand-name {
          font-size: 0.68rem;
          font-weight: 700;
          color: var(--text-tertiary);
          margin: 0;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          line-height: 1.2;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sidebar-bottom-brand.collapsed {
          flex-direction: column;
          justify-content: center;
          padding: 10px 8px 12px;
          gap: 10px;
        }

        .sidebar-bottom-brand.collapsed .sidebar-brand {
          justify-content: center;
          flex: none;
        }

        .sidebar-bottom-brand.collapsed .sidebar-logo-img {
          width: 20px;
          height: 20px;
        }

        .tab-nav-item.icon-only {
          justify-content: center;
          padding: 8px;
        }

        /* Floating sidebar toggle tab */
        .sidebar-toggle-floating {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          z-index: 20;
          width: 16px;
          height: 40px;
          border: 1px solid var(--border-color);
          border-left: none;
          background: var(--bg-sidebar);
          color: var(--text-tertiary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 0 var(--radius-md) var(--radius-md) 0;
          transition: left 0.2s ease, background var(--transition-fast), color var(--transition-fast);
          padding: 0;
        }

        .sidebar-toggle-floating:hover {
          background: var(--bg-item-hover);
          color: var(--text-primary);
        }

        /* 顶部预留：与 macOS hiddenInset 红绿灯区域错开 */
        .sidebar-header {
          padding: 28px 16px 12px;
          background: transparent;
          flex-shrink: 0;
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
          flex: 1;
          text-decoration: none;
          color: inherit;
          border-radius: var(--radius-sm, 6px);
          outline-offset: 2px;
        }

        .sidebar-brand:hover .sidebar-brand-name {
          color: var(--text-secondary);
        }

        .sidebar-brand:focus-visible {
          outline: 2px solid var(--accent, #6b8afd);
        }

        .sidebar-logo-img {
          width: 20px;
          height: 20px;
          object-fit: contain;
          border-radius: 4px;
          flex-shrink: 0;
        }

        .sidebar-header h1 {
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--text-tertiary);
          margin-bottom: 0;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .tab-nav {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 4px 0;
        }

        .tab-nav-item {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 8px 10px;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          font-size: 0.82rem;
          font-weight: 500;
          cursor: pointer;
          border-radius: var(--radius-md);
          transition: all var(--transition-normal);
          text-align: left;
          width: 100%;
          letter-spacing: -0.01em;
          position: relative;
        }

        .tab-nav-item:hover {
          color: var(--text-primary);
          background: var(--bg-item-hover);
        }

        .tab-nav-item.active {
          background: var(--accent-muted);
          color: var(--accent-hover);
          font-weight: 600;
        }

        .tab-nav-item.active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 20%;
          bottom: 20%;
          width: 2px;
          border-radius: 9999px;
          background: var(--accent-color);
        }

        .tab-nav-item.tab-nav-sub {
          padding-left: 28px;
          font-size: 0.76rem;
          font-weight: 500;
        }

        .sidebar-content {
          flex: 1;
          min-width: 0;
          overflow-x: hidden;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }
        
        .list-container {
            flex: 1;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }

        .sidebar-footer {
          padding: 12px 16px;
          border-top: 1px solid var(--border-color);
          background: transparent;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .new-btn {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 10px 12px;
            background: var(--accent-color);
            color: white;
            border: none;
            border-radius: var(--radius-md);
            font-size: 0.82rem;
            font-weight: 600;
            cursor: pointer;
            transition: all var(--transition-normal);
            letter-spacing: -0.01em;
        }
        
        .new-btn:hover {
            background: var(--accent-hover);
            box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
            transform: translateY(-1px);
        }
        
        .new-btn:active {
            transform: translateY(0);
        }

        /* Main Content Styles */
        .main-content {
          flex: 1;
          background: var(--bg-content);
          overflow-y: auto;
          overflow-x: hidden;
          position: relative;
          min-width: 0;
        }

        .content-wrapper {
          padding: 2.5rem;
          width: 100%;
          min-height: 100%;
          box-sizing: border-box;
        }

        .form-view,
        .versions-view {
          width: 100%;
          box-sizing: border-box;
        }

        .form-view--panel {
          padding: 2rem 2.5rem 3rem;
          box-sizing: border-box;
          min-height: 100%;
          width: 100%;
          max-width: 100%;
          min-width: 0;
        }

        /* 分栏内编辑区铺满右侧，表单不再限制为 800/900px */
        .form-view--panel :global(.prompt-form),
        .form-view--panel :global(.agent-skill-form) {
          max-width: none;
          width: 100%;
        }

        .content-wrapper.email-browse {
          padding: 0;
          max-width: none;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        /* Email workspace: topbar 通栏搜索 + 下方双栏布局 */
        .email-workspace {
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          overflow: hidden;
        }

        .email-topbar {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 14px 20px;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-sidebar);
        }

        .email-topbar-inner {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          max-width: 920px;
        }

        .email-topbar-search {
          position: relative;
          display: flex;
          align-items: center;
          flex: 1 1 auto;
          min-width: 0;
          height: 40px;
          padding: 0 12px 0 38px;
          border-radius: var(--radius-md, 10px);
          background: var(--bg-app);
          border: 1px solid var(--border-color);
          transition: border-color var(--transition-fast), background var(--transition-fast), box-shadow var(--transition-fast);
        }

        .email-topbar-search:focus-within {
          border-color: var(--accent-color);
          background: var(--bg-elevated, var(--bg-app));
          box-shadow: 0 0 0 3px var(--input-focus-shadow, rgba(99, 102, 241, 0.15));
        }

        .email-topbar-search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-tertiary);
          pointer-events: none;
        }

        .email-topbar-input {
          flex: 1 1 auto;
          min-width: 0;
          height: 100%;
          background: transparent;
          border: none;
          outline: none;
          color: var(--text-primary);
          font-size: 14px;
          line-height: 1;
        }

        .email-topbar-input::placeholder {
          color: var(--text-tertiary);
        }

        .email-topbar-kbd {
          margin-left: 8px;
          display: inline-flex;
          align-items: center;
          color: var(--text-tertiary);
          pointer-events: none;
        }

        .email-topbar-clear {
          margin-left: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          padding: 0;
          border-radius: 999px;
          border: none;
          background: transparent;
          color: var(--text-tertiary);
          cursor: pointer;
          transition: background var(--transition-fast), color var(--transition-fast);
        }

        .email-topbar-clear:hover {
          background: var(--bg-item-hover);
          color: var(--text-primary);
        }

        .email-topbar-new-btn {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 40px;
          padding: 0 16px;
          border-radius: var(--radius-md, 10px);
          background: var(--accent-color);
          color: #fff;
          border: none;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: -0.01em;
          cursor: pointer;
          transition: background var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast);
        }

        .email-topbar-new-btn:hover {
          background: var(--accent-hover, var(--accent-color));
          box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
          transform: translateY(-1px);
        }

        .email-topbar-new-btn:active {
          transform: translateY(0);
        }

        /* Email two-column layout */
        .email-layout {
          display: flex;
          flex: 1 1 auto;
          min-height: 0;
          width: 100%;
          overflow: hidden;
        }

        .email-list-panel {
          width: 320px;
          min-width: 160px;
          max-width: 480px;
          height: 100%;
          border-right: 1px solid var(--border-color);
          background: var(--bg-sidebar);
          display: flex;
          flex-direction: column;
          overflow: visible;
          flex-shrink: 0;
          position: relative;
        }

        .email-list-panel.list-panel-collapsed {
          width: 20px !important;
          min-width: 20px !important;
          max-width: 20px !important;
          overflow: visible;
        }

        /* Resize handle bar on the right edge */
        .list-resize-handle {
          position: absolute;
          right: -3px;
          top: 0;
          bottom: 0;
          width: 6px;
          cursor: col-resize;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
        }

        .list-resize-handle::before {
          content: '';
          position: absolute;
          top: 0;
          bottom: 0;
          left: 2px;
          width: 2px;
          background: transparent;
          transition: background var(--transition-fast);
          border-radius: 2px;
        }

        .list-resize-handle:hover::before {
          background: var(--accent-color);
          opacity: 0.6;
        }

        .list-panel-collapsed .list-resize-handle {
          cursor: pointer;
          right: -10px;
          width: 20px;
        }

        /* Toggle button on the resize handle */
        .list-panel-toggle {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 18px;
          height: 36px;
          border: 1px solid var(--border-color);
          border-left: none;
          background: var(--bg-sidebar);
          color: var(--text-tertiary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
          opacity: 0;
          transition: opacity var(--transition-fast), background var(--transition-fast), color var(--transition-fast);
          padding: 0;
          z-index: 11;
        }

        .list-resize-handle:hover .list-panel-toggle,
        .list-panel-collapsed .list-panel-toggle {
          opacity: 1;
        }

        .list-panel-toggle:hover {
          background: var(--bg-item-hover);
          color: var(--text-primary);
        }

        .email-detail-panel {
          flex: 1 1 0%;
          min-width: 0;
          width: 100%;
          height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          background: var(--bg-app);
        }

        .email-empty-detail {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 12px;
          color: var(--text-tertiary);
          text-align: center;
          padding: 2rem;
        }

        .email-empty-detail .empty-icon {
          opacity: 0.3;
        }

        .email-empty-detail p {
          font-size: 0.95rem;
          font-weight: 500;
          color: var(--text-secondary);
          margin: 0;
        }

        .email-empty-detail span {
          font-size: 0.82rem;
          color: var(--text-tertiary);
        }

        .skills-browse-view {
          width: 100%;
          min-height: min(70vh, 900px);
          animation: fadeIn 0.35s ease;
        }

        .skill-sidebar-info .home-sidebar-icon,
        .prompt-sidebar-info .home-sidebar-icon,
        .agent-sidebar-info .home-sidebar-icon,
        .team-sidebar-info .home-sidebar-icon {
          color: var(--accent-color);
          opacity: 0.85;
        }

        .skill-sidebar-footer {
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
        }

        .skill-sidebar-footer-hint {
          padding: 6px 4px !important;
          font-size: 0.72rem !important;
          line-height: 1.35;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 80vh;
          color: var(--text-secondary);
          text-align: center;
          animation: fadeIn 0.5s ease;
        }
        
        .empty-icon {
            margin-bottom: 1.5rem;
            opacity: 0.25;
            color: var(--accent-color);
        }
        
        .empty-state h2 {
            font-size: 1.3rem;
            margin-bottom: 0.5rem;
            color: var(--text-primary);
            font-weight: 600;
            letter-spacing: -0.02em;
        }
        
        .empty-state p {
            margin-bottom: 2rem;
            font-size: 0.9rem;
            color: var(--text-tertiary);
        }
        
        /* View Header */
        .view-header {
            margin-bottom: 1.5rem;
            padding-bottom: 0;
            border-bottom: none;
        }
        
        .btn-back {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: var(--bg-glass);
            border: 1px solid var(--border-color);
            color: var(--text-secondary);
            padding: 7px 14px;
            border-radius: var(--radius-full);
            cursor: pointer;
            font-size: 0.82rem;
            font-weight: 500;
            transition: all var(--transition-fast);
        }
        
        .btn-back:hover {
            background: var(--bg-item-hover);
            color: var(--text-primary);
            border-color: var(--border-light);
        }
        
        /* Buttons */
        .btn {
            padding: 9px 18px;
            border-radius: var(--radius-md);
            font-weight: 600;
            font-size: 0.85rem;
            border: 1px solid transparent;
            cursor: pointer;
            transition: all var(--transition-normal);
            letter-spacing: -0.01em;
        }
        
        .btn-primary {
            background: var(--accent-color);
            color: white;
        }
        
        .btn-primary:hover {
            background: var(--accent-hover);
            box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
            transform: translateY(-1px);
        }
        
        .btn-primary:active {
            transform: translateY(0);
        }
        
        /* All tabs use unified indigo accent from .tab-nav-item.active */
        
        .market-sidebar-info {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 3rem 1.5rem;
            text-align: center;
            color: var(--text-secondary);
            flex: 1;
            animation: fadeIn 0.4s ease;
        }
        
        .market-sidebar-info h3 {
            margin: 1.25rem 0 0.5rem;
            color: var(--text-primary);
            font-size: 1rem;
            font-weight: 600;
            letter-spacing: -0.02em;
        }
        
        .market-sidebar-info p {
            font-size: 0.82rem;
            line-height: 1.6;
            color: var(--text-tertiary);
        }
        
        .market-footer-hint {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            padding: 10px;
            color: var(--text-tertiary);
            font-size: 0.8rem;
        }
        
        .market-view {
            height: calc(100vh - 5rem);
            margin: -2.5rem;
        }
        
        .home-view {
            height: calc(100vh);
            margin: -2.5rem;
            overflow: hidden;
        }
        
        .home-sidebar-info {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 3rem 1.5rem;
            text-align: center;
            color: var(--text-secondary);
            flex: 1;
            animation: fadeIn 0.4s ease;
        }
        
        .home-sidebar-icon {
            color: var(--accent-color);
            opacity: 0.7;
            margin-bottom: 1rem;
        }
        
        .home-sidebar-info h3 {
            margin: 0 0 0.5rem;
            color: var(--text-primary);
            font-size: 1rem;
            font-weight: 600;
            letter-spacing: -0.02em;
        }
        
        .home-sidebar-info p {
            font-size: 0.82rem;
            line-height: 1.6;
            color: var(--text-tertiary);
        }
        
      `}</style>
    </div>
  );
}

// Agent Skill 查看组件
function AgentSkillView({
  skillId,
  libraries,
  onEdit,
  onBack,
  onViewVersions
}: {
  skillId: string;
  libraries: LibraryItem[];
  onEdit: () => void;
  onBack: () => void;
  onViewVersions: (versionGroupId: string) => void;
}) {
  const { t, locale } = useLocale();
  const pv = t.pageViews;
  const [skill, setSkill] = useState<AgentSkillMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installSuccess, setInstallSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [agents, setAgents] = useState<InstallableAgentInfo[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);

  useEffect(() => {
    loadSkill();
  }, [skillId]);

  const loadSkill = async () => {
    try {
      setLoading(true);
      const { agentSkillAPI } = await import("@/lib/seekdb/api");
      const data = await agentSkillAPI.get(skillId);
      setSkill(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : pv.errorLoad);
    } finally {
      setLoading(false);
    }
  };

  const openInstallModal = async () => {
    if (!skill) return;
    setInstallOpen(true);
    setAgentsLoading(true);
    try {
      const { agentSkillAPI } = await import("@/lib/seekdb/api");
      const list = await agentSkillAPI.listInstallableAgents();
      setAgents(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : pv.errorLoad);
      setTimeout(() => setError(null), 3000);
    } finally {
      setAgentsLoading(false);
    }
  };

  const closeInstallModal = () => {
    if (installing) return;
    setInstallOpen(false);
  };

  const buildExportPayload = async () => {
    const { generateExportFiles, toSkillSlug } = await import("@/lib/agentSkillTemplates");
    if (!skill) return null;
    const folderName = toSkillSlug(skill.name) || skill.skillId;
    const files = generateExportFiles({
      name: skill.name,
      description: skill.description,
      template: skill.template,
      examples: skill.examples,
      tags: skill.tags,
      category: skill.category,
    });
    return { folderName, files, skillId: skill.skillId };
  };

  const handleInstallToAgent = async (agentId: string) => {
    if (!skill) return;
    try {
      setInstalling(true);
      setInstallSuccess(null);
      const payload = await buildExportPayload();
      if (!payload) return;
      const { agentSkillAPI } = await import("@/lib/seekdb/api");
      const installedPath = await agentSkillAPI.installToAgent({
        agentId,
        folderName: payload.folderName,
        files: payload.files,
        skillId: payload.skillId,
      });
      setInstallSuccess(installedPath);
      setInstallOpen(false);
      setTimeout(() => setInstallSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : pv.errorExport);
      setTimeout(() => setError(null), 3000);
    } finally {
      setInstalling(false);
    }
  };

  const handleExportToFolder = async () => {
    if (!skill) return;
    try {
      setInstalling(true);
      setInstallSuccess(null);
      const payload = await buildExportPayload();
      if (!payload) return;
      const { agentSkillAPI } = await import("@/lib/seekdb/api");
      const exportedPath = await agentSkillAPI.exportToFolder({
        folderName: payload.folderName,
        files: payload.files,
        skillId: payload.skillId,
      });
      if (exportedPath) {
        setInstallSuccess(exportedPath);
        setInstallOpen(false);
        setTimeout(() => setInstallSuccess(null), 4000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : pv.errorExport);
      setTimeout(() => setError(null), 3000);
    } finally {
      setInstalling(false);
    }
  };

  const handleCopySkillMd = async () => {
    if (!skill) return;
    try {
      const { generateSkillMd } = await import("@/lib/agentSkillTemplates");
      const content = generateSkillMd({
        name: skill.name,
        description: skill.description,
        template: skill.template,
      });
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleCopyInstallCmd = async () => {
    if (!skill) return;
    const cmd = buildNpxSkillsAddCommand({
      sourceType: skill.sourceType,
      sourceRef: skill.sourceRef,
      sourceSkill: skill.sourceSkill,
      sourceCommit: skill.sourceCommit,
    });
    if (!cmd) return;
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2000);
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="skill-view">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (error || !skill) {
    return (
      <div className="skill-view">
        <div className="error-message">{error || "Skill not found"}</div>
      </div>
    );
  }

  // 生成 SKILL.md 预览内容
  const previewFrontmatter = `---\nname: ${skill.name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '-').replace(/-+/g, '-')}\ndescription: ${(skill.description || '').replace(/\n/g, ' ')}\n---`;

  const libraryOrCategoryLabel = resolveLibraryOrCategoryLabel(
    libraries,
    skill.libraryId,
    skill.category,
  );
  const sourceLabel = formatSkillSourceLabel(
    {
      sourceType: skill.sourceType,
      sourceRef: skill.sourceRef,
      sourceSkill: skill.sourceSkill,
      sourceCommit: skill.sourceCommit,
    },
    locale,
  );
  const installCmd = buildNpxSkillsAddCommand({
    sourceType: skill.sourceType,
    sourceRef: skill.sourceRef,
    sourceSkill: skill.sourceSkill,
    sourceCommit: skill.sourceCommit,
  });

  return (
    <div className="skill-view">
      <div className="skill-header">
        <div className="header-main">
          <h1>{skill.name}</h1>
          <div className="skill-badges">
            {skill.isCurrentVersion && (
              <span className="badge current">Current</span>
            )}
            <span className="badge version">v{skill.version}</span>
            {(skill.fileCount ?? 0) > 0 && (
              <span className="badge version">
                {t.skillPackage.badge.replace("{count}", String(skill.fileCount))}
              </span>
            )}
          </div>
        </div>
        <div className="header-actions">
          <button onClick={() => onViewVersions(skill.skillId)} className="btn-icon" title="History">
            <History size={18} />
          </button>
          <button onClick={handleCopySkillMd} className="btn-icon" title={copied ? pv.copied : pv.copySkillMd}>
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
          {installCmd && (
            <button onClick={handleCopyInstallCmd} className="btn-icon" title={copiedCmd ? pv.copied : pv.copyInstallCmd}>
              {copiedCmd ? <Check size={18} /> : <DownloadCloud size={18} />}
            </button>
          )}
          <button onClick={openInstallModal} className="btn btn-export" disabled={installing} title={pv.installSkill}>
            <Package size={16} /> {installing ? pv.installingSkill : pv.installSkill}
          </button>
          <button
            onClick={() => {
              // 外部 fs-scan 技能：打开编辑器前确认，含磁盘路径与影响提示
              if (
                skill.skillId.startsWith("fs-scan-") &&
                skill.sourcePath &&
                !window.confirm(
                  `该技能来自外部目录，保存修改将写回磁盘文件：\n${skill.sourcePath}\n\n修改会影响使用该技能的 agent。是否继续？`,
                )
              ) {
                return;
              }
              onEdit();
            }}
            className="btn btn-primary"
          >
            {pv.editSkill}
          </button>
        </div>
      </div>

      {installSuccess && (
        <div className="export-success">
          {pv.installSuccess(installSuccess)}
        </div>
      )}

      {installOpen && (
        <InstallSkillModal
          skillName={skill.name}
          agents={agents}
          loading={agentsLoading}
          installing={installing}
          onInstallToAgent={handleInstallToAgent}
          onExportToFolder={handleExportToFolder}
          onClose={closeInstallModal}
        />
      )}

      <div className="skill-detail-grid">
        <div className="detail-section meta">
          {skill.description && (
            <div className="meta-item">
              <span className="label">Description</span>
              <p>{skill.description}</p>
            </div>
          )}
          {sourceLabel && (
            <div className="meta-item">
              <span className="label">{pv.sourceLabel}</span>
              <p>{sourceLabel}</p>
            </div>
          )}
          
          <div className="meta-row">
            {libraryOrCategoryLabel ? (
              <div className="meta-item">
                <span className="label">{pv.metaLibrary}</span>
                <span className="value">{libraryOrCategoryLabel}</span>
              </div>
            ) : null}
            
            {skill.tags && skill.tags.length > 0 && (
              <div className="meta-item">
                <span className="label">Tags</span>
                <div className="tags">
                  {skill.tags.map((tag, i) => (
                    <span key={i} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SKILL.md 预览 */}
        <div className="detail-section content">
          <div className="template-header">
            <h3>SKILL.md</h3>
            <div className="file-structure">
              <span className="fs-icon">📂</span>
              <span className="fs-name">{skill.name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '-').replace(/-+/g, '-')}/</span>
              <span className="fs-files">SKILL.md{skill.examples && skill.examples.length > 0 ? ' + examples.md' : ''}</span>
            </div>
          </div>
          <div className="skill-md-preview">
            <div className="frontmatter-block">
              <pre>{previewFrontmatter}</pre>
            </div>
            <div className="body-block">
              <pre>{skill.template}</pre>
            </div>
          </div>
        </div>

        {/* 多文件技能包：文件树 + 文本预览（无包时面板内提供导入入口） */}
        <div className="detail-section content">
          <div className="template-header">
            <h3>{t.skillPackage.packageLabel}</h3>
          </div>
          <SkillPackagePanel skillId={skill.skillId} />
        </div>

        {(skill.parameters || (skill.examples && skill.examples.length > 0)) && (
          <div className="detail-section additional">
            {skill.parameters && Object.keys(skill.parameters).length > 0 && (
              <div className="additional-item">
                <h3>Parameters</h3>
                <div className="code-block sm">
                  <pre>{JSON.stringify(skill.parameters, null, 2)}</pre>
                </div>
              </div>
            )}

            {skill.examples && skill.examples.length > 0 && (
              <div className="additional-item">
                <h3>Examples</h3>
                <ul className="examples-list">
                  {skill.examples.map((ex, i) => (
                    <li key={i}>{ex}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .skill-view {
          padding: 2rem 2.5rem 3rem;
          animation: fadeIn 0.25s ease;
          width: 100%;
          box-sizing: border-box;
        }

        .skill-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1.5rem;
          margin-bottom: 1.75rem;
          padding-bottom: 1.25rem;
          border-bottom: 1px solid var(--border-color);
        }
        
        .header-main h1 {
          font-size: 1.4rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 0.5rem;
          letter-spacing: -0.03em;
          line-height: 1.3;
        }

        .skill-badges {
          display: flex;
          gap: 0.4rem;
          flex-wrap: wrap;
        }

        .badge {
          padding: 0.18rem 0.55rem;
          border-radius: var(--radius-full);
          font-size: 0.68rem;
          font-weight: 600;
          border: 1px solid var(--border-color);
          letter-spacing: 0.02em;
        }

        .badge.current {
          background: var(--badge-current-bg);
          color: var(--badge-current-color);
          border-color: var(--badge-current-border);
        }

        .badge.version {
          background: var(--badge-version-bg);
          color: var(--badge-version-color);
          border-color: var(--badge-version-border);
        }
        
        .header-actions {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          flex-shrink: 0;
          flex-wrap: wrap;
        }
        
        .btn-icon {
          background: var(--bg-glass);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          cursor: pointer;
          padding: 7px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-fast);
        }
        
        .btn-icon:hover {
          background: var(--bg-item-hover);
          color: var(--text-primary);
          border-color: var(--border-light);
        }

        .btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 8px 14px;
          border-radius: var(--radius-md);
          font-weight: 600;
          font-size: 0.82rem;
          cursor: pointer;
          transition: all var(--transition-normal);
          letter-spacing: -0.01em;
          border: 1px solid var(--border-color);
          white-space: nowrap;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-export {
          background: var(--bg-glass);
          color: var(--text-secondary);
        }

        .btn-export:hover:not(:disabled) {
          background: var(--bg-item-hover);
          color: var(--text-primary);
          border-color: var(--border-light);
        }

        .export-success {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #22c55e;
          padding: 0.65rem 1rem;
          border-radius: var(--radius-lg);
          font-size: 0.8rem;
          margin-bottom: 1.25rem;
          animation: fadeIn 0.3s ease;
        }

        .detail-section {
          margin-bottom: 1.75rem;
        }
        
        .meta-item {
          margin-bottom: 0.9rem;
        }
        
        .meta-row {
          display: flex;
          gap: 2.5rem;
          flex-wrap: wrap;
        }
        
        .label {
          display: block;
          font-size: 0.67rem;
          font-weight: 600;
          color: var(--text-tertiary);
          margin-bottom: 0.3rem;
          text-transform: uppercase;
          letter-spacing: 0.09em;
        }
        
        .value, p {
          color: var(--text-primary);
          font-size: 0.875rem;
          line-height: 1.65;
          margin: 0;
        }
        
        .tags {
          display: flex;
          gap: 0.35rem;
          flex-wrap: wrap;
        }
        
        .tag {
          background: var(--tag-bg);
          border: 1px solid var(--tag-border);
          color: var(--text-secondary);
          padding: 2px 9px;
          border-radius: var(--radius-full);
          font-size: 0.75rem;
        }

        .template-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.65rem;
        }

        .template-header h3 {
          font-size: 0.67rem;
          color: var(--text-tertiary);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.09em;
          margin: 0;
        }

        .file-structure {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.75rem;
          color: var(--text-tertiary);
          background: var(--bg-glass);
          padding: 4px 10px;
          border-radius: var(--radius-full);
          border: 1px solid var(--border-color);
        }

        .fs-icon {
          font-size: 0.8rem;
        }

        .fs-name {
          font-family: 'SF Mono', ui-monospace, monospace;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .fs-files {
          color: var(--text-tertiary);
          font-family: 'SF Mono', ui-monospace, monospace;
        }

        .skill-md-preview {
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }

        .frontmatter-block {
          background: rgba(99, 102, 241, 0.06);
          border-bottom: 1px dashed var(--border-color);
        }

        .frontmatter-block pre {
          padding: 1rem 1.25rem;
          margin: 0;
          font-family: 'SF Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 0.82rem;
          line-height: 1.6;
          color: var(--accent-color);
          white-space: pre-wrap;
        }

        .body-block {
          background: var(--code-bg);
        }

        .body-block pre {
          padding: 1.25rem;
          margin: 0;
          overflow-x: auto;
          font-family: 'SF Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, Liberation Mono, monospace;
          font-size: 0.82rem;
          line-height: 1.65;
          color: var(--text-primary);
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        .content h3, .additional h3 {
          font-size: 0.85rem;
          margin-bottom: 0.75rem;
          color: var(--text-secondary);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .code-block {
          background: var(--code-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }

        .code-block.sm {
          max-height: 200px;
          overflow-y: auto;
        }
        
        .code-block pre {
          padding: 1.25rem;
          margin: 0;
          overflow-x: auto;
          font-family: 'SF Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, Liberation Mono, monospace;
          font-size: 0.85rem;
          line-height: 1.65;
          color: var(--text-primary);
        }

        .examples-list {
          padding-left: 1.5rem;
          color: var(--text-primary);
        }

        .examples-list li {
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
          line-height: 1.6;
        }
        
        .btn-primary {
          background: var(--accent-color);
          color: white;
          border: none;
          padding: 9px 18px;
          border-radius: var(--radius-md);
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all var(--transition-normal);
          letter-spacing: -0.01em;
        }
        
        .btn-primary:hover {
          background: var(--accent-hover);
          box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
          transform: translateY(-1px);
        }
        
        .btn-primary:active {
          transform: translateY(0);
        }

        .loading,
        .error-message {
          text-align: center;
          padding: 2rem;
          color: var(--text-secondary);
        }

        .loading {
          animation: pulse-soft 1.5s ease infinite;
        }

        .error-message {
          color: var(--danger-color);
        }
      `}</style>
    </div>
  );
}

// 「安装 Skill」弹层组件：选择本地已安装的 AI 工具 或 导出到指定文件夹
function InstallSkillModal({
  skillName,
  agents,
  loading,
  installing,
  onInstallToAgent,
  onExportToFolder,
  onClose,
}: {
  skillName: string;
  agents: InstallableAgentInfo[];
  loading: boolean;
  installing: boolean;
  onInstallToAgent: (agentId: string) => void;
  onExportToFolder: () => void;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const pv = t.pageViews;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !installing) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [installing, onClose]);

  const installedAgents = agents.filter((a) => a.installed);
  const otherAgents = agents.filter((a) => !a.installed);
  const noneDetected = !loading && installedAgents.length === 0;

  return (
    <div
      className="install-modal-backdrop"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !installing) onClose();
      }}
    >
      <div className="install-modal">
        <div className="install-modal-header">
          <div>
            <h2>{pv.installDialogTitle}</h2>
            <p className="install-modal-subtitle">
              <span className="install-modal-skill">{skillName}</span>
              <span className="install-modal-sep">·</span>
              <span>{pv.installDialogDesc}</span>
            </p>
          </div>
          <button
            type="button"
            className="install-modal-close"
            onClick={onClose}
            disabled={installing}
            aria-label={pv.installCancel}
          >
            <X size={18} />
          </button>
        </div>

        <div className="install-modal-body">
          {loading ? (
            <div className="install-modal-loading">Loading...</div>
          ) : (
            <>
              {installedAgents.length > 0 && (
                <ul className="install-agent-list">
                  {installedAgents.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        className="install-agent-item"
                        onClick={() => onInstallToAgent(a.id)}
                        disabled={installing}
                      >
                        <div className="install-agent-icon">
                          <Package size={18} />
                        </div>
                        <div className="install-agent-main">
                          <div className="install-agent-name">
                            {a.name}
                            <span className="install-agent-badge detected">
                              {pv.installAgentInstalled}
                            </span>
                          </div>
                          <div className="install-agent-path" title={a.skillsPath}>
                            {a.skillsPath}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {noneDetected && (
                <div className="install-empty">{pv.installNoAgentDetected}</div>
              )}

              <div className="install-divider" role="separator" />

              <ul className="install-agent-list">
                <li>
                  <button
                    type="button"
                    className="install-agent-item folder"
                    onClick={onExportToFolder}
                    disabled={installing}
                  >
                    <div className="install-agent-icon folder-icon">
                      <FolderOpen size={18} />
                    </div>
                    <div className="install-agent-main">
                      <div className="install-agent-name">
                        {pv.installExportToFolder}
                      </div>
                      <div className="install-agent-path">
                        {pv.installExportToFolderDesc}
                      </div>
                    </div>
                  </button>
                </li>
              </ul>

              {otherAgents.length > 0 && (
                <details className="install-other">
                  <summary>
                    <span>{pv.installAgentNotInstalled}</span>
                    <span className="install-other-count">
                      ({otherAgents.length})
                    </span>
                  </summary>
                  <ul className="install-agent-list compact">
                    {otherAgents.map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          className="install-agent-item muted"
                          onClick={() => onInstallToAgent(a.id)}
                          disabled={installing}
                        >
                          <div className="install-agent-icon">
                            <Package size={16} />
                          </div>
                          <div className="install-agent-main">
                            <div className="install-agent-name">
                              {a.name}
                              <span className="install-agent-badge">
                                {pv.installAgentNotInstalled}
                              </span>
                            </div>
                            <div className="install-agent-path" title={a.skillsPath}>
                              {a.skillsPath}
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .install-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1.5rem;
          animation: fadeIn 0.18s ease;
        }

        .install-modal {
          width: 100%;
          max-width: 560px;
          max-height: 85vh;
          background: var(--bg-app, #0f0f12);
          border: 1px solid var(--border-light, rgba(255, 255, 255, 0.1));
          border-radius: var(--radius-xl, 16px);
          box-shadow: var(--shadow-lg, 0 24px 60px rgba(0, 0, 0, 0.4));
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideUp 0.22s ease;
        }

        .install-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          padding: 1.1rem 1.25rem;
          border-bottom: 1px solid var(--border-color);
        }

        .install-modal-header h2 {
          margin: 0 0 0.35rem 0;
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .install-modal-subtitle {
          margin: 0;
          font-size: 0.78rem;
          color: var(--text-tertiary);
          display: flex;
          align-items: center;
          gap: 0.45rem;
          flex-wrap: wrap;
        }

        .install-modal-skill {
          color: var(--text-secondary);
          font-weight: 500;
        }

        .install-modal-sep {
          opacity: 0.5;
        }

        .install-modal-close {
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-tertiary);
          width: 32px;
          height: 32px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all var(--transition-normal);
        }

        .install-modal-close:hover:not(:disabled) {
          background: var(--bg-item-hover);
          color: var(--text-primary);
          border-color: var(--border-color);
        }

        .install-modal-close:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .install-modal-body {
          padding: 0.75rem 0.75rem 1rem 0.75rem;
          overflow-y: auto;
        }

        .install-modal-loading {
          padding: 1.5rem;
          text-align: center;
          color: var(--text-secondary);
          animation: pulse-soft 1.5s ease infinite;
        }

        .install-agent-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .install-agent-list.compact {
          margin-top: 6px;
        }

        .install-agent-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 0.8rem;
          padding: 0.7rem 0.85rem;
          background: transparent;
          border: 1px solid transparent;
          border-radius: var(--radius-lg);
          color: var(--text-primary);
          cursor: pointer;
          text-align: left;
          transition: all var(--transition-normal);
        }

        .install-agent-item:hover:not(:disabled) {
          background: var(--bg-item-hover);
          border-color: var(--border-light);
        }

        .install-agent-item:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .install-agent-item.muted .install-agent-name {
          color: var(--text-secondary);
        }

        .install-agent-icon {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          background: rgba(99, 102, 241, 0.12);
          color: var(--accent-color, #818cf8);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .install-agent-icon.folder-icon {
          background: rgba(34, 197, 94, 0.12);
          color: #22c55e;
        }

        .install-agent-main {
          flex: 1;
          min-width: 0;
        }

        .install-agent-name {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .install-agent-badge {
          font-size: 0.65rem;
          font-weight: 500;
          padding: 2px 7px;
          border-radius: var(--radius-full);
          background: var(--bg-glass);
          border: 1px solid var(--border-color);
          color: var(--text-tertiary);
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .install-agent-badge.detected {
          background: rgba(34, 197, 94, 0.12);
          color: #22c55e;
          border-color: rgba(34, 197, 94, 0.25);
        }

        .install-agent-path {
          margin-top: 2px;
          font-size: 0.72rem;
          color: var(--text-tertiary);
          font-family: 'SF Mono', ui-monospace, monospace;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .install-divider {
          height: 1px;
          background: var(--border-color);
          margin: 8px 6px;
          opacity: 0.6;
        }

        .install-empty {
          padding: 0.8rem 0.85rem;
          font-size: 0.8rem;
          color: var(--text-tertiary);
          background: var(--bg-glass);
          border: 1px dashed var(--border-color);
          border-radius: var(--radius-lg);
          margin: 4px 2px;
        }

        .install-other {
          margin-top: 8px;
        }

        .install-other > summary {
          list-style: none;
          cursor: pointer;
          padding: 0.5rem 0.85rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          border-radius: var(--radius-md);
          transition: all var(--transition-normal);
        }

        .install-other > summary::-webkit-details-marker {
          display: none;
        }

        .install-other > summary:hover {
          color: var(--text-secondary);
          background: var(--bg-item-hover);
        }

        .install-other-count {
          opacity: 0.6;
          font-weight: 500;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes pulse-soft {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>
    </div>
  );
}

// Prompt 查看组件
function PromptView({
  promptId,
  libraries,
  onEdit,
  onBack,
  onViewVersions
}: {
  promptId: string;
  libraries: LibraryItem[];
  onEdit: () => void;
  onBack: () => void;
  onViewVersions: (versionGroupId: string) => void;
}) {
  const { t } = useLocale();
  const pv = t.pageViews;
  const st = t.settings;
  const [prompt, setPrompt] = useState<PromptMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ title: "", description: "", content: "", category: "other" });

  useEffect(() => {
    loadPrompt();
  }, [promptId]);

  const loadPrompt = async () => {
    try {
      setLoading(true);
      const { promptAPI } = await import("@/lib/seekdb/api");
      const data = await promptAPI.get(promptId);
      setPrompt(data);
      if (data) {
        setDraft({
          title: data.title,
          description: data.description || "",
          content: data.content,
          category: data.category || "other",
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : pv.errorLoad);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPrompt = async () => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt.content);
      void showDesktopNotification({
        kind: "copy",
        title: st.notifToastCopyTitle,
        body: st.notifToastCopyBody(prompt.title),
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleSaveInline = async () => {
    if (!prompt) return;
    try {
      setSaving(true);
      const { promptAPI } = await import("@/lib/seekdb/api");
      const { normalizeCategory } = await import("@/lib/promptPolicy");
      const { defaultAccentForCategory } = await import("@/lib/intent-prompt-heuristics");
      const category = normalizeCategory(draft.category);
      await promptAPI.update(promptId, {
        title: draft.title.trim() || prompt.title,
        description: draft.description,
        content: draft.content,
        category,
        accent: defaultAccentForCategory(category),
      });
      await loadPrompt();
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : pv.errorLoad);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="prompt-view">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (error || !prompt) {
    return (
      <div className="prompt-view">
        <div className="error-message">{error || "Prompt not found"}</div>
      </div>
    );
  }

  const libraryOrCategoryLabel = resolveLibraryOrCategoryLabel(
    libraries,
    prompt.libraryId,
    prompt.category,
  );

  return (
    <div className="prompt-view">
      <div className="prompt-header">
        <div className="header-main">
            {editing ? (
              <input
                className="inline-title"
                value={draft.title}
                onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
              />
            ) : (
              <h1>{prompt.title}</h1>
            )}
             <div className="prompt-badges">
                {prompt.isCurrentVersion && (
                <span className="badge current">Current</span>
                )}
                <span className="badge version">v{prompt.version}</span>
            </div>
        </div>
        <div className="header-actions">
            <button onClick={() => onViewVersions(prompt.promptId)} className="btn-icon" title="History">
                <History size={18} />
            </button>
            <button onClick={handleCopyPrompt} className="btn-icon" title={copied ? pv.copied : pv.copyPrompt}>
                {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
            {editing ? (
              <button onClick={handleSaveInline} className="btn btn-primary" disabled={saving}>
                <Save size={16} /> {saving ? t.promptForm.btnSaving : pv.saveInline}
              </button>
            ) : (
              <button onClick={() => setEditing(true)} className="btn btn-primary">
                {pv.editPrompt}
              </button>
            )}
        </div>
      </div>

      <div className="prompt-detail-grid">
         <div className="detail-section meta">
            {(editing || prompt.description) && (
                <div className="meta-item">
                    <span className="label">Description</span>
                    {editing ? (
                      <input
                        className="inline-input"
                        value={draft.description}
                        onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                      />
                    ) : (
                      <p>{prompt.description}</p>
                    )}
                </div>
            )}
            
            <div className="meta-row">
                 {libraryOrCategoryLabel ? (
                <div className="meta-item">
                    <span className="label">{pv.metaLibrary}</span>
                    <span className="value">{libraryOrCategoryLabel}</span>
                </div>
                ) : null}
                
                {prompt.tags && prompt.tags.length > 0 && (
                <div className="meta-item">
                    <span className="label">Tags</span>
                    <div className="tags">
                    {prompt.tags.map((tag, i) => (
                        <span key={i} className="tag">
                        {tag}
                        </span>
                    ))}
                    </div>
                </div>
                )}
            </div>
         </div>
         
         <div className="detail-section content">
             <h3>{pv.promptContent}</h3>
             <div className="content-block">
                {editing ? (
                  <textarea
                    className="inline-content"
                    value={draft.content}
                    onChange={(e) => setDraft((p) => ({ ...p, content: e.target.value }))}
                    rows={18}
                  />
                ) : (
                  <pre className="content-text">{prompt.content}</pre>
                )}
             </div>
         </div>
      </div>

      <style jsx>{`
        .prompt-view {
          padding: 2rem 2.5rem 3rem;
          animation: fadeIn 0.25s ease;
          width: 100%;
          box-sizing: border-box;
        }

        .prompt-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1.5rem;
          margin-bottom: 1.75rem;
          padding-bottom: 1.25rem;
          border-bottom: 1px solid var(--border-color);
        }
        
        .header-main h1 {
            font-size: 1.4rem;
            font-weight: 700;
            color: var(--text-primary);
            margin: 0 0 0.5rem;
            letter-spacing: -0.03em;
            line-height: 1.3;
        }
        .inline-title,
        .inline-input,
        .inline-content {
            width: 100%;
            box-sizing: border-box;
            border: 1px solid var(--border-color);
            border-radius: var(--radius-md);
            background: var(--bg-glass);
            color: var(--text-primary);
            font: inherit;
        }
        .inline-title {
            font-size: 1.3rem;
            font-weight: 700;
            padding: 6px 10px;
            margin-bottom: 0.5rem;
        }
        .inline-input {
            padding: 6px 10px;
            font-size: 0.9rem;
        }
        .inline-content {
            min-height: 280px;
            padding: 12px;
            font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
            font-size: 0.85rem;
            line-height: 1.6;
            resize: vertical;
        }

        .prompt-badges {
          display: flex;
          gap: 0.4rem;
          flex-wrap: wrap;
        }

        .badge {
          padding: 0.18rem 0.55rem;
          border-radius: var(--radius-full);
          font-size: 0.68rem;
          font-weight: 600;
          border: 1px solid var(--border-color);
          letter-spacing: 0.02em;
        }

        .badge.current {
          background: var(--badge-current-bg);
          color: var(--badge-current-color);
          border-color: var(--badge-current-border);
        }

        .badge.version {
          background: var(--badge-version-bg);
          color: var(--badge-version-color);
          border-color: var(--badge-version-border);
        }
        
        .header-actions {
            display: flex;
            gap: 0.5rem;
            align-items: center;
            flex-shrink: 0;
        }
        
        .btn-icon {
            background: var(--bg-glass);
            border: 1px solid var(--border-color);
            color: var(--text-secondary);
            cursor: pointer;
            padding: 7px;
            border-radius: var(--radius-md);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all var(--transition-fast);
        }
        
        .btn-icon:hover {
            background: var(--bg-item-hover);
            color: var(--text-primary);
            border-color: var(--border-light);
        }

        .prompt-detail-grid {
            display: flex;
            flex-direction: column;
            gap: 0;
        }

        .detail-section {
            margin-bottom: 1.75rem;
        }
        
        .meta-item {
            margin-bottom: 0.9rem;
        }
        
        .meta-row {
            display: flex;
            gap: 2.5rem;
            flex-wrap: wrap;
        }
        
        .label {
            display: block;
            font-size: 0.67rem;
            font-weight: 600;
            color: var(--text-tertiary);
            margin-bottom: 0.3rem;
            text-transform: uppercase;
            letter-spacing: 0.09em;
        }
        
        .value, p {
            color: var(--text-primary);
            font-size: 0.875rem;
            line-height: 1.65;
            margin: 0;
        }
        
        .tags {
            display: flex;
            gap: 0.35rem;
            flex-wrap: wrap;
        }
        
        .tag {
            background: var(--tag-bg);
            border: 1px solid var(--tag-border);
            color: var(--text-secondary);
            padding: 2px 9px;
            border-radius: var(--radius-full);
            font-size: 0.75rem;
        }
        
        .content h3 {
            font-size: 0.67rem;
            margin-bottom: 0.65rem;
            color: var(--text-tertiary);
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.09em;
        }
        
        .content-block {
            background: var(--bg-glass);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-lg);
            padding: 1.25rem 1.5rem;
        }

        .content-text {
            margin: 0;
            font-family: inherit;
            font-size: 0.875rem;
            line-height: 1.8;
            color: var(--text-primary);
            white-space: pre-wrap;
            word-break: break-word;
        }
        
        .btn-primary {
            background: var(--accent-color);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: var(--radius-md);
            font-weight: 600;
            font-size: 0.82rem;
            cursor: pointer;
            transition: all var(--transition-normal);
            letter-spacing: -0.01em;
            white-space: nowrap;
        }
        
        .btn-primary:hover {
            background: var(--accent-hover);
            box-shadow: 0 4px 14px rgba(99, 102, 241, 0.28);
            transform: translateY(-1px);
        }
        
        .btn-primary:active {
            transform: translateY(0);
        }

        .loading,
        .error-message {
          text-align: center;
          padding: 3rem 2rem;
          color: var(--text-secondary);
          font-size: 0.875rem;
        }

        .loading {
          animation: pulse-soft 1.5s ease infinite;
        }

        .error-message {
          color: var(--danger-color);
        }
      `}</style>
    </div>
  );
}

