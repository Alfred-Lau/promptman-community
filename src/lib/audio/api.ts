export interface ModelStatus {
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
}

export interface ModelProgress {
  status: "loading" | "ready" | "error";
  progress: number;
  message: string;
}

export interface TranscribeResult {
  success: boolean;
  data?: string;
  error?: string;
}

export interface ModelStatusResult {
  success: boolean;
  data?: ModelStatus;
  error?: string;
}

/**
 * 将音频 ArrayBuffer 发送给主进程进行语音转文字
 */
export async function transcribeAudio(
  buffer: ArrayBuffer
): Promise<TranscribeResult> {
  return window.electronAPI.invoke("audio:transcribe", buffer);
}

/**
 * 查询 Whisper 模型当前加载状态
 */
export async function getAudioModelStatus(): Promise<ModelStatusResult> {
  return window.electronAPI.invoke("audio:getModelStatus");
}

/**
 * 监听模型下载/加载进度事件
 * 返回取消监听的函数
 */
export function onModelProgress(
  callback: (progress: ModelProgress) => void
): () => void {
  const handler = (progress: ModelProgress) => callback(progress);
  window.electronAPI.on("audio:modelProgress", handler);
  return () => window.electronAPI.removeListener("audio:modelProgress", handler);
}
