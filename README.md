# RDgit

Git branch management and GitHub PR tooling -- as a Cursor/VS Code extension and a standalone web dashboard.

## Repository structure

This is a pnpm-workspaces monorepo:

```
robdev-cursor-git/
├── apps/
│   ├── extension/          # rd-git — Cursor/VS Code extension app
│   └── web/                # @rd-git/web — Standalone Vite React SPA (PO dashboard)
├── packages/
│   ├── shared/             # @rd-git/shared — GitHub API client, types, PR-to-issue linking
│   ├── ui/                 # @rd-git/ui — Shared React components (Button, Card, Tabs, etc.)
├── package.json            # Workspace root (orchestration only)
└── tsconfig.base.json      # Shared TypeScript config
```

### `rd-git` (`apps/extension/`)

The Cursor/VS Code extension lives under `apps/extension/`. It provides two sidebar webviews:

- **RDgit** — Recent branches, one-click switching, pull/push/merge/split via terminal.
- **RDgithub** — Open pull requests, create drafts, merge, mark ready/draft.

It also registers the **RD Git: Open PR Dashboard** command, which opens the dashboard in a full-width editor tab.

### `@rd-git/shared` (`packages/shared/`)

Platform-agnostic GitHub API client and domain types. No VS Code dependency. Used by both the extension and the web dashboard.

- `GitHubClient` — Auth-agnostic REST/GraphQL client (takes a token string).
- `pulls.ts` — List, detail, merge, create draft, mark ready/draft, comments, reviews.
- `issues.ts` — Issue detail, comments, filtered timeline (strips noise events and bot comments).
- `linking.ts` — Configurable PR-to-issue linking (GitHub closing refs, branch pattern, PR body pattern, custom regex).

### `@rd-git/ui` (`packages/ui/`)

Shared React + Radix UI components used by both the extension webview and the web dashboard.

### `@rd-git/web` (`apps/web/`)

Standalone Vite React SPA for the PO/product manager dashboard. Shows PRs with linked issues, filtered comment timelines, review threads, and approval status. Authenticates via GitHub OAuth Device Flow (no server required).

## Getting started

### Prerequisites

- Node.js 20+
- pnpm 10+

### Install

```bash
corepack enable
pnpm install
```

This installs dependencies for all workspace packages.

### Build everything

```bash
# Build all workspaces (extension + shared + web)
pnpm run build

# Or build individually:
pnpm run build:extension
pnpm run build:shared
pnpm run build:web
```

## Extension development

### Launch in development

1. Open this repo in Cursor/VS Code.
2. Press `F5` to launch the Extension Development Host.

### Build the extension

```bash
pnpm run build:extension
```

This runs `typecheck:webview` → `build:webview` (esbuild + Tailwind) → `tsc`.

### Package as VSIX

```bash
pnpm run package:extension
```

### Quick iteration loop

```bash
pnpm run dev:extension:local
```

Builds, packages, force-installs the VSIX into Cursor, and reloads the window (macOS).

## Web dashboard development

### Start the dev server

```bash
pnpm run dev:web
```

Opens at `http://localhost:5173`. Hot-reloads on save.

### GitHub authentication

The web dashboard uses GitHub OAuth Device Flow. You need a GitHub OAuth App:

1. Go to GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.
2. Set the callback URL to `http://localhost` (not used by device flow, but required by GitHub).
3. Copy the Client ID.
4. Create `apps/web/.env`:

```
VITE_GITHUB_CLIENT_ID=your_client_id_here
```

### Build for production

```bash
pnpm --filter @rd-git/web run build
```

Output goes to `apps/web/dist/`. Deploy as static files to any host (GitHub Pages, Vercel, Netlify, etc.).

### Typecheck

```bash
pnpm --filter @rd-git/web run typecheck
```

## Extension command templates

You can customize terminal commands in Settings:

| Setting | Default | Placeholders |
|---|---|---|
| `rd-git.gitCommands.switchBranch` | `git checkout {{targetBranch}}` | `{{targetBranch}}` |
| `rd-git.gitCommands.pullFromOrigin` | `git pull` | `{{targetBranch}}` |
| `rd-git.gitCommands.pushToOrigin` | `git push -u origin {{targetBranch}}` | `{{targetBranch}}` |
| `rd-git.gitCommands.mergeFromBase` | `git merge {{baseBranch}}` | `{{baseBranch}}`, `{{targetBranch}}` |
| `rd-git.gitCommands.splitBranch` | `git checkout -b {{newBranch}} {{targetBranch}}` | `{{targetBranch}}`, `{{newBranch}}` |

Reset any setting to its default via the Settings UI → **Reset Setting**.

## Lessons learned

Repository-specific notes live under `lessons-learned/`.

- `lessons-learned/api-first-terminal-fallback.md`: API-first decision rule for Git/PR actions.
