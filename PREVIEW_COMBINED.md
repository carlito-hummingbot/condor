# preview/combined

Throwaway integration branch for the team preview. Never merge it, never open a PR from it.
Base: origin/ui-redesign (97d9261a). Built by `git merge` only.

Merged heads, in order:

1. ui/test-no-real-ports (#26) 2b0f34ef
2. ui/chat-socket-host (#27) 38d1ce8f (includes VITE_API_TARGET)
3. fix/login-strictmode-probe (#15) e7b1ca18
4. feat/test-connection-endpoint (#16) 6e80e930 (backend)
5. fix/server-status-staleness (#17) 64fb7a75 (backend)
6. feat/model-readiness-state (#24) d38d8939 (backend)
7. ui/panel-rail-v2 (#25) d15f203c: contains the rail stack #3 4ea4af86, #4 a813dce7, #6 0d20f505, #7 3be0a250
8. ui/onboarding-model-connect (#23) a35c6f81: contains #2, #9, #11, #12, #14, #21, #22

Conflicts: AppShell.tsx (rail shell + wizard/keys banner/telemetry gate in `main`), lib/api.ts (login
fix dropped the unused getAuthMode). Duplicate preference plumbing: lib/preferences.ts removed,
hooks/useDisplayName.ts re-exports onboarding's helpers. Two small fixes on top (see git log).

Run: the wizard needs the backend from this branch (#16, #17, #24 are Python in condor/web).
Rerun the wizard: Settings (gear) > Appearance > Run setup again, or open /welcome.

## Showcase Dashboard (preview only)

Added on top of the merges, on this throwaway branch only. It is not on any PR branch and is not meant to be merged;
the real Dashboard is a later proposal.

- `/` is now a sample Dashboard (`pages/Dashboard.tsx`, `pages/dashboard/sampleData.ts`, `pages/dashboard/charts.tsx`):
  four summary cards, daily and hourly P&L, BTC hourly chart, Top News, and three Live Agents cards. All data is made up
  and labelled "Sample data"; nothing is fetched. Charts are inline SVG. News links are `href="#"` and go nowhere.
- The old chat home moved to `/chat`. Chat links that arrive on `/` with a chat query (`?panel=`, `?conversation=`,
  `?agent=`, `?ask=`, `?desk=`, `?who=`, `?loop=`, `?run=`) are forwarded to `/chat` with the query intact (`pages/Home.tsx`).
  `/agents`, the Ctrl/Cmd+K shortcut, "Back to your agents" and the chat's own "leave Hub" now go to `/chat`.
  The Agents rail door also lights on `/chat`.
- `/?onboarding=1` and `/welcome` stay on the Dashboard; the first-run wizard shows over its page area.
- Small shell fix: the right-hand column of `AppShell` got `min-h-0`, so a long page scrolls inside `main` on a phone.
