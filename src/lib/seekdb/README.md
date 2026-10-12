# SeekDB CRUD 功能说明

基于 SeekDB 的本地数据库存储，提供完整的增删改查功能。

## 架构说明

**重要：SeekDB 的核心实现已迁移到 Electron 主进程**

- **Electron 主进程** (`electron/main/seekdb/`): 包含 SeekDB 的核心实现（client, crud, config）
- **前端** (`src/lib/seekdb/`): 只包含 API 封装和类型定义，通过 IPC 与主进程通信

这种架构的优势：

- ✅ 数据库连接在主进程中管理，更安全
- ✅ 前端代码更轻量，不直接依赖 SeekDB
- ✅ 符合 Electron 最佳实践

## 功能特性

- ✅ 站点（Sites）的完整 CRUD 操作
- ✅ 组件（Components）的完整 CRUD 操作
- ✅ Prompt 的完整 CRUD 操作（支持版本管理）
- ✅ 向量搜索功能
- ✅ 批量操作支持
- ✅ TypeScript 类型支持
- ✅ Electron IPC 集成

## 安装依赖

```bash
pnpm install seekdb @seekdb/default-embed
```

## 配置

通过环境变量配置 SeekDB 连接：

```bash
SEEKDB_HOST=127.0.0.1
SEEKDB_PORT=2881
SEEKDB_TENANT=sys
SEEKDB_DATABASE=test
SEEKDB_USER=root
SEEKDB_PASSWORD=
```

或在代码中直接配置（见 `electron/main/seekdb/config.ts`）

## 使用示例

### 在 React 组件中使用

```typescript
import { siteAPI, componentAPI } from "@/lib/seekdb/api";

// 创建站点
await siteAPI.create({
  id: "site-1",
  name: "Framer Motion",
  description: "A production-ready motion library for React",
  url: "https://www.framer.com/motion/",
  category: ["animation", "react"],
  tags: ["motion", "framer"],
  framework: "React",
});

// 获取所有站点
const sites = await siteAPI.getAll();

// 搜索站点
const results = await siteAPI.search({
  queryTexts: ["React 动画"],
  nResults: 10,
});

// 更新站点
await siteAPI.update("site-1", {
  name: "Framer Motion Pro",
  featured: true,
});

// 删除站点
await siteAPI.delete("site-1");
```

### 在 Electron 主进程中使用

```typescript
// 在 electron/main/ipc.ts 或其他主进程文件中
import {
  createSite,
  getSite,
  updateSite,
  deleteSite,
  searchSites,
} from "./seekdb";

// 创建站点
await createSite({
  id: "site-1",
  name: "Framer Motion",
  description: "A production-ready motion library for React",
  url: "https://www.framer.com/motion/",
  category: ["animation", "react"],
  tags: ["motion", "framer"],
  framework: "React",
});

// 获取站点
const site = await getSite("site-1");

// 搜索站点
const results = await searchSites({
  queryTexts: ["React 动画"],
  nResults: 10,
});
```

## API 文档

### 站点 API (`siteAPI`)

- `create(input: CreateSiteInput)` - 创建单个站点
- `createBatch(inputs: CreateSiteInput[])` - 批量创建站点
- `get(id: string)` - 根据 ID 获取站点
- `getAll()` - 获取所有站点
- `update(id: string, input: UpdateSiteInput)` - 更新站点
- `delete(id: string)` - 删除站点
- `deleteBatch(ids: string[])` - 批量删除站点
- `search(options: QueryOptions)` - 搜索站点
- `count()` - 获取站点数量

### 组件 API (`componentAPI`)

- `create(input: CreateComponentInput)` - 创建单个组件
- `createBatch(inputs: CreateComponentInput[])` - 批量创建组件
- `get(id: string)` - 根据 ID 获取组件
- `getAll()` - 获取所有组件
- `getBySiteId(siteId: string)` - 根据站点 ID 获取组件
- `update(id: string, input: UpdateComponentInput)` - 更新组件
- `delete(id: string)` - 删除组件
- `deleteBatch(ids: string[])` - 批量删除组件
- `deleteBySiteId(siteId: string)` - 根据站点 ID 删除所有组件
- `search(options: QueryOptions)` - 搜索组件
- `count()` - 获取组件数量

## 类型定义

所有类型定义在 `src/lib/seekdb/types.ts` 中：

- `CreateSiteInput` - 创建站点输入
- `UpdateSiteInput` - 更新站点输入
- `CreateComponentInput` - 创建组件输入
- `UpdateComponentInput` - 更新组件输入
- `SiteMetadata` - 站点元数据
- `ComponentMetadata` - 组件元数据
- `QueryOptions` - 查询选项
- `QueryResult` - 查询结果

## 注意事项

1. **前端使用**：所有前端 API 调用必须在 Electron 环境中使用，通过 IPC 与主进程通信
2. **主进程使用**：主进程中的函数可以直接调用，无需通过 IPC（见 `electron/main/seekdb/`）
3. **类型定义**：类型定义在前端和主进程中共享，确保类型一致性
4. **集合创建**：集合会在首次使用时自动创建
5. **搜索功能**：基于向量相似度，支持语义搜索
6. **批量操作**：批量操作可以提高性能，建议在需要时使用

## 文件结构

```
electron/main/seekdb/     # SeekDB 核心实现（主进程）
├── config.ts             # 配置管理
├── client.ts             # 客户端管理
├── crud.ts               # CRUD 操作
├── types.ts              # 类型定义
└── index.ts              # 模块导出

src/lib/seekdb/           # 前端 API 封装
├── api.ts                # IPC API 封装（前端使用）
├── types.ts              # 类型定义（与主进程共享）
└── index.ts              # 模块导出
```
