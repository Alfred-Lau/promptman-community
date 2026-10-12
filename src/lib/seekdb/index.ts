/**
 * SeekDB 模块导出（前端）
 * 
 * 注意：SeekDB 的核心实现（client, crud, config）已迁移到 electron 主进程
 * 前端只通过 IPC 调用，因此这里只导出 API 和类型定义
 */
export * from "./types";
export * from "./api";

