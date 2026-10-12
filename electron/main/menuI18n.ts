/**
 * Menu internationalization strings for the Electron application menu.
 */

export interface MenuMessages {
  app: {
    about: string
    checkForUpdates: string
    settings: string
    hide: string
    hideOthers: string
    unhide: string
    quit: string
  }
  file: {
    label: string
    newPrompt: string
    newSkill: string
    globalSearch: string
    settings: string
    quit: string
  }
  edit: {
    label: string
    undo: string
    redo: string
    cut: string
    copy: string
    paste: string
    pasteAndMatchStyle: string
    delete: string
    selectAll: string
  }
  view: {
    label: string
    prompts: string
    skills: string
    discover: string
    reload: string
    forceReload: string
    resetZoom: string
    zoomIn: string
    zoomOut: string
    toggleFullscreen: string
    devTools: string
  }
  window: {
    label: string
    minimize: string
    zoom: string
    front: string
    close: string
  }
  help: {
    label: string
    visitHomepage: string
    reportIssue: string
    exportLogs: string
    checkForUpdates: string
    about: string
  }
}

export const menuMessages: Record<'zh' | 'en', MenuMessages> = {
  zh: {
    app: {
      about: '关于 PromptMan',
      checkForUpdates: '检查更新…',
      settings: '设置…',
      hide: '隐藏 PromptMan',
      hideOthers: '隐藏其他',
      unhide: '全部显示',
      quit: '退出 PromptMan',
    },
    file: {
      label: '文件',
      newPrompt: '新建 Prompt',
      newSkill: '新建 Skill',
      globalSearch: '全局搜索',
      settings: '设置',
      quit: '退出',
    },
    edit: {
      label: '编辑',
      undo: '撤销',
      redo: '重做',
      cut: '剪切',
      copy: '复制',
      paste: '粘贴',
      pasteAndMatchStyle: '粘贴并匹配样式',
      delete: '删除',
      selectAll: '全选',
    },
    view: {
      label: '视图',
      prompts: 'Prompts',
      skills: 'Skills',
      discover: 'Discover',
      reload: '刷新',
      forceReload: '强制刷新',
      resetZoom: '实际大小',
      zoomIn: '放大',
      zoomOut: '缩小',
      toggleFullscreen: '切换全屏',
      devTools: '开发者工具',
    },
    window: {
      label: '窗口',
      minimize: '最小化',
      zoom: '缩放',
      front: '将所有窗口前置',
      close: '关闭窗口',
    },
    help: {
      label: '帮助',
      visitHomepage: '访问项目主页',
      reportIssue: '报告问题',
      exportLogs: '导出系统错误日志…',
      checkForUpdates: '检查更新…',
      about: '关于 PromptMan',
    },
  },
  en: {
    app: {
      about: 'About PromptMan',
      checkForUpdates: 'Check for Updates…',
      settings: 'Settings…',
      hide: 'Hide PromptMan',
      hideOthers: 'Hide Others',
      unhide: 'Show All',
      quit: 'Quit PromptMan',
    },
    file: {
      label: 'File',
      newPrompt: 'New Prompt',
      newSkill: 'New Skill',
      globalSearch: 'Global Search',
      settings: 'Settings',
      quit: 'Quit',
    },
    edit: {
      label: 'Edit',
      undo: 'Undo',
      redo: 'Redo',
      cut: 'Cut',
      copy: 'Copy',
      paste: 'Paste',
      pasteAndMatchStyle: 'Paste and Match Style',
      delete: 'Delete',
      selectAll: 'Select All',
    },
    view: {
      label: 'View',
      prompts: 'Prompts',
      skills: 'Skills',
      discover: 'Discover',
      reload: 'Reload',
      forceReload: 'Force Reload',
      resetZoom: 'Actual Size',
      zoomIn: 'Zoom In',
      zoomOut: 'Zoom Out',
      toggleFullscreen: 'Toggle Full Screen',
      devTools: 'Developer Tools',
    },
    window: {
      label: 'Window',
      minimize: 'Minimize',
      zoom: 'Zoom',
      front: 'Bring All to Front',
      close: 'Close Window',
    },
    help: {
      label: 'Help',
      visitHomepage: 'Visit Project Homepage',
      reportIssue: 'Report an Issue',
      exportLogs: 'Export Error Logs…',
      checkForUpdates: 'Check for Updates…',
      about: 'About PromptMan',
    },
  },
}
