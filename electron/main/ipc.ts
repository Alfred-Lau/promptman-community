import { ipcMain, BrowserWindow, dialog, app, shell, Notification } from "electron";
import { mkdir, writeFile, rm, readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { appendIPCApiLog } from "./appErrorLog";
import {
  getResolvedDataPaths,
  setDataRootMode,
  type DataRootMode,
} from "./dataPaths";
import { transcribeAudio, getModelStatus } from "./audio";
import { createSearchWindow, closeSearchWindow, getMainWindow } from "./window";
import { githubLogin, googleLogin, emailLogin, emailRegister, githubLogout, getAuthStatus } from "./auth";
import { store, DEFAULT_NOTIFICATION_APP_SETTINGS } from "./store";
import type { AiProvider } from "./aiProviderModels";
import {
  resolveEffectiveAiProvider,
  resolveEffectiveModel,
  resolveOpenAiCompatibleBaseUrl,
} from "./aiProviderModels";
import { rebuildMenu } from "./menu";
import type { AppSettings, UserOrganization, OrgInvitation } from "./store";
import { fetchRegistrySkills, fetchRegistryAgents, fetchRegistryDetail, refreshMarketCache } from "./marketRegistry";
import type { FetchOptions } from "./marketRegistry";
import { installSkill, uninstallSkill, listInstalledSkills, scanInstalledSkills } from "./cliRunner";
import type { InstallOptions } from "./cliRunner";
import { getExtensionServerInfo } from "./extensionServer";
import { syncAgentSkillsFromCustomPaths, getExistingKnownPaths, rewriteSkillMdOnDisk, deleteSkillMdOnDisk, persistAgentSkillEmbeddingVersion } from "./skillPathSync";
import { startSkillWatcher, stopSkillWatcher } from "./skillWatcher";
import {
  listInstallableAgents,
  getInstallableAgent,
} from "./agentInstallPaths";
import {
  importZipToPackageDir,
  importFolderToPackageDir,
  buildFileTree,
  readPackageFile,
  writePackageFile,
  buildPackageZipBuffer,
  copyPackageDirTo,
  deletePackageDir,
  getSkillPackageDir,
  getSkillPackageDirName,
  getSkillPackageRoot,
  hasSkillPackage,
} from "./skillPackages";
import { previewRemoteSkills, installRemoteSkills } from "./skillsRemote";
import { syncPromptsFromCustomPaths, getExistingKnownPromptPaths } from "./promptPathSync";
import {
  checkPromptHubToken,
  logoutPromptHub,
  pullSync,
  pushSync,
  getPromptHubUser,
  getSyncState,
  hubListPrompts,
  hubCreatePrompt,
  hubUpdatePrompt,
  hubDeletePrompt,
  hubUploadLocalPrompt,
} from "./prompthub/sync";
import { PromptHubAPIError } from "./prompthub/client";
import { PROMPTHUB_SESSION_EXPIRED } from "./prompthub/syncErrors";
import type {
  PromptHubSyncPushRequest,
  CreatePromptHubPromptInput,
  UpdatePromptHubPromptInput,
} from "./prompthub/sync";
import {
  pullSyncSkills,
  pushSyncSkills,
  pushLocalSkill,
  hubUploadLocalSkill,
  getSkillSyncState,
} from "./prompthub/skillsSync";
import type { PromptHubSkillSyncPushRequest } from "./prompthub/skillsSync";
import {
  createSite,
  createSites,
  getSite,
  getAllSites,
  updateSite,
  deleteSite,
  deleteSites,
  searchSites,
  getSitesCount,
  createComponent,
  createComponents,
  getComponent,
  getAllComponents,
  getComponentsBySiteId,
  updateComponent,
  deleteComponent,
  deleteComponents,
  deleteComponentsBySiteId,
  searchComponents,
  getComponentsCount,
  createPrompt,
  createPrompts,
  getPrompt,
  getAllPrompts,
  getCurrentPrompts,
  getPromptVersions,
  updatePrompt,
  setCurrentVersion,
  deletePrompt,
  deletePromptAllVersions,
  deletePrompts,
  searchPrompts,
  getPromptsCount,
  togglePromptStar,
  incrementPromptUses,
  createAgentSkill,
  getAgentSkill,
  getAllAgentSkills,
  getCurrentAgentSkills,
  getAgentSkillVersions,
  updateAgentSkill,
  setAgentSkillCurrentVersion,
  deleteAgentSkill,
  deleteAgentSkillAllVersions,
  deleteAgentSkills,
  searchAgentSkills,
  getAgentSkillsCount,
  toggleAgentSkillStar,
  incrementAgentSkillUses,
  setAgentSkillPackageIndex,
  getCurrentAgentSkillBySkillId,
  createSubAgent,
  getSubAgent,
  getAllSubAgents,
  getCurrentSubAgents,
  getSubAgentVersions,
  updateSubAgent,
  setSubAgentCurrentVersion,
  deleteSubAgent,
  deleteSubAgentAllVersions,
  deleteSubAgents,
  searchSubAgents,
  getSubAgentsCount,
  createAgentTeam,
  getAgentTeam,
  getAllAgentTeams,
  getCurrentAgentTeams,
  getAgentTeamVersions,
  updateAgentTeam,
  setAgentTeamCurrentVersion,
  deleteAgentTeam,
  deleteAgentTeamAllVersions,
  deleteAgentTeams,
  searchAgentTeams,
  getAgentTeamsCount,
  createLibrary,
  getLibrary,
  getAllLibraries,
  updateLibrary,
  deleteLibrary,
  movePromptToLibrary,
  moveSkillToLibrary,
  getAllTagDefinitions,
  createTagDefinition,
  updateTagDefinition,
  deleteTagDefinition,
} from "./sqlitedb";
import { reindexAgentSkills } from "./sqlitedb/crud";
import { normalizeTagsForSave, resolveTagIdsToNames } from "./sqlitedb/tags";
import type {
  CreateSiteInput,
  CreateComponentInput,
  UpdateSiteInput,
  UpdateComponentInput,
  QueryOptions,
  CreatePromptInput,
  UpdatePromptInput,
  CreateAgentSkillInput,
  UpdateAgentSkillInput,
  CreateSubAgentInput,
  UpdateSubAgentInput,
  CreateAgentTeamInput,
  UpdateAgentTeamInput,
  CreateLibraryInput,
  UpdateLibraryInput,
} from "./sqlitedb";

/** PromptHub API 401：云端拒绝凭据，与应用会话统一清空 */
async function promptHubIpcErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error instanceof PromptHubAPIError && error.statusCode === 401) {
    await store.clearUnifiedSession();
    return PROMPTHUB_SESSION_EXPIRED;
  }
  return error instanceof Error ? error.message : fallback;
}

