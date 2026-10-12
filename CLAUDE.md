# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PromptMan is a local prompt management desktop application built with Electron + Next.js. It manages prompts, agent skills, sub-agents, and agent teams with version control and semantic search via SeekDB.

## Development Commands

```bash
pnpm dev              # Full dev environment (compiles Electron, starts Next.js on port 3001, launches Electron)
pnpm dev:next         # Next.js dev server only (port 3001)
pnpm dev:electron     # Electron only (requires Next.js running)
pnpm dev:watch        # Watch Electron code for auto-recompile (run in separate terminal)
pnpm build            # Full production build (Next.js + Electron packaging)
pnpm build:next       # Build Next.js only
pnpm build:electron:dir  # Build Electron without packaging (faster for testing)
pnpm lint             # ESLint
pnpm type-check       # TypeScript validation (no test framework configured)
pnpm clear-cache      # Clear ML model cache (fixes Protobuf parsing errors)
```

**Important**: Modifying Electron main process code (`electron/main/`, `electron/preload/`) requires recompilation — either run `pnpm dev:watch` or restart `pnpm dev`.

## Architecture

### Three-Layer Electron Architecture

1. **Main Process** (`electron/main/`) — App lifecycle, window management, IPC handlers, SeekDB access, OAuth authentication
2. **Preload Script** (`electron/preload/`) — Security bridge with context isolation; exposes `window.electronAPI` to renderer
3. **Renderer** (`src/`) — Next.js App Router with React 19, communicates with main process exclusively via IPC

### IPC Communication Pattern

All renderer-to-main communication uses:
```typescript
const result = await window.electronAPI.invoke('namespace:entity:action', ...args)
// Returns: { success: boolean, data?: any, error?: string }
```

Channel naming convention: `seekdb:prompt:create`, `seekdb:agentSkill:list`, `app:getVersion`, etc. Handlers are registered in `electron/main/ipc.ts`.

### Data Entities

All entities support CRUD, version control, and semantic search through SeekDB:
- **Prompts** — Prompt templates with version history (`promptId` groups versions)
- **Agent Skills** — Skill definitions with versions
- **SubAgents** — Sub-agent configurations with versions
- **Agent Teams** — Team collaboration configs with versions

Version control pattern: each entity has a shared group ID across versions, a unique `id` per version, a `version` number, and an `isCurrentVersion` flag.

### Key Code Locations

- `electron/main/ipc.ts` — All IPC handlers (100+), the central routing layer
- `electron/main/seekdb/` — SeekDB CRUD operations for each entity
- `src/lib/seekdb/types.ts` — Core TypeScript type definitions for all entities
- `src/lib/seekdb/api.ts` — Frontend API wrappers that call IPC handlers
- `src/app/page.tsx` — Main dashboard with tab-based navigation and ViewMode state machine (20+ modes)
- `src/modules/auth/` — Multi-provider auth module (GitHub OAuth, Google OAuth, email/password)

### Component Patterns

Components in `src/components/` follow paired patterns:
- **List components** (`PromptList.tsx`, `AgentSkillList.tsx`, etc.) — Display and manage collections
- **Form components** (`PromptForm.tsx`, `AgentSkillForm.tsx`, etc.) — Handle create/edit
- **Version list components** — Manage version history for entities

### Security Model

- Context isolation enabled, Node integration disabled
- Preload script is the only bridge — never bypass IPC to access Node.js APIs from renderer
- OAuth uses device flow (GitHub) and PKCE (Google)

## Tech Stack

- **pnpm** (pinned via Corepack) — package manager
- **Electron** ^39 / **Next.js** ^16 (App Router, standalone mode) / **React** ^19 / **TypeScript** ^5
- **SeekDB** — Local vector database with semantic search via ONNX embeddings
- **lucide-react** — Icons
- **electron-builder** — Cross-platform packaging (macOS DMG/ZIP, Windows NSIS, Linux AppImage/DEB)

## TypeScript Configuration

Two separate tsconfig files:
- `tsconfig.json` — Next.js/React code
- `electron/tsconfig.json` — Electron code (ES2020, CommonJS, no React types)

Both use strict mode.
