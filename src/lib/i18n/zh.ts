export interface Messages {
  tabs: {
    home: string;
    prompts: string;
    skills: string;
    agents: string;
    teams: string;
    market: string;
  };
  sidebar: {
    homeTitle: string;
    homeDesc: string;
    homeFooter: string;
    promptTitle: string;
    promptDesc: string;
    promptFooter: string;
    skillTitle: string;
    skillDesc: string;
    skillFooter: string;
    agentTitle: string;
    agentDesc: string;
    agentFooter: string;
    teamTitle: string;
    teamDesc: string;
    teamFooter: string;
    marketTitle: string;
    marketDesc: string;
    marketFooter: string;
    discoverPrompts: string;
    discoverSkills: string;
    brandLinkAria: string;
  };
  library: {
    allItems: string;
    newLibrary: string;
    editLibrary: string;
    deleteLibrary: string;
    deleteConfirm: string;
    namePlaceholder: string;
    descPlaceholder: string;
    iconLabel: string;
    colorLabel: string;
    btnSave: string;
    btnCancel: string;
    moveToLibrary: string;
    removeFromLibrary: string;
    noLibraries: string;
    itemCount: (n: number) => string;
    assignLabel: string;
    assignNone: string;
    tagsSection: string;
    allTags: string;
    deleteTagConfirm: string;
    tagSelectPlaceholder: string;
    tagNewPlaceholder: string;
    tagAddNew: string;
    tagDimension: string;
    tagDimGeneral: string;
    tagDimScene: string;
    tagDimStyle: string;
    tagDimModel: string;
    exportAsSkill: string;
    exportSkillEmpty: string;
    exportSkillSuccess: string;
    exportSkillFail: string;
    deleteTag: string;
    cloudSection: string;
    localSection: string;
  };
  newPrompt: string;
  newSkill: string;
  newAgent: string;
  newTeam: string;
  empty: {
    promptTitle: string;
    promptDesc: string;
    promptCreate: string;
    skillTitle: string;
    skillCreate: string;
    agentTitle: string;
    agentDesc: string;
    agentCreate: string;
    teamTitle: string;
    teamDesc: string;
    teamCreate: string;
  };
  back: string;
  search: {
    titlePre: string;
    titleAccent: string;
    titlePost: string;
    subtitle: string;
    submitBtn: string;
    slashHint: string;
    featuredLabel: string;
    recentLabel: string;
    searchingAll: string;
    searchingType: (type: string) => string;
    noResult: string;
    noResultHint: string;
    resultMeta: (n: number) => string;
    placeholders: string[];
    hotTags: { label: string; type: "prompt" | "skill" }[];
    typeLabels: {
      prompt: string;
      skill: string;
    };
  };
  lang: {
    switchTo: string;
    current: string;
  };
  userAvatar: {
    login: string;
    optionalCloud: string;
    localMode: string;
    githubProfile: string;
    openProfile: string;
    settings: string;
    signOut: string;
    switchLanguage: string;
    promptHubNotLinkedHint: string;
  };
  loginPage: {
    backBtn: string;
    title: string;
    subtitle: string;
    configureCredentials: string;
    dividerOr: string;
    googleContinue: string;
    githubContinue: string;
    connecting: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    confirmPasswordPlaceholder: string;
    namePlaceholder: string;
    emailLoginBtn: string;
    registerBtn: string;
    loggingIn: string;
    registering: string;
    tabLogin: string;
    tabRegister: string;
    loginTitle: string;
    loginSubtitle: string;
    registerTitle: string;
    registerSubtitle: string;
    orEmail: string;
    legalNote: string;
    legalTerms: string;
    legalAnd: string;
    legalPrivacy: string;
    pwStrengthWeak: string;
    pwStrengthMedium: string;
    pwStrengthStrong: string;
    errorInvalidEmail: string;
    errorPasswordTooShort: string;
    errorPasswordMismatch: string;
    featurePrompts: string;
    featureVersions: string;
    featureSearch: string;
    badgeLocal: string;
    brandSubtitleLogin: string;
    brandSubtitleRegister: string;
    brandHeadlineLogin: string;
    brandHeadlineRegister: string;
    backToHome: string;
    signInLead: string;
    forgotPassword: string;
    orContinueOAuth: string;
    sendCode: string;
    sendingCode: string;
    resendCode: string;
    codeSentTitle: string;
    codeSentDesc: string;
    codeLabel: string;
    codePlaceholder: string;
    codeInvalid: string;
    codeSendFailed: string;
    brandTagline: string;
    statUsers: string;
    statUsersLabel: string;
    statPrompts: string;
    statPromptsLabel: string;
    statUptime: string;
    statUptimeLabel: string;
    footerCopyright: string;
  };
  pageViews: {
    errorLoad: string;
    errorExport: string;
    exportSuccess: (path: string) => string;
    exportSkill: string;
    exportingSkill: string;
    installSkill: string;
    installingSkill: string;
    installSuccess: (path: string) => string;
    installDialogTitle: string;
    installDialogDesc: string;
    installExportToFolder: string;
    installExportToFolderDesc: string;
    installNoAgentDetected: string;
    installAgentInstalled: string;
    installAgentNotInstalled: string;
    installCancel: string;
    editSkill: string;
    editPrompt: string;
    editAgent: string;
    editTeam: string;
    exportAgent: string;
    exportingAgent: string;
    exportTeam: string;
    exportingTeam: string;
    copied: string;
    copySkillMd: string;
    copyInstallCmd: string;
    installFromRepo: string;
    saveInline: string;
    savedInline: string;
    sourceLabel: string;
    copyPrompt: string;
    copyAgentMd: string;
    copyTeamMd: string;
    promptContent: string;
    systemInstructions: string;
    leadInstructions: string;
    taskTemplate: string;
    qualityGates: string;
    teammates: (n: number) => string;
    spawnPrompt: string;
    subAgentTypes: Record<string, string>;
    authErrorLogin: string;
    authErrorEmailLogin: string;
    badgeCurrent: string;
    metaLibrary: string;
  };
  promptList: {
    searchPlaceholder: string;
    tableTitle: string;
    copySuccess: (title: string) => string;
    moreActions: string;
    copyContent: string;
    delete: string;
    confirmDelete: string;
    errorLoad: string;
    errorSearch: string;
    errorDelete: string;
    errorCopy: string;
    navLabel: string;
    selectLabel: string;
    escLabel: string;
    colTitle: string;
    colVersion: string;
    colDescription: string;
    colLibrary: string;
    colTags: string;
    colContent: string;
    colActions: string;
    badgeCurrent: string;
    actionView: string;
    actionHistory: string;
    actionEdit: string;
    actionDelete: string;
    /** 列表分组：从外部目录/文件同步的 Prompt 与 Skill */
    externalSyncGroupTitle: string;
  };
  settings: {
    title: string;
    subtitle: string;
    back: string;
    navAccount: string;
    navOAuth: string;
    navAppearance: string;
    navOrganization: string;
    navData: string;
    navSkill: string;
    navPrompt: string;
    navNotifications: string;
    navAI: string;
    navUpdate: string;
    btnSave: string;
    btnSaving: string;
    btnSaved: string;
    accountTitle: string;
    accountSubtitle: string;
    accountProvider: string;
    accountViewGitHub: string;
    accountViewProfile: string;
    accountSignOut: string;
    accountLoginTitle: string;
    accountLoginDesc: string;
    accountLoginBtn: string;
    accountLoginHint: string;
    oauthTitle: string;
    oauthSubtitle: string;
    oauthGitHubGuideTitle: string;
    oauthGitHubGuideStep1: string;
    oauthGitHubGuideStep2: string;
    oauthGitHubGuideStep3Pre: string;
    oauthGitHubGuideStep3Key: string;
    oauthGitHubGuideStep3Post: string;
    oauthGitHubGuideStep4Pre: string;
    oauthGitHubGuideStep4Key: string;
    oauthGitHubGuideStep4Post: string;
    oauthGitHubGuideStep5: string;
    oauthGitHubAppTitle: string;
    oauthGoogleGuideTitle: string;
    oauthGoogleGuideStep1: string;
    oauthGoogleGuideStep2Pre: string;
    oauthGoogleGuideStep2Key: string;
    oauthGoogleGuideStep2Post: string;
    oauthGoogleGuideStep3Pre: string;
    oauthGoogleGuideStep4: string;
    oauthGoogleAppTitle: string;
    oauthGoogleClientId: string;
    appearanceTitle: string;
    appearanceSubtitle: string;
    appearanceTheme: string;
    appearanceDark: string;
    appearanceLight: string;
    appearanceSystem: string;
    appearanceLanguage: string;
    orgTitle: string;
    orgSubtitle: string;
    orgCurrentLabel: string;
    orgLeave: string;
    orgNotMember: string;
    orgJoinPlaceholder: string;
    orgJoin: string;
    orgInviteMembersLabel: string;
    orgInvitePlaceholder: string;
    orgSendInvite: string;
    orgSentInvitationsLabel: string;
    orgStatusPending: string;
    orgStatusAccepted: string;
    orgStatusDeclined: string;
    orgReceivedInvitationsLabel: string;
    orgInvitedBy: string;
    orgAccept: string;
    orgDecline: string;
    orgMarketRegistryLabel: string;
    orgMarketRegistryHint: string;
    aiTitle: string;
    aiSubtitle: string;
    aiApiConfigLabel: string;
    aiProviderLabel: string;
    aiProviderCustom: string;
    aiProviderBailianCoding: string;
    aiApiKeyLabel: string;
    aiApiKeyHintAnthropic: string;
    aiApiKeyHintDeepSeek: string;
    aiApiKeyHintOpenAI: string;
    aiApiKeyHintBailianCoding: string;
    aiBailianRegionLabel: string;
    aiBailianRegionCn: string;
    aiBailianRegionIntl: string;
    aiBaseUrlLabel: string;
    aiBaseUrlHint: string;
    aiModelLabel: string;
    aiModelHint: string;
    aiModelPickOrTypeHint: string;
    aiInfoTitle: string;
    aiInfoDesc: string;
    updateTitle: string;
    updateSubtitle: string;
    updateCurrentVersionLabel: string;
    updateIdle: string;
    updateIdleDesc: string;
    updateIdleBtn: string;
    updateChecking: string;
    updateCheckingDesc: string;
    updateAvailable: string;
    updateAvailableDesc: string;
    updateAvailableDesc2: string;
    updateReleaseNotesLabel: string;
    updateDownloadBtn: string;
    updateDownloading: string;
    updateDownloadingDesc: string;
    updateDownloaded: string;
    updateDownloadedDesc: string;
    updateDownloadedDesc2: string;
    updateInstallBtn: string;
    updateUpToDate: string;
    updateUpToDateDesc: string;
    updateCheckAgainBtn: string;
    updateError: string;
    updateErrorDefault: string;
    updateRetryBtn: string;
    updateToastDismiss: string;
    updateToastOpenSettings: string;
    updateToastNoNotes: string;
    communityTitle: string;
    communitySubtitle: string;
    communityWebsite: string;
    communityWebsiteDesc: string;
    communityGitHub: string;
    communityGitHubDesc: string;
    communityStarHint: string;
    errorCheckUpdate: string;
    errorDownloadUpdate: string;
    errorInstallUpdate: string;
    errorSave: string;
    errorJoinOrg: string;
    errorLeaveOrg: string;
    errorSendInvite: string;
    errorRespondInvite: string;
    dataTitle: string;
    dataSubtitle: string;
    localFirstTitle: string;
    localFirstDesc: string;
    dataDirGroup: string;
    dataDirDesc: string;
    dataDirOpen: string;
    dataDirCopy: string;
    dataDirCopied: string;
    dataPathsGroup: string;
    dataPathUserData: string;
    dataPathStore: string;
    dataPathDb: string;
    dataPathSkills: string;
    dataPathModels: string;
    dataRootModeGroup: string;
    dataRootModeDesc: string;
    dataRootModeApp: string;
    dataRootModeHome: string;
    dataRootApply: string;
    dataRootRestartHint: string;
    dataPathElectronUserData: string;
    dataPathPreferenceFile: string;
    dataMaintenanceGroup: string;
    dataClearEmbedCache: string;
    dataClearEmbedCacheDesc: string;
    dataClearEmbedDone: string;
    dataClearEmbedFail: string;
    dataDbInfoGroup: string;
    dataDbInfoLine: string;
    skillTitle: string;
    skillSubtitle: string;
    skillInstallGroup: string;
    skillInstallSymlink: string;
    skillInstallSymlinkDesc: string;
    skillInstallCopy: string;
    skillInstallCopyDesc: string;
    skillInstallHint: string;
    skillCustomScanGroup: string;
    skillCustomScanDesc: string;
    skillCustomScanPlaceholder: string;
    skillCustomScanAdd: string;
    skillCustomScanEmpty: string;
    skillCustomScanRemove: string;
    skillBuiltinGroup: string;
    skillBuiltinDesc: string;
    skillWatchFolders: string;
    skillWatchFoldersDesc: string;
    skillBuiltinClaude: string;
    skillBuiltinCopilot: string;
    skillBuiltinCursor: string;
    skillBuiltinWindsurf: string;
    skillBuiltinKiro: string;
    skillBuiltinGemini: string;
    skillBuiltinTrae: string;
    skillBuiltinOpenCode: string;
    skillBuiltinCodex: string;
    skillBuiltinDevin: string;
    skillAddAllKnown: string;
    skillAddAllKnownDesc: string;
    skillSyncNow: string;
    skillSyncResult: (imported: number, skipped: number) => string;
    skillSyncError: string;
    promptTitle: string;
    promptSubtitle: string;
    promptCustomScanGroup: string;
    promptCustomScanDesc: string;
    promptCustomScanPlaceholder: string;
    promptCustomScanAdd: string;
    promptCustomScanEmpty: string;
    promptCustomScanRemove: string;
    promptBuiltinGroup: string;
    promptBuiltinDesc: string;
    promptBuiltinCursor: string;
    promptBuiltinClaude: string;
    promptBuiltinOpenCode: string;
    promptBuiltinGemini: string;
    promptAutoScanOnStartup: string;
    promptAutoScanOnStartupDesc: string;
    promptAddAllKnown: string;
    promptAddAllKnownDesc: string;
    promptSyncNow: string;
    promptSyncResult: (imported: number, skipped: number) => string;
    promptSyncError: string;
    notifTitle: string;
    notifSubtitle: string;
    notifEnable: string;
    notifEnableDesc: string;
    notifCopySuccess: string;
    notifCopySuccessDesc: string;
    notifSaveSuccess: string;
    notifSaveSuccessDesc: string;
    notifToastCopyTitle: string;
    notifToastCopyBody: (title: string) => string;
    notifToastSaveTitle: string;
    notifToastSaveBody: (title: string) => string;
  };
  cloudSync: {
    syncing: string;
    syncNow: string;
    syncTitle: string;
    syncSuccess: (count: number) => string;
    syncError: string;
    syncErrorNeedPromptHub: string;
    syncSessionExpired: string;
    retryBtn: string;
    lastSyncAt: (time: string) => string;
    notSynced: string;
    loginRequired: string;
  };
  promptForm: {
    titleCreate: string;
    titleEdit: string;
    titleNewVersion: string;
    labelTitle: string;
    labelDescription: string;
    labelLibrary: string;
    labelTags: string;
    labelCategory: string;
    categoryCode: string;
    categoryWriting: string;
    categoryAnalysis: string;
    categoryCreative: string;
    categoryOther: string;
    labelContent: string;
    labelChangeNotes: string;
    placeholderTitle: string;
    placeholderDescription: string;
    optionNoLibrary: string;
    placeholderTags: string;
    placeholderContent: string;
    placeholderChangeNotes: string;
    btnSave: string;
    btnSaving: string;
    btnCancel: string;
    btnPolish: string;
    btnPolishing: string;
    btnPolishDone: string;
    btnRestore: string;
    btnRestoreTitle: string;
    btnPolishTitle: string;
    errorRequired: string;
    errorLoad: string;
    errorLoadVersion: string;
    errorSave: string;
    errorPolishEmpty: string;
    errorPolishFailed: string;
    labelGuidanceSection: string;
    labelUseWhen: string;
    labelGuidance: string;
    labelPitfalls: string;
    placeholderUseWhen: string;
    placeholderGuidance: string;
    placeholderPitfalls: string;
  };
  generate: {
    badge: string;
    title: string;
    subtitle: string;
    placeholder: string;
    typeAuto: string;
    typePrompt: string;
    typeSkill: string;
    btnGenerate: string;
    btnGenerating: string;
    kbdHint: string;
    quickLabel: string;
    quickIdeas: { label: string; idea: string; type: "auto" | "prompt" | "skill" }[];
    generatingMsg: string;
    errorTitle: string;
    errorMissingApiKey: string;
    errorRetry: string;
    btnOpenAiSettings: string;
    btnRegen: string;
    contentLabelPrompt: string;
    contentLabelSkill: string;
    btnSavePrompt: string;
    btnSaveSkill: string;
    btnSaving: string;
    btnSaved: string;
    btnDiscard: string;
    notAvailable: string;
    language: string;
    typeLabels: { prompt: string; skill: string };
  };
  /** Discover / Market 页面 */
  market: {
    title: string;
    subtitle: string;
    statGalleryItems: string;
    statOnlineSkills: string;
    statLocalSkills: string;
    tabInstalled: string;
    allCategories: string;
    refresh: string;
    featured: string;
    latestTrending: string;
    all: string;
    cli: string;
    cliPanelTitle: string;
    cliSkillNamePlaceholder: string;
    cliCommandPlaceholder: string;
    cliRunning: string;
    cliInstall: string;
    loadingFromGithub: string;
    loadingFromCloud: string;
    galleryCategory: {
      all: string;
      dev: string;
      media: string;
      comic: string;
      product: string;
      academic: string;
      general: string;
    };
    sortPopular: string;
    sortNewest: string;
    sortRating: string;
    emptyGallery: string;
    localFirstHint: string;
    loadCloudGallery: string;
    hideCloudGallery: string;
    emptyPrompts: string;
    emptySkills: string;
    emptyOnlineSkills: string;
    emptyOnlineAgents: string;
    emptyInstalled: string;
    uninstall: string;
    errorLoadGallery: string;
    errorLoadOnline: string;
    alertImportFailed: (msg: string) => string;
    alertUnknownError: string;
    alertNoInstallCommand: string;
    alertInstallFailed: (msg: string) => string;
    alertUninstallFailed: (msg: string) => string;
    cliLogFailed: string;
    featuredBadge: string;
    hide: string;
    preview: string;
    import: string;
    imported: string;
    details: string;
    install: string;
    installed: string;
    skillMdContent: string;
    allowedTools: string;
    detailAuthor: string;
    detailVersion: string;
    detailInstall: string;
    detailRepo: string;
    typePrompt: string;
    typeSkill: string;
    galleryByAuthor: (name: string) => string;
    galleryUses: (n: string) => string;
    searchPlaceholder: (tabLabel: string) => string;
  };
  skillPackage: {
    versionLabel: string;
    versionLabelHint: string;
    platformsLabel: string;
    packageLabel: string;
    packageAfterSaveHint: string;
    localOnlyHint: string;
    empty: string;
    summary: string;
    importZip: string;
    importFolder: string;
    replaceZip: string;
    replaceFolder: string;
    reveal: string;
    clear: string;
    cleared: string;
    imported: string;
    importedWithSkipped: string;
    truncated: string;
    selectFileHint: string;
    binaryNotPreviewable: string;
    badge: string;
    errorLoadTree: string;
    errorImport: string;
    errorReadFile: string;
    errorClear: string;
    errorReveal: string;
    saveFile: string;
    saved: string;
    exportZip: string;
    exported: string;
    errorSaveFile: string;
    errorExportZip: string;
  };
  skillRemote: {
    title: string;
    subtitle: string;
    close: string;
    sourceLabel: string;
    sourcePlaceholder: string;
    preview: string;
    previewing: string;
    copyCli: string;
    selectAll: string;
    duplicate: string;
    strategySkip: string;
    strategyOverwrite: string;
    strategyCopy: string;
    install: string;
    installing: string;
    errorPreview: string;
    errorInstall: string;
    status_created: string;
    status_updated: string;
    status_skipped: string;
    status_failed: string;
    openButton: string;
  };
}

