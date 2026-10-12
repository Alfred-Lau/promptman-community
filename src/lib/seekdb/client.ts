/**
 * SeekDB 客户端管理
 */
import "@seekdb/default-embed";
import { SeekDBClient } from "seekdb";
import { getSeekDBConfig, SeekDBConfig } from "./config";

let clientInstance: SeekDBClient | null = null;
let initializationError: Error | null = null;

/**
 * 获取或创建 SeekDB 客户端实例（单例模式）
 */
export function getSeekDBClient(config?: SeekDBConfig): SeekDBClient {
  if (!clientInstance) {
    try {
      const dbConfig = config || getSeekDBConfig();
      clientInstance = new SeekDBClient(dbConfig);
      initializationError = null;
    } catch (error) {
      initializationError = error instanceof Error ? error : new Error(String(error));
      throw new Error(
        `SeekDB 客户端初始化失败: ${initializationError.message}\n` +
        `如果遇到模型加载错误，请运行: pnpm clear-cache`
      );
    }
  }
  return clientInstance;
}

/**
 * 获取初始化错误（如果有）
 */
export function getInitializationError(): Error | null {
  return initializationError;
}

/**
 * 关闭 SeekDB 客户端连接
 */
export async function closeSeekDBClient(): Promise<void> {
  if (clientInstance) {
    await clientInstance.close();
    clientInstance = null;
  }
}

/**
 * 重置客户端实例（用于测试或重新连接）
 */
export function resetSeekDBClient(): void {
  clientInstance = null;
}

