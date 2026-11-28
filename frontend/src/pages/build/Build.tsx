/**
 * Build: one bot's life in five stages — Design, Backtest, Dry Run, Deploy,
 * Improve — and the draft they all edit.
 *
 * The shell owns everything around the stages: the tab row and the stepper
 * (`BuildNav`), the draft (`useDraft`), the origin banner for the two entry
 * points (Explore, Dashboard), the resume card, "My drafts", and the gentle
 * notice a stage shows when the one before it is unfinished. Nothing is ever
 * locked: the demo must be free to jump.
 *
 * Showcase only. Every value the stages show is sample data, labelled as such,
 * and no stage calls the API: the navigation is real, the trading is not.
 */

import { X } from "lucide-react";
import { useCallback, useState, type ComponentType } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { BuildNav } from "./BuildNav";
import {
  draftName,
  emptyDraft,
  reachedStage,
  readStage,
  stageFailed,
  STAGE_LABEL,
  STAGE_HINT,
} from "./draftStore";
import { findCatalogItem, findDashboardAgent, pickCatalogItem } from "./sample/catalog";
import { useDraft, type Seed } from "./useDraft";
import type { StageId, StageProps } from "./types";

/**
 * The stages whose own component is on the branch. A stage that is not here
 * draws `Placeholder`, so the page works while the other designers finish.
 */
const STAGE_COMPONENTS: Partial<Record<StageId, ComponentType<StageProps>>> = {
  design: Design,
  backtest: Backtest,
  "dry-run": DryRun,
  deploy: Deploy,
  improve: Improve,
};

import Backtest from "./stages/Backtest";
import Deploy from "./stages/Deploy";
import Design from "./stages/Design";
import DryRun from "./stages/DryRun";
import Improve from "./stages/Improve";
import Placeholder from "./stages/Placeholder";

const CARD = "rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]";

/** The draft a link from Explore or Dashboard starts from, or null. */
function seedFromLink(from: string | null, item: string | null, intent: string | null): Seed | null {
  if (from === "explore") {
    const fields = pickCatalogItem(item, intent === "improve" ? "v2" : "copy");
    const catalogue = findCatalogItem(item);
    if (!fields || !catalogue) return null;
    return {
      draft: {
        ...emptyDraft(),
        ...fields,
        // Explore is a catalogue of running things: the draft starts as an
        // import, with the design still to be agreed.
        startingPoint: "import",
        // "Improve this" opens the stage's chat rather than its guide, and the
        // chat is the stage's own state: it is open once the design is agreed,
        // which is what an improvement starts from. "Edit guide" brings the
        // form back, and the design stays done.
        designDone: intent === "improve",
      },
      origin: {
        from: "explore",
        itemId: catalogue.id,
        label: `Based on ${catalogue.name} (Learn, sample)`,
        chat: intent === "improve",
      },
      stage: "design",
    };
  }
  if (from === "dashboard") {
    const live = findDashboardAgent(item);
    if (!live) return null;
    return {
      draft: {
        ...emptyDraft(),
        ...live.fields,
        // A live bot has been through everything the lifecycle has.
        designDone: true,
        backtestDone: true,
        dryRunDone: true,
        deployed: true,
      },
      origin: {
        from: "dashboard",
        itemId: live.id,
        label: `Improving your live bot ${live.fields.title} (Dashboard, sample)`,
      },
      stage: "improve",
    };
  }
  return null;
}

