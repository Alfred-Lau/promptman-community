'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Search,
  Download,
  Star,
  Sparkles,
  FileText,
  Filter,
  TrendingUp,
  Check,
  ExternalLink,
  ChevronDown,
  Zap,
  Globe,
  Bot,
  Terminal,
  RefreshCw,
  Trash2,
  Package,
  Play,
  Square,
  AlertCircle,
} from 'lucide-react'
import {
  marketPrompts,
  marketSkills,
  searchMarketPrompts,
  searchMarketSkills,
  getPromptCategories,
  getSkillCategories,
  getFeaturedPrompts,
  getFeaturedSkills,
  getLatestPopularSkills,
  type MarketPrompt,
  type MarketSkill
} from '@/lib/marketData'
import { promptAPI, agentSkillAPI, marketRegistryAPI, cliAPI, discoveryAPI } from '@/lib/seekdb/api'
import type { GalleryItem } from '@/lib/seekdb/api'
import type { RegistrySkill, RegistryAgent, InstalledSkill } from '@/lib/seekdb/types'
import { useLocale } from '@/lib/i18n'
import type { Messages } from '@/lib/i18n/zh'
import { LOCAL_FIRST } from '@/lib/localFirst'

type MarketI18n = Messages['market']

type MarketTab = 'discover' | 'prompts' | 'skills' | 'agents' | 'installed'
type DataSource = 'local' | 'online'
type ViewMode = 'featured' | 'trending' | 'all'

interface MarketProps {
  onImportSuccess?: (type: 'prompt' | 'skill', name: string) => void
  section?: 'overview' | 'prompts' | 'skills'
  focusId?: string | null
}

