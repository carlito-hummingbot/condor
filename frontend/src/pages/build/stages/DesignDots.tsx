/**
 * The Design step's progress dots.
 *
 * A small presentational copy of onboarding's `StepDots` (components/onboarding),
 * which is typed on the onboarding flow (`FlowState`) and so cannot take the
 * Build wizard's plain index without importing that module's state machine.
 * This one is the same shape and colours: the current dot is ringed, a reached
 * step can be opened again, a later one cannot, and the label stays on the dot
 * ("Step 2 of 5") so five fit at 390px.
 *
 * The Build page's numbered stage bar (1 Design … 5 Improve) is a different
 * thing and is untouched: these dots count the steps inside Design.
 */
export function DesignDots({
  steps,
  index,
  furthest,
  onJump,
}: {
  steps: readonly { id: string; title: string }[];
  index: number;
  /** The furthest step reached this visit; later ones are not clickable. */
  furthest: number;
  onJump: (index: number) => void;
}) {
  return (
    <nav aria-label="Design progress" className="mb-4">
      <ol className="flex items-center justify-center gap-2">
        {steps.map((step, i) => {
          const current = i === index;
          const reached = i <= furthest;
          const clickable = reached && !current;
          return (
            <li key={step.id}>
              <button
                type="button"
                aria-label={`Step ${i + 1} of ${steps.length}`}
                aria-current={current ? "step" : undefined}
                title={step.title}
                disabled={!clickable}
                onClick={() => onJump(i)}
                className={`block h-2.5 w-2.5 rounded-full transition-colors ${
                  current
                    ? "bg-[var(--color-primary-fill)] ring-2 ring-[var(--color-primary)]/40 ring-offset-2 ring-offset-[var(--color-surface)]"
                    : reached
                      ? "bg-[var(--color-primary-fill)] hover:opacity-80"
                      : "bg-[var(--color-border)]"
                } ${clickable ? "cursor-pointer" : "cursor-default"} disabled:opacity-100`}
              />
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-center text-2xs text-[var(--color-text-muted)]">
        Step {index + 1} of {steps.length}: {steps[index]?.title}
      </p>
    </nav>
  );
}
