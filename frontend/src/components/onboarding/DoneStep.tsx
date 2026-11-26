import { Bot, Compass, LineChart, MessageSquare } from "lucide-react";
import { useEffect, useRef } from "react";

import { dashboardTitleFrom, type UserPreferences } from "@/lib/onboarding";

import type { WizardAction } from "./MakeItYoursStep";

const NEXT = [
  {
    to: "/",
    title: "Ask Condor",
    body: "Start a conversation",
    icon: MessageSquare,
  },
  {
    to: "/trade",
    title: "Open Trade",
    body: "Place an order",
    icon: LineChart,
  },
  {
    to: "/bots",
    title: "Deploy a bot",
    body: "Run a strategy",
    icon: Bot,
  },
  {
    to: "/hub",
    title: "Browse agents",
    body: "See the Hub",
    icon: Compass,
  },
] as const;

/**
 * Recap of what this run saved, then the four ways out of setup. Each card
 * finishes the wizard and opens that page.
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
      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {NEXT.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.to}
              type="button"
              disabled={busy}
              onClick={() => onFinish(action.to)}
              className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
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
