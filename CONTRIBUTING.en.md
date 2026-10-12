# Contributing

Thank you for your interest in PromptMan! This guide covers how to set up a local development environment, code conventions, and the release workflow.

> 中文版本：[CONTRIBUTING.md](./CONTRIBUTING.md)

## Development Setup

### Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0 (recommended via [Corepack](https://nodejs.org/api/corepack.html))

```bash
corepack enable
```

### Install & Run

```bash
# Clone the repository
git clone https://github.com/Alfred-Lau/promptman-community.git
cd kithub

# Install dependencies (auto-rebuilds native modules and installs git hooks)
pnpm install

# Start the development environment
pnpm dev
```

`pnpm dev` sequentially: compiles Electron TypeScript → starts the Next.js dev server (port 4001) → waits for it to be ready → launches the Electron window.

#### Split-terminal mode (recommended when editing main process code)

```bash
# Terminal 1: watch Electron source and auto-recompile on change
pnpm dev:watch

# Terminal 2: start the Next.js dev server
pnpm dev:next

# Terminal 3: launch Electron
pnpm dev:electron
```

### Useful Commands

```bash
pnpm dev                 # Full dev environment
pnpm build               # Production build (Next.js + Electron packaging)
pnpm build:electron:dir  # Compile Electron only (no packaging, fast iteration)
pnpm lint                # ESLint
pnpm type-check          # TypeScript type checking
pnpm clear-cache         # Clear ML model cache
```

## Architecture

### Three-Layer Electron Architecture

```
┌─────────────────────────────────────────┐
│           Renderer Process              │
│   Next.js App Router + React 19        │
│   src/  ──→ window.electronAPI (IPC)   │
└──────────────────┬──────────────────────┘
                   │ IPC (contextBridge)
┌──────────────────▼──────────────────────┐
│           Preload Script                │
│   electron/preload/index.ts            │
│   Exposes allowlisted APIs only        │
│   context isolation enabled            │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│           Main Process                  │
│   electron/main/                        │
│   - ipc.ts      100+ IPC handlers      │
│   - sqlitedb/   SQLite + vector search │
│   - auth.ts     OAuth authentication   │
│   - updater.ts  Auto-update            │
└─────────────────────────────────────────┘
```

### IPC Convention

```typescript
const result = await window.electronAPI.invoke('namespace:entity:action', ...args)
// Response shape: { success: boolean, data?: any, error?: string }
```

Channel naming examples: `seekdb:prompt:create`, `seekdb:agentSkill:list`, `app:getVersion`.

### Project Structure

```
kithub/
├── electron/
│   ├── main/              # Main process
│   │   ├── ipc.ts         # All IPC handlers (100+)
│   │   ├── sqlitedb/      # SQLite CRUD + vector search
│   │   ├── auth.ts        # OAuth authentication
│   │   ├── updater.ts     # Auto-update
│   │   └── prompthub/     # Cloud sync client
│   └── preload/index.ts   # Secure bridge layer
├── src/
│   ├── app/               # Next.js App Router
│   ├── components/        # UI components (List / Form pairs)
│   ├── lib/seekdb/        # Frontend API wrappers + type definitions
│   └── modules/auth/      # Auth module
├── scripts/               # Build / release scripts
├── docs/screenshots/      # README screenshot assets
├── .env.example           # Env template (never commit a real .env)
└── .github/workflows/     # CI / Release
```

## Code Style

- TypeScript with strict mode enabled
- Renderer ↔ main process communication **must** go through IPC — never bypass the preload script to access Node.js APIs directly
- IPC channel naming format: `namespace:entity:action`
- Run `pnpm lint` and `pnpm type-check` before pushing; both must pass

## Submitting a PR

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m 'feat: add some feature'`
4. Push the branch: `git push origin feat/your-feature`
5. Open a Pull Request

## Build & Release

### Local Build

```bash
pnpm build:mac            # macOS (requires Apple Developer certificate)
pnpm build:mac:unsigned   # macOS (skip code signing, for testing only)
pnpm build:win            # Windows (Coming Soon)
pnpm build:all            # All platforms (Coming Soon)
```

Copy the environment variable template and fill in the required values:

```bash
cp .env.example .env
```

### Publish to GitHub Releases

```bash
pnpm release:github:mac   # macOS
pnpm release:github:win   # Windows (Coming Soon)
pnpm release:github:all   # All platforms (Coming Soon)
```

### CI/CD Auto-Release

Push a version tag; GitHub Actions creates a GitHub Release **on this repository** and uploads artifacts:

```bash
git tag v1.2.3 && git push origin v1.2.3
```

Pull requests run `pnpm lint` and `pnpm type-check` (see `.github/workflows/ci.yml`).

Configure the following repository Secrets to enable code signing and notarization:

| Secret | Description |
|--------|-------------|
| `CSC_LINK` | Base64-encoded .p12 certificate (macOS) |
| `CSC_KEY_PASSWORD` | .p12 certificate password |
| `APPLE_ID` | Apple Developer account email |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for notarization |
| `APPLE_TEAM_ID` | Apple Developer Team ID |
| `WIN_CSC_LINK` | Base64-encoded .p12 certificate (Windows, optional) |
| `WIN_CSC_KEY_PASSWORD` | Windows certificate password (optional) |

> The older `promptman-releases` repo may remain as a historical mirror; new builds should use this repo’s Releases and the website download page.

### Code of conduct & security

- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- Report vulnerabilities privately via [SECURITY.md](./SECURITY.md) — do not file public issues for security bugs

## Troubleshooting

**Model fails to load (Protobuf parsing failed)**

```bash
pnpm clear-cache
```

**Electron window not reflecting main process changes**

Recompile the main process code:

```bash
pnpm dev:watch  # or restart pnpm dev
```

**Native module crash (better-sqlite3 / onnxruntime-node)**

```bash
pnpm install  # postinstall automatically rebuilds native modules
```
