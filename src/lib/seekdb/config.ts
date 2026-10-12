/**
 * SeekDB 配置
 */
export interface SeekDBConfig {
  host: string;
  port: number;
  tenant: string;
  database: string;
  user: string;
  password: string;
}

/**
 * 从环境变量获取 SeekDB 配置
 */
export function getSeekDBConfig(): SeekDBConfig {
  return {
    host: process.env.SEEKDB_HOST || "127.0.0.1",
    port: parseInt(process.env.SEEKDB_PORT || "2881"),
    tenant: process.env.SEEKDB_TENANT || "sys",
    database: process.env.SEEKDB_DATABASE || "test",
    user: process.env.SEEKDB_USER || "root",
    password: process.env.SEEKDB_PASSWORD || "",
  };
}

