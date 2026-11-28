import { CircleAlert, CircleCheck, CircleDashed, CircleHelp, Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/Button";
import type { ReadinessRow, ReadinessStatus, StepDef } from "@/lib/onboarding";

import type { WizardAction } from "./MakeItYoursStep";

const STATUS: Record<ReadinessStatus, { icon: typeof CircleCheck; tone: string; word: string }> = {
  ok: { icon: CircleCheck, tone: "text-[var(--color-green)]", word: "Ready" },
  todo: { icon: CircleAlert, tone: "text-[var(--color-primary)]", word: "Needs you" },
  optional: { icon: CircleDashed, tone: "text-[var(--color-text-muted)]", word: "Optional" },
  pending: { icon: Loader2, tone: "text-[var(--color-text-muted)]", word: "Checking" },
  unknown: { icon: CircleHelp, tone: "text-[var(--color-text-muted)]", word: "Not checked" },
};

/**
 * Opens the wizard. It reads what setup already did and shows it, so nothing
 * is asked twice. The steps that follow are only the ones marked "Needs you",
 * plus the name and the preferences, which cannot be read from the install.
 */
export function CheckStep({
  rows,
  loading,
  upNext,
  busy,
  onRetry,
  onContinue,
  onBind,
}: {
  rows: ReadinessRow[];
  loading: boolean;
  /** The steps that will follow this one, in order. */
  upNext: StepDef[];
  busy: boolean;
  onRetry: () => void;
  onContinue: () => void;
  onBind: (action: WizardAction | null) => void;
}) {
  const continueRef = useRef(onContinue);
  useEffect(() => {
    continueRef.current = onContinue;
  }, [onContinue]);

  useEffect(() => {
    onBind({ label: "Continue", disabled: busy || loading, run: () => continueRef.current() });
    return () => onBind(null);
  }, [busy, loading, onBind]);

  const todo = rows.filter((row) => row.status === "todo");
  const offline = rows.find((row) => row.id === "server" && row.status === "todo");

  return (
    <div>
      <h2 id="onboarding-title" className="text-xl font-bold text-[var(--color-text)]">
        Here is your setup
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
        {loading
          ? "Looking at what setup already did on this machine."
          : todo.length === 0
            ? "Setup already did everything Condor needs. Nothing here to fill in."
            : "Setup already did most of this. Only the items marked Needs you are left."}
      </p>

      <ul className="mt-4 divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
        {rows.map((row) => {
          const style = STATUS[row.status];
          const Icon = style.icon;
          return (
            <li key={row.id} className="flex items-start gap-3 px-3 py-2.5">
              <Icon
                aria-hidden="true"
                className={`mt-0.5 h-4 w-4 shrink-0 ${style.tone} ${row.status === "pending" ? "animate-spin" : ""}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-[var(--color-text)]">{row.label}</span>
                  <span className={`text-2xs font-semibold uppercase tracking-wide ${style.tone}`}>
                    {style.word}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-text-muted)]">{row.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>

      {offline && (
        <div className="mt-3">
          <Button variant="secondary" disabled={busy} onClick={onRetry}>
            Check again
          </Button>
        </div>
      )}

      {!loading && (
        <p className="mt-4 text-xs leading-relaxed text-[var(--color-text-muted)]">
          Next: {upNext.map((step) => step.title).join(", ")}.
        </p>
      )}
    </div>
  );
}
