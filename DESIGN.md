# Condor dashboard redesign

Handoff doc for the web dashboard UI. Read this before changing the interface. Several agents will work on this over time (a Designer agent first, later Claude Code or others), plus human comments on pull requests. Update this file when a goal, principle, or decision is settled.

This fork redesigns the **web dashboard** only. The Telegram bot is out of scope unless a UI change forces a shared contract.

## 1. Goal

Redesign the Condor dashboard so it is clearer and easier to use for traders.

**Goals and audience — TBD.** The team fills this in: who the primary reader is, which jobs the dashboard must make fast (watch positions, place or adjust a trade, see what an agent did, stop something), and what "clearer" means in practice. Do not invent goals here.

## 2. Workflow

- `main` stays untouched.
- `ui-redesign` is the integration branch. It was cut from upstream [hummingbot/condor](https://github.com/hummingbot/condor) `97d9261` (`97d9261a`, "Merge pull request #344 from hummingbot/review/system-audit-2026-11"), the version running in production.
- One short-lived branch per change, named `ui/<area>`, with a pull request into `ui-redesign`.
- Every PR includes before/after screenshots and a short note on what changed and why.
- Team feedback goes in PR comments.
- Keep PRs small.
- Never commit secrets, local config (`conf/`), `state/`, or box-specific scripts.

**Preview.** The maintainer deploys a PR branch to a preview Condor, separate from production, with agents and trading disabled, so the team can try the change before merge.

## 3. Current UI map

Recorded from the tree at `97d9261`. Paths below are in this repo.

### Stack

| Piece | Where |
| --- | --- |
| App | React 19 + TypeScript, React Router 7. Entry: `frontend/index.html` → `frontend/src/main.tsx` → `frontend/src/App.tsx`. |
| Build | Vite 8 (`frontend/vite.config.ts`, `@vitejs/plugin-react`). Path alias `@` → `frontend/src`. Package manager: npm (`frontend/package-lock.json`). CI uses Node 22 (`.github/workflows/ci.yml`, job `frontend-build`). |
| Server state | TanStack Query. Client: `frontend/src/lib/queryClient.ts`. |
| HTTP | `frontend/src/lib/api.ts` (`apiFetch` / the `api` object) calls `/api/v1/...` with the session token from `frontend/src/lib/auth-token.ts`. Auth state: `frontend/src/lib/auth.ts`. |
| Live data | Multiplexed socket `GET`-style WebSocket `/api/v1/ws` (`frontend/src/lib/websocket.ts`, `condor/web/routes/ws.py`). Chat socket `/api/v1/ws/chat` (`frontend/src/hooks/useChatSocket.ts`, `condor/web/routes/chat_ws.py`). |
| Icons | `lucide-react`. |
| Charts | `lightweight-charts` (trade/candle charts) and `recharts` (some PnL/summary charts). |
| Editors | CodeMirror (`frontend/src/components/editor/`). Markdown via `react-markdown`. |
| Tests | Vitest. `cd frontend && npm test`. Component tests opt into jsdom per file. |

### How the browser reaches the API

`condor/web/app.py` (`create_app`) mounts every router in `condor/web/routes/` under `/api/v1`, then, when `frontend/dist` exists, serves that build. Unknown non-API paths fall back to `frontend/dist/index.html`. Default dashboard port is `WEB_PORT` **8088**.

Route modules (each file is the backend for one area of the UI):

`admin.py`, `agents.py` (also `hub_router` at `/api/v1/hub`), `archived.py`, `auth.py`, `backtesting.py`, `bots.py`, `chat_ws.py`, `code.py`, `confirmations.py`, `controller_performance.py`, `conversations.py`, `dex.py`, `executors.py`, `market.py`, `meta.py`, `notifications.py`, `portfolio.py`, `positions.py`, `push.py`, `reports.py`, `routines.py`, `servers.py`, `sessions.py`, `settings.py`, `sharing.py`, `transcribe.py`, `updates.py`, `ws.py`.

The selected Hummingbot server is held in React context (`frontend/src/App.tsx`, `ServerProvider`) and stored in `localStorage`. Most trading calls put that server name in the path, for example `/api/v1/servers/{server}/portfolio`.

### Run the frontend locally

**Built dashboard (what production and `make run` serve).** From the repo root, with the API up:

```bash
make build-frontend    # npm ci when the lockfile changed, then vite build into frontend/dist
make run               # builds the frontend, then starts Condor; dashboard at http://localhost:8088
```

`uv run python main.py` starts the same process without the Makefile's build step. The page at `:8088` is the last build in `frontend/dist`, not a live reload.

**Dev server with reload.** Leave the API on port 8088, then:

```bash
cd frontend
npm ci
npm run dev            # Vite, http://localhost:5173
```

`frontend/vite.config.ts` proxies `/api` to `http://localhost:8088` and `/ws` to `ws://localhost:8088`. `condor/web/app.py` allows CORS from `http://localhost:5173` and `http://127.0.0.1:5173`. Open **5173** while changing UI; open **8088** to check the built bundle.

Other scripts in `frontend/package.json`: `npm run build`, `npm run lint`, `npm test`.

### Shell and navigation

`frontend/src/components/layout/AppShell.tsx` is the logged-in frame: top bar, page outlet, relaunch banner, telemetry consent, connect-keys overlay, issue report, and a chat bubble on every page except `/`.

Top nav is `NAV_ITEMS` in `frontend/src/lib/nav.ts`:

| Label | Path |
| --- | --- |
| Agents | `/` |
| Portfolio | `/portfolio` |
| Trade | `/trade` |
| DEX | `/dex` |
| Bots | `/bots` |
| Routines | `/routines` |
| Settings | `/settings` |

The bar also has the server selector, Gateway indicator, currency selector, notification bell, issue report, and a light/dark toggle (`frontend/src/hooks/useTheme.ts`). Full-bleed routes (no page padding): `/`, `/hub`, `/bots`, `/routines`, and `/agents/:slug`.

### Pages (`frontend/src/pages/`, routes in `frontend/src/App.tsx`)

| Path | Page | What it is |
| --- | --- | --- |
| `/login` | `Login.tsx` | Token login (`?token=`) or local-mode login. Outside the shell. |
| `/` | `Agents.tsx` | Home. Renders the agent conversation (`pages/tabs/AgentChatTab.tsx`). |
| `/hub` | `Agents.tsx` | Same workspace with the transcript column swapped for the Botcamp catalogue. No nav item; opened from the chat rail. |
| `/agents/:slug` | `AgentWorkspace.tsx` | One agent: sections, runs, and ticks are query params on this route. |
| `/portfolio` | `Portfolio.tsx` | Balances, PnL history, positions. |
| `/trade` | `CreateExecutor.tsx` | CEX order / grid trade ticket and chart. |
| `/dex` | `Dex.tsx` | Pool browser and LP positions. |
| `/dex/:network/:address` | `DexPool.tsx` | One pool: chart, depth, swap / LP ticket. |
| `/bots` | `Bots.tsx` | Controller browser (`components/perf/PerfBrowser.tsx`). `?population=` and `?group=` pick the view. |
| `/bots/:id` | `BotDetail.tsx` | One bot, including YAML config edit. |
| `/routines` | `Routines.tsx` | Routine library and reports. `?tab=reports` is the old `/reports` page. |
| `/settings` | `Settings.tsx` | Tabbed settings (see below). |
| `/_design` | `DesignSystem.tsx` | Dev-only style gallery (`import.meta.env.DEV`). Not in a production build. |
| `*` | `NotFound.tsx` | Unknown path, still inside the shell. |

Redirects kept for old links: `/fleet` → execution panel on the home chat; `/floor` → `/bots`; `/agents` → `/`; `/executors` → `/bots?group=type`; `/executors/new` → `/trade`; `/executors/new-grid` → `/trade?type=grid`; `/archived` → `/bots?population=terminated&group=bot`; `/reports` → `/routines?tab=reports`; `/market` → `/trade`; `/agents/:slug/runs` and `/agents/:slug/strategies/:sslug` → the workspace.

### Component folders (`frontend/src/components/`)

| Folder | Role |
| --- | --- |
| `layout/` | Shell, server selector, gateway indicator, currency, notifications. |
| `ui/` | Shared controls: Button, Card, Badge, Field, Tabs, Stat, EmptyState, PageHeader, SegmentedControl, AnchoredMenu, InlineConfirm. |
| `chat/` | Conversation, rail, account dock, chat bubble. |
| `agent/` | Workspace, knowledge, strategies, lab, delegation. |
| `portfolio/` | Portfolio tabs (positions and related). |
| `trade/`, `market/`, `grid/`, `executor/` | Trade ticket, venues, chart, grid and executor config. |
| `dex/` | Pools, LP, gateway-down / upstream notices. |
| `bots/`, `perf/` | Bot list pieces and the performance browser. |
| `routines/` | Routine library and report view. |
| `settings/` | Settings panels, including `settings/admin/`. |
| `charts/`, `editor/` | Chart widgets and the code editor. |

Shell-level pieces next to those folders: `ConnectKeysOverlay.tsx`, `ErrorBoundary.tsx`, `NoServerCard.tsx`, `RelaunchBanner.tsx`, `ReportIssueDialog.tsx`, `TelemetryConsentBanner.tsx`.

Settings tabs (`frontend/src/pages/Settings.tsx`), selected with `?tab=`: Hummingbot API, Gateway, Keys and Wallets, Servers, Agents, LLM Endpoints, Voice & AI, Notifications, Appearance, Privacy. Admin and Updates only when `/api/v1/admin/people` allows the caller.

### Styling today

Tailwind CSS v4, wired by `@tailwindcss/vite` and `@import "tailwindcss"` in `frontend/src/index.css`.

- Token source: `frontend/src/styles/hummingbot-ds.css` (Hummingbot design-system values, ported). Comment at the top says Condor-specific choices belong in `index.css`, not in that file.
- Theme switch: `data-theme="dark"|"light"` on `<html>`, plus optional `data-colorblind`. Defaults and the light/dark toggle: `frontend/src/hooks/useTheme.ts`. Colour-blind is Settings → Appearance, not the top-bar toggle.
- Components use CSS variables such as `var(--color-bg)`, `var(--color-surface)`, `var(--color-text)`, `var(--color-primary)`.
- Type: Satoshi (sans) and Geist Mono, self-hosted with `@font-face` in `index.css` from `frontend/src/assets/fonts/`. `package.json` also depends on `@fontsource-variable/inter` and `@fontsource/jetbrains-mono`; nothing under `frontend/src` imports them.
- `index.css` already writes down a type scale (11px–24px) and two radii (6px controls, 8px cards). Treat that as a description of the current UI, not as the redesign's style guide (section 4).

## 4. Design principles / style guide

Placeholders. The Designer fills these in and records the choice in the decisions log. Until then, do not treat section 3 as the target look.

- **Colours — TBD.**
- **Typography — TBD.**
- **Spacing — TBD.**
- **Components — TBD.**
- **Data density — TBD.**
- **Dark mode — TBD.**

## 5. Decisions log

| Date | Decision | Reason | PR |
| --- | --- | --- | --- |
| 2026-11-25 | Created `ui-redesign` from upstream `97d9261` | Integration branch for the dashboard redesign. That commit is the version running in production. `main` stays untouched. | — |

Add a row when a goal, visual rule, or workflow rule is actually decided. Link the PR that landed it.

## 6. Next steps / open questions

**TBD.** Starting list for the team and the Designer:

- Who is the audience, and which three tasks must get faster?
- Which screens are in the first pass, and which stay as they are?
- Does the redesign keep the current Hummingbot token file, or replace it?
- Light, dark, or both as the default?
- What must a preview build prove before a PR merges?

## 7. Handoff checklist

A new agent picking this up:

1. Read this file. If section 1 or 4 still says TBD, do not invent the missing goals or visual rules; ask in the PR or leave a comment.
2. Branch from `ui-redesign`, not from `main`. Name it `ui/<area>`.
3. Change one area. Open the PR into `ui-redesign`.
4. Put before/after screenshots in the PR, and say what changed and why.
5. Do not commit secrets, `conf/`, `state/`, or scripts that only exist for one machine.
6. If you settle a design choice, add a row to the decisions log in the same PR.
7. UI work lives under `frontend/`. The API it calls lives under `condor/web/routes/`. A visual change should not rewrite the API unless the screen cannot be built on the current routes.
8. Check the result in a browser: `npm run dev` in `frontend/` against an API on port 8088, or the built dashboard on port 8088 after `make build-frontend`. The maintainer deploys the branch to the preview Condor for the team.