export function setupIPC(): void {
  // 窗口控制 IPC
  ipcMain.on("window:minimize", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.minimize();
  });

  ipcMain.on("window:maximize", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window?.isMaximized()) {
      window.unmaximize();
    } else {
      window?.maximize();
    }
  });

  ipcMain.on("window:close", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.close();
  });

  // 渲染进程 IPC 失败（preload 包装 invoke），写入 ipc-api.log 供导出日志排查
  ipcMain.on("app:ipcDebugLog", (_event, payload: unknown) => {
    if (!payload || typeof payload !== "object") return;
    const p = payload as { channel?: string; kind?: string; error?: string };
    appendIPCApiLog(
      `[renderer] ${p.kind ?? "?"} channel=${p.channel ?? "?"} ${p.error ?? ""}`.trim(),
    );
  });

  // 搜索窗口控制 IPC
  ipcMain.on("search:open", () => {
    createSearchWindow();
  });

  ipcMain.on("search:close", () => {
    closeSearchWindow();
  });

  // 动态调整搜索窗口高度
  ipcMain.handle("search:resize", (_event, height: number) => {
    const win = BrowserWindow.fromWebContents(_event.sender);
    if (win && !win.isDestroyed()) {
      const [width] = win.getSize();
      win.setSize(width, Math.round(height));
    }
  });

  // 搜索结果导航：关闭搜索窗口，在主窗口打开对应内容
  ipcMain.on("search:navigate", (_event, payload: { type: string; id: string }) => {
    // 关闭搜索窗口
    closeSearchWindow();

    // 向主窗口发送导航事件
    const main = getMainWindow();
    if (main && !main.isDestroyed()) {
      main.webContents.send("search:navigate", payload);
      // 聚焦主窗口
      if (main.isMinimized()) main.restore();
      main.show();
      main.focus();
    }
  });

  // 应用信息
  ipcMain.handle("app:getVersion", () => {
    return app.getVersion();
  });

  ipcMain.handle("app:getPlatform", () => {
    return process.platform;
  });

  // 扩展 API 服务信息（供 Chrome 插件配置或设置页展示）
  ipcMain.handle("extensionServer:getInfo", () => {
    return getExtensionServerInfo();
  });

  ipcMain.handle("app:getDataPaths", async () => {
    try {
      const p = getResolvedDataPaths();
      return {
        success: true,
        data: {
          userData: p.dataRoot,
          home: p.home,
          dataRoot: p.dataRoot,
          dataRootMode: p.dataRootMode,
          electronUserData: p.electronUserData,
          dotPromptmanDir: p.dotPromptmanDir,
          preferenceFile: p.preferenceFile,
          storeFile: p.storeFile,
          dbFile: p.dbFile,
          skillsDir: p.skillsDir,
          modelsDir: p.modelsDir,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  ipcMain.handle("app:setDataRootMode", async (_event, mode: DataRootMode) => {
    try {
      if (mode !== "appUserData" && mode !== "homeDotPromptman") {
        return { success: false, error: "Invalid data root mode" };
      }
      setDataRootMode(mode);
      return { success: true, data: { needsRestart: true } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  ipcMain.handle("app:openPath", async (_event, targetPath: string) => {
    try {
      if (typeof targetPath !== "string" || !targetPath.trim()) {
        return { success: false, error: "Invalid path" };
      }
      const err = await shell.openPath(targetPath.trim());
      if (err) {
        return { success: false, error: err };
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  ipcMain.handle("app:clearEmbeddingCache", async () => {
    try {
      const { modelsDir } = getResolvedDataPaths();
      await rm(modelsDir, { recursive: true, force: true });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  ipcMain.handle(
    "app:showNotification",
    async (
      _event,
      payload: {
        title: string;
        body?: string;
        kind: "copy" | "save" | "generic";
      },
    ) => {
      try {
        if (!payload?.title || typeof payload.title !== "string") {
          return { success: false, error: "Invalid notification" };
        }
        const prefs = await store.getSettings();
        const n = {
          ...DEFAULT_NOTIFICATION_APP_SETTINGS,
          ...prefs.notifications,
        };
        if (!n.enabled) {
          return { success: true, skipped: true };
        }
        if (payload.kind === "copy" && !n.copySuccess) {
          return { success: true, skipped: true };
        }
        if (payload.kind === "save" && !n.saveSuccess) {
          return { success: true, skipped: true };
        }
        if (!Notification.isSupported()) {
          return { success: false, error: "Notifications not supported" };
        }
        const notification = new Notification({
          title: payload.title.slice(0, 256),
          body: payload.body ? payload.body.slice(0, 512) : undefined,
        });
        notification.show();
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // ==================== 站点 CRUD IPC ====================

  // 创建站点
  ipcMain.handle(
    "seekdb:site:create",
    async (_event, input: CreateSiteInput) => {
      try {
        await createSite(input);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 批量创建站点
  ipcMain.handle(
    "seekdb:site:createBatch",
    async (_event, inputs: CreateSiteInput[]) => {
      try {
        await createSites(inputs);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 获取站点
  ipcMain.handle("seekdb:site:get", async (_event, id: string) => {
    try {
      const site = await getSite(id);
      return { success: true, data: site };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 获取所有站点
  ipcMain.handle("seekdb:site:getAll", async () => {
    try {
      const result = await getAllSites();
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 更新站点
  ipcMain.handle(
    "seekdb:site:update",
    async (_event, id: string, input: UpdateSiteInput) => {
      try {
        await updateSite(id, input);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 删除站点
  ipcMain.handle("seekdb:site:delete", async (_event, id: string) => {
    try {
      await deleteSite(id);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 批量删除站点
  ipcMain.handle("seekdb:site:deleteBatch", async (_event, ids: string[]) => {
    try {
      await deleteSites(ids);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 搜索站点
  ipcMain.handle(
    "seekdb:site:search",
    async (_event, options: QueryOptions) => {
      try {
        const result = await searchSites(options);
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 获取站点数量
  ipcMain.handle("seekdb:site:count", async () => {
    try {
      const count = await getSitesCount();
      return { success: true, data: count };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // ==================== 组件 CRUD IPC ====================

  // 创建组件
  ipcMain.handle(
    "seekdb:component:create",
    async (_event, input: CreateComponentInput) => {
      try {
        await createComponent(input);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 批量创建组件
  ipcMain.handle(
    "seekdb:component:createBatch",
    async (_event, inputs: CreateComponentInput[]) => {
      try {
        await createComponents(inputs);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 获取组件
  ipcMain.handle("seekdb:component:get", async (_event, id: string) => {
    try {
      const component = await getComponent(id);
      return { success: true, data: component };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 获取所有组件
  ipcMain.handle("seekdb:component:getAll", async () => {
    try {
      const result = await getAllComponents();
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 根据站点 ID 获取组件
  ipcMain.handle(
    "seekdb:component:getBySiteId",
    async (_event, siteId: string) => {
      try {
        const result = await getComponentsBySiteId(siteId);
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 更新组件
  ipcMain.handle(
    "seekdb:component:update",
    async (_event, id: string, input: UpdateComponentInput) => {
      try {
        await updateComponent(id, input);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 删除组件
  ipcMain.handle("seekdb:component:delete", async (_event, id: string) => {
    try {
      await deleteComponent(id);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 批量删除组件
  ipcMain.handle(
    "seekdb:component:deleteBatch",
    async (_event, ids: string[]) => {
      try {
        await deleteComponents(ids);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 根据站点 ID 删除所有组件
  ipcMain.handle(
    "seekdb:component:deleteBySiteId",
    async (_event, siteId: string) => {
      try {
        await deleteComponentsBySiteId(siteId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 搜索组件
  ipcMain.handle(
    "seekdb:component:search",
    async (_event, options: QueryOptions) => {
      try {
        const result = await searchComponents(options);
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 获取组件数量
  ipcMain.handle("seekdb:component:count", async () => {
    try {
      const count = await getComponentsCount();
      return { success: true, data: count };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // ==================== Prompt CRUD IPC ====================

  // 创建prompt
  ipcMain.handle(
    "seekdb:prompt:create",
    async (_event, input: CreatePromptInput) => {
      try {
        await createPrompt(input);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 批量创建prompt
  ipcMain.handle(
    "seekdb:prompt:createBatch",
    async (_event, inputs: CreatePromptInput[]) => {
      try {
        await createPrompts(inputs);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 获取prompt
  ipcMain.handle("seekdb:prompt:get", async (_event, id: string) => {
    try {
      const prompt = await getPrompt(id);
      return { success: true, data: prompt };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 获取所有prompt
  ipcMain.handle("seekdb:prompt:getAll", async () => {
    try {
      const result = await getAllPrompts();
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 获取当前版本的prompt
  ipcMain.handle("seekdb:prompt:getCurrent", async () => {
    try {
      const result = await getCurrentPrompts();
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 获取prompt的所有版本
  ipcMain.handle(
    "seekdb:prompt:getVersions",
    async (_event, promptId: string) => {
      try {
        const versions = await getPromptVersions(promptId);
        return { success: true, data: versions };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 更新prompt
  ipcMain.handle(
    "seekdb:prompt:update",
    async (_event, id: string, input: UpdatePromptInput) => {
      try {
        await updatePrompt(id, input);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 设置某个版本为当前版本
  ipcMain.handle(
    "seekdb:prompt:setCurrentVersion",
    async (_event, promptId: string, versionId: string) => {
      try {
        await setCurrentVersion(promptId, versionId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 删除prompt
  ipcMain.handle("seekdb:prompt:delete", async (_event, id: string) => {
    try {
      await deletePrompt(id);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 删除prompt的所有版本
  ipcMain.handle(
    "seekdb:prompt:deleteAllVersions",
    async (_event, promptId: string) => {
      try {
        await deletePromptAllVersions(promptId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 批量删除prompt
  ipcMain.handle("seekdb:prompt:deleteBatch", async (_event, ids: string[]) => {
    try {
      await deletePrompts(ids);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 搜索prompt
  ipcMain.handle(
    "seekdb:prompt:search",
    async (_event, options: QueryOptions) => {
      try {
        const result = await searchPrompts(options);
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 获取prompt数量
  ipcMain.handle("seekdb:prompt:count", async () => {
    try {
      const count = await getPromptsCount();
      return { success: true, data: count };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // ==================== 星标和使用计数 ====================

  ipcMain.handle('seekdb:prompt:toggleStar', async (_event, id: string) => {
    try {
      const isStarred = await togglePromptStar(id);
      return { success: true, data: isStarred };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('seekdb:prompt:incrementUses', async (_event, id: string) => {
    try {
      await incrementPromptUses(id);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('seekdb:agentSkill:toggleStar', async (_event, id: string) => {
    try {
      const isStarred = await toggleAgentSkillStar(id);
      return { success: true, data: isStarred };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('seekdb:agentSkill:incrementUses', async (_event, id: string) => {
    try {
      await incrementAgentSkillUses(id);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // ==================== 云数据拉取 ====================

  ipcMain.handle('prompthub:prompt:listCloud', async () => {
    try {
      const { getPromptHubUser } = await import('./prompthub/sync');
      const user = getPromptHubUser();
      if (!user) return { success: true, data: [] };
      const { hubListPrompts } = await import('./prompthub/sync');
      const prompts = await hubListPrompts();
      return { success: true, data: prompts };
    } catch (err) {
      return { success: true, data: [] };
    }
  });

  ipcMain.handle('prompthub:skill:listCloud', async () => {
    try {
      const auth = await store.getPromptHubAuth();
      if (!auth?.token) return { success: true, data: [] };
      const { listSkills } = await import('./prompthub/client');
      const res = await listSkills(auth.token, { limit: 200 });
      return { success: true, data: res.data ?? [] };
    } catch {
      return { success: true, data: [] };
    }
  });

  ipcMain.handle('prompthub:library:listCloudFolders', async () => {
    try {
      const auth = await store.getPromptHubAuth();
      if (!auth?.token) {
        appendIPCApiLog('[prompthub:library:listCloudFolders] no token, skip');
        return { success: true, data: [] };
      }
      const { listCloudLibraryFolders } = await import('./prompthub/client');
      const folders = await listCloudLibraryFolders(auth.token);
      return { success: true, data: folders };
    } catch (err) {
      appendIPCApiLog(`[prompthub:library:listCloudFolders] error: ${err instanceof Error ? err.message : String(err)}`);
      return { success: false, error: String(err), data: [] };
    }
  });

  ipcMain.handle('prompthub:library:listCloudItems', async (_event, folderId: string | null) => {
    try {
      const auth = await store.getPromptHubAuth();
      if (!auth?.token) {
        appendIPCApiLog('[prompthub:library:listCloudItems] no token, skip');
        return { success: true, data: [] };
      }
      const { listCloudLibraryItems } = await import('./prompthub/client');
      const items = await listCloudLibraryItems(auth.token, folderId);
      return { success: true, data: items };
    } catch (err) {
      appendIPCApiLog(`[prompthub:library:listCloudItems] error: ${err instanceof Error ? err.message : String(err)}`);
      return { success: false, error: String(err), data: [] };
    }
  });

  // ==================== Discovery / Gallery IPC (public, no auth) ====================

  ipcMain.handle('discovery:gallery:items', async (_event, params?: { q?: string; category?: string; sort?: string }) => {
    try {
      const { fetchGalleryItems } = await import('./prompthub/client');
      const result = await fetchGalleryItems(params as Parameters<typeof fetchGalleryItems>[0]);
      return { success: true, data: result };
    } catch (err) {
      appendIPCApiLog(`[discovery:gallery:items] error: ${err instanceof Error ? err.message : String(err)}`);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('discovery:gallery:prompts', async (_event, params?: { limit?: number; offset?: number }) => {
    try {
      const { fetchGalleryPrompts } = await import('./prompthub/client');
      const result = await fetchGalleryPrompts(params);
      return { success: true, data: result };
    } catch (err) {
      appendIPCApiLog(`[discovery:gallery:prompts] error: ${err instanceof Error ? err.message : String(err)}`);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('discovery:gallery:skills', async (_event, params?: { limit?: number; offset?: number }) => {
    try {
      const { fetchGallerySkills } = await import('./prompthub/client');
      const result = await fetchGallerySkills(params);
      return { success: true, data: result };
    } catch (err) {
      appendIPCApiLog(`[discovery:gallery:skills] error: ${err instanceof Error ? err.message : String(err)}`);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // ==================== Agent Skills CRUD IPC ====================

  // 创建 Agent Skill
  ipcMain.handle(
    "seekdb:agentSkill:create",
    async (_event, input: CreateAgentSkillInput) => {
      try {
        await createAgentSkill(input);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 批量创建 Agent Skill（暂时使用循环调用单个创建）
  ipcMain.handle(
    "seekdb:agentSkill:createBatch",
    async (_event, inputs: CreateAgentSkillInput[]) => {
      try {
        for (const input of inputs) {
          await createAgentSkill(input);
        }
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 获取 Agent Skill
  ipcMain.handle("seekdb:agentSkill:get", async (_event, id: string) => {
    try {
      const skill = await getAgentSkill(id);
      return { success: true, data: skill };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 获取所有 Agent Skills
  ipcMain.handle("seekdb:agentSkill:getAll", async () => {
    try {
      const result = await getAllAgentSkills();
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 获取当前版本的 Agent Skills
  ipcMain.handle("seekdb:agentSkill:getCurrent", async () => {
    try {
      const result = await getCurrentAgentSkills();
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 获取 Agent Skill 的所有版本
  ipcMain.handle(
    "seekdb:agentSkill:getVersions",
    async (_event, skillId: string) => {
      try {
        const versions = await getAgentSkillVersions(skillId);
        return { success: true, data: versions };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // ==================== Agent Skill 磁盘写回辅助 ====================

  /** 返回这些 skill 版本行中磁盘文件仍存在的 source_path（去重）；磁盘文件不存在视为无需写盘 */
  async function collectExistingDiskSourcePaths(ids: string[]): Promise<string[]> {
    const paths = new Set<string>();
    for (const id of ids) {
      try {
        const row = await getAgentSkill(id);
        if (row?.sourcePath && existsSync(row.sourcePath)) {
          paths.add(row.sourcePath);
        }
      } catch {
        /* 单行查询失败不阻塞其余行 */
      }
    }
    return [...paths];
  }

  /** 删除安全门：命中磁盘文件时必须显式 confirmDisk 才允许删除 */
  function needsDiskConfirm(paths: string[]): boolean {
    return paths.length > 0;
  }

  // 更新 Agent Skill（外部 fs-scan 技能：先写回磁盘 SKILL.md，写盘失败则不落库）
  ipcMain.handle(
    "seekdb:agentSkill:update",
    async (_event, id: string, input: UpdateAgentSkillInput) => {
      try {
        const row = await getAgentSkill(id);
        if (row?.sourcePath && existsSync(row.sourcePath)) {
          // 同步写盘（文件小）；写失败抛错 → 返回错误、不落库，保证磁盘与库一致
          const tagNames =
            input.tags !== undefined
              ? resolveTagIdsToNames(normalizeTagsForSave(input.tags))
              : undefined;
          rewriteSkillMdOnDisk(row.sourcePath, {
            name: input.name,
            description: input.description,
            template: input.template,
            category: input.category,
            tags: tagNames,
            platforms: input.platforms,
            versionLabel: input.versionLabel,
          });
        }
        await updateAgentSkill(id, input);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 设置某个版本为当前版本
  ipcMain.handle(
    "seekdb:agentSkill:setCurrentVersion",
    async (_event, skillId: string, versionId: string) => {
      try {
        await setAgentSkillCurrentVersion(skillId, versionId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 删除 Agent Skill（单个版本）
  // 外部 fs-scan 行：命中磁盘文件时需 options.confirmDisk === true（UI 已展示磁盘路径并确认），
  // 先删磁盘 SKILL.md 再删库；未确认时拒绝删除并返回 needsDiskConfirm
  ipcMain.handle(
    "seekdb:agentSkill:delete",
    async (_event, id: string, options?: { confirmDisk?: boolean }) => {
      try {
        const diskPaths = await collectExistingDiskSourcePaths([id]);
        if (needsDiskConfirm(diskPaths) && options?.confirmDisk !== true) {
          return {
            success: false,
            needsDiskConfirm: true,
            sourcePath: diskPaths[0],
            error:
              "该技能来自外部目录，删除将同时删除磁盘文件，请确认后重试（confirmDisk）",
          };
        }
        for (const p of diskPaths) deleteSkillMdOnDisk(p);
        await deleteAgentSkill(id);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 删除 Agent Skill 的所有版本（删除整个外部技能：同样受 confirmDisk 门控）
  ipcMain.handle(
    "seekdb:agentSkill:deleteAllVersions",
    async (_event, skillId: string, options?: { confirmDisk?: boolean }) => {
      try {
        const current = await getCurrentAgentSkillBySkillId(skillId);
        let diskPath: string | null = null;
        if (current?.sourcePath && existsSync(current.sourcePath)) {
          diskPath = current.sourcePath;
        }
        if (diskPath && options?.confirmDisk !== true) {
          return {
            success: false,
            needsDiskConfirm: true,
            sourcePath: diskPath,
            error:
              "该技能来自外部目录，删除将同时删除磁盘文件，请确认后重试（confirmDisk）",
          };
        }
        if (diskPath) deleteSkillMdOnDisk(diskPath);
        await deleteAgentSkillAllVersions(skillId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 批量删除 Agent Skill（命中磁盘文件时受 confirmDisk 门控；同一磁盘文件只删一次）
  ipcMain.handle(
    "seekdb:agentSkill:deleteBatch",
    async (_event, ids: string[], options?: { confirmDisk?: boolean }) => {
      try {
        const diskPaths = await collectExistingDiskSourcePaths(ids);
        if (needsDiskConfirm(diskPaths) && options?.confirmDisk !== true) {
          return {
            success: false,
            needsDiskConfirm: true,
            sourcePath: diskPaths[0],
            error:
              "所选技能来自外部目录，删除将同时删除磁盘文件，请确认后重试（confirmDisk）",
          };
        }
        for (const p of diskPaths) deleteSkillMdOnDisk(p);
        await deleteAgentSkills(ids);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 搜索 Agent Skills
  ipcMain.handle(
    "seekdb:agentSkill:search",
    async (_event, options: QueryOptions) => {
      try {
        const results = await searchAgentSkills(options);
        return { success: true, data: results };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 获取 Agent Skills 数量
  ipcMain.handle("seekdb:agentSkill:count", async () => {
    try {
      const count = await getAgentSkillsCount();
      return { success: true, data: count };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // ==================== Skill Export IPC ====================

  // 选择导出目录
  ipcMain.handle("dialog:selectDirectory", async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      return { success: false, error: "无法获取窗口引用" };
    }
    try {
      const result = await dialog.showOpenDialog(window, {
        title: "选择导出目录",
        properties: ["openDirectory", "createDirectory"],
        buttonLabel: "选择此目录",
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null };
      }
      return { success: true, data: result.filePaths[0] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  /**
   * 把 Skill 写到目标目录：
   * - 该 skill 有多文件技能包 → 先整目录拷贝，再用 files 覆盖（保证编辑器里的 SKILL.md 生效）
   * - 没有包 → 保持原有逐文件写入的行为
   */
  const writeSkillTo = async (
    skillDir: string,
    files: Array<{ filename: string; content: string }>,
    skillId?: string,
  ): Promise<void> => {
    await mkdir(skillDir, { recursive: true });

    if (skillId && hasSkillPackage(skillId)) {
      copyPackageDirTo(skillId, skillDir);
    }

    for (const file of files) {
      const filePath = join(skillDir, file.filename);
      await mkdir(join(filePath, ".."), { recursive: true });
      await writeFile(filePath, file.content, "utf-8");
    }
  };

  // 导出 Skill 为文件夹 (SKILL.md 标准结构；有技能包时导出完整目录树)
  ipcMain.handle(
    "skill:exportToFolder",
    async (
      _event,
      args: {
        targetDir: string;
        folderName: string;
        files: Array<{ filename: string; content: string }>;
        skillId?: string;
      },
    ) => {
      try {
        const { targetDir, folderName, files, skillId } = args;
        const skillDir = join(targetDir, folderName);
        await writeSkillTo(skillDir, files, skillId);
        return { success: true, data: skillDir };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 列出已知 AI Agent 的安装信息（供「安装 Skill」弹层展示可选目标）
  ipcMain.handle("skill:listInstallableAgents", async () => {
    try {
      const agents = listInstallableAgents();
      return { success: true, data: agents };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 安装 Skill 到指定 Agent 的默认 skills 目录
  ipcMain.handle(
    "skill:installToAgent",
    async (
      _event,
      args: {
        agentId: string;
        folderName: string;
        files: Array<{ filename: string; content: string }>;
        skillId?: string;
      },
    ) => {
      try {
        const { agentId, folderName, files, skillId } = args;
        const agent = getInstallableAgent(agentId);
        if (!agent) {
          return { success: false, error: `未知的 Agent: ${agentId}` };
        }

        // 确保 skills 根目录存在（即便 Agent 未安装，也允许用户创建）
        await mkdir(agent.skillsPath, { recursive: true });

        const skillDir = join(agent.skillsPath, folderName);
        await writeSkillTo(skillDir, files, skillId);

        return { success: true, data: skillDir };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // ==================== 多文件技能包 IPC ====================

  /**
   * 导入结果写回 DB（按 skill_id 整组），并在 template 为空时用包内 SKILL.md 回填
   */
  const persistPackageImport = async (
    skillId: string,
    result: {
      packageDir: string;
      fileTree: ReturnType<typeof buildFileTree>;
      fileCount: number;
      packageSize: number;
      skillMd: string;
      skipped: number;
    },
  ) => {
    setAgentSkillPackageIndex(skillId, {
      packageDir: result.packageDir,
      fileTree: result.fileTree,
      fileCount: result.fileCount,
      packageSize: result.packageSize,
    });

    // 只有本地正文为空时才用包内 SKILL.md 回填，避免覆盖用户已编辑的内容
    const current = await getCurrentAgentSkillBySkillId(skillId);
    let templateFilled = false;
    if (current && !current.template.trim() && result.skillMd.trim()) {
      await updateAgentSkill(current.id, { template: result.skillMd });
      templateFilled = true;
    }

    return { ...result, templateFilled };
  };

  // 从 ZIP 导入技能包（未传 filePath 时弹出文件选择框）
  ipcMain.handle(
    "skill:package:importZip",
    async (event, args: { skillId: string; filePath?: string }) => {
      try {
        const { skillId } = args;
        if (!skillId) return { success: false, error: "缺少 skillId" };

        let filePath = args.filePath;
        if (!filePath) {
          const window = BrowserWindow.fromWebContents(event.sender);
          if (!window) return { success: false, error: "无法获取窗口引用" };
          const picked = await dialog.showOpenDialog(window, {
            title: "选择技能包 ZIP",
            properties: ["openFile"],
            filters: [{ name: "ZIP 压缩包", extensions: ["zip"] }],
            buttonLabel: "导入",
          });
          if (picked.canceled || picked.filePaths.length === 0) {
            return { success: true, data: null };
          }
          filePath = picked.filePaths[0];
        }

        const buffer = await readFile(filePath);
        const result = importZipToPackageDir(skillId, buffer);
        return { success: true, data: await persistPackageImport(skillId, result) };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 从本地文件夹导入技能包（未传 sourceDir 时弹出目录选择框）
  ipcMain.handle(
    "skill:package:importFolder",
    async (event, args: { skillId: string; sourceDir?: string }) => {
      try {
        const { skillId } = args;
        if (!skillId) return { success: false, error: "缺少 skillId" };

        let sourceDir = args.sourceDir;
        if (!sourceDir) {
          const window = BrowserWindow.fromWebContents(event.sender);
          if (!window) return { success: false, error: "无法获取窗口引用" };
          const picked = await dialog.showOpenDialog(window, {
            title: "选择技能包目录",
            properties: ["openDirectory"],
            buttonLabel: "导入",
          });
          if (picked.canceled || picked.filePaths.length === 0) {
            return { success: true, data: null };
          }
          sourceDir = picked.filePaths[0];
        }

        const result = importFolderToPackageDir(skillId, sourceDir);
        return { success: true, data: await persistPackageImport(skillId, result) };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 读取技能包文件树（磁盘为准，顺便刷新 DB 索引）
  ipcMain.handle("skill:package:tree", async (_event, args: { skillId: string }) => {
    try {
      const fileTree = buildFileTree(args.skillId);
      const files = fileTree.filter((n) => !n.isDir);
      setAgentSkillPackageIndex(args.skillId, {
        packageDir: fileTree.length ? getSkillPackageDirName(args.skillId) : null,
        fileTree,
        fileCount: files.length,
        packageSize: files.reduce((sum, n) => sum + (n.size || 0), 0),
      });
      return { success: true, data: fileTree };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 读取技能包内单个文本文件（用于预览）
  ipcMain.handle(
    "skill:package:readFile",
    async (_event, args: { skillId: string; path: string }) => {
      try {
        return { success: true, data: readPackageFile(args.skillId, args.path) };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 移除技能包（保留技能本身）
  ipcMain.handle("skill:package:clear", async (_event, args: { skillId: string }) => {
    try {
      deletePackageDir(args.skillId);
      setAgentSkillPackageIndex(args.skillId, {
        packageDir: null,
        fileTree: [],
        fileCount: 0,
        packageSize: 0,
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 写入技能包内文本文件（详情页 inline 编辑）
  ipcMain.handle(
    "skill:package:writeFile",
    async (_event, args: { skillId: string; path: string; content: string }) => {
      try {
        if (!args.skillId || !args.path) {
          return { success: false, error: "缺少 skillId 或 path" };
        }
        const index = writePackageFile(args.skillId, args.path, args.content);
        setAgentSkillPackageIndex(args.skillId, {
          packageDir: getSkillPackageDirName(args.skillId),
          fileTree: index.fileTree,
          fileCount: index.fileCount,
          packageSize: index.packageSize,
        });
        const base = args.path.split("/").pop()?.toLowerCase() ?? "";
        if (base === "skill.md") {
          const current = await getCurrentAgentSkillBySkillId(args.skillId);
          if (current) {
            await updateAgentSkill(current.id, { template: args.content });
          }
        }
        return { success: true, data: index };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 导出技能包为 ZIP（弹出保存对话框）
  ipcMain.handle(
    "skill:package:exportZip",
    async (event, args: { skillId: string; suggestedName?: string }) => {
      try {
        if (!args.skillId) return { success: false, error: "缺少 skillId" };
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) return { success: false, error: "无法获取窗口引用" };
        const suggested = (args.suggestedName || args.skillId).replace(/[^\w.-]+/g, "-");
        const picked = await dialog.showSaveDialog(window, {
          title: "导出技能包 ZIP",
          defaultPath: `${suggested}.zip`,
          filters: [{ name: "ZIP", extensions: ["zip"] }],
        });
        if (picked.canceled || !picked.filePath) {
          return { success: true, data: null };
        }
        const buf = buildPackageZipBuffer(args.skillId);
        await writeFile(picked.filePath, buf);
        return { success: true, data: picked.filePath };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  ipcMain.handle("skill:remote:preview", async (_event, args: { source: string }) => {
    try {
      const data = await previewRemoteSkills(args.source || "");
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  ipcMain.handle(
    "skill:remote:install",
    async (
      _event,
      args: {
        source: string;
        rootPaths?: string[] | null;
        strategy?: "skip" | "overwrite" | "copy";
        libraryId?: string | null;
      },
    ) => {
      try {
        const data = await installRemoteSkills({
          source: args.source || "",
          rootPaths: args.rootPaths,
          strategy: args.strategy,
          libraryId: args.libraryId,
        });
        return { success: true, data };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 在系统文件管理器中显示技能包目录
  ipcMain.handle("skill:package:reveal", async (_event, args: { skillId: string }) => {
    try {
      const dir = hasSkillPackage(args.skillId)
        ? getSkillPackageDir(args.skillId)
        : getSkillPackageRoot();
      await mkdir(dir, { recursive: true });
      shell.showItemInFolder(dir);
      return { success: true, data: dir };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // ==================== SubAgent CRUD IPC ====================

  // 创建 SubAgent
  ipcMain.handle(
    "seekdb:subAgent:create",
    async (_event, input: CreateSubAgentInput) => {
      try {
        await createSubAgent(input);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 批量创建 SubAgent
  ipcMain.handle(
    "seekdb:subAgent:createBatch",
    async (_event, inputs: CreateSubAgentInput[]) => {
      try {
        for (const input of inputs) {
          await createSubAgent(input);
        }
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 获取 SubAgent
  ipcMain.handle("seekdb:subAgent:get", async (_event, id: string) => {
    try {
      const agent = await getSubAgent(id);
      return { success: true, data: agent };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 获取所有 SubAgents
  ipcMain.handle("seekdb:subAgent:getAll", async () => {
    try {
      const result = await getAllSubAgents();
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 获取当前版本的 SubAgents
  ipcMain.handle("seekdb:subAgent:getCurrent", async () => {
    try {
      const result = await getCurrentSubAgents();
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 获取 SubAgent 的所有版本
  ipcMain.handle(
    "seekdb:subAgent:getVersions",
    async (_event, subAgentId: string) => {
      try {
        const versions = await getSubAgentVersions(subAgentId);
        return { success: true, data: versions };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 更新 SubAgent
  ipcMain.handle(
    "seekdb:subAgent:update",
    async (_event, id: string, input: UpdateSubAgentInput) => {
      try {
        await updateSubAgent(id, input);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 设置某个版本为当前版本
  ipcMain.handle(
    "seekdb:subAgent:setCurrentVersion",
    async (_event, subAgentId: string, versionId: string) => {
      try {
        await setSubAgentCurrentVersion(subAgentId, versionId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 删除 SubAgent（单个版本）
  ipcMain.handle("seekdb:subAgent:delete", async (_event, id: string) => {
    try {
      await deleteSubAgent(id);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 删除 SubAgent 的所有版本
  ipcMain.handle(
    "seekdb:subAgent:deleteAllVersions",
    async (_event, subAgentId: string) => {
      try {
        await deleteSubAgentAllVersions(subAgentId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 批量删除 SubAgent
  ipcMain.handle(
    "seekdb:subAgent:deleteBatch",
    async (_event, ids: string[]) => {
      try {
        await deleteSubAgents(ids);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 搜索 SubAgents
  ipcMain.handle(
    "seekdb:subAgent:search",
    async (_event, options: QueryOptions) => {
      try {
        const results = await searchSubAgents(options);
        return { success: true, data: results };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 获取 SubAgents 数量
  ipcMain.handle("seekdb:subAgent:count", async () => {
    try {
      const count = await getSubAgentsCount();
      return { success: true, data: count };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // ==================== SubAgent Export IPC ====================

  // 导出 SubAgent 为文件夹 (AGENT.md 标准结构)
  ipcMain.handle(
    "subAgent:exportToFolder",
    async (
      _event,
      args: {
        targetDir: string;
        folderName: string;
        files: Array<{ filename: string; content: string }>;
      },
    ) => {
      try {
        const { targetDir, folderName, files } = args;
        const agentDir = join(targetDir, folderName);

        // 创建 agent 目录
        await mkdir(agentDir, { recursive: true });

        // 写入所有文件
        for (const file of files) {
          const filePath = join(agentDir, file.filename);
          await writeFile(filePath, file.content, "utf-8");
        }

        return { success: true, data: agentDir };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // ==================== Agent Team CRUD IPC ====================

  // 创建 Agent Team
  ipcMain.handle(
    "seekdb:agentTeam:create",
    async (_event, input: CreateAgentTeamInput) => {
      try {
        await createAgentTeam(input);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 批量创建 Agent Team
  ipcMain.handle(
    "seekdb:agentTeam:createBatch",
    async (_event, inputs: CreateAgentTeamInput[]) => {
      try {
        for (const input of inputs) {
          await createAgentTeam(input);
        }
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 获取 Agent Team
  ipcMain.handle("seekdb:agentTeam:get", async (_event, id: string) => {
    try {
      const team = await getAgentTeam(id);
      return { success: true, data: team };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 获取所有 Agent Teams
  ipcMain.handle("seekdb:agentTeam:getAll", async () => {
    try {
      const result = await getAllAgentTeams();
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 获取当前版本的 Agent Teams
  ipcMain.handle("seekdb:agentTeam:getCurrent", async () => {
    try {
      const result = await getCurrentAgentTeams();
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 获取 Agent Team 的所有版本
  ipcMain.handle(
    "seekdb:agentTeam:getVersions",
    async (_event, teamId: string) => {
      try {
        const versions = await getAgentTeamVersions(teamId);
        return { success: true, data: versions };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 更新 Agent Team
  ipcMain.handle(
    "seekdb:agentTeam:update",
    async (_event, id: string, input: UpdateAgentTeamInput) => {
      try {
        await updateAgentTeam(id, input);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 设置某个版本为当前版本
  ipcMain.handle(
    "seekdb:agentTeam:setCurrentVersion",
    async (_event, teamId: string, versionId: string) => {
      try {
        await setAgentTeamCurrentVersion(teamId, versionId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 删除 Agent Team（单个版本）
  ipcMain.handle("seekdb:agentTeam:delete", async (_event, id: string) => {
    try {
      await deleteAgentTeam(id);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 删除 Agent Team 的所有版本
  ipcMain.handle(
    "seekdb:agentTeam:deleteAllVersions",
    async (_event, teamId: string) => {
      try {
        await deleteAgentTeamAllVersions(teamId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 批量删除 Agent Team
  ipcMain.handle(
    "seekdb:agentTeam:deleteBatch",
    async (_event, ids: string[]) => {
      try {
        await deleteAgentTeams(ids);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 搜索 Agent Teams
  ipcMain.handle(
    "seekdb:agentTeam:search",
    async (_event, options: QueryOptions) => {
      try {
        const results = await searchAgentTeams(options);
        return { success: true, data: results };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 获取 Agent Teams 数量
  ipcMain.handle("seekdb:agentTeam:count", async () => {
    try {
      const count = await getAgentTeamsCount();
      return { success: true, data: count };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // ==================== Agent Team Export IPC ====================

  // 导出 Agent Team 为文件夹 (TEAM.md 标准结构)
  ipcMain.handle(
    "agentTeam:exportToFolder",
    async (
      _event,
      args: {
        targetDir: string;
        folderName: string;
        files: Array<{ filename: string; content: string }>;
      },
    ) => {
      try {
        const { targetDir, folderName, files } = args;
        const teamDir = join(targetDir, folderName);

        // 创建 team 目录
        await mkdir(teamDir, { recursive: true });

        // 写入所有文件
        for (const file of files) {
          const filePath = join(teamDir, file.filename);
          await writeFile(filePath, file.content, "utf-8");
        }

        return { success: true, data: teamDir };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // ==================== Auth IPC ====================

  // GitHub 登录
  ipcMain.handle("auth:github:login", async () => {
    try {
      const authData = await githubLogin();
      return { success: true, data: authData };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // Google 登录
  ipcMain.handle("auth:google:login", async () => {
    try {
      const authData = await googleLogin();
      return { success: true, data: authData };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 邮箱登录
  ipcMain.handle("auth:email:login", async (_event, payload: { email: string; password: string }) => {
    try {
      const authData = await emailLogin(payload?.email || "", payload?.password || "");
      return { success: true, data: authData };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 发送邮箱验证码
  ipcMain.handle("auth:email:sendCode", async (_event, payload: { email: string; purpose?: string }) => {
    try {
      const { sendEmailCode } = await import('./prompthub/client');
      const result = await sendEmailCode(
        payload?.email || "",
        payload?.purpose === "register" ? "register" : undefined
      );
      return { success: result.success, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "发送验证码失败",
      };
    }
  });

  // 邮箱注册
  ipcMain.handle("auth:email:register", async (_event, payload: { email: string; password: string; name?: string; code?: string }) => {
    try {
      const authData = await emailRegister(payload?.email || "", payload?.password || "", payload?.name || "", payload?.code || "");
      return { success: true, data: authData };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 登出
  ipcMain.handle("auth:logout", async () => {
    try {
      await githubLogout();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 获取认证状态
  ipcMain.handle("auth:status", async () => {
    try {
      const authData = await getAuthStatus();
      return { success: true, data: authData };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // ==================== Settings IPC ====================

  // 获取设置
  ipcMain.handle("settings:get", async () => {
    try {
      const settings = await store.getSettings();
      return { success: true, data: settings };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 更新设置
  ipcMain.handle(
    "settings:update",
    async (_event, settings: Partial<AppSettings>) => {
      try {
        const prevSettings = await store.getSettings();
        await store.updateSettings(settings);
        const updated = await store.getSettings();
        // 语言变更时重建菜单
        if (settings.language !== undefined && settings.language !== prevSettings.language) {
          rebuildMenu().catch((err) => console.error('[Menu] rebuildMenu error:', err));
        }
        if (settings.skills !== undefined) {
          try {
            const sr = await syncAgentSkillsFromCustomPaths();
            const win = getMainWindow();
            if (win && !win.isDestroyed() && sr.imported > 0) {
              win.webContents.send("default-data:seeded", {
                prompts: 0,
                skills: sr.imported,
                subAgents: 0,
              });
            }
            // 自定义路径可能变化：重建实时监听（失败仅 warn，不阻塞设置保存）
            stopSkillWatcher();
            await startSkillWatcher();
          } catch (e) {
            console.warn("[SkillPathSync] After settings update:", e);
          }
        }
        if (settings.prompts !== undefined) {
          try {
            const pr = await syncPromptsFromCustomPaths();
            const win = getMainWindow();
            if (win && !win.isDestroyed() && pr.imported > 0) {
              win.webContents.send("default-data:seeded", {
                prompts: pr.imported,
                skills: 0,
                subAgents: 0,
              });
            }
          } catch (e) {
            console.warn("[PromptPathSync] After settings update:", e);
          }
        }
        return { success: true, data: updated };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 手动触发 skill 路径扫描同步
  ipcMain.handle("skills:syncPaths", async () => {
    try {
      const result = await syncAgentSkillsFromCustomPaths();
      const win = getMainWindow();
      if (win && !win.isDestroyed() && result.imported > 0) {
        win.webContents.send("default-data:seeded", {
          prompts: 0,
          skills: result.imported,
          subAgents: 0,
        });
      }
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 手动触发 agent_skills 正文纳入检索的存量重嵌
  ipcMain.handle("skills:reindex", async () => {
    try {
      const result = await reindexAgentSkills();
      if (!result.aborted) await persistAgentSkillEmbeddingVersion();
      return { success: true, data: { processed: result.processed, aborted: result.aborted } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 获取本机已存在的内置 skill 路径列表
  ipcMain.handle("skills:getKnownPaths", async () => {
    try {
      const paths = getExistingKnownPaths();
      return { success: true, data: paths };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 手动触发 prompt 路径扫描同步
  ipcMain.handle("prompts:syncPaths", async () => {
    try {
      const result = await syncPromptsFromCustomPaths();
      const win = getMainWindow();
      if (win && !win.isDestroyed() && result.imported > 0) {
        win.webContents.send("default-data:seeded", {
          prompts: result.imported,
          skills: 0,
          subAgents: 0,
        });
      }
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 获取本机已存在的内置 prompt 规则路径列表
  ipcMain.handle("prompts:getKnownPaths", async () => {
    try {
      const paths = getExistingKnownPromptPaths();
      return { success: true, data: paths };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // ==================== Organization IPC ====================

  // 获取组织数据（当前组织 + 邀请）
  ipcMain.handle("org:getData", async () => {
    try {
      const orgData = await store.getOrgData();
      return { success: true, data: orgData };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 设置/加入当前组织
  ipcMain.handle(
    "org:setCurrent",
    async (_event, org: UserOrganization | null) => {
      try {
        await store.setCurrentOrg(org);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 退出当前组织
  ipcMain.handle("org:leave", async () => {
    try {
      await store.leaveOrg();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 发送邀请
  ipcMain.handle(
    "org:invite:send",
    async (_event, invitation: OrgInvitation) => {
      try {
        await store.addSentInvite(invitation);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 接收邀请（添加到收到的邀请列表）
  ipcMain.handle(
    "org:invite:receive",
    async (_event, invitation: OrgInvitation) => {
      try {
        await store.addInvitation(invitation);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // 接受/拒绝邀请
  ipcMain.handle(
    "org:invite:respond",
    async (_event, id: string, status: 'accepted' | 'declined') => {
      try {
        const inv = await store.updateInvitation(id, status);
        return { success: true, data: inv };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "未知错误",
        };
      }
    },
  );

  // ==================== Market Registry IPC ====================

  // 获取 Registry Skills
  ipcMain.handle("market:fetchSkills", async (_event, options?: FetchOptions) => {
    try {
      const result = await fetchRegistrySkills(options || {});
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 获取 Registry Agents
  ipcMain.handle("market:fetchAgents", async (_event, options?: FetchOptions) => {
    try {
      const result = await fetchRegistryAgents(options || {});
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 获取详情（README）
  ipcMain.handle("market:getDetail", async (_event, repoUrl: string) => {
    try {
      const detail = await fetchRegistryDetail(repoUrl);
      return { success: true, data: detail };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 刷新缓存
  ipcMain.handle("market:refresh", async () => {
    try {
      await refreshMarketCache();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // ==================== CLI Runner IPC ====================

  // 安装 skill
  ipcMain.handle("cli:install", async (event, options: InstallOptions) => {
    try {
      const sender = event.sender;
      const result = await installSkill(options, (output) => {
        // 通过 IPC event 将实时日志发送到前端
        if (!sender.isDestroyed()) {
          sender.send("cli:output", output);
        }
      });
      return { success: result.success, data: result, error: result.error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 卸载 skill
  ipcMain.handle("cli:uninstall", async (_event, id: string) => {
    try {
      const result = await uninstallSkill(id);
      return { success: result.success, error: result.error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 列出已安装的 skills
  ipcMain.handle("cli:list", async () => {
    try {
      const skills = await listInstalledSkills();
      return { success: true, data: skills };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 扫描并列出已安装的 skills
  ipcMain.handle("cli:scan", async () => {
    try {
      const skills = await scanInstalledSkills();
      return { success: true, data: skills };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // 语音转文字：接收音频 ArrayBuffer，返回识别文本
  ipcMain.handle("audio:transcribe", async (_, audioBuffer: ArrayBuffer) => {
    try {
      const text = await transcribeAudio(audioBuffer);
      return { success: true, data: text };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "语音识别失败",
      };
    }
  });

  // 查询当前模型加载状态
  ipcMain.handle("audio:getModelStatus", async () => {
    try {
      const status = getModelStatus();
      return { success: true, data: status };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  });

  // ==================== AI 润色 IPC ====================

  ipcMain.handle(
    "ai:polish",
    async (
      _event,
      params: {
        content: string;
        title?: string;
        description?: string;
        tags?: string[];
        category?: string;
      }
    ) => {
      try {
        const settings = await store.getSettings();
        const aiConfig = settings.ai;

        if (!aiConfig || !aiConfig.apiKey) {
          return {
            success: false,
            error: "AI_API_KEY_MISSING",
          };
        }

        const { content, title, description, tags, category } = params;

        const contextParts: string[] = [];
        if (title) contextParts.push(`标题：${title}`);
        if (description) contextParts.push(`描述：${description}`);
        if (category) contextParts.push(`分类：${category}`);
        if (tags && tags.length > 0)
          contextParts.push(`标签：${tags.join("、")}`);

        const systemPrompt = `你是一个专业的 Prompt 工程师，精通提示词最佳实践。请根据用户提供的原始 prompt 内容及其上下文信息，对 prompt 进行优化润色。

优化要求：
1. **明确性**：确保指令清晰、无歧义，大模型能准确理解意图
2. **结构化**：使用清晰的结构，如角色定义、任务说明、输出格式、约束条件等
3. **完整性**：补充必要的上下文、示例或边界条件
4. **专业性**：使用准确的专业术语，避免模糊表达
5. **可操作性**：确保大模型可以直接执行，而不需要额外猜测
6. **符合上下文**：确保润色后的内容与标题、描述、分类、标签保持一致

只返回润色后的 prompt 内容本身，不要添加任何解释或前缀。`;

        const userMessage = contextParts.length > 0
          ? `上下文信息：\n${contextParts.join("\n")}\n\n原始 Prompt 内容：\n${content}`
          : `原始 Prompt 内容：\n${content}`;

        const provider = resolveEffectiveAiProvider(aiConfig);
        const model = resolveEffectiveModel(provider, aiConfig.model);
        const baseUrl =
          provider === "anthropic"
            ? "https://api.anthropic.com"
            : resolveOpenAiCompatibleBaseUrl({
                provider,
                customBaseUrl: aiConfig.baseUrl,
                bailianCodingRegion: aiConfig.bailianCodingRegion,
              });

        let polishedContent: string;

        if (provider === "anthropic") {
          // Anthropic API
          let response: Response;
          try {
            response = await fetch(`${baseUrl}/v1/messages`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": aiConfig.apiKey,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model,
                max_tokens: 4096,
                system: systemPrompt,
                messages: [{ role: "user", content: userMessage }],
              }),
            });
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            appendIPCApiLog(`[ai:polish] anthropic POST /v1/messages fetch error: ${m}`);
            throw e;
          }

          if (!response.ok) {
            let userFacing = `Anthropic API 错误: ${response.status}`;
            try {
              const err = (await response.json()) as { error?: { message?: string } };
              if (err.error?.message) userFacing = err.error.message;
            } catch {
              // 非 JSON 错误体
            }
            appendIPCApiLog(
              `[ai:polish] anthropic POST /v1/messages HTTP ${response.status} ${userFacing}`,
            );
            throw new Error(userFacing);
          }

          const data = (await response.json()) as {
            content: Array<{ type: string; text: string }>;
          };
          polishedContent = data.content
            .filter((c) => c.type === "text")
            .map((c) => c.text)
            .join("");
        } else {
          // OpenAI 兼容 API（含自定义端点）
          let response: Response;
          try {
            response = await fetch(`${baseUrl}/v1/chat/completions`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${aiConfig.apiKey}`,
              },
              body: JSON.stringify({
                model,
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: userMessage },
                ],
                max_tokens: 4096,
                temperature: 0.7,
              }),
            });
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            appendIPCApiLog(
              `[ai:polish] openai-compatible POST ${baseUrl}/v1/chat/completions fetch error: ${m}`,
            );
            throw e;
          }

          if (!response.ok) {
            let userFacing = `OpenAI API 错误: ${response.status}`;
            try {
              const err = (await response.json()) as {
                error?: { message?: string };
              };
              if (err.error?.message) userFacing = err.error.message;
            } catch {
              // 非 JSON 错误体
            }
            appendIPCApiLog(
              `[ai:polish] openai-compatible POST ${baseUrl}/v1/chat/completions HTTP ${response.status} ${userFacing}`,
            );
            throw new Error(userFacing);
          }

          const data = (await response.json()) as {
            choices: Array<{ message: { content: string } }>;
          };
          polishedContent = data.choices[0]?.message?.content || "";
        }

        return { success: true, data: polishedContent.trim() };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "AI 润色失败";
        return { success: false, error: msg };
      }
    }
  );

  // ==================== AI 生成 IPC ====================

  ipcMain.handle(
    "ai:generate",
    async (
      _event,
      params: {
        idea: string;
        type: "prompt" | "skill" | "auto";
        language?: string;
      }
    ) => {
      try {
        const settings = await store.getSettings();
        const aiConfig = settings.ai;

        if (!aiConfig || !aiConfig.apiKey) {
          return {
            success: false,
            error: "AI_API_KEY_MISSING",
          };
        }

        const { idea, type, language = "zh" } = params;
        const isZh = language !== "en";

        const systemPrompt = isZh
          ? `你是一个专业的 Prompt 工程师和 AI Agent 设计专家。用户会描述一个想法或需求，你需要根据该想法生成结构化的内容。

请严格按照以下 JSON 格式返回，不要添加任何 markdown 代码块包裹，直接返回纯 JSON：

{
  "type": "prompt" 或 "skill",
  "title": "标题（简洁、描述性强）",
  "description": "简短描述（1-2句话）",
  "category": "分类（如：写作、编程、分析、创意、翻译、教育等）",
  "tags": ["标签1", "标签2", "标签3"],
  "content": "主要内容（prompt 模板或 skill 指令）"
}

判断规则：
- 如果想法偏向于"让 AI 完成某个具体任务的模板"，生成 prompt 类型
- 如果想法偏向于"定义一个 AI 角色或持续性能力"，生成 skill 类型
- type 参数若为 "prompt" 或 "skill"，则强制使用该类型

对于 prompt 类型，content 应该是一个可以直接使用的提示词模板，使用 {{变量名}} 标记可替换的变量。
对于 skill 类型，content 应该是详细的角色定义和行为指令。

使用中文生成内容。`
          : `You are an expert Prompt Engineer and AI Agent Designer. The user will describe an idea or need, and you must generate structured content based on it.

Return ONLY a pure JSON object (no markdown code fences), strictly following this format:

{
  "type": "prompt" or "skill",
  "title": "Concise, descriptive title",
  "description": "Short description (1-2 sentences)",
  "category": "Category (e.g. Writing, Coding, Analysis, Creative, Translation, Education)",
  "tags": ["tag1", "tag2", "tag3"],
  "content": "Main content (prompt template or skill instructions)"
}

Decision rules:
- If the idea is about a template for AI to complete a specific task, use type "prompt"
- If the idea is about defining an AI role or persistent capability, use type "skill"
- If the type parameter is "prompt" or "skill", always use that type

For prompt type: content should be a ready-to-use prompt template using {{variableName}} for replaceable variables.
For skill type: content should be detailed role definition and behavioral instructions.

Generate all content in English.`;

        const userMessage = isZh
          ? `请根据以下想法生成内容${type !== "auto" ? `（类型：${type}）` : ""}：\n\n${idea}`
          : `Generate content based on the following idea${type !== "auto" ? ` (type: ${type})` : ""}:\n\n${idea}`;

        const provider = resolveEffectiveAiProvider(aiConfig);
        const model = resolveEffectiveModel(provider, aiConfig.model);
        const baseUrl =
          provider === "anthropic"
            ? "https://api.anthropic.com"
            : resolveOpenAiCompatibleBaseUrl({
                provider,
                customBaseUrl: aiConfig.baseUrl,
                bailianCodingRegion: aiConfig.bailianCodingRegion,
              });

        let rawContent: string;

        if (provider === "anthropic") {
          let response: Response;
          try {
            response = await fetch(`${baseUrl}/v1/messages`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": aiConfig.apiKey,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model,
                max_tokens: 4096,
                system: systemPrompt,
                messages: [{ role: "user", content: userMessage }],
              }),
            });
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            appendIPCApiLog(`[ai:generate] anthropic POST /v1/messages fetch error: ${m}`);
            throw e;
          }

          if (!response.ok) {
            let userFacing = `Anthropic API 错误: ${response.status}`;
            try {
              const err = (await response.json()) as { error?: { message?: string } };
              if (err.error?.message) userFacing = err.error.message;
            } catch {
              // 非 JSON 错误体
            }
            appendIPCApiLog(
              `[ai:generate] anthropic POST /v1/messages HTTP ${response.status} ${userFacing}`,
            );
            throw new Error(userFacing);
          }

          const data = (await response.json()) as {
            content: Array<{ type: string; text: string }>;
          };
          rawContent = data.content.filter((c) => c.type === "text").map((c) => c.text).join("");
        } else {
          let response: Response;
          try {
            response = await fetch(`${baseUrl}/v1/chat/completions`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${aiConfig.apiKey}`,
              },
              body: JSON.stringify({
                model,
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: userMessage },
                ],
                max_tokens: 4096,
                temperature: 0.8,
              }),
            });
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            appendIPCApiLog(
              `[ai:generate] openai-compatible POST ${baseUrl}/v1/chat/completions fetch error: ${m}`,
            );
            throw e;
          }

          if (!response.ok) {
            let userFacing = `OpenAI API 错误: ${response.status}`;
            try {
              const err = (await response.json()) as { error?: { message?: string } };
              if (err.error?.message) userFacing = err.error.message;
            } catch {
              // 非 JSON 错误体
            }
            appendIPCApiLog(
              `[ai:generate] openai-compatible POST ${baseUrl}/v1/chat/completions HTTP ${response.status} ${userFacing}`,
            );
            throw new Error(userFacing);
          }

          const data = (await response.json()) as {
            choices: Array<{ message: { content: string } }>;
          };
          rawContent = data.choices[0]?.message?.content || "";
        }

        // 解析 JSON 结果
        const cleaned = rawContent.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
        let parsed: {
          type: "prompt" | "skill";
          title: string;
          description: string;
          category: string;
          tags: string[];
          content: string;
        };
        try {
          parsed = JSON.parse(cleaned) as typeof parsed;
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e);
          appendIPCApiLog(`[ai:generate] JSON.parse failed: ${m}`);
          throw e;
        }

        return { success: true, data: parsed };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "AI 生成失败";
        return { success: false, error: msg };
      }
    }
  );

  // ==================== PromptHub 云同步 IPC ====================

  // 验证/获取当前 PromptHub 登录状态
  ipcMain.handle("prompthub:auth:check", async () => {
    try {
      const result = await checkPromptHubToken();
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "验证 Token 失败",
      };
    }
  });

  // 获取当前 PromptHub 用户信息（本地缓存，不验证）
  ipcMain.handle("prompthub:auth:user", async () => {
    try {
      const user = await getPromptHubUser();
      return { success: true, data: user };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "获取用户信息失败",
      };
    }
  });

  // 登出 PromptHub
  ipcMain.handle("prompthub:auth:logout", async () => {
    try {
      await logoutPromptHub();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "登出失败",
      };
    }
  });

  // 拉取同步（全量或增量）
  ipcMain.handle(
    "prompthub:sync:pull",
    async (_event, options?: { forceFullSync?: boolean; limit?: number }) => {
      try {
        const result = await pullSync(options);
        return { success: true, data: result };
      } catch (error) {
        console.error("[PromptHub] sync:pull failed:", error);
        return {
          success: false,
          error: await promptHubIpcErrorMessage(error, "同步拉取失败"),
        };
      }
    }
  );

  // 推送同步（本地变更 → 远端）
  ipcMain.handle(
    "prompthub:sync:push",
    async (_event, payload: PromptHubSyncPushRequest) => {
      try {
        const result = await pushSync(payload);
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: await promptHubIpcErrorMessage(error, "同步推送失败"),
        };
      }
    }
  );

  // 获取同步状态
  ipcMain.handle("prompthub:sync:state", async () => {
    try {
      const state = await getSyncState();
      return { success: true, data: state };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "获取同步状态失败",
      };
    }
  });

  // ==================== PromptHub 技能云同步 IPC ====================
  // 游标与提示词独立（store.promptHubSkillSync）；技能包文件不上云

  // 技能拉取同步（全量或增量）
  ipcMain.handle(
    "prompthub:skill:syncPull",
    async (_event, options?: { forceFullSync?: boolean; limit?: number }) => {
      try {
        const result = await pullSyncSkills(options);
        return { success: true, data: result };
      } catch (error) {
        console.error("[PromptHub] skill:syncPull failed:", error);
        return {
          success: false,
          error: await promptHubIpcErrorMessage(error, "技能同步拉取失败"),
        };
      }
    }
  );

  // 技能推送同步（本地变更 → 远端）
  ipcMain.handle(
    "prompthub:skill:syncPush",
    async (_event, payload: PromptHubSkillSyncPushRequest) => {
      try {
        const result = await pushSyncSkills(payload);
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: await promptHubIpcErrorMessage(error, "技能同步推送失败"),
        };
      }
    }
  );

  // 推送单个本地技能（保存后调用；已有 cloud_id 走更新，否则新建并回写 cloud_id）
  ipcMain.handle(
    "prompthub:skill:pushOne",
    async (_event, args: { skillId: string }) => {
      try {
        const result = await pushLocalSkill(args.skillId);
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: await promptHubIpcErrorMessage(error, "推送技能失败"),
        };
      }
    }
  );

  // 将本地技能上传为一条全新的云端技能
  ipcMain.handle(
    "prompthub:skill:upload",
    async (_event, args: { skillId: string }) => {
      try {
        const result = await hubUploadLocalSkill(args.skillId);
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: await promptHubIpcErrorMessage(error, "上传技能失败"),
        };
      }
    }
  );

  // 获取技能同步状态
  ipcMain.handle("prompthub:skill:syncState", async () => {
    try {
      const state = await getSkillSyncState();
      return { success: true, data: state };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "获取技能同步状态失败",
      };
    }
  });

  // 列出云端提示词
  ipcMain.handle(
    "prompthub:prompt:list",
    async (
      _event,
      params?: { category?: string; org_id?: string; limit?: number; offset?: number }
    ) => {
      try {
        const data = await hubListPrompts(params);
        return { success: true, data };
      } catch (error) {
        return {
          success: false,
          error: await promptHubIpcErrorMessage(error, "获取云端提示词失败"),
        };
      }
    }
  );

  // 创建云端提示词
  ipcMain.handle(
    "prompthub:prompt:create",
    async (_event, input: CreatePromptHubPromptInput) => {
      try {
        const data = await hubCreatePrompt(input);
        return { success: true, data };
      } catch (error) {
        return {
          success: false,
          error: await promptHubIpcErrorMessage(error, "创建云端提示词失败"),
        };
      }
    }
  );

  // 更新云端提示词
  ipcMain.handle(
    "prompthub:prompt:update",
    async (_event, id: string, input: UpdatePromptHubPromptInput) => {
      try {
        const data = await hubUpdatePrompt(id, input);
        return { success: true, data };
      } catch (error) {
        return {
          success: false,
          error: await promptHubIpcErrorMessage(error, "更新云端提示词失败"),
        };
      }
    }
  );

  // 删除云端提示词
  ipcMain.handle("prompthub:prompt:delete", async (_event, id: string) => {
    try {
      await hubDeletePrompt(id);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: await promptHubIpcErrorMessage(error, "删除云端提示词失败"),
      };
    }
  });

  // 将本地 prompt 上传到云端（获取 cloud_id 并保存到本地）
  ipcMain.handle("prompthub:prompt:uploadLocal", async (_event, localId: string) => {
    try {
      const result = await hubUploadLocalPrompt(localId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: await promptHubIpcErrorMessage(error, "上传到云端失败"),
      };
    }
  });

  // ==================== Library IPC ====================

  ipcMain.handle("seekdb:library:create", async (_event, input: CreateLibraryInput) => {
    try {
      const data = await createLibrary(input);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "创建库失败" };
    }
  });

  ipcMain.handle("seekdb:library:get", async (_event, id: string) => {
    try {
      const data = await getLibrary(id);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "获取库失败" };
    }
  });

  ipcMain.handle("seekdb:library:getAll", async () => {
    try {
      const data = await getAllLibraries();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "获取库列表失败" };
    }
  });

  ipcMain.handle("seekdb:library:update", async (_event, id: string, input: UpdateLibraryInput) => {
    try {
      await updateLibrary(id, input);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "更新库失败" };
    }
  });

  ipcMain.handle("seekdb:library:delete", async (_event, id: string) => {
    try {
      await deleteLibrary(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "删除库失败" };
    }
  });

  ipcMain.handle("seekdb:library:movePrompt", async (_event, promptGroupId: string, libraryId: string | null) => {
    try {
      await movePromptToLibrary(promptGroupId, libraryId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "移动提示词到库失败" };
    }
  });

  ipcMain.handle("seekdb:library:moveSkill", async (_event, skillGroupId: string, libraryId: string | null) => {
    try {
      await moveSkillToLibrary(skillGroupId, libraryId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "移动技能到库失败" };
    }
  });

  // ==================== Tag definitions IPC ====================

  ipcMain.handle("seekdb:tag:getAll", async () => {
    try {
      const data = getAllTagDefinitions();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "获取标签失败" };
    }
  });

  ipcMain.handle("seekdb:tag:create", async (_event, name: string, color?: string, dimension?: string) => {
    try {
      const data = createTagDefinition(name, color, dimension);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "创建标签失败" };
    }
  });

  ipcMain.handle("seekdb:tag:update", async (_event, id: string, input: { name?: string; color?: string; dimension?: string }) => {
    try {
      updateTagDefinition(id, input);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "更新标签失败" };
    }
  });

  ipcMain.handle("seekdb:tag:delete", async (_event, id: string) => {
    try {
      deleteTagDefinition(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "删除标签失败" };
    }
  });
}