export function Build() {
  const [params, setParams] = useSearchParams();
  // The entry point's link is read once, on the first render, so the seeded
  // draft is what the stage mounts with (see `useDraft`).
  const [linkSeed] = useState(() =>
    seedFromLink(params.get("from"), params.get("item"), params.get("intent")),
  );
  const state = useDraft(linkSeed);
  const { draft, setDraft } = state;
  const stage = readStage(params.get("stage"));
  const from = params.get("from");
  const [guardsDismissed, setGuardsDismissed] = useState<StageId[]>([]);
  const [discardAsk, setDiscardAsk] = useState(false);
  const [draftsOpen, setDraftsOpen] = useState(false);

  const goTo = useCallback(
    (next: StageId) => {
      setParams(
        (current) => {
          const copy = new URLSearchParams(current);
          copy.set("stage", next);
          return copy;
        },
        { replace: false },
      );
    },
    [setParams],
  );

  const Stage = STAGE_COMPONENTS[stage];
  const failed = stageFailed(draft, stage);
  const showGuard = failed && !guardsDismissed.includes(stage);
  const linked = from === "explore" || from === "dashboard";
  const showResume = state.canResume && !linked && !params.get("stage");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0">
          {state.origin?.from === "explore" && (
            <p className="mb-0.5 text-[12px] text-[var(--color-text-muted)]">
              <Link to="/explore" className="hover:text-[var(--color-text)] hover:underline">
                Learn
              </Link>{" "}
              › <span className="text-[var(--color-text)]">{state.origin.label}</span>
            </p>
          )}
          <h1 className="text-[22px] font-bold tracking-tight text-[var(--color-text)]">Build</h1>
          <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">
            One bot, five stages: design it, test it, dry-run it, send it live, then make it better.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[var(--color-primary)]/45 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
            Sample data
          </span>
          <span className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[12px] text-[var(--color-text-muted)]">
            Draft: <strong className="font-semibold text-[var(--color-text)]">{draftName(draft)}</strong>
          </span>
          <span className="text-[11.5px] text-[var(--color-text-muted)]">Draft saved</span>
          {state.savedDrafts.length > 0 && (
            <div className="relative">
              <button
                type="button"
                aria-expanded={draftsOpen}
                onClick={() => setDraftsOpen((open) => !open)}
                className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-[12px] font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
              >
                My drafts ({state.savedDrafts.length})
              </button>
              {draftsOpen && (
                <ul className={`absolute right-0 z-20 mt-1 w-72 list-none p-1.5 ${CARD} shadow-xl`}>
                  {state.savedDrafts.map((saved) => (
                    <li key={saved.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-[12.5px]">
                      <button
                        type="button"
                        onClick={() => {
                          state.openSaved(saved.id);
                          setDraftsOpen(false);
                          goTo(saved.stage);
                        }}
                        className="min-w-0 flex-1 truncate text-left font-medium text-[var(--color-text)] hover:underline"
                      >
                        {saved.title}
                        <span className="ml-1.5 font-normal text-[var(--color-text-muted)]">
                          {STAGE_LABEL[saved.stage]} · {saved.updated}
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${saved.title}`}
                        onClick={() => state.deleteSaved(saved.id)}
                        className="shrink-0 rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-red)]"
                      >
                        <X aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </header>

      {state.origin && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-[var(--color-primary)]/35 bg-[var(--color-primary)]/8 px-3 py-1.5 text-[12.5px]">
          <span className="font-semibold text-[var(--color-text)]">{state.origin.label}</span>
          <button
            type="button"
            onClick={() => {
              state.dismissOrigin();
              state.discard();
            }}
            className="text-[var(--color-text-muted)] underline underline-offset-2 hover:text-[var(--color-text)]"
          >
            Change
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => state.dismissOrigin()}
            className="ml-auto rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {showResume && (
        <div className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 p-3 ${CARD}`}>
          <p className="min-w-0 text-[13.5px] text-[var(--color-text)]">
            Continue where you left off:{" "}
            <strong className="font-semibold">{draftName(draft)}</strong>{" "}
            <span className="text-[var(--color-text-muted)]">
              ({STAGE_LABEL[reachedStage(draft)]})
            </span>
          </p>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => goTo(reachedStage(draft))}
              className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--on-primary)]"
            >
              Resume
            </button>
            <button
              type="button"
              onClick={() => {
                state.startNew();
                goTo("design");
              }}
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
            >
              Start new
            </button>
            {discardAsk ? (
              <span className="flex items-center gap-2 text-[12.5px]">
                Discard this draft?
                <button
                  type="button"
                  onClick={() => {
                    state.discard();
                    setDiscardAsk(false);
                    goTo("design");
                  }}
                  className="rounded-md bg-[var(--color-red)]/15 px-2.5 py-1 font-semibold text-[var(--color-red)]"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={() => setDiscardAsk(false)}
                  className="text-[var(--color-text-muted)] underline underline-offset-2"
                >
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setDiscardAsk(true)}
                className="text-[12.5px] text-[var(--color-text-muted)] underline underline-offset-2 hover:text-[var(--color-red)]"
              >
                Discard
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-4">
        <BuildNav stage={stage} onStage={goTo} />
      </div>

      {showGuard && failed && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[12.5px]">
          <span>
            You have not finished <strong className="font-semibold">{STAGE_LABEL[failed]}</strong> yet.
          </span>
          <button
            type="button"
            onClick={() => goTo(failed)}
            className="font-semibold text-[var(--color-primary)] hover:underline"
          >
            Go to {STAGE_LABEL[failed]}
          </button>
          <button
            type="button"
            onClick={() => setGuardsDismissed((list) => [...list, stage])}
            className="text-[var(--color-text-muted)] underline underline-offset-2 hover:text-[var(--color-text)]"
          >
            Continue anyway
          </button>
        </div>
      )}

      {state.pending && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Replace your current draft"
          className={`mt-3 p-3 ${CARD}`}
        >
          <p className="text-[13.5px] text-[var(--color-text)]">
            Replace your current draft <strong className="font-semibold">{draftName(draft)}</strong>?
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                state.replacePending();
                goTo(state.pending?.stage ?? "design");
              }}
              className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--on-primary)]"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => {
                state.keepBothPending();
                goTo(state.pending?.stage ?? "design");
              }}
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
            >
              Keep both
            </button>
            <button
              type="button"
              onClick={() => state.cancelPending()}
              className="text-[12.5px] text-[var(--color-text-muted)] underline underline-offset-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <section
        role="tabpanel"
        id={`build-panel-${stage}`}
        aria-labelledby={`build-tab-${stage}`}
        className="mt-4"
      >
        {Stage ? (
          <div data-stage={stage}>
            <Stage draft={draft} setDraft={setDraft} goTo={goTo} />
          </div>
        ) : (
          <Placeholder stage={stage} draft={draft} setDraft={setDraft} goTo={goTo} />
        )}
      </section>

      {/* The lifecycle's way out at the end: back to the catalogue it came from.
          The Improve stage is the other designer's file, so the link lives here. */}
      {stage === "improve" && (
        <p className="mt-4 text-[13px]">
          <Link
            to="/explore"
            className="font-semibold text-[var(--color-primary)] underline-offset-2 hover:underline"
          >
            Back to Learn
          </Link>{" "}
          <span className="text-[var(--color-text-muted)]">
            to find the next thing to run.
          </span>
        </p>
      )}

      <p className="mt-6 text-[11.5px] text-[var(--color-text-muted)]">
        {STAGE_HINT[stage]}. Sample data only: nothing here trades, deploys or calls the API.
      </p>
    </div>
  );
}
