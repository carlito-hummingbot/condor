/**
 * The Build page's two navigations.
 *
 * The tab row is the page's own nav — Design · Backtest · Dry Run · Deploy ·
 * Improve — a `tablist` with arrow, Home and End keys, on a phone scrolling
 * sideways. Above the stage sits a thin stepper of the same five, which reads
 * the draft's flags: done, the one you are on, or the ones still open. Neither
 * ever blocks a jump: the demo can go anywhere, and the stage itself says what
 * is unfinished (`Build` draws that notice).
 */

import type { Draft, StageId } from "./types";
import { STAGE_LABEL, STAGES, stageState, stepText } from "./draftStore";

export function BuildNav({
  stage,
  draft,
  onStage,
}: {
  stage: StageId;
  draft: Draft;
  onStage: (stage: StageId) => void;
}) {
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = STAGES.indexOf(stage);
    const last = STAGES.length - 1;
    const next =
      event.key === "ArrowRight"
        ? Math.min(index + 1, last)
        : event.key === "ArrowLeft"
          ? Math.max(index - 1, 0)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    onStage(STAGES[next]);
    const tabs = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs[next]?.focus();
  };

  return (
    <div>
      {/* The stepper: one thin line of five, above the stage. */}
      <ol
        aria-label="Build progress"
        className="mb-3 hidden items-center gap-2 sm:flex"
      >
        {STAGES.map((id) => {
          const state = stageState(draft, id, stage);
          return (
            <li key={id} className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onStage(id)}
                aria-current={state === "active" ? "step" : undefined}
                className="group flex w-full min-w-0 items-center gap-2 text-left"
              >
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                    state === "done"
                      ? "border-[var(--color-green)] bg-[var(--color-green)] text-[var(--color-bg)]"
                      : state === "active"
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--on-primary)]"
                        : "border-[var(--color-border)] text-[var(--color-text-muted)]"
                  }`}
                >
                  {state === "done" ? "✓" : STAGES.indexOf(id) + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block truncate text-[12.5px] font-semibold ${
                      state === "available"
                        ? "text-[var(--color-text-muted)]"
                        : "text-[var(--color-text)]"
                    }`}
                  >
                    {STAGE_LABEL[id]}
                  </span>
                  <span className="mt-0.5 block h-0.5 rounded-full bg-[var(--color-border)]">
                    <span
                      className={`block h-0.5 rounded-full ${
                        state === "done"
                          ? "bg-[var(--color-green)]"
                          : state === "active"
                            ? "bg-[var(--color-primary)]"
                            : "bg-transparent"
                      }`}
                    />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {/* The phone: the five dots do not fit a 390 px line. */}
      <p className="mb-3 text-[12px] font-semibold text-[var(--color-text-muted)] sm:hidden">
        {stepText(stage)}
      </p>

      <div
        role="tablist"
        aria-label="Build stages"
        onKeyDown={onKeyDown}
        className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
      >
        {STAGES.map((id) => {
          const selected = id === stage;
          return (
            <button
              key={id}
              role="tab"
              type="button"
              id={`build-tab-${id}`}
              aria-selected={selected}
              aria-controls={`build-panel-${id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onStage(id)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                selected
                  ? "bg-[var(--color-primary)]/15 text-[var(--color-primary)]"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
              }`}
            >
              {STAGE_LABEL[id]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
