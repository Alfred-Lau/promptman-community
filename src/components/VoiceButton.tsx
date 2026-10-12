'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, MicOff, Loader2 } from 'lucide-react'
import { transcribeAudio, onModelProgress } from '@/lib/audio/api'
import type { ModelProgress } from '@/lib/audio/api'

/** 全局关闭语音输入（麦克风录音 + 转写）。改为 `true` 可恢复。 */
export const VOICE_INPUT_ENABLED = false

interface VoiceButtonProps {
  /** 转写完成后的回调，接收识别文本 */
  onTranscribed: (text: string) => void
  /** 追加到现有内容还是替换 */
  mode?: 'append' | 'replace'
  /** 是否禁用 */
  disabled?: boolean
  className?: string
}

type ButtonState = 'idle' | 'recording' | 'transcribing' | 'model-loading'

export default function VoiceButton(props: VoiceButtonProps) {
  if (!VOICE_INPUT_ENABLED) {
    return null
  }
  return <VoiceButtonInner {...props} />
}

function VoiceButtonInner({
  onTranscribed,
  mode = 'append',
  disabled = false,
  className = '',
}: VoiceButtonProps) {
  const [state, setState] = useState<ButtonState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [modelProgress, setModelProgress] = useState<ModelProgress | null>(null)
  const [recordingSeconds, setRecordingSeconds] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // 监听模型下载进度（全局事件）
  useEffect(() => {
    const unsubscribe = onModelProgress((progress) => {
      setModelProgress(progress)
      if (progress.status === 'ready') {
        // 模型加载完成后短暂显示再清除
        setTimeout(() => setModelProgress(null), 2000)
      }
    })
    return unsubscribe
  }, [])

  const startTimer = useCallback(() => {
    setRecordingSeconds(0)
    timerRef.current = setInterval(() => {
      setRecordingSeconds((s) => s + 1)
    }, 1000)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    stopTimer()
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [stopTimer])

  // 组件卸载时清理资源
  useEffect(() => {
    return () => {
      stopRecording()
    }
  }, [stopRecording])

  const handleClick = async () => {
    if (disabled) return
    setError(null)

    if (state === 'recording') {
      stopRecording()
      return
    }

    if (state !== 'idle') return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      recorder.onstop = async () => {
        setState('transcribing')
        try {
          const blob = new Blob(chunksRef.current, { type: mimeType })
          const arrayBuffer = await blob.arrayBuffer()

          const result = await transcribeAudio(arrayBuffer)

          if (result.success && result.data) {
            onTranscribed(result.data)
          } else {
            const errMsg = result.error || '识别失败'
            // 模型加载中给出特别提示
            if (errMsg.includes('loading') || errMsg.includes('初始化')) {
              setState('model-loading')
              setError('模型正在加载中，请稍后再试')
            } else {
              setError(errMsg)
            }
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : '语音识别出错')
        } finally {
          setState('idle')
        }
      }

      recorder.start(100)
      setState('recording')
      startTimer()
    } catch (err) {
      setState('idle')
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('麦克风权限被拒绝，请在系统设置中允许访问麦克风')
      } else {
        setError(err instanceof Error ? err.message : '无法访问麦克风')
      }
    }
  }

  const formatSeconds = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const isRecording = state === 'recording'
  const isTranscribing = state === 'transcribing'
  const isModelLoading = state === 'model-loading'
  const isBusy = isTranscribing || isModelLoading

  return (
    <span className={`voice-button-wrap ${className}`}>
      <button
        type="button"
        className={`voice-btn ${isRecording ? 'recording' : ''} ${isBusy ? 'busy' : ''}`}
        onClick={handleClick}
        disabled={disabled || isBusy}
        title={
          isRecording
            ? `录音中 ${formatSeconds(recordingSeconds)}，点击停止`
            : isTranscribing
            ? '正在识别...'
            : mode === 'append'
            ? '点击开始录音（追加到末尾）'
            : '点击开始录音（替换内容）'
        }
        aria-label={isRecording ? '停止录音' : '开始语音输入'}
      >
        {isTranscribing || isModelLoading ? (
          <Loader2 size={14} className="spin" />
        ) : isRecording ? (
          <MicOff size={14} />
        ) : (
          <Mic size={14} />
        )}
        {isRecording && (
          <span className="rec-timer">{formatSeconds(recordingSeconds)}</span>
        )}
      </button>

      {/* 模型下载进度浮层 */}
      {modelProgress && modelProgress.status === 'loading' && (
        <span className="model-progress-tip">
          <span className="progress-bar">
            <span
              className="progress-fill"
              style={{ width: `${modelProgress.progress}%` }}
            />
          </span>
          <span className="progress-text">{modelProgress.message}</span>
        </span>
      )}

      {/* 错误提示 */}
      {error && (
        <span className="voice-error" role="alert">
          {error}
          <button
            type="button"
            className="voice-error-close"
            onClick={() => setError(null)}
            aria-label="关闭错误提示"
          >
            ×
          </button>
        </span>
      )}

      <style jsx>{`
        .voice-button-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
          flex-shrink: 0;
        }

        .voice-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 5px 8px;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          background: transparent;
          color: var(--text-tertiary);
          cursor: pointer;
          font-size: 0.75rem;
          font-weight: 500;
          transition: all var(--transition-fast);
          white-space: nowrap;
          line-height: 1;
        }

        .voice-btn:hover:not(:disabled) {
          color: var(--accent-color);
          border-color: var(--accent-color);
          background: var(--bg-item-hover);
        }

        .voice-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .voice-btn.recording {
          color: #ef4444;
          border-color: #ef4444;
          background: rgba(239, 68, 68, 0.08);
          animation: pulse-border 1.2s ease-in-out infinite;
        }

        .voice-btn.busy {
          color: var(--accent-color);
          border-color: var(--accent-color);
        }

        .rec-timer {
          font-variant-numeric: tabular-nums;
          font-size: 0.72rem;
        }

        .model-progress-tip {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          min-width: 220px;
          background: var(--bg-elevated, var(--bg-glass));
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 8px 10px;
          z-index: 100;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .progress-bar {
          display: block;
          height: 3px;
          background: var(--border-color);
          border-radius: 2px;
          overflow: hidden;
        }

        .progress-fill {
          display: block;
          height: 100%;
          background: var(--accent-color);
          border-radius: 2px;
          transition: width 0.3s ease;
        }

        .progress-text {
          font-size: 0.72rem;
          color: var(--text-tertiary);
          line-height: 1.3;
        }

        .voice-error {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          min-width: 200px;
          max-width: 300px;
          background: var(--bg-elevated, var(--bg-glass));
          border: 1px solid rgba(239, 68, 68, 0.4);
          border-radius: var(--radius-md);
          padding: 7px 28px 7px 10px;
          font-size: 0.75rem;
          color: #ef4444;
          z-index: 100;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
          line-height: 1.4;
        }

        .voice-error-close {
          position: absolute;
          top: 4px;
          right: 6px;
          background: none;
          border: none;
          color: #ef4444;
          cursor: pointer;
          font-size: 0.9rem;
          line-height: 1;
          padding: 2px;
          opacity: 0.7;
        }

        .voice-error-close:hover {
          opacity: 1;
        }

        :global(.spin) {
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes pulse-border {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.3); }
          50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
        }
      `}</style>
    </span>
  )
}
