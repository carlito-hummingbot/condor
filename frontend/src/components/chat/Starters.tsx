import { ArrowRight, type LucideIcon } from "lucide-react";

/** One opener: what it does, why you'd click it, and what it actually sends. */
export type Starter = {
  icon: LucideIcon;
  title: string;
  hint: string;
  /** The message sent on click. Defaults to `title`. */
  prompt?: string;
};

/**
 * What you can ask, while there is nothing to read.
 *
 * Openers are a capability list, not decoration: each row says what the thing
 * on the other side can do and sends the question that proves it. They belong
 * to the *empty conversation*, not to the "no session yet" hero — a freshly
 * spawned slot has no transcript either, and dropping them the instant a
 * subprocess warmed up was what made them look like they flickered.
 */
export function Starters({
  starters,
  onAsk,
  label = "Get started",
  className = "",
}: {
  starters: Starter[];
  onAsk: (text: string) => void;
  label?: string;
  className?: string;
}) {
  if (starters.length === 0) return null;

  return (
    <div className={`w-full text-left ${className}`}>
      <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </p>
      <div className="flex flex-col">
        {starters.map((starter) => (
          <button
            key={starter.title}
            type="button"
            onClick={() => onAsk(starter.prompt ?? starter.title)}
            className="group flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]/60"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] transition-colors group-hover:border-[var(--color-primary)]/40 group-hover:text-[var(--color-primary)] group-focus-visible:border-[var(--color-primary)]/40 group-focus-visible:text-[var(--color-primary)]">
              <starter.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-[var(--color-text)]">
                {starter.title}
              </span>
              <span className="block text-xs leading-snug text-[var(--color-text-muted)]">
                {starter.hint}
              </span>
            </span>
            {/* Says the row sends on click, not just fills the box. Hidden until
                hover or focus so the list stays quiet at rest. */}
            <ArrowRight
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0 -translate-x-1 text-[var(--color-primary)] opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
