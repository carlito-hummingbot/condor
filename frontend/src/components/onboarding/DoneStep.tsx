import { Bot, Compass, type LucideIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { DONE_ACTIONS, dashboardTitleFrom, type UserPreferences } from "@/lib/onboarding";

import type { WizardAction } from "./MakeItYoursStep";

const ACTION_ICONS: Record<(typeof DONE_ACTIONS)[number]["to"], LucideIcon> = {
  "/bots": Bot,
  "/hub": Compass,
};

/**
 * Recap of what this run saved, then the two ways forward. Each card finishes
 * the wizard and opens that page. Full-width rows, so two cards fill the
 * space a four-card grid used to.
 */
export function DoneStep({
  prefs,
  busy,
  onFinish,
  onBind,
}: {
  prefs: UserPreferences;
  busy: boolean;
  onFinish: (to?: string) => void;
  onBind: (action: WizardAction | null) => void;
}) {
  const finishRef = useRef(onFinish);
  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    onBind({
      label: "Finish",
      disabled: busy,
      run: () => finishRef.current(),
    });
    return () => onBind(null);
  }, [busy, onBind]);

  const detected = prefs.onboarding?.detected;
  const name = prefs.profile?.display_name?.trim();
  const skipped = (prefs.onboarding?.skipped ?? []).join(", ");

  return (
    <div>
      <h2 id="onboarding-title" className="text-xl font-bold text-[var(--color-text)]">
        You're set
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
        Change any of this later in Settings. You can run setup again from Appearance.
      </p>
      <ul className="mt-4 space-y-1.5 text-sm text-[var(--color-text)]">
        <SummaryRow label="Name" value={name || "Not set"} done={!!name} />
        <SummaryRow label="Dashboard" value={dashboardTitleFrom(prefs)} done />
        {detected?.server && (
          <SummaryRow
            label="Server"
            value={detected.server_online === false ? `${detected.server} (offline)` : detected.server}
            done={detected.server_online !== false}
          />
        )}
        {skipped && <SummaryRow label="Skipped" value={skipped} done={false} />}
        {detected?.model_label && (
          <SummaryRow
            label="Model"
            value={
              detected.model_ready === false
                ? `${detected.model_label} (needs a login)`
                : detected.model_label
            }
            done={detected.model_ready !== false}
          />
        )}
      </ul>
      <div className="mt-5 grid grid-cols-1 gap-2">
        {DONE_ACTIONS.map((action) => {
          const Icon = ACTION_ICONS[action.to];
          return (
            <button
              key={action.to}
              type="button"
              disabled={busy}
              onClick={() => onFinish(action.to)}
              className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-3 text-left transition-colors hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
            >
              <Icon className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[var(--color-text)]">{action.title}</span>
                <span className="block text-xs text-[var(--color-text-muted)]">{action.body}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SummaryRow({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className="truncate text-right">
        <span aria-hidden className="mr-1.5">{done ? "✓" : "–"}</span>
        {value}
      </span>
    </li>
  );
}
