import { BrowserWindow } from "electron";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { getDataRoot } from "./dataPaths";

type WhisperPipeline = (
  audio: Float32Array,
  options?: { language?: string; task?: string }
) => Promise<{ text: string }>;

let whisperPipeline: WhisperPipeline | null = null;
let isLoading = false;
let modelStatus: "idle" | "loading" | "ready" | "error" = "idle";
let modelError: string | null = null;

function getModelCacheDir(): string {
  const cacheDir = join(getDataRoot(), "models");
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }
  return cacheDir;
}

function broadcastProgress(event: string, data: unknown): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send(event, data);
    }
  }
}

export async function getWhisperPipeline(): Promise<WhisperPipeline> {
  if (whisperPipeline) return whisperPipeline;

  if (isLoading) {
    // 等待加载完成
    return new Promise((resolve, reject) => {
      const check = setInterval(() => {
        if (whisperPipeline) {
          clearInterval(check);
          resolve(whisperPipeline);
        } else if (modelStatus === "error") {
          clearInterval(check);
          reject(new Error(modelError || "模型加载失败"));
        }
      }, 200);
    });
  }

  isLoading = true;
  modelStatus = "loading";
  modelError = null;

  broadcastProgress("audio:modelProgress", {
    status: "loading",
    progress: 0,
    message: "正在初始化语音识别模型...",
  });

  try {
    const cacheDir = getModelCacheDir();

    // 动态导入 @huggingface/transformers，避免影响启动时间
    const { pipeline, env } = await import("@huggingface/transformers");

    // 配置缓存目录
    env.cacheDir = cacheDir;
    env.localModelPath = cacheDir;

    broadcastProgress("audio:modelProgress", {
      status: "loading",
      progress: 10,
      message: "正在下载语音识别模型（约 145MB）...",
    });

    const pipe = await pipeline(
      "automatic-speech-recognition",
      "Xenova/whisper-base",
      {
        progress_callback: (progressInfo: {
          status?: string;
          progress?: number;
          name?: string;
          loaded?: number;
          total?: number;
        }) => {
          if (progressInfo.status === "progress" || progressInfo.status === "downloading") {
            const pct = progressInfo.progress ?? 0;
            broadcastProgress("audio:modelProgress", {
              status: "loading",
              progress: Math.round(10 + pct * 0.85),
              message: `正在下载模型: ${Math.round(pct)}%`,
            });
          } else if (progressInfo.status === "initiate") {
            broadcastProgress("audio:modelProgress", {
              status: "loading",
              progress: 10,
              message: `初始化: ${progressInfo.name ?? ""}`,
            });
          } else if (progressInfo.status === "done") {
            broadcastProgress("audio:modelProgress", {
              status: "loading",
              progress: 95,
              message: "模型加载完成，正在准备...",
            });
          }
        },
      }
    );

    whisperPipeline = pipe as unknown as WhisperPipeline;
    modelStatus = "ready";
    isLoading = false;

    broadcastProgress("audio:modelProgress", {
      status: "ready",
      progress: 100,
      message: "语音识别模型已就绪",
    });

    return whisperPipeline;
  } catch (error) {
    modelStatus = "error";
    isLoading = false;
    modelError = error instanceof Error ? error.message : "未知错误";

    broadcastProgress("audio:modelProgress", {
      status: "error",
      progress: 0,
      message: `模型加载失败: ${modelError}`,
    });

    throw error;
  }
}

export function getModelStatus(): {
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
} {
  return { status: modelStatus, error: modelError };
}

export async function transcribeAudio(audioBuffer: ArrayBuffer): Promise<string> {
  const pipe = await getWhisperPipeline();
  const float32 = new Float32Array(audioBuffer);

  const result = await pipe(float32, {
    language: "zh",
    task: "transcribe",
  });

  return result.text.trim();
}
