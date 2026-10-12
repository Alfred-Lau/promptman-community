/**
 * 本地 ONNX Embedding 生成器
 * 使用 @huggingface/transformers 的 feature-extraction pipeline
 * 模型：Xenova/all-MiniLM-L6-v2（384维，约 23MB）
 */
import { join } from "path";
import { mkdirSync } from "fs";
import { getDataRoot } from "../dataPaths";

// feature-extraction pipeline 类型
type EmbedPipeline = (
  text: string | string[],
  options?: { pooling?: string; normalize?: boolean }
) => Promise<{ data: Float32Array; dims: number[] }>;

let embedPipeline: EmbedPipeline | null = null;
let isLoading = false;
let loadError: Error | null = null;

const EMBED_MODEL = "Xenova/all-MiniLM-L6-v2";
const EMBED_DIM = 384;

function getModelCacheDir(): string {
  const cacheDir = join(getDataRoot(), "models");
  mkdirSync(cacheDir, { recursive: true });
  return cacheDir;
}

/**
 * 懒加载 embedding pipeline
 */
async function getEmbedPipeline(): Promise<EmbedPipeline> {
  if (embedPipeline) return embedPipeline;

  if (isLoading) {
    // 等待加载完成
    return new Promise((resolve, reject) => {
      const check = setInterval(() => {
        if (embedPipeline) {
          clearInterval(check);
          resolve(embedPipeline);
        } else if (loadError) {
          clearInterval(check);
          reject(loadError);
        }
      }, 100);
    });
  }

  isLoading = true;
  loadError = null;

  try {
    const cacheDir = getModelCacheDir();

    const { pipeline, env } = await import("@huggingface/transformers");

    // 配置缓存目录
    env.cacheDir = cacheDir;
    env.localModelPath = cacheDir;

    console.log("[Embedder] Loading embedding model:", EMBED_MODEL);

    const pipe = await pipeline("feature-extraction", EMBED_MODEL, {
      progress_callback: (info: { status?: string; progress?: number }) => {
        if (info.status === "progress") {
          console.log(`[Embedder] Loading model: ${Math.round(info.progress ?? 0)}%`);
        }
      },
    });

    embedPipeline = pipe as unknown as EmbedPipeline;
    console.log("[Embedder] Embedding model loaded successfully");
    isLoading = false;
    return embedPipeline;
  } catch (err) {
    loadError = err instanceof Error ? err : new Error(String(err));
    isLoading = false;
    console.error("[Embedder] Failed to load embedding model:", loadError);
    throw loadError;
  }
}

/**
 * 生成单条文本的 embedding 向量
 * @returns Float32Array(384)
 */
export async function embed(text: string): Promise<Float32Array> {
  const pipe = await getEmbedPipeline();
  const output = await pipe(text, { pooling: "mean", normalize: true });
  return new Float32Array(output.data.buffer, output.data.byteOffset, EMBED_DIM);
}

/**
 * 批量生成 embedding 向量
 * @returns Float32Array[] 每个元素长度为 384
 */
export async function embedBatch(texts: string[]): Promise<Float32Array[]> {
  if (texts.length === 0) return [];
  // 逐条处理以复用同一 pipeline 实例
  const results: Float32Array[] = [];
  for (const text of texts) {
    results.push(await embed(text));
  }
  return results;
}

/**
 * 将 Float32Array 序列化为 Buffer（用于存入 SQLite BLOB）
 */
export function vecToBuffer(vec: Float32Array): Buffer {
  return Buffer.from(vec.buffer);
}

/**
 * 将 SQLite BLOB（Buffer）反序列化为 Float32Array
 */
export function bufferToVec(buf: Buffer): Float32Array {
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

/**
 * 获取 embedding 维度
 */
export const EMBED_DIMENSION = EMBED_DIM;
