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
7. ui/panel-rail-v2 (#25) ad8e9ffd: contains the rail stack #3 b5a1bd0d, #4 5728adcf, #6 d617fd5e, #7 0b81a167 (More removed; Settings panel with three groups; avatar Account dialog; four-tab phone bar; Labs page)
8. ui/onboarding-model-connect (#23) a35c6f81: contains #2, #9, #11, #12, #14, #21, #22
9. showcase/onboarding-walkthrough 59f2599b: the Designer's wizard fixes (one throwaway branch, no PR)

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
- Live Agents cards also show two extra sample rows after Volume: `Agent Started` (e.g. `25-Nov-26 at 12:55 pm`) and
  `Total Runtime` (e.g. `3D 2H 30Mins`), with different dummy values per card.

## Rail stack update (ad8e9ffd)

`ui/panel-rail-v2` ad8e9ffd was merged in with `git merge`. Conflicts and how they were resolved:

- `hooks/useDisplayName.ts`, `lib/preferences.ts`: #4 copied onboarding's preference helpers. Here there is ONE copy
  (onboarding's, in `lib/onboarding.ts` and `hooks/useUserPreferences.ts`). `lib/preferences.ts` stays deleted,
  `useDisplayName.ts` stays the thin re-export, and `AccountDialog.tsx` imports onboarding's helpers and hook.
- `components/layout/AppShell.tsx`: only a comment differed; one `min-h-0` line (it is in the stack now).

Showcase-only difference: `pages/Dashboard.tsx` shows the saved dashboard title (set in the Account dialog or the
wizard) as its heading, and "Condor Dashboard" when none is saved. Nothing else in the stack was changed.
## Onboarding walkthrough fixes (showcase/onboarding-walkthrough 59f2599b)

Merged with `git merge` (merge commit 4f04bc67). One conflict, comment-only: in `lib/onboarding.ts` both sides
already named the model constant `RECOMMENDED_MODEL_ID`, so only the doc comment differed; the Designer's fuller
comment was kept and there is ONE definition.

What it fixes, over the page mock:

- **Saving a key no longer ends setup.** A wizard that is on screen now outranks `completed`/`hasKeys` in
  `shouldShowWizard`, and `shouldAutoComplete` stays quiet while it is up. The run closes only when its own Finish or
  Skip writes a newer `completed_at` than the one it opened with (`finishedThisRun`). Saving a demo exchange key at
  Connect keeps the wizard open through Look & units and You're set.
- **Forced re-runs start at step 1.** `/welcome`, `/?onboarding=1` and Settings > Appearance > Run setup again start
  clean: the saved `last_step` and an older run's skips do not carry over, and the saved name and Dashboard title are
  prefilled. Finish and Skip hand back to `setupReturnPath` — the page that asked (Settings) or the Dashboard.
- **The AI model step appears only when no model is ready** (`planStepIds`).
- `RECOMMENDED_MODEL_KEY` is `RECOMMENDED_MODEL_ID` (`lib/onboarding.ts`).

Not changed on this branch, as asked: no proposal pages, no "Run setup again" in the avatar Account popup, PR #23 and
every PR branch untouched, sample Dashboard routing (`/` Dashboard, `/chat` chat) and the shared preference helpers
(`profile.display_name`, `ui.dashboard_title`) as before.

## Explore page (showcase only)

The 2nd rail door is **Explore** (`/explore`) in this showcase build: a compass icon, the phone tab bar shows
Dashboard · Explore · Labs · Account, and `/hub` redirects to `/explore`, so the old Agent Hub page is unreachable
here. Showcase only: the rail PRs (#3, #6, #25) and the other proposal pages still say Agents until the user approves
the rename. The page is an ordinary padded, scrolling page, so the chat still lives at `/chat`.

- **One sample-data module**, `pages/explore/sampleData.ts`, typed from the content pack: the 14 real Botcamp Agent
  Builders Cup agents, the 10 strategy names verified against the Hummingbot docs, the 3 verified channel links, and
  sample Live now cards, Start here picks and news. Videos are placeholders ("Video coming"); nothing is fetched.
- **Four tabs in `?tab=`**: Overview (Start here, next livestream, six Live now cards in the Dashboard card style,
  Browse teasers), Strategies (definition + 10 video-first cards with risk/difficulty and Try in Labs), Agents
  (definition + All / Hummingbot / Botcamp Hackathon / Community filter with counts and video-first cards; the 14
  Botcamp cards name the builder and "From Botcamp Agent Builders Cup"), and What's new (one timeline with a
  Livestream / X / Discord filter and the 3 real Follow links). Sample blocks carry a "Sample data" badge.
- Tabs are a `tablist` with arrow/Home/End keys; panels are labelled. At 390 px the tab row scrolls sideways and all
  card grids are one column. Only the 3 channel links are real `href`s; internal actions (tabs, Try in Labs, Open the
  Dashboard) are buttons, and news item links are `#` no-ops.
- Existing tests changed: `AppShell.nav.test.ts`, `SideRail.test.tsx` and `MobileTabBar.test.tsx` now expect the
  Explore door and `/explore` instead of Agents at `/hub`.

