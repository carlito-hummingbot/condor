/**
 * The Build page's state: the draft, where it came from, the set-aside drafts,
 * and the one question a page ever asks ("Replace your current draft?").
 *
 * The rules are the demo's:
 * - the draft is kept in `sessionStorage` on every change, so a refresh keeps
 *   it and the header can say "Draft saved" without a Save button;
 * - arriving from Explore or Dashboard seeds it, and if another draft is in
 *   the way the page asks Replace or Keep both instead of overwriting it;
 * - "My drafts" holds five at most, and a set-aside draft keeps its own stage.
 *
 * Everything is sample state: no request leaves the page.
 */

import { useCallback, useEffect, useState } from "react";

import {
  emptyDraft,
  hasProgress,
  keepDraft,
  readDraft,
  readDrafts,
  readOrigin,
  reachedStage,
  writeDraft,
  writeDrafts,
  writeOrigin,
  type Origin,
  type SavedDraft,
} from "./draftStore";
import type { Draft, StageId } from "./types";

export interface Seed {
  draft: Draft;
  origin: Origin;
  stage: StageId;
}

export interface BuildState {
  draft: Draft;
  setDraft: (patch: Partial<Draft>) => void;
  origin: Origin | null;
  dismissOrigin: () => void;
  /** The replacement waiting for an answer, when an entry point met a draft. */
  pending: Seed | null;
  replacePending: () => void;
  keepBothPending: () => void;
  cancelPending: () => void;
  savedDrafts: SavedDraft[];
  openSaved: (id: string) => void;
  deleteSaved: (id: string) => void;
  /** Set aside the current draft without opening another. */
  keepCurrent: () => void;
  startNew: () => void;
  discard: () => void;
  /** True when the page should offer "Continue where you left off". */
  canResume: boolean;
}

export function useDraft(linkSeed: Seed | null = null): BuildState {
  // The starter is read once, during the first render: a stage reads the draft
  // as it mounts (Design opens its chat from `designDone`), so a seed that
  // arrived in an effect would be one render too late.
  const [starter] = useState(() => {
    const stored = readDraft();
    const blocked = Boolean(stored && hasProgress(stored));
    return { stored, blocked };
  });
  const [draft, setDraftState] = useState<Draft>(() =>
    linkSeed && !starter.blocked ? linkSeed.draft : (starter.stored ?? emptyDraft()),
  );
  const [origin, setOrigin] = useState<Origin | null>(() =>
    linkSeed && !starter.blocked ? linkSeed.origin : readOrigin(),
  );
  const [savedDrafts, setSavedDrafts] = useState<SavedDraft[]>(() => readDrafts());
  // An entry point that met a draft with work in it waits for Replace / Keep both.
  const [pending, setPending] = useState<Seed | null>(() =>
    linkSeed && starter.blocked ? linkSeed : null,
  );
  // Whether the page opened on a draft that was already there: the resume card
  // is about that draft, not one the demo just started typing into.
  const [canResume] = useState(() => !linkSeed && Boolean(starter.stored && hasProgress(starter.stored)));

  useEffect(() => {
    writeDraft(draft);
  }, [draft]);

  useEffect(() => {
    writeOrigin(origin);
  }, [origin]);

  useEffect(() => {
    writeDrafts(savedDrafts);
  }, [savedDrafts]);

  const setDraft = useCallback((patch: Partial<Draft>) => {
    setDraftState((current) => ({ ...current, ...patch }));
  }, []);

  const apply = useCallback((seed: Seed) => {
    setDraftState(seed.draft);
    setOrigin(seed.origin);
    setPending(null);
  }, []);

  const replacePending = useCallback(() => {
    if (pending) apply(pending);
  }, [apply, pending]);

  const keepBothPending = useCallback(() => {
    if (!pending) return;
    setSavedDrafts((list) => keepDraft(draft, reachedStage(draft), list));
    apply(pending);
  }, [apply, draft, pending]);

  const cancelPending = useCallback(() => setPending(null), []);

  const keepCurrent = useCallback(() => {
    setSavedDrafts((list) => keepDraft(draft, reachedStage(draft), list));
  }, [draft]);

  const openSaved = useCallback(
    (id: string) => {
      const entry = savedDrafts.find((row) => row.id === id);
      if (!entry) return;
      setDraftState(entry.draft);
      setSavedDrafts((list) => list.filter((row) => row.id !== id));
    },
    [savedDrafts],
  );

  const deleteSaved = useCallback((id: string) => {
    setSavedDrafts((list) => list.filter((row) => row.id !== id));
  }, []);

  const startNew = useCallback(() => {
    setDraftState(emptyDraft());
    setOrigin(null);
  }, []);

  const discard = useCallback(() => {
    setDraftState(emptyDraft());
    setOrigin(null);
  }, []);

  const dismissOrigin = useCallback(() => setOrigin(null), []);

  return {
    draft,
    setDraft,
    origin,
    dismissOrigin,
    pending,
    replacePending,
    keepBothPending,
    cancelPending,
    savedDrafts,
    openSaved,
    deleteSaved,
    keepCurrent,
    startNew,
    discard,
    canResume,
  };
}
