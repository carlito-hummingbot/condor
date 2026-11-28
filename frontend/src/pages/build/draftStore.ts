/**
 * The Build page's draft: what one strategy or agent is, how far it got, and
 * which pages have touched it.
 *
 * The draft lives in `sessionStorage`, so a refresh during the demo keeps it
 * and closing the tab ends it. There is no backend and no `localStorage`:
 * everything here is sample state for the showcase (see `PREVIEW_COMBINED.md`).
 *
 * `My drafts` is a small list of set-aside drafts (five at most) in the same
 * store, with a human "updated" label rather than a timestamp, because a demo
 * is read off a screen.
 */

import { BUILD_DRAFT_KEY, BUILD_DRAFTS_KEY, BUILD_ORIGIN_KEY } from "@/lib/sessionState";

import type { Draft, StageId } from "./types";

export const STAGES: readonly StageId[] = ["design", "backtest", "dry-run", "deploy", "improve"];

export const STAGE_LABEL: Record<StageId, string> = {
  design: "Design",
  backtest: "Backtest",
  "dry-run": "Dry Run",
  deploy: "Deploy",
  improve: "Improve",
};

/** One line under each stage in the stepper: the lifecycle in plain words. */
export const STAGE_HINT: Record<StageId, string> = {
  design: "Say what the bot is",
  backtest: "Test it on the past",
  "dry-run": "Watch it trade with no money",
  deploy: "Send it live",
  improve: "Make it better",
};

const DRAFT_KEY = BUILD_DRAFT_KEY;
const LIST_KEY = BUILD_DRAFTS_KEY;
const ORIGIN_KEY = BUILD_ORIGIN_KEY;

export function emptyDraft(): Draft {
  return {
    botKind: null,
    strategyType: null,
    exchange: null,
    pair: null,
    marketType: null,
    marketQty: null,
    maxPositions: null,
    startingPoint: null,
    howItWorks: "",
    title: "",
    designDone: false,
    backtestDone: false,
    dryRunDone: false,
    deployed: false,
  };
}

/** True once the design form holds anything worth keeping. */
export function hasProgress(draft: Draft): boolean {
  return Boolean(
    draft.botKind ||
      draft.strategyType ||
      draft.exchange ||
      draft.pair ||
      draft.howItWorks.trim() ||
      draft.title.trim(),
  );
}

/** The stage the draft has reached: the first one whose flag is still unset. */
export function reachedStage(draft: Draft): StageId {
  if (!draft.designDone) return "design";
  if (!draft.backtestDone) return "backtest";
  if (!draft.dryRunDone) return "dry-run";
  if (!draft.deployed) return "deploy";
  return "improve";
}

/** The title on screen: the saved one, or the placeholder the chip shows. */
export function draftName(draft: Draft): string {
  const title = draft.title.trim();
  return title || "Untitled";
}

/**
 * A stage's done/active/available state, read off the four flags. `active` is
 * the one being shown; a stage with its prerequisite missing is `available`,
 * not locked, because the demo must be free to jump.
 */
export type StageState = "done" | "active" | "available";

const PREREQUISITE: Record<StageId, keyof Draft | null> = {
  design: null,
  backtest: "designDone",
  "dry-run": "backtestDone",
  deploy: "dryRunDone",
  improve: "deployed",
};

export function stageFailed(draft: Draft, stage: StageId): StageId | null {
  const flag = PREREQUISITE[stage];
  if (!flag) return null;
  if (draft[flag]) return null;
  // The stage whose flag is missing: design before backtest, and so on.
  const order: StageId[] = ["design", "backtest", "dry-run", "deploy"];
  return order[STAGES.indexOf(stage) - 1] ?? null;
}

export function stageState(draft: Draft, stage: StageId, open: StageId): StageState {
  if (stage === open) return "active";
  if (isStageDone(draft, stage)) return "done";
  return "available";
}

function isStageDone(draft: Draft, stage: StageId): boolean {
  switch (stage) {
    case "design":
      return draft.designDone;
    case "backtest":
      return draft.backtestDone;
    case "dry-run":
      return draft.dryRunDone;
    case "deploy":
      return draft.deployed;
    case "improve":
      // Improve is the end of the line: there is nothing after it to finish.
      return draft.deployed;
  }
}

/** What the origin banner says, when the draft came from Explore or Dashboard. */
export interface Origin {
  from: "explore" | "dashboard";
  itemId: string;
  label: string;
  /** Set for "Improve this", which opens the Design chat instead of the guide. */
  chat?: boolean;
}

export function readOrigin(): Origin | null {
  return readJson<Origin>(ORIGIN_KEY);
}

export function writeOrigin(origin: Origin | null): void {
  writeJson(ORIGIN_KEY, origin);
}

export interface SavedDraft {
  id: string;
  title: string;
  stage: StageId;
  updated: string;
  draft: Draft;
}

export function readDraft(): Draft | null {
  const stored = readJson<Draft>(DRAFT_KEY);
  if (!stored) return null;
  // A stored draft from an older shape keeps every field it has and takes the
  // rest from an empty one, so a missing key never renders as `undefined`.
  return { ...emptyDraft(), ...stored };
}

export function writeDraft(draft: Draft | null): void {
  writeJson(DRAFT_KEY, draft);
}

export function readDrafts(): SavedDraft[] {
  return readJson<SavedDraft[]>(LIST_KEY) ?? [];
}

/** Keep a draft aside under `My drafts`, newest first, five at most. */
export function keepDraft(draft: Draft, stage: StageId, previous: SavedDraft[]): SavedDraft[] {
  const entry: SavedDraft = {
    id: `draft-${Date.now()}`,
    title: draftName(draft),
    stage,
    updated: "just now",
    draft,
  };
  return [entry, ...previous].slice(0, 5);
}

export function writeDrafts(list: SavedDraft[]): void {
  writeJson(LIST_KEY, list);
}

/** `Step 3 of 5: Dry Run` for the phone, where the five-dot stepper does not fit. */
export function stepText(stage: StageId): string {
  return `Step ${STAGES.indexOf(stage) + 1} of ${STAGES.length}: ${STAGE_LABEL[stage]}`;
}

/** Is `stage` one of the five? A bad `?stage=` falls back to Design. */
export function readStage(value: string | null): StageId {
  return STAGES.includes(value as StageId) ? (value as StageId) : "design";
}

function readJson<T>(key: string): T | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // A browser with storage turned off still gets a working demo.
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    if (value === null) globalThis.sessionStorage?.removeItem(key);
    else globalThis.sessionStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Ignored: see `readJson`.
  }
}