export const zh: Messages = {
  // ── Sidebar tabs ──
  tabs: {
    home: "首页",
    prompts: "提示词",
    skills: "技能",
    agents: "智能体",
    teams: "团队",
    market: "发现",
  },

  // ── Sidebar info panels ──
  sidebar: {
    homeTitle: "全库搜索",
    homeDesc: "在搜索框中输入任意描述，跨 Prompts、Skills、Agents、Teams 语义搜索。",
    homeFooter: "语义搜索 · 全库",
    promptTitle: "提示词库",
    promptDesc: "在右侧表格中搜索、查看完整描述与版本；点击行打开详情。",
    promptFooter: "提示词列表 · 主内容区",
    skillTitle: "技能库",
    skillDesc: "在右侧列表中搜索、查看完整描述与版本；点选一行在宽屏区域打开详情。",
    skillFooter: "技能列表 · 主内容区",
    agentTitle: "智能体",
    agentDesc: "在右侧浏览子智能体全表与描述，点击进入查看与编辑。",
    agentFooter: "智能体列表 · 主内容区",
    teamTitle: "团队",
    teamDesc: "在右侧查看协作团队配置与成员数，点击行进入详情。",
    teamFooter: "团队列表 · 主内容区",
    marketTitle: "发现",
    marketDesc: "内置精选，打开即可浏览和导入。",
    marketFooter: "探索精选内容 →",
    discoverPrompts: "精选提示词",
    discoverSkills: "精选技能",
    brandLinkAria: "打开 PromptMan 官网（prompt.solokit.run）",
  },

  // ── Library ──
  library: {
    allItems: "全部",
    newLibrary: "新建库",
    editLibrary: "编辑库",
    deleteLibrary: "删除库",
    deleteConfirm: "确定删除此库？库内的提示词和技能将移回「全部」。",
    namePlaceholder: "库名称",
    descPlaceholder: "描述（可选）",
    iconLabel: "图标",
    colorLabel: "颜色",
    btnSave: "保存",
    btnCancel: "取消",
    moveToLibrary: "移动到库",
    removeFromLibrary: "移出库",
    noLibraries: "暂无库，新建一个开始整理",
    itemCount: (n: number) => `${n} 项`,
    assignLabel: "归属库",
    assignNone: "不归属任何库",
    tagsSection: "标签",
    allTags: "全部标签",
    deleteTagConfirm: "确定删除此标签？提示词与技能中的该标签引用将被移除。",
    tagSelectPlaceholder: "选择已有标签…",
    tagNewPlaceholder: "新标签名称",
    tagAddNew: "新建",
    tagDimension: "标签维度",
    tagDimGeneral: "通用",
    tagDimScene: "场景",
    tagDimStyle: "风格",
    tagDimModel: "适配模型",
    exportAsSkill: "导出为 Agent Skill",
    exportSkillEmpty: "该库暂无提示词，无需导出",
    exportSkillSuccess: "已导出为 Agent Skill",
    exportSkillFail: "导出失败",
    deleteTag: "删除标签",
    cloudSection: "云端资料库",
    localSection: "本地库",
  },

  // ── New buttons ──
  newPrompt: "新建提示词",
  newSkill: "新建技能",
  newAgent: "新建智能体",
  newTeam: "新建团队",

  // ── Empty states ──
  empty: {
    promptTitle: "选择一个提示词查看",
    promptDesc: "或创建新的提示词开始使用",
    promptCreate: "新建提示词",
    skillTitle: "选择一个技能查看",
    skillCreate: "新建技能",
    agentTitle: "选择一个智能体查看",
    agentDesc: "或基于 Claude 标准创建新的子智能体",
    agentCreate: "新建智能体",
    teamTitle: "选择一个团队查看",
    teamDesc: "或创建新的智能体团队进行并行协作",
    teamCreate: "新建团队",
  },

  // ── Back button ──
  back: "返回",

  // ── SearchHome ──
  search: {
    titlePre: "在这里",
    titleAccent: "搜索",
    titlePost: "你的提示库",
    subtitle: "Prompts · Skills · Agents · Teams 全库语义搜索",
    submitBtn: "搜索",
    slashHint: "输入 / 然后选择类型筛选，之后继续输入关键词",
    featuredLabel: "最新收录",
    recentLabel: "最近搜索",
    searchingAll: "正在搜索全库...",
    searchingType: (type: string) => `正在搜索 ${type}...`,
    noResult: "未找到相关记录",
    noResultHint: "换个关键词试试",
    resultMeta: (n: number) => `找到 ${n} 条结果`,
    placeholders: [
      "描述你的想法，找到对应的提示词...",
      "搜索代码审查相关的 Agent...",
      "寻找写作风格的 Skill...",
      "查找多模态协作 Team 配置...",
      "探索 API 集成提示词...",
    ],
    hotTags: [
      { label: "代码审查", type: "prompt" },
      { label: "写作润色", type: "prompt" },
      { label: "数据分析", type: "skill" },
      { label: "翻译助手", type: "skill" },
      { label: "代码生成", type: "prompt" },
      { label: "代码调试", type: "skill" },
      { label: "内容摘要", type: "prompt" },
      { label: "代码重构", type: "skill" },
    ],
    typeLabels: {
      prompt: "Prompt",
      skill: "Skill",
    },
  },

  // ── Language switcher ──
  lang: {
    switchTo: "English",
    current: "中文",
  },

  // ── UserAvatar ──
  userAvatar: {
    login: "登录",
    optionalCloud: "可选云同步",
    localMode: "本地模式",
    githubProfile: "GitHub 主页",
    openProfile: "查看主页",
    settings: "设置",
    signOut: "退出登录",
    switchLanguage: "Switch to English",
    promptHubNotLinkedHint:
      "头像是应用内登录；与 PromptMan 云端账号不同。GitHub/Google 登录不会连上云端，同步需使用邮箱登录。",
  },

  // ── LoginPage ──
  loginPage: {
    backBtn: "跳过",
    title: "PromptMan",
    subtitle: "本机 SQLite · 无需注册",
    configureCredentials: "配置凭据",
    dividerOr: "或",
    googleContinue: "Google 登录",
    githubContinue: "GitHub 登录",
    connecting: "连接中…",
    emailPlaceholder: "邮箱地址",
    passwordPlaceholder: "密码",
    confirmPasswordPlaceholder: "确认密码",
    namePlaceholder: "昵称（可选）",
    emailLoginBtn: "登录",
    registerBtn: "创建账号",
    loggingIn: "登录中…",
    registering: "注册中…",
    tabLogin: "登录",
    tabRegister: "注册",
    loginTitle: "登录你的账号",
    loginSubtitle: "使用邮箱或第三方账号登录",
    registerTitle: "创建新账号",
    registerSubtitle: "填写以下信息完成注册",
    orEmail: "或使用邮箱",
    legalNote: "注册即表示同意",
    legalTerms: "服务条款",
    legalAnd: "与",
    legalPrivacy: "隐私政策",
    pwStrengthWeak: "弱",
    pwStrengthMedium: "中",
    pwStrengthStrong: "强",
    errorInvalidEmail: "邮箱格式不正确",
    errorPasswordTooShort: "密码至少需要 8 位",
    errorPasswordMismatch: "两次密码不一致",
    featurePrompts: "管理你的所有 Prompt 模版",
    featureVersions: "版本历史，一键回溯",
    featureSearch: "语义搜索，快速定位",
    badgeLocal: "无需注册 · 本地 SQLite",
    brandSubtitleLogin: "数据存在本机 SQLite，打开即可使用",
    brandSubtitleRegister: "注册仅用于可选的云同步，本地功能不受影响",
    brandHeadlineLogin: "欢迎回来",
    brandHeadlineRegister: "开启你的\nPrompt 之旅",
    backToHome: "返回应用",
    signInLead: "登录仅用于可选云同步。本机 SQLite 无需注册即可使用。",
    forgotPassword: "忘记密码？",
    orContinueOAuth: "或使用以下方式继续",
    sendCode: "发送验证码",
    sendingCode: "发送中…",
    resendCode: "重新发送验证码",
    codeSentTitle: "验证码已发送",
    codeSentDesc: "我们已向以下邮箱发送了 6 位验证码：",
    codeLabel: "邮箱验证码",
    codePlaceholder: "请输入 6 位验证码",
    codeInvalid: "请输入 6 位数字验证码",
    codeSendFailed: "验证码发送失败",
    brandTagline: "一处管理，处处使用。",
    statUsers: "2,000+",
    statUsersLabel: "位活跃用户",
    statPrompts: "50k+",
    statPromptsLabel: "条 Prompt 已管理",
    statUptime: "99.9%",
    statUptimeLabel: "可用性",
    footerCopyright: "© 2026 PromptMan · 保留所有权利",
  },

  // ── PageViews (inline view components in page.tsx) ──
  pageViews: {
    errorLoad: "加载失败",
    errorExport: "导出失败",
    exportSuccess: (path: string) => `导出成功: ${path}`,
    exportSkill: "导出 Skill",
    exportingSkill: "导出中...",
    installSkill: "安装 Skill",
    installingSkill: "安装中...",
    installSuccess: (path: string) => `已安装到：${path}`,
    installDialogTitle: "选择要安装到的 AI 工具",
    installDialogDesc: "将把该 Skill 复制到所选工具的默认 skills 目录。",
    installExportToFolder: "导出到文件夹…",
    installExportToFolderDesc: "手动选择任意本地目录",
    installNoAgentDetected: "未在本机检测到常见 AI 工具，你仍可选择导出到文件夹。",
    installAgentInstalled: "已检测到",
    installAgentNotInstalled: "未安装",
    installCancel: "取消",
    editSkill: "编辑 Skill",
    editPrompt: "编辑 Prompt",
    editAgent: "编辑 Agent",
    editTeam: "编辑 Team",
    exportAgent: "导出 Agent",
    exportingAgent: "导出中...",
    exportTeam: "导出 Team",
    exportingTeam: "导出中...",
    copied: "已复制！",
    copySkillMd: "复制 SKILL.md",
    copyInstallCmd: "复制安装命令",
    installFromRepo: "从仓库安装",
    saveInline: "保存",
    savedInline: "已保存",
    sourceLabel: "来源",
    copyPrompt: "复制 Prompt",
    copyAgentMd: "复制 AGENT.md",
    copyTeamMd: "复制 TEAM.md",
    promptContent: "Prompt 内容",
    systemInstructions: "系统指令",
    leadInstructions: "主导指令",
    taskTemplate: "任务模板",
    qualityGates: "质量门控",
    teammates: (n: number) => `成员（${n}）`,
    spawnPrompt: "启动 Prompt",
    subAgentTypes: {
      generalPurpose: '通用型',
      explore: '代码探索',
      shell: '命令执行',
      codeReview: '代码审查',
      testing: '测试',
      documentation: '文档',
      refactoring: '重构',
      custom: '自定义',
    },
    authErrorLogin: "登录失败",
    authErrorEmailLogin: "邮箱登录失败",
    badgeCurrent: "当前版本",
    metaLibrary: "归属库",
  },

  // ── PromptList ──
  promptList: {
    searchPlaceholder: "搜索提示词...",
    tableTitle: "Prompt 列表",
    copySuccess: (title: string) => `✓ 已复制 "${title}"`,
    moreActions: "更多操作",
    copyContent: "复制内容",
    delete: "删除",
    confirmDelete: "确定要删除这个 prompt 吗？",
    errorLoad: "加载 prompt 失败",
    errorSearch: "搜索失败",
    errorDelete: "删除失败",
    errorCopy: "复制失败",
    navLabel: "导航",
    selectLabel: "选中",
    escLabel: "退出",
    colTitle: "标题",
    colVersion: "版本",
    colDescription: "描述",
    colLibrary: "归属库",
    colTags: "标签",
    colContent: "内容预览",
    colActions: "操作",
    badgeCurrent: "当前",
    actionView: "查看",
    actionHistory: "版本历史",
    actionEdit: "编辑",
    actionDelete: "删除",
    externalSyncGroupTitle: "外部目录",
  },

  // ── Settings ──
  settings: {
    title: "设置",
    subtitle: "管理本机数据和可选云同步",
    back: "返回",
    // Nav
    navAccount: "账号（可选）",
    navOAuth: "OAuth",
    navAppearance: "外观",
    navOrganization: "组织",
    navData: "数据",
    navSkill: "技能",
    navPrompt: "Prompt 扫描",
    navNotifications: "通知",
    navAI: "AI 服务",
    navUpdate: "更新",
    // Save button
    btnSave: "保存设置",
    btnSaving: "保存中...",
    btnSaved: "已保存",
    // Account section
    accountTitle: "账户",
    accountSubtitle: "管理你的账户连接",
    accountProvider: "登录方式",
    accountViewGitHub: "在 GitHub 查看",
    accountViewProfile: "查看主页",
    accountSignOut: "退出登录",
    accountLoginTitle: "登录账号（可选）",
    accountLoginDesc: "你可以在登录页面选择邮箱、Google 或 GitHub 登录。不登录也可以继续使用主要功能。",
    accountLoginBtn: "打开登录页面",
    accountLoginHint: "可在登录页使用邮箱或第三方账号登录。",
    // OAuth section
    oauthTitle: "OAuth 配置",
    oauthSubtitle: "配置 GitHub 和 Google OAuth 凭证以启用认证",
    oauthGitHubGuideTitle: "GitHub 配置指南",
    oauthGitHubGuideStep1: "前往",
    oauthGitHubGuideStep2: "点击「New OAuth App」",
    oauthGitHubGuideStep3Pre: "将",
    oauthGitHubGuideStep3Key: "Homepage URL",
    oauthGitHubGuideStep3Post: "设置为",
    oauthGitHubGuideStep4Pre: "将",
    oauthGitHubGuideStep4Key: "Authorization callback URL",
    oauthGitHubGuideStep4Post: "设置为",
    oauthGitHubGuideStep5: "复制下方的 Client ID 和 Client Secret",
    oauthGitHubAppTitle: "GitHub OAuth App",
    oauthGoogleGuideTitle: "Google 配置指南",
    oauthGoogleGuideStep1: "前往",
    oauthGoogleGuideStep2Pre: "创建一个",
    oauthGoogleGuideStep2Key: "OAuth 客户端 ID",
    oauthGoogleGuideStep2Post: "（Web 应用类型）",
    oauthGoogleGuideStep3Pre: "在「授权重定向 URI」中添加",
    oauthGoogleGuideStep4: "复制下方的 Client ID 和 Client Secret",
    oauthGoogleAppTitle: "Google OAuth App",
    oauthGoogleClientId: "Google Client ID",
    // Appearance section
    appearanceTitle: "外观",
    appearanceSubtitle: "自定义应用的外观与风格",
    appearanceTheme: "主题",
    appearanceDark: "深色",
    appearanceLight: "浅色",
    appearanceSystem: "跟随系统",
    appearanceLanguage: "语言",
    // Organization section
    orgTitle: "组织",
    orgSubtitle: "管理你的组织成员关系和邀请",
    orgCurrentLabel: "当前所属组织",
    orgLeave: "退出",
    orgNotMember: "你还未加入任何组织。",
    orgJoinPlaceholder: "输入组织名称以加入...",
    orgJoin: "加入",
    orgInviteMembersLabel: "邀请成员",
    orgInvitePlaceholder: "输入 GitHub 用户名以邀请...",
    orgSendInvite: "发送邀请",
    orgSentInvitationsLabel: "已发送的邀请",
    orgStatusPending: "待确认",
    orgStatusAccepted: "已接受",
    orgStatusDeclined: "已拒绝",
    orgReceivedInvitationsLabel: "收到的邀请",
    orgInvitedBy: "邀请自",
    orgAccept: "接受",
    orgDecline: "拒绝",
    orgMarketRegistryLabel: "市场源地址（可选）",
    orgMarketRegistryHint: "自定义 GitHub 仓库地址作为技能市场源，留空则使用默认地址。",
    // AI section
    aiTitle: "AI 服务配置",
    aiSubtitle: "配置 AI 服务用于 Prompt 内容智能润色",
    aiApiConfigLabel: "API 配置",
    aiProviderLabel: "AI 服务提供商",
    aiProviderCustom: "自定义（OpenAI 兼容）",
    aiProviderBailianCoding: "阿里云百炼 Coding Plan",
    aiApiKeyLabel: "API KEY",
    aiApiKeyHintAnthropic: "在 Anthropic Console 创建 API Key",
    aiApiKeyHintDeepSeek: "在 DeepSeek Platform 创建 API Key",
    aiApiKeyHintOpenAI: "在 OpenAI Platform 创建 API Key",
    aiApiKeyHintBailianCoding:
      "在百炼 Coding Plan 页面获取套餐专属 API Key（通常以 sk-sp- 开头），与按量付费的 DashScope Key 不互通",
    aiBailianRegionLabel: "Coding Plan 端点区域",
    aiBailianRegionCn: "中国大陆（coding.dashscope.aliyuncs.com）",
    aiBailianRegionIntl: "国际（coding-intl.dashscope.aliyuncs.com）",
    aiBaseUrlLabel: "自定义端点 Base URL",
    aiBaseUrlHint: "需兼容 OpenAI Chat Completions API 格式",
    aiModelLabel: "模型（可选）",
    aiModelHint: "留空则使用默认模型",
    aiModelPickOrTypeHint: "以下为该服务商常用模型，可直接选择或手动输入其他模型名",
    aiInfoTitle: "AI 润色功能",
    aiInfoDesc: "配置后，在创建或编辑 Prompt 时，内容区域会出现「AI 润色」按钮。AI 将依据 Prompt 的标题、描述、分类和标签，将内容优化为符合最佳实践的专业提示词。",
    // Update section
    updateTitle: "软件更新",
    updateSubtitle: "保持应用程序为最新版本",
    updateCurrentVersionLabel: "当前版本",
    updateIdle: "检查更新",
    updateIdleDesc: "点击下方按钮检查是否有新版本可用。",
    updateIdleBtn: "检查更新",
    updateChecking: "检查中...",
    updateCheckingDesc: "正在检查最新版本，请稍候。",
    updateAvailable: "发现新版本！",
    updateAvailableDesc: "新版本",
    updateAvailableDesc2: "已可用。",
    updateReleaseNotesLabel: "更新说明",
    updateDownloadBtn: "下载更新",
    updateDownloading: "正在下载更新...",
    updateDownloadingDesc: "正在下载版本",
    updateDownloaded: "更新已就绪，可以安装",
    updateDownloadedDesc: "版本",
    updateDownloadedDesc2: "已下载完成，重启应用以应用更新。",
    updateInstallBtn: "重启并安装",
    updateUpToDate: "已是最新版本！",
    updateUpToDateDesc: "PromptMan v{version} 是最新版本。",
    updateCheckAgainBtn: "再次检查",
    updateError: "更新出错",
    updateErrorDefault: "发生未知错误。",
    updateRetryBtn: "重试",
    updateToastDismiss: "关闭",
    updateToastOpenSettings: "前往更新",
    updateToastNoNotes: "暂无详细说明。",
    communityTitle: "官网与开源",
    communitySubtitle: "下载更新、云同步与源码仓库",
    communityWebsite: "打开官网",
    communityWebsiteDesc: "免费下载、PromptHub 云同步与产品动态",
    communityGitHub: "GitHub 仓库",
    communityGitHubDesc: "源码、Issue 与 Releases",
    communityStarHint: "如果 PromptMan 对你有帮助，欢迎在 GitHub 点 Star 支持项目。",
    // Error messages
    errorCheckUpdate: "检查更新失败",
    errorDownloadUpdate: "下载更新失败",
    errorInstallUpdate: "安装更新失败",
    errorSave: "保存失败",
    errorJoinOrg: "加入组织失败",
    errorLeaveOrg: "退出组织失败",
    errorSendInvite: "发送邀请失败",
    errorRespondInvite: "处理邀请失败",
    dataTitle: "数据",
    dataSubtitle: "本机 SQLite 路径、同步偏好与维护选项",
    localFirstTitle: "无需注册，打开即可用",
    localFirstDesc:
      "Prompt、Skill 和版本历史默认写在本机 SQLite。下载后可直接创建和搜索，账号与云同步是可选能力。",
    dataDirGroup: "数据目录",
    dataDirDesc: "当前生效的数据根目录（数据库、配置 JSON、CLI 安装的技能包、嵌入模型缓存等）",
    dataDirOpen: "在文件管理器中打开",
    dataDirCopy: "复制路径",
    dataDirCopied: "已复制",
    dataPathsGroup: "关键路径",
    dataPathUserData: "当前数据根目录",
    dataPathElectronUserData: "应用配置目录（仅存储数据位置偏好）",
    dataPathPreferenceFile: "数据位置偏好文件",
    dataRootModeGroup: "本地数据保存位置",
    dataRootModeDesc:
      "数据库、Prompt/Skill 数据、JSON 配置与嵌入模型缓存均落在「当前数据根目录」下。新安装默认使用主目录下隐藏文件夹 ~/.promptman；若升级前数据已在应用用户数据目录，会继续使用该目录。切换选项并应用后需重启生效；跨路径迁移请自行备份或复制文件。",
    dataRootModeApp: "应用用户数据目录（系统为应用分配的路径；检测到旧数据时沿用）",
    dataRootModeHome: "用户主目录：~/.promptman（隐藏文件夹；新安装默认）",
    dataRootApply: "应用此位置",
    dataRootRestartHint: "已保存数据位置偏好。请完全退出并重新打开应用后生效。",
    dataPathStore: "设置与状态 (JSON)",
    dataPathDb: "SQLite 数据库",
    dataPathSkills: "CLI 技能安装目录",
    dataPathModels: "嵌入模型缓存",
    dataMaintenanceGroup: "维护",
    dataClearEmbedCache: "清除嵌入模型缓存",
    dataClearEmbedCacheDesc: "删除本地下载的 ONNX 嵌入模型。下次语义搜索时会重新下载，可修复部分解析错误。",
    dataClearEmbedDone: "已清除模型缓存",
    dataClearEmbedFail: "清除缓存失败",
    dataDbInfoGroup: "数据库信息",
    dataDbInfoLine: "本地 SQLite（库名：promptman.db），与上方路径一致。",
    skillTitle: "技能 (Skills)",
    skillSubtitle: "与外部 AI 工具的技能目录及安装方式相关的选项",
    skillInstallGroup: "技能安装方式",
    skillInstallSymlink: "符号链接",
    skillInstallSymlinkDesc: "在目标工具目录创建指向本应用技能文件夹的链接，便于一处更新、多处生效（后续 CLI 安装将遵循此偏好）。",
    skillInstallCopy: "复制文件",
    skillInstallCopyDesc: "将 SKILL.md 复制到各工具目录，与 PromptMan 内目录相互独立。",
    skillInstallHint: "当前市场/CLI 安装流程将逐步读取此设置；已安装内容不会自动迁移。",
    skillCustomScanGroup: "自定义扫描路径",
    skillCustomScanDesc: "希望日后纳入索引或同步的额外目录（绝对路径或 ~/ 开头）。",
    skillCustomScanPlaceholder: "例如 ~/myskills 或 /opt/skills",
    skillCustomScanAdd: "添加",
    skillCustomScanEmpty: "尚未添加自定义路径",
    skillCustomScanRemove: "移除",
    skillBuiltinGroup: "内置参考路径（只读）",
    skillBuiltinDesc: "常见 AI 工具默认技能目录，供你对照配置；是否启用取决于各工具本身。",
    skillWatchFolders: "关注外部目录变更",
    skillWatchFoldersDesc: "预留：启用后可在后续版本监听上述路径并提示变更。",
    skillBuiltinClaude: "Claude Code",
    skillBuiltinCopilot: "GitHub Copilot",
    skillBuiltinCursor: "Cursor",
    skillBuiltinWindsurf: "Windsurf",
    skillBuiltinKiro: "Kiro",
    skillBuiltinGemini: "Gemini CLI",
    skillBuiltinTrae: "Trae",
    skillBuiltinOpenCode: "OpenCode",
    skillBuiltinCodex: "Codex CLI",
    skillBuiltinDevin: "Devin / 其他",
    skillAddAllKnown: "一键添加所有内置路径",
    skillAddAllKnownDesc: "将本机已存在的内置 skill 目录自动添加到自定义扫描列表",
    skillSyncNow: "立即扫描同步",
    skillSyncResult: (imported: number, skipped: number) => `导入 ${imported} 条，跳过 ${skipped} 条未变更`,
    skillSyncError: "扫描失败",
    promptTitle: "Prompt 文件扫描",
    promptSubtitle: "从外部 AI 工具规则目录自动导入 Prompt 文件",
    promptCustomScanGroup: "自定义扫描路径",
    promptCustomScanDesc: "额外扫描 Prompt 文件的目录（支持 ~/；保存设置或点击「立即扫描」时同步到 Prompts）。",
    promptCustomScanPlaceholder: "例如 ~/myprompts 或 /path/to/rules",
    promptCustomScanAdd: "添加",
    promptCustomScanEmpty: "尚未添加自定义路径",
    promptCustomScanRemove: "移除",
    promptBuiltinGroup: "内置参考路径（自动扫描）",
    promptBuiltinDesc: "以下目录会在启动和保存设置时自动扫描，无需手动添加。",
    promptBuiltinCursor: "Cursor 规则目录",
    promptBuiltinClaude: "Claude Code 规则目录",
    promptBuiltinOpenCode: "OpenCode 规则目录",
    promptBuiltinGemini: "Gemini CLI 规则目录",
    promptAutoScanOnStartup: "启动时自动扫描",
    promptAutoScanOnStartupDesc: "应用启动时自动扫描所有已知规则目录并导入新的 Prompt 文件。",
    promptAddAllKnown: "一键添加所有内置路径",
    promptAddAllKnownDesc: "将本机已存在的内置 prompt 目录添加到自定义扫描列表",
    promptSyncNow: "立即扫描同步",
    promptSyncResult: (imported: number, skipped: number) => `导入 ${imported} 条，跳过 ${skipped} 条未变更`,
    promptSyncError: "扫描失败",
    notifTitle: "通知",
    notifSubtitle: "消息与桌面通知",
    notifEnable: "启用通知",
    notifEnableDesc: "允许应用发送系统桌面通知",
    notifCopySuccess: "复制成功通知",
    notifCopySuccessDesc: "复制 Prompt 内容后显示通知",
    notifSaveSuccess: "保存成功通知",
    notifSaveSuccessDesc: "保存更改后显示通知",
    notifToastCopyTitle: "已复制",
    notifToastCopyBody: (title: string) => `Prompt「${title}」已复制到剪贴板`,
    notifToastSaveTitle: "已保存",
    notifToastSaveBody: (title: string) => `「${title}」已保存`,
  },

  // ── CloudSync ──
  cloudSync: {
    syncing: "同步中…",
    syncNow: "同步",
    syncTitle: "立即从 PromptMan 同步最新数据",
    syncSuccess: (count: number) => count > 0 ? `已同步 ${count} 条` : "已是最新",
    syncError: "同步失败",
    syncErrorNeedPromptHub:
      "应用账号与 PromptMan 云端分开登录。请打开「设置」，登录 PromptMan 后再点同步。",
    syncSessionExpired: "云端登录已失效，请重新登录。",
    retryBtn: "重试",
    lastSyncAt: (time: string) => `上次同步 ${time}`,
    notSynced: "尚未同步",
    loginRequired: "登录后可同步云端数据",
  },

  // ── PromptForm ──
  promptForm: {
    titleCreate: "创建 Prompt",
    titleEdit: "编辑 Prompt",
    titleNewVersion: "创建新版本",
    labelTitle: "标题 *",
    labelDescription: "描述",
    labelLibrary: "归属库",
    labelTags: "标签",
    labelCategory: "分类",
    categoryCode: "编程",
    categoryWriting: "写作",
    categoryAnalysis: "分析",
    categoryCreative: "创意",
    categoryOther: "其他",
    labelContent: "内容 *",
    labelChangeNotes: "变更说明",
    placeholderTitle: "输入 prompt 标题",
    placeholderDescription: "输入 prompt 描述（可选）",
    optionNoLibrary: "不归属任何库",
    placeholderTags: "用逗号分隔多个标签（可选）",
    placeholderContent: "输入 prompt 内容",
    placeholderChangeNotes: "简要描述本次版本变更内容",
    btnSave: "保存",
    btnSaving: "保存中...",
    btnCancel: "取消",
    btnPolish: "AI 润色",
    btnPolishing: "润色中...",
    btnPolishDone: "润色完成",
    btnRestore: "撤销润色",
    btnRestoreTitle: "撤销润色，恢复原始内容",
    btnPolishTitle: "根据标题、描述、标签对 Prompt 内容进行 AI 润色",
    errorRequired: "标题和内容不能为空",
    errorLoad: "加载 prompt 失败",
    errorLoadVersion: "加载 prompt 版本失败",
    errorSave: "保存失败",
    errorPolishEmpty: "请先输入 Prompt 内容再润色",
    errorPolishFailed: "AI 润色失败",
    labelGuidanceSection: "进阶指导（可选）",
    labelUseWhen: "适用场景",
    labelGuidance: "使用指导",
    labelPitfalls: "常见陷阱",
    placeholderUseWhen: "每行一条：什么任务或输入适合用这个 Prompt",
    placeholderGuidance: "每行一条：使用时的关键指令、变量说明或调优建议",
    placeholderPitfalls: "每行一条：已知局限、易错点或模型常见失败模式",
  },

  generate: {
    badge: "AI 创作引擎",
    title: "你想创建什么？",
    subtitle: "描述你的想法，AI 将为你生成专属的提示词或技能模板",
    placeholder: "例如：帮我写一个专业的产品经理，能够分析用户需求、撰写 PRD 文档并制定产品路线图...",
    typeAuto: "自动判断",
    typePrompt: "生成提示词",
    typeSkill: "生成技能",
    btnGenerate: "生成",
    btnGenerating: "生成中...",
    kbdHint: "⌘↵ 生成",
    quickLabel: "快速开始",
    quickIdeas: [
      { label: "写作助手", idea: "帮我写各种文章和内容的写作助手，能根据主题生成高质量文案", type: "auto" },
      { label: "代码审查", idea: "对代码进行全面审查，找出问题并给出优化建议", type: "auto" },
      { label: "客服话术", idea: "专业客服代表的话术模板，处理常见问题和投诉", type: "prompt" },
      { label: "数据分析", idea: "分析数据并生成可视化报告的数据分析师", type: "skill" },
      { label: "翻译专家", idea: "精准翻译不同语言的内容，保留原意和文化背景", type: "prompt" },
      { label: "头脑风暴", idea: "帮助用户进行创意头脑风暴，生成创新想法和解决方案", type: "skill" },
      { label: "学习总结", idea: "阅读文章或书籍并生成结构化学习笔记和总结", type: "prompt" },
      { label: "AI 助理", idea: "全能 AI 个人助理，帮助处理日程、邮件、问题解答等各类任务", type: "skill" },
    ],
    generatingMsg: "AI 正在理解你的想法并生成内容...",
    errorTitle: "生成失败",
    errorMissingApiKey: "尚未配置 AI API Key。请在设置中配置 AI 服务后再试。",
    errorRetry: "重试",
    btnOpenAiSettings: "打开 AI 设置",
    btnRegen: "重新生成",
    contentLabelPrompt: "提示词内容",
    contentLabelSkill: "技能指令",
    btnSavePrompt: "保存提示词",
    btnSaveSkill: "保存技能",
    btnSaving: "保存中...",
    btnSaved: "已保存",
    btnDiscard: "丢弃",
    notAvailable: "仅在桌面应用中可用",
    language: "zh",
    typeLabels: { prompt: "提示词", skill: "技能" },
  },

  market: {
    title: "发现",
    subtitle: "浏览内置精选并导入本机库；云端精选可选",
    statGalleryItems: "画廊条目",
    statOnlineSkills: "在线技能",
    statLocalSkills: "本地技能",
    tabInstalled: "已安装",
    allCategories: "全部分类",
    refresh: "刷新",
    featured: "精选",
    latestTrending: "最新与趋势",
    all: "全部",
    cli: "CLI",
    cliPanelTitle: "通过 CLI 安装技能",
    cliSkillNamePlaceholder: "技能名称",
    cliCommandPlaceholder: "npx @promptman/skill-installer <名称>",
    cliRunning: "运行中…",
    cliInstall: "安装",
    loadingFromGithub: "正在从 GitHub 加载…",
    loadingFromCloud: "正在从云端加载…",
    galleryCategory: {
      all: "全部",
      dev: "开发",
      media: "媒体",
      comic: "漫画",
      product: "产品",
      academic: "学术",
      general: "通用",
    },
    sortPopular: "🔥 热门",
    sortNewest: "🆕 最新",
    sortRating: "⭐ 评分",
    emptyGallery: "暂无数据",
    localFirstHint:
      "下面是内置精选，全部来自本机数据包。云端精选需要联网，可按需加载。",
    loadCloudGallery: "加载云端精选（可选）",
    hideCloudGallery: "返回本机精选",
    emptyPrompts: "没有符合筛选条件的提示词",
    emptySkills: "没有符合筛选条件的技能",
    emptyOnlineSkills: "暂无在线技能",
    emptyOnlineAgents: "暂无在线智能体",
    emptyInstalled: "尚未安装技能。可通过 CLI 或在线源安装。",
    uninstall: "卸载",
    errorLoadGallery: "加载失败",
    errorLoadOnline: "加载在线数据失败",
    alertImportFailed: (msg: string) => `导入失败：${msg}`,
    alertUnknownError: "未知错误",
    alertNoInstallCommand: "该技能没有安装命令。",
    alertInstallFailed: (msg: string) => `安装失败：${msg}`,
    alertUninstallFailed: (msg: string) => `卸载失败：${msg}`,
    cliLogFailed: "失败",
    featuredBadge: "精选",
    hide: "收起",
    preview: "预览",
    import: "导入",
    imported: "已导入",
    details: "详情",
    install: "安装",
    installed: "已安装",
    skillMdContent: "SKILL.md 内容",
    allowedTools: "允许的工具",
    detailAuthor: "作者",
    detailVersion: "版本",
    detailInstall: "安装",
    detailRepo: "仓库",
    typePrompt: "提示词",
    typeSkill: "技能",
    galleryByAuthor: (name: string) => `作者 ${name}`,
    galleryUses: (n: string) => `${n} 次使用`,
    searchPlaceholder: (tabLabel: string) => `搜索${tabLabel}…`,
  },

  // ── 多文件技能包 ──
  skillPackage: {
    versionLabel: "版本号",
    versionLabelHint: "云端展示用的版本号，与本地版本历史互不影响",
    platformsLabel: "兼容平台",
    packageLabel: "技能包（多文件）",
    packageAfterSaveHint: "保存技能后即可导入 ZIP 或本地文件夹",
    localOnlyHint: "技能包文件仅保存在本机，不会上传到云端；跨设备同步只覆盖 SKILL.md 与元数据。",
    empty: "暂无技能包",
    summary: "{count} 个文件 · 共 {size}",
    importZip: "导入 ZIP",
    importFolder: "导入文件夹",
    replaceZip: "替换 ZIP",
    replaceFolder: "替换文件夹",
    reveal: "在文件管理器中显示",
    clear: "移除技能包",
    cleared: "技能包已移除",
    imported: "已导入 {count} 个文件",
    importedWithSkipped: "已导入 {count} 个文件，跳过 {skipped} 项（忽略目录或不安全路径）",
    truncated: "文件过大，仅显示前 200KB",
    selectFileHint: "选择左侧文件查看内容",
    binaryNotPreviewable: "二进制文件不支持预览",
    badge: "包 · {count} 文件",
    errorLoadTree: "读取技能包失败",
    errorImport: "导入技能包失败",
    errorReadFile: "读取文件失败",
    errorClear: "移除技能包失败",
    errorReveal: "打开目录失败",
    saveFile: "保存文件",
    saved: "已保存",
    exportZip: "导出 ZIP",
    exported: "已导出到 {path}",
    errorSaveFile: "保存文件失败",
    errorExportZip: "导出 ZIP 失败",
  },
  skillRemote: {
    title: "从 GitHub 安装技能",
    subtitle: "输入公开仓库，等价于 npx skills add owner/repo。文件只保存在本机。",
    close: "关闭",
    sourceLabel: "仓库",
    sourcePlaceholder: "owner/repo 或 https://github.com/owner/repo",
    preview: "探测",
    previewing: "探测中…",
    copyCli: "复制安装命令",
    selectAll: "全选",
    duplicate: "重名策略",
    strategySkip: "跳过已有",
    strategyOverwrite: "覆盖已有",
    strategyCopy: "另存副本",
    install: "安装 {count} 个技能",
    installing: "安装中…",
    errorPreview: "探测失败",
    errorInstall: "安装失败",
    status_created: "已创建",
    status_updated: "已覆盖",
    status_skipped: "已跳过",
    status_failed: "失败",
    openButton: "从仓库安装",
  },
};
