"use client";

import { useState, useEffect } from "react";
import { siteAPI } from "@/lib/seekdb/api";
import type { SiteMetadata, GetResult } from "@/lib/seekdb/types";

interface SiteListProps {
  onSelectSite?: (siteId: string) => void;
  onEditSite?: (siteId: string) => void;
}

export default function SiteList({ onSelectSite, onEditSite }: SiteListProps) {
  const [sites, setSites] = useState<GetResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GetResult | null>(null);

  // 加载所有站点
  const loadSites = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await siteAPI.getAll();
      setSites(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载站点失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSites();
  }, []);

  // 搜索站点
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    try {
      setLoading(true);
      const results = await siteAPI.search({
        queryTexts: [searchQuery],
        nResults: 20,
        include: ["documents", "metadatas", "distances"],
      });

      // 转换搜索结果格式
      const formattedResults: GetResult = {
        ids: results.ids[0] || [],
        documents: results.documents?.[0] || [],
        metadatas: results.metadatas?.[0] || [],
      };
      setSearchResults(formattedResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : "搜索失败");
    } finally {
      setLoading(false);
    }
  };

  // 删除站点
  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这个站点吗？")) {
      return;
    }

    try {
      await siteAPI.delete(id);
      await loadSites();
      if (searchResults) {
        await handleSearch();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  };

  const displaySites = searchResults || sites;
  const sitesData = (displaySites?.metadatas as SiteMetadata[]) || [];

  return (
    <div className="site-list">
      <div className="site-list-header">
        <h2>站点列表</h2>
        <div className="search-box">
          <input
            type="text"
            placeholder="搜索站点..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            className="search-input"
          />
          <button onClick={handleSearch} className="btn btn-primary">
            搜索
          </button>
          {searchResults && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSearchResults(null);
              }}
              className="btn btn-secondary"
            >
              清除
            </button>
          )}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">加载中...</div>
      ) : sitesData.length === 0 ? (
        <div className="empty-state">
          {searchResults ? "未找到匹配的站点" : "暂无站点数据"}
        </div>
      ) : (
        <div className="sites-grid">
          {sitesData.map((site, index) => {
            const siteId = displaySites?.ids[index] || "";
            const categories = Array.isArray(site.category)
              ? site.category
              : [];
            const tags = Array.isArray(site.tags) ? site.tags : [];

            return (
              <div key={siteId} className="site-card">
                <div className="site-card-header">
                  <h3>{site.name}</h3>
                  {site.featured && (
                    <span className="badge featured">推荐</span>
                  )}
                </div>
                <p className="site-description">{site.description}</p>
                {site.framework && (
                  <div className="site-framework">
                    <span className="label">框架:</span>
                    <span className="value">{site.framework}</span>
                  </div>
                )}
                {categories.length > 0 && (
                  <div className="site-categories">
                    {categories.map((cat, i) => (
                      <span key={i} className="tag">
                        {cat}
                      </span>
                    ))}
                  </div>
                )}
                {tags.length > 0 && (
                  <div className="site-tags">
                    {tags.map((tag, i) => (
                      <span key={i} className="tag tag-small">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="site-card-actions">
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-link"
                  >
                    访问
                  </a>
                  {onSelectSite && (
                    <button
                      onClick={() => onSelectSite(siteId)}
                      className="btn btn-secondary"
                    >
                      查看组件
                    </button>
                  )}
                  {onEditSite && (
                    <button
                      onClick={() => onEditSite(siteId)}
                      className="btn btn-secondary"
                    >
                      编辑
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(siteId)}
                    className="btn btn-danger"
                  >
                    删除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .site-list {
          width: 100%;
        }

        .site-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .site-list-header h2 {
          margin: 0;
          font-size: 1.5rem;
          color: #111827;
        }

        .search-box {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .search-input {
          padding: 0.5rem 1rem;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          color: #111827;
          font-size: 1rem;
          min-width: 200px;
        }

        .search-input::placeholder {
          color: #9ca3af;
        }

        .search-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .sites-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }

        .site-card {
          border-radius: 0.75rem;
          padding: 1.5rem;
          border: 1px solid #e5e7eb;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1),
            0 1px 2px rgba(0, 0, 0, 0.06);
        }

        .site-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1),
            0 2px 4px rgba(0, 0, 0, 0.06);
          border-color: #d1d5db;
        }

        .site-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.75rem;
        }

        .site-card-header h3 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: #111827;
        }

        .badge {
          padding: 0.25rem 0.75rem;
          border-radius: 0.5rem;
          font-size: 0.75rem;
          font-weight: 600;
          border: 1px solid;
        }

        .badge.featured {
          border-color: #f59e0b;
          color: #f59e0b;
        }

        .site-description {
          margin: 0.75rem 0;
          color: #4b5563;
          line-height: 1.5;
          font-size: 0.9rem;
        }

        .site-framework {
          margin: 0.5rem 0;
          font-size: 0.85rem;
          color: #6b7280;
        }

        .site-categories,
        .site-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin: 0.75rem 0;
        }

        .tag {
          padding: 0.25rem 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid #d1d5db;
          font-size: 0.85rem;
          color: #6b7280;
        }

        .tag-small {
          font-size: 0.75rem;
          padding: 0.2rem 0.5rem;
        }

        .site-card-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
          flex-wrap: wrap;
        }

        .btn {
          padding: 0.5rem 1rem;
          border: 1px solid;
          border-radius: 0.5rem;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-primary {
          border-color: #3b82f6;
          color: #3b82f6;
        }

        .btn-primary:hover {
          border-color: #2563eb;
          color: #2563eb;
        }

        .btn-secondary {
          border-color: #d1d5db;
          color: #374151;
        }

        .btn-secondary:hover {
          border-color: #9ca3af;
          color: #111827;
        }

        .btn-danger {
          border-color: #ef4444;
          color: #ef4444;
        }

        .btn-danger:hover {
          border-color: #dc2626;
          color: #dc2626;
        }

        .btn-link {
          border: none;
          color: #3b82f6;
          text-decoration: underline;
          padding: 0.5rem 0;
        }

        .btn-link:hover {
          color: #2563eb;
        }

        .loading,
        .empty-state,
        .error-message {
          text-align: center;
          padding: 2rem;
          color: #6b7280;
        }

        .error-message {
          border: 1px solid #fca5a5;
          border-radius: 0.5rem;
          color: #dc2626;
          margin-bottom: 1rem;
        }
      `}</style>
    </div>
  );
}
