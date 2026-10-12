'use client'

import { HardDrive, Cloud, CloudOff } from 'lucide-react'

interface StorageStatusBadgeProps {
  /** 是否存在于云端（cloudId 非空） */
  isCloud: boolean
  /** 是否正在上传 */
  uploading?: boolean
  /** 紧凑模式（侧边栏用） */
  compact?: boolean
}

/**
 * 存储状态徽章：显示 local / cloud 状态图标
 * - 本地：HardDrive 图标（始终显示，因为记录一定在本地）
 * - 云端：Cloud 图标（绿色，表示已同步）
 * - 未云端：CloudOff 图标（灰色，表示仅本地）
 */
export default function StorageStatusBadge({
  isCloud,
  uploading = false,
  compact = false,
}: StorageStatusBadgeProps) {
  const size = compact ? 11 : 13

  return (
    <span className={`storage-badge ${compact ? 'compact' : ''}`}>
      <span className="badge-local" title="本地存储">
        <HardDrive size={size} />
      </span>
      <span
        className={`badge-cloud ${isCloud ? 'synced' : 'unsynced'} ${uploading ? 'uploading' : ''}`}
        title={isCloud ? '已同步到云端' : '仅本地存储'}
      >
        {isCloud ? <Cloud size={size} /> : <CloudOff size={size} />}
      </span>

      <style jsx>{`
        .storage-badge {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          flex-shrink: 0;
        }

        .badge-local {
          display: flex;
          align-items: center;
          color: var(--text-tertiary);
          opacity: 0.7;
        }

        .badge-cloud {
          display: flex;
          align-items: center;
          transition: all 0.2s ease;
        }

        .badge-cloud.synced {
          color: var(--success-color, #22c55e);
        }

        .badge-cloud.unsynced {
          color: var(--text-tertiary);
          opacity: 0.45;
        }

        .badge-cloud.uploading {
          animation: pulse-upload 0.8s ease-in-out infinite;
          color: var(--accent-color);
          opacity: 1;
        }

        @keyframes pulse-upload {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.15); }
        }
      `}</style>
    </span>
  )
}
