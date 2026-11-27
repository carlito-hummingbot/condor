import type { FlowState } from "@/lib/onboarding";

/**
 * Progress dots. A reached step can be opened again; a later one cannot.
 * Labels stay on the dot (`aria-label`) so six of them still fit at 390px.
 */
export function StepDots({
  steps,
  flow,
  onJump,
}: {
  steps: readonly { id: string; title: string }[];
  flow: FlowState;
  onJump: (index: number) => void;
}) {
  return (
    <nav aria-label="Setup progress" className="mb-5">
      <ol className="flex items-center justify-center gap-2">
        {steps.map((step, index) => {
          const current = index === flow.index;
          const reached = index <= flow.furthest;
          const clickable = reached && !current;
          return (
            <li key={step.id}>
              <button
                type="button"
                aria-label={step.title}
                aria-current={current ? "step" : undefined}
                disabled={!clickable}
                onClick={() => onJump(index)}
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
        Step {flow.index + 1} of {steps.length}
      </p>
    </nav>
  );
}