export default function Market({ onImportSuccess, section = 'overview', focusId = null }: MarketProps) {
  const { t } = useLocale()
  const m = t.market

  const [activeTab, setActiveTab] = useState<MarketTab>('discover')
  const [dataSource, setDataSource] = useState<DataSource>('local')
  const [viewMode, setViewMode] = useState<ViewMode>('featured')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [importingId, setImportingId] = useState<string | null>(null)
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)

  // Discovery (cloud gallery) data
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([])
  const [galleryCounts, setGalleryCounts] = useState<Record<string, number>>({})
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [galleryError, setGalleryError] = useState<string | null>(null)
  const [gallerySort, setGallerySort] = useState<'popular' | 'newest' | 'rating'>('popular')
  const [galleryCategory, setGalleryCategory] = useState<string>('all')
  const [cloudGalleryEnabled, setCloudGalleryEnabled] = useState(!LOCAL_FIRST)

  useEffect(() => {
    if (section === 'prompts') {
      setActiveTab('prompts')
      setViewMode('featured')
      setCloudGalleryEnabled(false)
    } else if (section === 'skills') {
      setActiveTab('skills')
      setViewMode('featured')
      setCloudGalleryEnabled(false)
    } else {
      setActiveTab('discover')
    }
  }, [section])

  useEffect(() => {
    if (focusId) {
      setExpandedId(focusId)
    }
  }, [focusId])

  // Online data
  const [onlineSkills, setOnlineSkills] = useState<RegistrySkill[]>([])
  const [onlineAgents, setOnlineAgents] = useState<RegistryAgent[]>([])
  const [onlineLoading, setOnlineLoading] = useState(false)
  const [onlineError, setOnlineError] = useState<string | null>(null)

  // Installed skills
  const [installedSkills, setInstalledSkills] = useState<InstalledSkill[]>([])

  // CLI state
  const [showCLI, setShowCLI] = useState(false)
  const [cliCommand, setCliCommand] = useState('')
  const [cliName, setCliName] = useState('')
  const [cliRunning, setCliRunning] = useState(false)
  const [cliLogs, setCliLogs] = useState<string[]>([])

  // 获取本地分类列表
  const promptCategories = useMemo(() => getPromptCategories(), [])
  const skillCategories = useMemo(() => getSkillCategories(), [])
  const categories = activeTab === 'prompts' ? promptCategories : skillCategories

  // 加载 Discovery 数据
  const loadGalleryItems = useCallback(async (force = false) => {
    if (galleryItems.length > 0 && !force) return
    setGalleryLoading(true)
    setGalleryError(null)
    try {
      const result = await discoveryAPI.fetchGalleryItems({
        category: galleryCategory !== 'all' ? galleryCategory : undefined,
        sort: gallerySort,
      })
      setGalleryItems(result.data || [])
      if (result.categoryCounts) setGalleryCounts(result.categoryCounts)
    } catch (err) {
      setGalleryError(err instanceof Error ? err.message : m.errorLoadGallery)
    } finally {
      setGalleryLoading(false)
    }
  }, [galleryCategory, gallerySort, galleryItems.length, m.errorLoadGallery])

  useEffect(() => {
    if (activeTab === 'discover' && cloudGalleryEnabled) {
      loadGalleryItems()
    }
  }, [activeTab, loadGalleryItems, cloudGalleryEnabled])

  useEffect(() => {
    if (activeTab === 'discover' && cloudGalleryEnabled && galleryItems.length > 0) {
      loadGalleryItems(true)
    }
    // eslint-disable-next-line
  }, [galleryCategory, gallerySort, cloudGalleryEnabled])

  const localFeaturedPrompts = useMemo(() => {
    const items = getFeaturedPrompts()
    if (!searchQuery) return items
    const q = searchQuery.toLowerCase()
    return items.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some((tag) => tag.toLowerCase().includes(q))
    )
  }, [searchQuery])

  const localFeaturedSkills = useMemo(() => {
    const items = getFeaturedSkills()
    if (!searchQuery) return items
    const q = searchQuery.toLowerCase()
    return items.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some((tag) => tag.toLowerCase().includes(q))
    )
  }, [searchQuery])

  // 按搜索词过滤 gallery
  const filteredGalleryItems = useMemo(() => {
    if (!searchQuery) return galleryItems
    const q = searchQuery.toLowerCase()
    return galleryItems.filter(item =>
      item.titleZh.toLowerCase().includes(q) ||
      item.titleEn.toLowerCase().includes(q) ||
      item.descZh.toLowerCase().includes(q) ||
      item.descEn.toLowerCase().includes(q) ||
      item.tags.some(t => t.toLowerCase().includes(q))
    )
  }, [galleryItems, searchQuery])

  // 过滤本地结果（与 skills 分支一致：无搜索且无分类时按 viewMode；否则走全文搜索）
  const filteredPrompts = useMemo(() => {
    if (!searchQuery && !selectedCategory) {
      if (viewMode === 'featured') {
        return getFeaturedPrompts()
      }
      if (viewMode === 'trending') {
        // 提示词市集暂无单独趋势算法，按下载量取前若干条作为「趋势」占位
        return [...marketPrompts].sort((a, b) => b.downloads - a.downloads).slice(0, 12)
      }
    }
    return searchMarketPrompts(searchQuery, selectedCategory)
  }, [searchQuery, selectedCategory, viewMode])

  const filteredSkills = useMemo(() => {
    if (!searchQuery && !selectedCategory) {
      if (viewMode === 'featured') {
        return getFeaturedSkills()
      }
      if (viewMode === 'trending') {
        return getLatestPopularSkills()
      }
    }
    return searchMarketSkills(searchQuery, selectedCategory)
  }, [searchQuery, selectedCategory, viewMode])

  // 过滤在线结果
  const filteredOnlineSkills = useMemo(() => {
    let items = onlineSkills
    if (selectedCategory) {
      items = items.filter(s => s.category.toLowerCase() === selectedCategory.toLowerCase())
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      items = items.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    return items
  }, [onlineSkills, searchQuery, selectedCategory])

  const filteredOnlineAgents = useMemo(() => {
    let items = onlineAgents
    if (selectedCategory) {
      items = items.filter(a => a.category.toLowerCase() === selectedCategory.toLowerCase())
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      items = items.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    return items
  }, [onlineAgents, searchQuery, selectedCategory])

  // 加载在线数据
  const loadOnlineData = useCallback(async (force = false) => {
    setOnlineLoading(true)
    setOnlineError(null)
    try {
      const [skillsRes, agentsRes] = await Promise.all([
        marketRegistryAPI.fetchSkills({ forceRefresh: force }),
        marketRegistryAPI.fetchAgents({ forceRefresh: force }),
      ])
      setOnlineSkills(skillsRes.items)
      setOnlineAgents(agentsRes.items)
    } catch (err) {
      setOnlineError(err instanceof Error ? err.message : m.errorLoadOnline)
    } finally {
      setOnlineLoading(false)
    }
  }, [m.errorLoadOnline])

  // 加载已安装的 skills
  const loadInstalledSkills = useCallback(async () => {
    try {
      const list = await cliAPI.list()
      setInstalledSkills(list)
    } catch {
      // ignore errors silently
    }
  }, [])

  useEffect(() => {
    if (dataSource === 'online' && onlineSkills.length === 0 && !onlineLoading) {
      loadOnlineData()
    }
  }, [dataSource, onlineSkills.length, onlineLoading, loadOnlineData])

  useEffect(() => {
    if (activeTab === 'installed') {
      loadInstalledSkills()
    }
  }, [activeTab, loadInstalledSkills])

  // CLI 输出监听
  useEffect(() => {
    const handleOutput = (data: { type: string; message: string }) => {
      setCliLogs(prev => [...prev, `[${data.type}] ${data.message}`])
    }
    cliAPI.onOutput(handleOutput)
    return () => {
      cliAPI.removeOutputListener(handleOutput as (...args: unknown[]) => void)
    }
  }, [])

  // 导入 Prompt
  const handleImportPrompt = async (prompt: MarketPrompt) => {
    setImportingId(prompt.id)
    try {
      const now = new Date().toISOString()
      await promptAPI.create({
        id: `imported-${prompt.id}-${Date.now()}`,
        title: prompt.title,
        content: prompt.content,
        description: prompt.description,
        category: prompt.category,
        tags: [...prompt.tags, 'imported', 'market'],
        createdAt: now
      })
      setImportedIds(prev => new Set(prev).add(prompt.id))
      onImportSuccess?.('prompt', prompt.title)
    } catch (err) {
      console.error('Import prompt failed:', err)
      alert(m.alertImportFailed(err instanceof Error ? err.message : m.alertUnknownError))
    } finally {
      setImportingId(null)
    }
  }

  // 导入本地 Skill
  const handleImportSkill = async (skill: MarketSkill) => {
    setImportingId(skill.id)
    try {
      const now = new Date().toISOString()
      const rowId = `imported-${skill.id}-${Date.now()}`
      await agentSkillAPI.create({
        id: rowId,
        name: skill.name,
        description: skill.description,
        category: skill.category,
        template: skill.skillContent,
        tags: [...skill.tags, 'imported', 'market'],
        createdAt: now,
        sourceType: 'market',
        sourceRef: skill.id,
        sourceSkill: skill.name,
      })
      const created = await agentSkillAPI.get(rowId)
      if (created?.skillId && skill.skillContent.trim()) {
        await agentSkillAPI.writePackageFile({
          skillId: created.skillId,
          path: 'SKILL.md',
          content: skill.skillContent,
        })
      }
      setImportedIds(prev => new Set(prev).add(skill.id))
      onImportSuccess?.('skill', skill.name)
    } catch (err) {
      console.error('Import skill failed:', err)
      alert(m.alertImportFailed(err instanceof Error ? err.message : m.alertUnknownError))
    } finally {
      setImportingId(null)
    }
  }

  // 通过 CLI 安装在线 Skill
  const handleInstallOnlineSkill = async (skill: RegistrySkill) => {
    if (!skill.installCommand) {
      alert(m.alertNoInstallCommand)
      return
    }
    setImportingId(skill.id)
    try {
      await cliAPI.install({
        command: skill.installCommand,
        name: skill.name,
        registryId: skill.id,
      })
      setImportedIds(prev => new Set(prev).add(skill.id))
      await loadInstalledSkills()
    } catch (err) {
      console.error('Install failed:', err)
      alert(m.alertInstallFailed(err instanceof Error ? err.message : m.alertUnknownError))
    } finally {
      setImportingId(null)
    }
  }

  // CLI 手动安装
  const handleCLIInstall = async () => {
    if (!cliCommand.trim() || !cliName.trim()) return
    setCliRunning(true)
    setCliLogs([])
    try {
      await cliAPI.install({
        command: cliCommand,
        name: cliName,
      })
      await loadInstalledSkills()
      setCliCommand('')
      setCliName('')
    } catch (err) {
      setCliLogs(prev => [...prev, `[error] ${err instanceof Error ? err.message : m.cliLogFailed}`])
    } finally {
      setCliRunning(false)
    }
  }

  // 卸载已安装的 skill
  const handleUninstall = async (id: string) => {
    try {
      await cliAPI.uninstall(id)
      await loadInstalledSkills()
    } catch (err) {
      alert(m.alertUninstallFailed(err instanceof Error ? err.message : m.alertUnknownError))
    }
  }

  // 导入 Gallery Item (prompt 或 skill)
  const handleImportGalleryItem = async (item: GalleryItem) => {
    setImportingId(item.id)
    try {
      const now = new Date().toISOString()
      if (item.type === 'prompt') {
        await promptAPI.create({
          id: `gallery-${item.id}-${Date.now()}`,
          title: item.titleZh || item.titleEn,
          content: item.content,
          description: item.descZh || item.descEn,
          category: item.category,
          tags: [...item.tags, 'gallery', 'imported'],
          createdAt: now,
        })
        onImportSuccess?.('prompt', item.titleZh || item.titleEn)
      } else {
        await agentSkillAPI.create({
          id: `gallery-${item.id}-${Date.now()}`,
          name: item.titleZh || item.titleEn,
          description: item.descZh || item.descEn,
          category: item.category,
          template: item.content,
          tags: [...item.tags, 'gallery', 'imported'],
          createdAt: now,
        })
        onImportSuccess?.('skill', item.titleZh || item.titleEn)
      }
      setImportedIds(prev => new Set(prev).add(item.id))
    } catch (err) {
      console.error('Import gallery item failed:', err)
      alert(m.alertImportFailed(err instanceof Error ? err.message : m.alertUnknownError))
    } finally {
      setImportingId(null)
    }
  }

  const handleTabChange = (tab: MarketTab) => {
    const prev = activeTab
    setActiveTab(tab)
    setSelectedCategory('')
    setExpandedId(null)
    setShowCategoryDropdown(false)
    // 发现页与本地市集数据源不同；已安装列表不使用搜索框，避免串词导致结果错乱
    if (
      tab === 'discover' ||
      prev === 'discover' ||
      tab === 'installed' ||
      prev === 'installed'
    ) {
      setSearchQuery('')
    }
    // 从云画廊进入本地市集时回到「精选」，避免沿用「全部」等视图导致列表与预期不一致
    if (prev === 'discover' && (tab === 'prompts' || tab === 'skills')) {
      setViewMode('featured')
    }
    if (tab !== 'skills' && viewMode === 'trending') {
      setViewMode('featured')
    }
  }

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category === selectedCategory ? '' : category)
    setShowCategoryDropdown(false)
    setViewMode('all')
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (query) {
      setViewMode('all')
    }
  }

  const marketSearchTabLabel =
    activeTab === 'discover'
      ? t.tabs.market
      : activeTab === 'installed'
        ? m.tabInstalled
        : activeTab === 'prompts'
          ? t.tabs.prompts
          : activeTab === 'skills'
            ? t.tabs.skills
            : t.tabs.agents

  return (
    <div className="market-container">
      {/* Header */}
      <div className="market-header">
        <div className="header-content">
          <div className="header-title">
            <Zap size={28} className="header-icon" />
            <div>
              <h1>{m.title}</h1>
              <p>{m.subtitle}</p>
            </div>
          </div>
          <div className="header-stats">
            <div className="stat">
              <span className="stat-value">
                {cloudGalleryEnabled
                  ? (galleryCounts['all'] ?? galleryItems.length ?? 0)
                  : localFeaturedPrompts.length + localFeaturedSkills.length}
              </span>
              <span className="stat-label">{cloudGalleryEnabled ? m.statGalleryItems : m.featured}</span>
            </div>
            <div className="stat">
              <span className="stat-value">{dataSource === 'online' ? onlineSkills.length : marketSkills.length}</span>
              <span className="stat-label">{dataSource === 'online' ? m.statOnlineSkills : m.statLocalSkills}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="market-toolbar">
        <div className="market-toolbar-inner">
          <div className="market-toolbar-main-row">
            <div className="market-topbar-search">
              <Search size={16} className="market-topbar-search-icon" aria-hidden />
              <input
                type="text"
                placeholder={m.searchPlaceholder(marketSearchTabLabel)}
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="market-topbar-input"
              />
            </div>

            {/* <div className="tab-buttons">
              <button
                className={`tab-btn ${activeTab === 'installed' ? 'active' : ''}`}
                onClick={() => handleTabChange('installed')}
              >
                <Package size={16} /> {m.tabInstalled}
              </button>
            </div> */}
          </div>

          <div className="filter-group">
            {activeTab !== 'installed' && activeTab !== 'discover' && (
              <>
                {dataSource === 'local' && (
                  <div className="category-dropdown">
                    <button
                      className="category-btn"
                      onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                    >
                      <Filter size={14} />
                      {selectedCategory || m.allCategories}
                      <ChevronDown size={14} />
                    </button>
                    {showCategoryDropdown && (
                      <div className="dropdown-menu">
                        <button
                          className={`dropdown-item ${!selectedCategory ? 'active' : ''}`}
                          onClick={() => handleCategorySelect('')}
                        >
                          {m.allCategories}
                        </button>
                        {categories.map(cat => (
                          <button
                            key={cat}
                            className={`dropdown-item ${selectedCategory === cat ? 'active' : ''}`}
                            onClick={() => handleCategorySelect(cat)}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {dataSource === 'online' && (
                  <button className="refresh-btn" onClick={() => loadOnlineData(true)} disabled={onlineLoading}>
                    <RefreshCw size={14} className={onlineLoading ? 'spin' : ''} />
                    {m.refresh}
                  </button>
                )}

                {dataSource === 'local' && (
                  <div className="view-toggle">
                    <button
                      className={`toggle-btn ${viewMode === 'featured' ? 'active' : ''}`}
                      onClick={() => { setViewMode('featured'); setSearchQuery(''); setSelectedCategory(''); }}
                    >
                      <TrendingUp size={14} /> {m.featured}
                    </button>
                    {activeTab === 'skills' && (
                      <button
                        className={`toggle-btn ${viewMode === 'trending' ? 'active' : ''}`}
                        onClick={() => { setViewMode('trending'); setSearchQuery(''); setSelectedCategory(''); }}
                      >
                        <TrendingUp size={14} /> {m.latestTrending}
                      </button>
                    )}
                    <button
                      className={`toggle-btn ${viewMode === 'all' ? 'active' : ''}`}
                      onClick={() => setViewMode('all')}
                    >
                      {m.all}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* CLI Toggle */}
            {/* <button className={`cli-toggle ${showCLI ? 'active' : ''}`} onClick={() => setShowCLI(!showCLI)}>
              <Terminal size={14} /> {m.cli}
            </button> */}
          </div>
        </div>
      </div>

      {/* CLI Panel */}
      {showCLI && (
        <div className="cli-panel">
          <div className="cli-header">
            <Terminal size={16} />
            <span>{m.cliPanelTitle}</span>
          </div>
          <div className="cli-form">
            <input
              type="text"
              value={cliName}
              onChange={e => setCliName(e.target.value)}
              placeholder={m.cliSkillNamePlaceholder}
              className="cli-input name"
              disabled={cliRunning}
            />
            <input
              type="text"
              value={cliCommand}
              onChange={e => setCliCommand(e.target.value)}
              placeholder={m.cliCommandPlaceholder}
              className="cli-input command"
              disabled={cliRunning}
              onKeyDown={e => { if (e.key === 'Enter') handleCLIInstall() }}
            />
            <button
              className="cli-run-btn"
              onClick={handleCLIInstall}
              disabled={cliRunning || !cliCommand.trim() || !cliName.trim()}
            >
              {cliRunning ? <Square size={14} /> : <Play size={14} />}
              {cliRunning ? m.cliRunning : m.cliInstall}
            </button>
          </div>
          {cliLogs.length > 0 && (
            <div className="cli-logs">
              {cliLogs.map((log, i) => (
                <div key={i} className={`cli-log-line ${log.startsWith('[stderr]') ? 'error' : log.startsWith('[status]') ? 'status' : ''}`}>
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="market-content">
        {/* Online Error */}
        {dataSource === 'online' && onlineError && (
          <div className="online-error">
            <AlertCircle size={16} />
            <span>{onlineError}</span>
          </div>
        )}

        {/* Online Loading */}
        {dataSource === 'online' && onlineLoading && (
          <div className="online-loading">
            <RefreshCw size={24} className="spin" />
            <p>{m.loadingFromGithub}</p>
          </div>
        )}

        {/* Discover: local featured first; cloud gallery is opt-in */}
        {activeTab === 'discover' && !cloudGalleryEnabled && (
          <>
            <div className="local-first-hint">
              <p>{m.localFirstHint}</p>
              <button type="button" className="load-cloud-btn" onClick={() => setCloudGalleryEnabled(true)}>
                <Globe size={14} />
                {m.loadCloudGallery}
              </button>
            </div>

            <h3 className="discover-section-title">{m.featured} · {t.tabs.prompts}</h3>
            <div className="items-grid">
              {localFeaturedPrompts.length === 0 ? (
                <div className="empty-state">
                  <FileText size={48} />
                  <p>{m.emptyPrompts}</p>
                </div>
              ) : (
                localFeaturedPrompts.map(prompt => (
                  <PromptCard
                    key={prompt.id}
                    m={m}
                    prompt={prompt}
                    isImporting={importingId === prompt.id}
                    isImported={importedIds.has(prompt.id)}
                    isExpanded={expandedId === prompt.id}
                    onImport={() => handleImportPrompt(prompt)}
                    onToggleExpand={() => setExpandedId(expandedId === prompt.id ? null : prompt.id)}
                  />
                ))
              )}
            </div>

            <h3 className="discover-section-title">{m.featured} · {t.tabs.skills}</h3>
            <div className="items-grid">
              {localFeaturedSkills.length === 0 ? (
                <div className="empty-state">
                  <Sparkles size={48} />
                  <p>{m.emptySkills}</p>
                </div>
              ) : (
                localFeaturedSkills.map(skill => (
                  <SkillCard
                    key={skill.id}
                    m={m}
                    skill={skill}
                    isImporting={importingId === skill.id}
                    isImported={importedIds.has(skill.id)}
                    isExpanded={expandedId === skill.id}
                    onImport={() => handleImportSkill(skill)}
                    onToggleExpand={() => setExpandedId(expandedId === skill.id ? null : skill.id)}
                  />
                ))
              )}
            </div>
          </>
        )}

        {activeTab === 'discover' && cloudGalleryEnabled && (
          <>
            <div className="local-first-hint">
              <button type="button" className="load-cloud-btn secondary" onClick={() => setCloudGalleryEnabled(false)}>
                {m.hideCloudGallery}
              </button>
            </div>
            {/* Gallery category & sort filters */}
            <div className="gallery-filters">
              <div className="gallery-cats">
                {(['all', 'dev', 'media', 'comic', 'product', 'academic', 'general'] as const).map(cat => {
                  const label = m.galleryCategory[cat]
                  const n = galleryCounts[cat]
                  const text = n ? `${label} (${n})` : label
                  return (
                    <button
                      key={cat}
                      className={`gallery-cat-btn ${galleryCategory === cat ? 'active' : ''}`}
                      onClick={() => setGalleryCategory(cat)}
                    >
                      {text}
                    </button>
                  )
                })}
              </div>
              <div className="gallery-sort">
                {(['popular', 'newest', 'rating'] as const).map(s => (
                  <button
                    key={s}
                    className={`gallery-sort-btn ${gallerySort === s ? 'active' : ''}`}
                    onClick={() => setGallerySort(s)}
                  >
                    {s === 'popular' ? m.sortPopular : s === 'newest' ? m.sortNewest : m.sortRating}
                  </button>
                ))}
                <button className="refresh-btn" onClick={() => loadGalleryItems(true)} disabled={galleryLoading}>
                  <RefreshCw size={14} className={galleryLoading ? 'spin' : ''} />
                </button>
              </div>
            </div>

            {galleryLoading && galleryItems.length === 0 && (
              <div className="online-loading">
                <RefreshCw size={24} className="spin" />
                <p>{m.loadingFromCloud}</p>
              </div>
            )}

            {galleryError && (
              <div className="online-error">
                <AlertCircle size={16} />
                <span>{galleryError}</span>
              </div>
            )}

            {!galleryLoading && filteredGalleryItems.length === 0 && !galleryError && (
              <div className="empty-state">
                <Globe size={48} />
                <p>{m.emptyGallery}</p>
              </div>
            )}

            <div className="items-grid">
              {filteredGalleryItems.map(item => (
                <GalleryCard
                  key={item.id}
                  m={m}
                  item={item}
                  isImporting={importingId === item.id}
                  isImported={importedIds.has(item.id)}
                  isExpanded={expandedId === item.id}
                  onImport={() => handleImportGalleryItem(item)}
                  onToggleExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* Local Prompts */}
        {dataSource === 'local' && activeTab === 'prompts' && (
          <div className="items-grid">
            {filteredPrompts.length === 0 ? (
              <div className="empty-state">
                <FileText size={48} />
                <p>{m.emptyPrompts}</p>
              </div>
            ) : (
              filteredPrompts.map(prompt => (
                <PromptCard
                  key={prompt.id}
                  m={m}
                  prompt={prompt}
                  isImporting={importingId === prompt.id}
                  isImported={importedIds.has(prompt.id)}
                  isExpanded={expandedId === prompt.id}
                  onImport={() => handleImportPrompt(prompt)}
                  onToggleExpand={() => setExpandedId(expandedId === prompt.id ? null : prompt.id)}
                />
              ))
            )}
          </div>
        )}

        {/* Local Skills */}
        {dataSource === 'local' && activeTab === 'skills' && (
          <div className="items-grid">
            {filteredSkills.length === 0 ? (
              <div className="empty-state">
                <Sparkles size={48} />
                <p>{m.emptySkills}</p>
              </div>
            ) : (
              filteredSkills.map(skill => (
                <SkillCard
                  key={skill.id}
                  m={m}
                  skill={skill}
                  isImporting={importingId === skill.id}
                  isImported={importedIds.has(skill.id)}
                  isExpanded={expandedId === skill.id}
                  onImport={() => handleImportSkill(skill)}
                  onToggleExpand={() => setExpandedId(expandedId === skill.id ? null : skill.id)}
                />
              ))
            )}
          </div>
        )}

        {/* Online Skills */}
        {dataSource === 'online' && activeTab === 'skills' && !onlineLoading && (
          <div className="items-grid">
            {filteredOnlineSkills.length === 0 ? (
              <div className="empty-state">
                <Sparkles size={48} />
                <p>{m.emptyOnlineSkills}</p>
              </div>
            ) : (
              filteredOnlineSkills.map(skill => (
                <OnlineCard
                  key={skill.id}
                  m={m}
                  item={skill}
                  type="skill"
                  isInstalling={importingId === skill.id}
                  isInstalled={importedIds.has(skill.id)}
                  isExpanded={expandedId === skill.id}
                  onInstall={() => handleInstallOnlineSkill(skill)}
                  onToggleExpand={() => setExpandedId(expandedId === skill.id ? null : skill.id)}
                />
              ))
            )}
          </div>
        )}

        {/* Online Agents */}
        {dataSource === 'online' && activeTab === 'agents' && !onlineLoading && (
          <div className="items-grid">
            {filteredOnlineAgents.length === 0 ? (
              <div className="empty-state">
                <Bot size={48} />
                <p>{m.emptyOnlineAgents}</p>
              </div>
            ) : (
              filteredOnlineAgents.map(agent => (
                <OnlineCard
                  key={agent.id}
                  m={m}
                  item={agent}
                  type="agent"
                  isInstalling={importingId === agent.id}
                  isInstalled={importedIds.has(agent.id)}
                  isExpanded={expandedId === agent.id}
                  onInstall={() => { }}
                  onToggleExpand={() => setExpandedId(expandedId === agent.id ? null : agent.id)}
                />
              ))
            )}
          </div>
        )}

        {/* Installed Skills */}
        {activeTab === 'installed' && (
          <div className="installed-list">
            {installedSkills.length === 0 ? (
              <div className="empty-state">
                <Package size={48} />
                <p>{m.emptyInstalled}</p>
              </div>
            ) : (
              installedSkills.map(skill => (
                <div key={skill.id} className="installed-item">
                  <div className="installed-info">
                    <Package size={18} />
                    <div>
                      <span className="installed-name">{skill.name}</span>
                      <span className="installed-meta">
                        v{skill.version} &middot; {skill.source} &middot; {new Date(skill.installedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="installed-actions">
                    <span className="installed-path">{skill.installPath}</span>
                    <button className="btn-uninstall" onClick={() => handleUninstall(skill.id)}>
                      <Trash2 size={14} /> {m.uninstall}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .market-container {
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .market-header {
          background: linear-gradient(135deg, var(--market-gradient-start) 0%, var(--market-gradient-end) 100%);
          border-bottom: 1px solid var(--border-color);
          padding: 2rem 2.5rem;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 1400px;
          margin: 0 auto;
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .header-icon {
          color: var(--accent-color);
          background: var(--accent-muted);
          padding: 10px;
          border-radius: var(--radius-lg);
        }

        .header-title h1 {
          font-size: 1.4rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
          letter-spacing: -0.03em;
        }

        .header-title p {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin: 0.25rem 0 0;
        }

        .header-stats {
          display: flex;
          gap: 2.5rem;
        }

        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--accent-color);
          letter-spacing: -0.02em;
        }

        .stat-label {
          font-size: 0.7rem;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 500;
        }

        /* Toolbar */
        .market-toolbar {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 14px 2rem;
          background: var(--bg-sidebar);
          backdrop-filter: blur(var(--blur-md));
          -webkit-backdrop-filter: blur(var(--blur-md));
          border-bottom: 1px solid var(--border-color);
        }

        .market-toolbar-inner {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 10px;
          width: 100%;
          max-width: 1100px;
        }

        /* 第一行：搜索 + Tab，避免与筛选区 flex-wrap 挤乱 */
        .market-toolbar-main-row {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          min-width: 0;
        }

        /* Topbar search — 与 email-topbar 风格一致 */
        .market-topbar-search {
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

        .market-topbar-search:focus-within {
          border-color: var(--accent-color);
          background: var(--bg-elevated, var(--bg-app));
          box-shadow: 0 0 0 3px var(--input-focus-shadow, rgba(99, 102, 241, 0.15));
        }

        .market-topbar-search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-tertiary);
          pointer-events: none;
        }

        .market-topbar-input {
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

        .market-topbar-input::placeholder {
          color: var(--text-tertiary);
        }

        .tab-buttons {
          display: flex;
          flex-shrink: 0;
          flex-wrap: wrap;
          gap: 0.4rem;
          align-items: center;
        }

        .tab-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 7px 14px;
          border: 1px solid var(--border-color);
          background: transparent;
          color: var(--text-secondary);
          border-radius: var(--radius-full);
          cursor: pointer;
          transition: all var(--transition-normal);
          font-weight: 500;
          font-size: 0.82rem;
        }

        .tab-btn:hover {
          background: var(--bg-item-hover);
          color: var(--text-primary);
        }

        .tab-btn.active {
          background: var(--accent-color);
          color: white;
          border-color: transparent;
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
        }

        .filter-group {
          display: flex;
          flex-wrap: wrap;
          gap: 0.6rem;
          align-items: center;
          width: 100%;
        }

        .search-box {
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          color: var(--text-tertiary);
        }

        .search-input {
          padding: 7px 12px 7px 2.25rem;
          border: 1px solid var(--border-color);
          background: var(--bg-glass);
          border-radius: var(--radius-full);
          color: var(--text-primary);
          width: 200px;
          font-size: 0.82rem;
          transition: all var(--transition-fast);
        }

        .search-input::placeholder {
          color: var(--text-tertiary);
        }

        .search-input:focus {
          outline: none;
          border-color: var(--border-focus);
          box-shadow: 0 0 0 3px var(--input-focus-shadow);
          width: 240px;
        }

        .category-dropdown {
          position: relative;
        }

        .category-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 7px 12px;
          border: 1px solid var(--border-color);
          background: var(--bg-glass);
          color: var(--text-secondary);
          border-radius: var(--radius-full);
          cursor: pointer;
          font-size: 0.82rem;
          transition: all var(--transition-fast);
        }

        .category-btn:hover {
          background: var(--bg-item-hover);
          color: var(--text-primary);
        }

        .dropdown-menu {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          min-width: 180px;
          background: var(--bg-elevated);
          backdrop-filter: blur(var(--blur-lg));
          -webkit-backdrop-filter: blur(var(--blur-lg));
          border: 1px solid var(--border-light);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          z-index: 100;
          max-height: 300px;
          overflow-y: auto;
          padding: 4px;
          animation: fadeInScale 0.15s ease;
        }

        .dropdown-item {
          display: block;
          width: 100%;
          text-align: left;
          padding: 8px 12px;
          border: none;
          background: transparent;
          color: var(--text-primary);
          cursor: pointer;
          font-size: 0.82rem;
          border-radius: var(--radius-sm);
          transition: background var(--transition-fast);
        }

        .dropdown-item:hover {
          background: var(--bg-item-hover);
        }

        .dropdown-item.active {
          background: var(--accent-muted);
          color: var(--accent-color);
          font-weight: 500;
        }

        .refresh-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 7px 12px;
          border: 1px solid var(--border-color);
          background: var(--bg-glass);
          color: var(--text-secondary);
          border-radius: var(--radius-full);
          cursor: pointer;
          font-size: 0.82rem;
          transition: all var(--transition-fast);
        }

        .refresh-btn:hover:not(:disabled) {
          background: var(--bg-item-hover);
          color: var(--text-primary);
        }

        .refresh-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .view-toggle {
          display: flex;
          background: var(--bg-glass);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-full);
          overflow: hidden;
          padding: 2px;
        }

        .toggle-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 5px 10px;
          border: none;
          background: transparent;
          color: var(--text-tertiary);
          cursor: pointer;
          font-size: 0.78rem;
          transition: all var(--transition-normal);
          border-radius: var(--radius-full);
          font-weight: 500;
        }

        .toggle-btn:hover {
          color: var(--text-primary);
        }

        .toggle-btn.active {
          background: var(--accent-color);
          color: white;
          box-shadow: 0 2px 6px rgba(99, 102, 241, 0.3);
        }

        .cli-toggle {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 7px 12px;
          border: 1px solid var(--border-color);
          background: var(--bg-glass);
          color: var(--text-secondary);
          border-radius: var(--radius-full);
          cursor: pointer;
          font-size: 0.82rem;
          font-weight: 500;
          transition: all var(--transition-fast);
        }

        .cli-toggle:hover {
          background: var(--bg-item-hover);
          color: var(--text-primary);
        }

        .cli-toggle.active {
          background: rgba(34, 197, 94, 0.1);
          border-color: rgba(34, 197, 94, 0.3);
          color: #22c55e;
        }

        /* CLI Panel */
        .cli-panel {
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-sidebar);
          padding: 1rem 2.5rem;
          animation: slideDown 0.2s ease;
        }

        @keyframes slideDown {
          from { opacity: 0; max-height: 0; }
          to { opacity: 1; max-height: 300px; }
        }

        .cli-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 0.75rem;
        }

        .cli-form {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .cli-input {
          padding: 8px 12px;
          background: var(--bg-glass);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: 0.82rem;
          outline: none;
          transition: border-color var(--transition-fast);
        }

        .cli-input:focus {
          border-color: var(--accent-color);
        }

        .cli-input.name {
          width: 150px;
        }

        .cli-input.command {
          flex: 1;
          font-family: 'SF Mono', ui-monospace, monospace;
        }

        .cli-input::placeholder {
          color: var(--text-tertiary);
        }

        .cli-run-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: #22c55e;
          color: white;
          border: none;
          border-radius: var(--radius-md);
          cursor: pointer;
          font-size: 0.82rem;
          font-weight: 600;
          transition: all var(--transition-fast);
          white-space: nowrap;
        }

        .cli-run-btn:hover:not(:disabled) {
          background: #16a34a;
        }

        .cli-run-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .cli-logs {
          margin-top: 0.75rem;
          background: #0d1117;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 0.75rem;
          max-height: 150px;
          overflow-y: auto;
          font-family: 'SF Mono', ui-monospace, monospace;
          font-size: 0.75rem;
          line-height: 1.6;
        }

        .cli-log-line {
          color: #c9d1d9;
          white-space: pre-wrap;
          word-break: break-all;
        }

        .cli-log-line.error {
          color: #f85149;
        }

        .cli-log-line.status {
          color: #58a6ff;
        }

        /* Content */
        .market-content {
          flex: 1;
          overflow-y: auto;
          padding: 2rem 2.5rem;
        }

        .local-first-hint {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          max-width: 1400px;
          margin: 0 auto 1.25rem;
          padding: 0.85rem 1rem;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          background: var(--bg-glass);
        }

        .local-first-hint p {
          margin: 0;
          font-size: 0.85rem;
          color: var(--text-secondary);
          line-height: 1.45;
        }

        .load-cloud-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          flex-shrink: 0;
          padding: 7px 12px;
          border: 1px solid var(--border-color);
          background: var(--bg-item-hover);
          color: var(--text-primary);
          border-radius: var(--radius-full);
          cursor: pointer;
          font-size: 0.82rem;
        }

        .load-cloud-btn.secondary {
          background: transparent;
        }

        .discover-section-title {
          max-width: 1400px;
          margin: 0 auto 0.75rem;
          font-size: 0.92rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .items-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1rem;
          max-width: 1400px;
          margin: 0 auto;
        }

        .empty-state {
          grid-column: 1 / -1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem 2rem;
          color: var(--text-tertiary);
          text-align: center;
        }

        .empty-state p {
          margin-top: 1rem;
          font-size: 0.9rem;
        }

        .online-error {
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
        }

        .online-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem 2rem;
          color: var(--text-secondary);
          gap: 1rem;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Installed List */
        .installed-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          max-width: 900px;
        }

        .installed-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          transition: border-color var(--transition-fast);
        }

        .installed-item:hover {
          border-color: rgba(99, 102, 241, 0.2);
        }

        .installed-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: var(--accent-color);
        }

        .installed-name {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-primary);
          display: block;
        }

        .installed-meta {
          font-size: 0.75rem;
          color: var(--text-tertiary);
          display: block;
        }

        .installed-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .installed-path {
          font-size: 0.7rem;
          color: var(--text-tertiary);
          font-family: 'SF Mono', ui-monospace, monospace;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .btn-uninstall {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 5px 10px;
          border: 1px solid rgba(239, 68, 68, 0.3);
          background: transparent;
          color: #ef4444;
          border-radius: var(--radius-full);
          cursor: pointer;
          font-size: 0.75rem;
          font-weight: 500;
          transition: all var(--transition-fast);
        }

        .btn-uninstall:hover {
          background: rgba(239, 68, 68, 0.1);
        }

        /* Gallery Filters */
        .gallery-filters {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        .gallery-cats {
          display: flex;
          gap: 0.35rem;
          flex-wrap: wrap;
        }

        .gallery-cat-btn {
          padding: 5px 12px;
          border: 1px solid var(--border-color);
          background: transparent;
          color: var(--text-secondary);
          border-radius: var(--radius-full);
          cursor: pointer;
          font-size: 0.78rem;
          font-weight: 500;
          transition: all var(--transition-fast);
          text-transform: capitalize;
        }

        .gallery-cat-btn:hover {
          background: var(--bg-item-hover);
          color: var(--text-primary);
        }

        .gallery-cat-btn.active {
          background: var(--accent-color);
          color: white;
          border-color: transparent;
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
        }

        .gallery-sort {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .gallery-sort-btn {
          padding: 5px 10px;
          border: 1px solid var(--border-color);
          background: transparent;
          color: var(--text-tertiary);
          border-radius: var(--radius-full);
          cursor: pointer;
          font-size: 0.78rem;
          font-weight: 500;
          transition: all var(--transition-fast);
        }

        .gallery-sort-btn:hover {
          color: var(--text-primary);
          background: var(--bg-item-hover);
        }

        .gallery-sort-btn.active {
          background: var(--bg-item-hover);
          color: var(--text-primary);
          border-color: var(--accent-color);
        }
      `}</style>
    </div>
  )
}

// ==================== Prompt Card 组件 ====================
function PromptCard({
  m, prompt, isImporting, isImported, isExpanded, onImport, onToggleExpand
}: {
  m: MarketI18n
  prompt: MarketPrompt; isImporting: boolean; isImported: boolean; isExpanded: boolean; onImport: () => void; onToggleExpand: () => void
}) {
  return (
    <div className={`item-card ${isExpanded ? 'expanded' : ''}`}>
      <div className="card-header"><div className="card-title-row"><h3>{prompt.title}</h3>{prompt.featured && (<span className="featured-badge"><TrendingUp size={12} />{m.featuredBadge}</span>)}</div><span className="category-badge">{prompt.category}</span></div>
      <p className="card-description">{prompt.description}</p>
      <div className="card-tags">{prompt.tags.slice(0, 3).map(tag => (<span key={tag} className="tag">{tag}</span>))}{prompt.tags.length > 3 && (<span className="tag-more">+{prompt.tags.length - 3}</span>)}</div>
      {isExpanded && (<div className="card-preview"><pre>{prompt.content}</pre></div>)}
      <div className="card-footer">
        <div className="card-stats"><span className="stat-item"><Download size={14} />{prompt.downloads.toLocaleString()}</span><span className="stat-item"><Star size={14} />{prompt.rating}</span></div>
        <div className="card-actions"><button className="btn-preview" onClick={onToggleExpand}>{isExpanded ? m.hide : m.preview}</button><button className={`btn-import ${isImported ? 'imported' : ''}`} onClick={onImport} disabled={isImporting || isImported}>{isImporting ? (<span className="loading-spinner" />) : isImported ? (<><Check size={14} />{m.imported}</>) : (<><Download size={14} />{m.import}</>)}</button></div>
      </div>
      <style jsx>{`
        .item-card{background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-xl);padding:1.25rem;display:flex;flex-direction:column;gap:0.75rem;transition:all var(--transition-normal);backdrop-filter:blur(var(--blur-sm));-webkit-backdrop-filter:blur(var(--blur-sm))}
        .item-card:hover{border-color:rgba(99,102,241,0.2);box-shadow:var(--shadow-md),var(--shadow-glow);transform:translateY(-2px)}
        .item-card.expanded{grid-column:span 2}
        @media(max-width:768px){.item-card.expanded{grid-column:span 1}}
        .card-header{display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem}
        .card-title-row{display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap}
        .card-header h3{font-size:0.95rem;font-weight:600;color:var(--text-primary);margin:0;letter-spacing:-0.02em}
        .featured-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:linear-gradient(135deg,#f59e0b 0%,#ef4444 100%);color:white;font-size:0.65rem;font-weight:600;border-radius:var(--radius-full);text-transform:uppercase;letter-spacing:0.03em}
        .category-badge{padding:3px 8px;background:var(--category-tag-bg);color:var(--accent-color);font-size:0.7rem;font-weight:500;border-radius:var(--radius-full);white-space:nowrap}
        .card-description{color:var(--text-secondary);font-size:0.82rem;line-height:1.55;margin:0}
        .card-tags{display:flex;flex-wrap:wrap;gap:0.3rem}
        .tag{padding:2px 8px;background:var(--tag-bg);border:1px solid var(--tag-border);color:var(--text-secondary);font-size:0.7rem;border-radius:var(--radius-full)}
        .tag-more{padding:2px 8px;color:var(--text-tertiary);font-size:0.7rem;font-style:italic}
        .card-preview{background:var(--code-bg);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:1rem;max-height:200px;overflow:auto}
        .card-preview pre{margin:0;font-family:'SF Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:0.78rem;line-height:1.55;white-space:pre-wrap;word-break:break-word;color:var(--text-primary)}
        .card-footer{display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding-top:0.75rem;border-top:1px solid var(--border-color)}
        .card-stats{display:flex;gap:0.75rem}
        .stat-item{display:flex;align-items:center;gap:4px;color:var(--text-tertiary);font-size:0.75rem}
        .card-actions{display:flex;gap:0.4rem}
        .btn-preview{padding:6px 12px;border:1px solid var(--border-color);background:transparent;color:var(--text-secondary);border-radius:var(--radius-full);cursor:pointer;font-size:0.78rem;transition:all var(--transition-fast);font-weight:500}
        .btn-preview:hover{background:var(--bg-item-hover);color:var(--text-primary)}
        .btn-import{display:flex;align-items:center;gap:6px;padding:6px 14px;border:none;background:var(--accent-color);color:white;border-radius:var(--radius-full);cursor:pointer;font-size:0.78rem;font-weight:600;transition:all var(--transition-normal)}
        .btn-import:hover:not(:disabled){background:var(--accent-hover);box-shadow:0 4px 12px rgba(99,102,241,0.3)}
        .btn-import:disabled{cursor:not-allowed;opacity:0.6}
        .btn-import.imported{background:var(--success-color)}
        .loading-spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:spin 0.8s linear infinite}
      `}</style>
    </div>
  )
}

// ==================== Skill Card 组件 ====================
function SkillCard({
  m, skill, isImporting, isImported, isExpanded, onImport, onToggleExpand
}: {
  m: MarketI18n
  skill: MarketSkill; isImporting: boolean; isImported: boolean; isExpanded: boolean; onImport: () => void; onToggleExpand: () => void
}) {
  return (
    <div className={`item-card ${isExpanded ? 'expanded' : ''}`}>
      <div className="card-header"><div className="card-title-row"><h3>{skill.name}</h3>{skill.featured && (<span className="featured-badge"><TrendingUp size={12} />{m.featuredBadge}</span>)}</div><span className="category-badge">{skill.category}</span></div>
      <p className="card-description">{skill.description}</p>
      <div className="card-tags">{skill.tags.slice(0, 3).map(tag => (<span key={tag} className="tag">{tag}</span>))}{skill.tags.length > 3 && (<span className="tag-more">+{skill.tags.length - 3}</span>)}</div>
      {isExpanded && (<div className="card-details"><div className="detail-section"><h4>{m.skillMdContent}</h4><pre>{skill.skillContent}</pre></div>{skill.allowedTools && skill.allowedTools.length > 0 && (<div className="detail-section tools-section"><h4>{m.allowedTools}</h4><div className="tools-list">{skill.allowedTools.map((tool, i) => (<span key={i} className="tool-badge">{tool}</span>))}</div></div>)}</div>)}
      <div className="card-footer">
        <div className="card-stats"><span className="stat-item"><Download size={14} />{skill.downloads.toLocaleString()}</span><span className="stat-item"><Star size={14} />{skill.rating}</span></div>
        <div className="card-actions"><button className="btn-preview" onClick={onToggleExpand}>{isExpanded ? m.hide : m.preview}</button><button className={`btn-import ${isImported ? 'imported' : ''}`} onClick={onImport} disabled={isImporting || isImported}>{isImporting ? (<span className="loading-spinner" />) : isImported ? (<><Check size={14} />{m.imported}</>) : (<><Download size={14} />{m.import}</>)}</button></div>
      </div>
      <style jsx>{`
        .item-card{background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-xl);padding:1.25rem;display:flex;flex-direction:column;gap:0.75rem;transition:all var(--transition-normal);backdrop-filter:blur(var(--blur-sm));-webkit-backdrop-filter:blur(var(--blur-sm))}
        .item-card:hover{border-color:rgba(168,85,247,0.2);box-shadow:var(--shadow-md),0 0 20px rgba(168,85,247,0.1);transform:translateY(-2px)}
        .item-card.expanded{grid-column:span 2}@media(max-width:768px){.item-card.expanded{grid-column:span 1}}
        .card-header{display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem}
        .card-title-row{display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap}
        .card-header h3{font-size:0.95rem;font-weight:600;color:var(--text-primary);margin:0;letter-spacing:-0.02em}
        .featured-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:linear-gradient(135deg,#8b5cf6 0%,#ec4899 100%);color:white;font-size:0.65rem;font-weight:600;border-radius:var(--radius-full);text-transform:uppercase;letter-spacing:0.03em}
        .category-badge{padding:3px 8px;background:rgba(168,85,247,0.12);color:#c084fc;font-size:0.7rem;font-weight:500;border-radius:var(--radius-full);white-space:nowrap}
        .card-description{color:var(--text-secondary);font-size:0.82rem;line-height:1.55;margin:0}
        .card-tags{display:flex;flex-wrap:wrap;gap:0.3rem}
        .tag{padding:2px 8px;background:var(--tag-bg);border:1px solid var(--tag-border);color:var(--text-secondary);font-size:0.7rem;border-radius:var(--radius-full)}
        .tag-more{padding:2px 8px;color:var(--text-tertiary);font-size:0.7rem;font-style:italic}
        .card-details{display:flex;flex-direction:column;gap:0.75rem}
        .detail-section{background:var(--code-bg);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:1rem}
        .detail-section h4{margin:0 0 0.5rem;font-size:0.7rem;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.08em}
        .detail-section pre{margin:0;font-family:'SF Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:0.78rem;line-height:1.55;white-space:pre-wrap;word-break:break-word;color:var(--text-primary);max-height:150px;overflow:auto}
        .tools-section{background:rgba(168,85,247,0.06);border-color:rgba(168,85,247,0.15)}
        .tools-list{display:flex;flex-wrap:wrap;gap:0.4rem}
        .tool-badge{padding:3px 8px;background:rgba(168,85,247,0.12);color:#c084fc;font-size:0.7rem;font-family:'SF Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;border-radius:var(--radius-full);border:1px solid rgba(168,85,247,0.2)}
        .card-footer{display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding-top:0.75rem;border-top:1px solid var(--border-color)}
        .card-stats{display:flex;gap:0.75rem}
        .stat-item{display:flex;align-items:center;gap:4px;color:var(--text-tertiary);font-size:0.75rem}
        .card-actions{display:flex;gap:0.4rem}
        .btn-preview{padding:6px 12px;border:1px solid var(--border-color);background:transparent;color:var(--text-secondary);border-radius:var(--radius-full);cursor:pointer;font-size:0.78rem;transition:all var(--transition-fast);font-weight:500}
        .btn-preview:hover{background:var(--bg-item-hover);color:var(--text-primary)}
        .btn-import{display:flex;align-items:center;gap:6px;padding:6px 14px;border:none;background:#8b5cf6;color:white;border-radius:var(--radius-full);cursor:pointer;font-size:0.78rem;font-weight:600;transition:all var(--transition-normal)}
        .btn-import:hover:not(:disabled){background:#7c3aed;box-shadow:0 4px 12px rgba(139,92,246,0.3)}
        .btn-import:disabled{cursor:not-allowed;opacity:0.6}
        .btn-import.imported{background:var(--success-color)}
        .loading-spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:spin 0.8s linear infinite}
      `}</style>
    </div>
  )
}

// ==================== Online Card 组件（Skills & Agents）====================
function OnlineCard({
  m, item, type, isInstalling, isInstalled, isExpanded, onInstall, onToggleExpand
}: {
  m: MarketI18n
  item: RegistrySkill | RegistryAgent; type: 'skill' | 'agent'; isInstalling: boolean; isInstalled: boolean; isExpanded: boolean; onInstall: () => void; onToggleExpand: () => void
}) {
  const isSkill = type === 'skill'
  const skill = item as RegistrySkill

  return (
    <div className={`item-card ${isExpanded ? 'expanded' : ''}`}>
      <div className="card-header">
        <div className="card-title-row">
          <h3>{item.name}</h3>
          {item.featured && (<span className="featured-badge"><TrendingUp size={12} />{m.featuredBadge}</span>)}
        </div>
        <span className="category-badge">{item.category}</span>
      </div>
      <p className="card-description">{item.description}</p>
      <div className="card-tags">
        {item.tags.slice(0, 3).map(tag => (<span key={tag} className="tag">{tag}</span>))}
        {item.tags.length > 3 && (<span className="tag-more">+{item.tags.length - 3}</span>)}
      </div>

      {isExpanded && (
        <div className="card-details">
          <div className="detail-row">
            <span className="detail-label">{m.detailAuthor}</span>
            <span className="detail-value">{item.author}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">{m.detailVersion}</span>
            <span className="detail-value">{item.version}</span>
          </div>
          {isSkill && skill.installCommand && (
            <div className="detail-row">
              <span className="detail-label">{m.detailInstall}</span>
              <code className="detail-code">{skill.installCommand}</code>
            </div>
          )}
          <div className="detail-row">
            <span className="detail-label">{m.detailRepo}</span>
            <a href={item.repoUrl} target="_blank" rel="noopener noreferrer" className="detail-link">
              {item.repoUrl} <ExternalLink size={12} />
            </a>
          </div>
        </div>
      )}

      <div className="card-footer">
        <div className="card-stats">
          <span className="stat-item"><Download size={14} />{item.downloads.toLocaleString()}</span>
          <span className="stat-item"><Star size={14} />{item.rating}</span>
        </div>
        <div className="card-actions">
          <button className="btn-preview" onClick={onToggleExpand}>{isExpanded ? m.hide : m.details}</button>
          {isSkill && skill.installCommand && (
            <button className={`btn-install ${isInstalled ? 'installed' : ''}`} onClick={onInstall} disabled={isInstalling || isInstalled}>
              {isInstalling ? (<span className="loading-spinner" />) : isInstalled ? (<><Check size={14} />{m.installed}</>) : (<><Download size={14} />{m.install}</>)}
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        .item-card{background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-xl);padding:1.25rem;display:flex;flex-direction:column;gap:0.75rem;transition:all var(--transition-normal);backdrop-filter:blur(var(--blur-sm));-webkit-backdrop-filter:blur(var(--blur-sm))}
        .item-card:hover{border-color:rgba(59,130,246,0.2);box-shadow:var(--shadow-md),0 0 20px rgba(59,130,246,0.1);transform:translateY(-2px)}
        .item-card.expanded{grid-column:span 2}@media(max-width:768px){.item-card.expanded{grid-column:span 1}}
        .card-header{display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem}
        .card-title-row{display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap}
        .card-header h3{font-size:0.95rem;font-weight:600;color:var(--text-primary);margin:0;letter-spacing:-0.02em}
        .featured-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:linear-gradient(135deg,#3b82f6 0%,#06b6d4 100%);color:white;font-size:0.65rem;font-weight:600;border-radius:var(--radius-full);text-transform:uppercase;letter-spacing:0.03em}
        .category-badge{padding:3px 8px;background:rgba(59,130,246,0.12);color:#60a5fa;font-size:0.7rem;font-weight:500;border-radius:var(--radius-full);white-space:nowrap}
        .card-description{color:var(--text-secondary);font-size:0.82rem;line-height:1.55;margin:0}
        .card-tags{display:flex;flex-wrap:wrap;gap:0.3rem}
        .tag{padding:2px 8px;background:var(--tag-bg);border:1px solid var(--tag-border);color:var(--text-secondary);font-size:0.7rem;border-radius:var(--radius-full)}
        .tag-more{padding:2px 8px;color:var(--text-tertiary);font-size:0.7rem;font-style:italic}
        .card-details{display:flex;flex-direction:column;gap:0.5rem;padding:0.75rem;background:var(--bg-glass);border:1px solid var(--border-color);border-radius:var(--radius-lg)}
        .detail-row{display:flex;align-items:baseline;gap:0.75rem;font-size:0.82rem}
        .detail-label{color:var(--text-tertiary);font-weight:500;min-width:70px;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em}
        .detail-value{color:var(--text-primary)}
        .detail-code{background:var(--code-bg);padding:2px 8px;border-radius:var(--radius-sm);font-family:'SF Mono',ui-monospace,monospace;font-size:0.78rem;color:var(--accent-color)}
        .detail-link{color:var(--accent-color);text-decoration:none;display:inline-flex;align-items:center;gap:4px;font-size:0.82rem}
        .detail-link:hover{text-decoration:underline}
        .card-footer{display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding-top:0.75rem;border-top:1px solid var(--border-color)}
        .card-stats{display:flex;gap:0.75rem}
        .stat-item{display:flex;align-items:center;gap:4px;color:var(--text-tertiary);font-size:0.75rem}
        .card-actions{display:flex;gap:0.4rem}
        .btn-preview{padding:6px 12px;border:1px solid var(--border-color);background:transparent;color:var(--text-secondary);border-radius:var(--radius-full);cursor:pointer;font-size:0.78rem;transition:all var(--transition-fast);font-weight:500}
        .btn-preview:hover{background:var(--bg-item-hover);color:var(--text-primary)}
        .btn-install{display:flex;align-items:center;gap:6px;padding:6px 14px;border:none;background:#3b82f6;color:white;border-radius:var(--radius-full);cursor:pointer;font-size:0.78rem;font-weight:600;transition:all var(--transition-normal)}
        .btn-install:hover:not(:disabled){background:#2563eb;box-shadow:0 4px 12px rgba(59,130,246,0.3)}
        .btn-install:disabled{cursor:not-allowed;opacity:0.6}
        .btn-install.installed{background:var(--success-color)}
        .loading-spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:spin 0.8s linear infinite}
      `}</style>
    </div>
  )
}

// ==================== Gallery Card 组件 ====================
function GalleryCard({
  m, item, isImporting, isImported, isExpanded, onImport, onToggleExpand
}: {
  m: MarketI18n
  item: GalleryItem; isImporting: boolean; isImported: boolean; isExpanded: boolean; onImport: () => void; onToggleExpand: () => void
}) {
  const title = item.titleZh || item.titleEn
  const desc = item.descZh || item.descEn
  const accentColor = item.accent || '#6366f1'
  const typeLabel = item.type === 'prompt' ? m.typePrompt : m.typeSkill

  return (
    <div className={`item-card ${isExpanded ? 'expanded' : ''}`}>
      <div className="card-header">
        <div className="card-title-row">
          <h3>{title}</h3>
          <span className="type-badge">
            {item.type === 'prompt' ? <FileText size={11} /> : <Sparkles size={11} />}
            {typeLabel}
          </span>
        </div>
        <span className="category-badge">{item.category}</span>
      </div>
      <p className="card-description">{desc}</p>
      <div className="card-tags">
        {item.tags.slice(0, 4).map(tag => (<span key={tag} className="tag">{tag}</span>))}
        {item.tags.length > 4 && (<span className="tag-more">+{item.tags.length - 4}</span>)}
      </div>
      <div className="card-meta">
        {item.difficulty && <span className="meta-item">{item.difficulty}</span>}
        {item.platforms.length > 0 && <span className="meta-item">{item.platforms.join(' · ')}</span>}
        {item.author && <span className="meta-item">{m.galleryByAuthor(item.author)}</span>}
      </div>
      {isExpanded && (
        <div className="card-preview">
          <pre>{item.content}</pre>
        </div>
      )}
      <div className="card-footer">
        <div className="card-stats">
          <span className="stat-item"><TrendingUp size={14} />{m.galleryUses(item.uses.toLocaleString())}</span>
          <span className="stat-item"><Star size={14} />{item.rating}</span>
        </div>
        <div className="card-actions">
          <button className="btn-preview" onClick={onToggleExpand}>{isExpanded ? m.hide : m.preview}</button>
          <button
            className={`btn-import ${isImported ? 'imported' : ''}`}
            onClick={onImport}
            disabled={isImporting || isImported}
          >
            {isImporting ? (<span className="loading-spinner" />) : isImported ? (<><Check size={14} />{m.imported}</>) : (<><Download size={14} />{m.import}</>)}
          </button>
        </div>
      </div>
      <style jsx>{`
        .item-card{background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-xl);padding:1.25rem;display:flex;flex-direction:column;gap:0.75rem;transition:all var(--transition-normal);backdrop-filter:blur(var(--blur-sm));-webkit-backdrop-filter:blur(var(--blur-sm))}
        .item-card:hover{border-color:${accentColor}33;box-shadow:var(--shadow-md),0 0 20px ${accentColor}15;transform:translateY(-2px)}
        .item-card.expanded{grid-column:span 2}@media(max-width:768px){.item-card.expanded{grid-column:span 1}}
        .card-header{display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem}
        .card-title-row{display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap}
        .card-header h3{font-size:0.95rem;font-weight:600;color:var(--text-primary);margin:0;letter-spacing:-0.02em}
        .type-badge{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;font-size:0.65rem;font-weight:500;border-radius:var(--radius-full);text-transform:capitalize;background:${item.type === 'prompt' ? 'rgba(99,102,241,0.12)' : 'rgba(168,85,247,0.12)'};color:${item.type === 'prompt' ? '#818cf8' : '#c084fc'}}
        .category-badge{padding:3px 8px;font-size:0.7rem;font-weight:500;border-radius:var(--radius-full);white-space:nowrap;background:${accentColor}18;color:${accentColor}}
        .card-description{color:var(--text-secondary);font-size:0.82rem;line-height:1.55;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .card-tags{display:flex;flex-wrap:wrap;gap:0.3rem}
        .tag{padding:2px 8px;background:var(--tag-bg);border:1px solid var(--tag-border);color:var(--text-secondary);font-size:0.7rem;border-radius:var(--radius-full)}
        .tag-more{padding:2px 8px;color:var(--text-tertiary);font-size:0.7rem;font-style:italic}
        .card-meta{display:flex;flex-wrap:wrap;gap:0.5rem;font-size:0.72rem;color:var(--text-tertiary)}
        .meta-item{display:flex;align-items:center}
        .meta-item::after{content:'·';margin-left:0.5rem}
        .meta-item:last-child::after{content:''}
        .card-preview{background:var(--code-bg);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:1rem;max-height:200px;overflow:auto}
        .card-preview pre{margin:0;font-family:'SF Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:0.78rem;line-height:1.55;white-space:pre-wrap;word-break:break-word;color:var(--text-primary)}
        .card-footer{display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding-top:0.75rem;border-top:1px solid var(--border-color)}
        .card-stats{display:flex;gap:0.75rem}
        .stat-item{display:flex;align-items:center;gap:4px;color:var(--text-tertiary);font-size:0.75rem}
        .card-actions{display:flex;gap:0.4rem}
        .btn-preview{padding:6px 12px;border:1px solid var(--border-color);background:transparent;color:var(--text-secondary);border-radius:var(--radius-full);cursor:pointer;font-size:0.78rem;transition:all var(--transition-fast);font-weight:500}
        .btn-preview:hover{background:var(--bg-item-hover);color:var(--text-primary)}
        .btn-import{display:flex;align-items:center;gap:6px;padding:6px 14px;border:none;color:white;border-radius:var(--radius-full);cursor:pointer;font-size:0.78rem;font-weight:600;transition:all var(--transition-normal);background:${accentColor}}
        .btn-import:hover:not(:disabled){filter:brightness(1.1);box-shadow:0 4px 12px ${accentColor}40}
        .btn-import:disabled{cursor:not-allowed;opacity:0.6}
        .btn-import.imported{background:var(--success-color)!important}
        .loading-spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:spin 0.8s linear infinite}
      `}</style>
    </div>
  )
}
