'use client'

import { FileText, Sparkles } from 'lucide-react'
import { getFeaturedPrompts, getFeaturedSkills } from '@/lib/marketData'
import { useLocale } from '@/lib/i18n'

export type DiscoverSection = 'overview' | 'prompts' | 'skills'

interface DiscoverSidebarProps {
  section: DiscoverSection
  focusId: string | null
  onSelectSection: (section: DiscoverSection) => void
  onSelectItem: (type: 'prompt' | 'skill', id: string) => void
}

export default function DiscoverSidebar({
  section,
  focusId,
  onSelectSection,
  onSelectItem,
}: DiscoverSidebarProps) {
  const { t } = useLocale()
  const prompts = getFeaturedPrompts()
  const skills = getFeaturedSkills()
  const showPrompts = section !== 'skills'
  const showSkills = section !== 'prompts'

  return (
    <div className="discover-sidebar">
      <p className="discover-lead">{t.sidebar.marketDesc}</p>

      {showPrompts && (
        <section className="discover-group">
          <button
            type="button"
            className={`discover-group-head ${section === 'prompts' ? 'active' : ''}`}
            onClick={() => onSelectSection('prompts')}
          >
            <FileText size={13} />
            <span>{t.sidebar.discoverPrompts}</span>
            <span className="discover-count">{prompts.length}</span>
          </button>
          <div className="discover-list">
            {prompts.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`discover-item ${focusId === item.id ? 'active' : ''}`}
                onClick={() => onSelectItem('prompt', item.id)}
                title={item.description}
              >
                <span className="discover-item-title">{item.title}</span>
                <span className="discover-item-meta">{item.category}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {showSkills && (
        <section className="discover-group">
          <button
            type="button"
            className={`discover-group-head ${section === 'skills' ? 'active' : ''}`}
            onClick={() => onSelectSection('skills')}
          >
            <Sparkles size={13} />
            <span>{t.sidebar.discoverSkills}</span>
            <span className="discover-count">{skills.length}</span>
          </button>
          <div className="discover-list">
            {skills.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`discover-item ${focusId === item.id ? 'active' : ''}`}
                onClick={() => onSelectItem('skill', item.id)}
                title={item.description}
              >
                <span className="discover-item-title">{item.name}</span>
                <span className="discover-item-meta">{item.category}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <style jsx>{`
        .discover-sidebar {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 8px 12px 16px;
          min-width: 0;
        }

        .discover-lead {
          margin: 2px 4px 0;
          font-size: 0.72rem;
          line-height: 1.45;
          color: var(--text-tertiary);
        }

        .discover-group {
          min-width: 0;
        }

        .discover-group-head {
          display: flex;
          align-items: center;
          gap: 6px;
          width: 100%;
          padding: 6px 8px;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.02em;
          cursor: pointer;
          border-radius: var(--radius-md);
        }

        .discover-group-head:hover,
        .discover-group-head.active {
          color: var(--accent-hover);
          background: var(--accent-muted);
        }

        .discover-count {
          margin-left: auto;
          font-size: 0.68rem;
          font-weight: 500;
          color: var(--text-tertiary);
        }

        .discover-list {
          display: flex;
          flex-direction: column;
          gap: 1px;
          margin-top: 2px;
        }

        .discover-item {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 1px;
          width: 100%;
          padding: 7px 10px 7px 22px;
          border: none;
          background: transparent;
          color: var(--text-primary);
          text-align: left;
          cursor: pointer;
          border-radius: var(--radius-md);
          min-width: 0;
        }

        .discover-item:hover {
          background: var(--bg-item-hover);
        }

        .discover-item.active {
          background: var(--accent-muted);
        }

        .discover-item-title {
          font-size: 0.78rem;
          font-weight: 500;
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 100%;
        }

        .discover-item.active .discover-item-title {
          color: var(--accent-color);
        }

        .discover-item-meta {
          font-size: 0.66rem;
          color: var(--text-tertiary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 100%;
        }
      `}</style>
    </div>
  )
}
