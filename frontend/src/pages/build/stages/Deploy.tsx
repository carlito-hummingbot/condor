/**
 * Build → Deploy: the only stage that can move money.
 *
 * The flow is pre-flight, then risk and capital, then a review, then a typed
 * confirmation, then the live state. Everything is sample data: the key check
 * is true, the balance is a constant, and the deploy steps are canned. The
 * only real inputs are the draft and its flags, so the checklist can be tested
 * without a server.
 *
 * Money safety rules kept here: the primary action is never one click from a
 * form (a dialog asks for the bot title or the word DEPLOY), the checks that
 * still need action are repeated in that dialog, and a blocking check disables
 * the primary instead of only warning.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Loader2,
  Rocket,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

import type { StageProps } from "../types";
import {
  CAPITAL,
  CONFIRM_WORD,
  DEPLOY_STEPS,
  LIMITS,
  SAMPLE_DRAFT_LINE,
  SCHEDULE,
  STEP_MS,
  confirmMatches,
  formatUsd,
  hasBlockingRow,
  openRows,
  preFlightRows,
  type CheckStatus,
  type PreFlightRow,
  type ScheduleId,
  type StartMode,
} from "../sample/deployData";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const STATUS: Record<CheckStatus, { tone: "success" | "warning" | "danger"; word: string; Icon: typeof Check }> = {
  pass: { tone: "success", word: "Ready", Icon: CircleCheck },
  action: { tone: "warning", word: "Needs action", Icon: CircleAlert },
  fail: { tone: "danger", word: "Blocked", Icon: AlertTriangle },
};

type Phase = "form" | "deploying" | "live";

export default function Deploy({ draft, setDraft, goTo }: StageProps) {
  const [capital, setCapital] = useState<number>(CAPITAL.initial);
  const [maxLossPerDay, setMaxLossPerDay] = useState<number>(LIMITS.maxLossPerDay);
  const [maxLossTotal, setMaxLossTotal] = useState<number>(LIMITS.maxLossTotal);
  const [maxOrderSize, setMaxOrderSize] = useState<number>(LIMITS.maxOrderSize);
  const [refreshSec, setRefreshSec] = useState(SCHEDULE.refreshSec);
  const [hours, setHours] = useState<ScheduleId>("always");
  const [notifyFills, setNotifyFills] = useState(true);
  const [notifyErrors, setNotifyErrors] = useState(true);
  const [notifyDaily, setNotifyDaily] = useState(false);
  const [startMode, setStartMode] = useState<StartMode>("paused");
  const [phase, setPhase] = useState<Phase>("form");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const reducedMotion = usePrefersReducedMotion();
  const title = draft.title.trim();
  const sample = !title;
  const rows = useMemo(
    () => preFlightRows({ backtestDone: draft.backtestDone, dryRunDone: draft.dryRunDone, capital }),
    [draft.backtestDone, draft.dryRunDone, capital],
  );
  const blocking = hasBlockingRow(rows);
  const stillOpen = openRows(rows);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  /** Move to the live state and tell the shell the draft is deployed. */
  const finish = useCallback(() => {
    clearTimers();
    setPhase("live");
    setDraft({ deployed: true });
  }, [clearTimers, setDraft]);

  /** The canned deploy: three steps, then live. Reduced motion skips the show. */
  const startDeploy = useCallback(() => {
    setConfirmOpen(false);
    setPhase("deploying");
    setStepIndex(0);
    if (reducedMotion) {
      finish();
      return;
    }
    DEPLOY_STEPS.slice(1).forEach((_, i) => {
      const id = window.setTimeout(() => setStepIndex(i + 1), STEP_MS * (i + 1));
      timers.current.push(id);
    });
    timers.current.push(window.setTimeout(finish, STEP_MS * DEPLOY_STEPS.length));
  }, [finish, reducedMotion]);

  const draftLine = sample ? SAMPLE_DRAFT_LINE : `Draft: ${title}`;
  const venue = [draft.exchange, draft.marketType, draft.pair].filter(Boolean).join(" · ") || "Binance · Spot · USDC-USDT";
  const kind = draft.botKind === "agent" ? "Agent" : draft.botKind === "strategy" ? "Strategy" : "Strategy (sample)";

  if (phase === "live") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-green)]/10 text-[var(--color-green)]">
            <CircleCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="text-xl font-semibold text-[var(--color-text)]">
            {startMode === "paused" ? "Your bot is live, paused" : "Your bot is live"}
          </h2>
          <p className="max-w-md text-sm text-[var(--color-text-muted)]">
            {startMode === "paused"
              ? `${title || "The bot"} is deployed on ${venue} with ${formatUsd(capital)} of capital, waiting for you to start it.`
              : `${title || "The bot"} is trading on ${venue} with ${formatUsd(capital)} of capital and the stops you set.`}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">Sample data: nothing was deployed.</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Link
              to="/"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--color-primary-fill)] px-4 text-sm font-medium text-[var(--on-primary)] shadow-sm transition-colors hover:bg-[var(--color-primary-fill)]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/50"
            >
              See it on the Dashboard <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Button variant="secondary" onClick={() => goTo("improve")}>
              Go to Improve <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold text-[var(--color-text)]">What happens next</h3>
          <ul className="mt-2 space-y-1 text-sm text-[var(--color-text-muted)]">
            <li>The bot appears under Live Agents on the Dashboard.</li>
            <li>Improve compares the live result with this backtest and dry run.</li>
            <li>You can pause it here or from the Dashboard at any time.</li>
          </ul>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Deploy</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          {draftLine}. Pre-flight, then the money settings, then one confirmation.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="flex flex-col gap-6">
          {/* 1. Pre-flight */}
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
                <ShieldCheck className="h-4 w-4 text-[var(--color-primary)]" aria-hidden="true" />
                Pre-flight checks
              </h2>
              <Badge tone={blocking ? "danger" : stillOpen.length ? "warning" : "success"}>
                {blocking
                  ? "Blocked"
                  : stillOpen.length
                    ? `${stillOpen.length} open`
                    : "All ready"}
              </Badge>
            </div>
            <ul className="mt-3 divide-y divide-[var(--color-border)]">
              {rows.map((row) => (
                <CheckRow key={row.id} row={row} onGoTo={goTo} />
              ))}
            </ul>
            <p className="mt-3 text-xs text-[var(--color-text-muted)]">
              Sample checks: the key is sample-true and the balance is a constant.
            </p>
          </Card>

          {/* 2. Risk and capital */}
          <Card>
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Risk and capital</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Capital allocation" hint={`${formatUsd(CAPITAL.min)} to ${formatUsd(CAPITAL.max)}, sample`}>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    aria-label="Capital allocation slider"
                    min={CAPITAL.min}
                    max={CAPITAL.max}
                    step={CAPITAL.step}
                    value={capital}
                    onChange={(e) => setCapital(Number(e.target.value))}
                    className="h-1.5 w-full accent-[var(--color-primary)]"
                  />
                  <Input
                    aria-label="Capital allocation"
                    type="number"
                    min={CAPITAL.min}
                    max={CAPITAL.max}
                    step={CAPITAL.step}
                    value={capital}
                    onChange={(e) => setCapital(Number(e.target.value))}
                    className="w-28"
                  />
                </div>
              </Field>
              <Field label="Max loss per day" hint="The bot pauses itself for the day at this loss.">
                <Input
                  aria-label="Maximum daily loss"
                  type="number"
                  min={1}
                  value={maxLossPerDay}
                  onChange={(e) => setMaxLossPerDay(Number(e.target.value))}
                />
              </Field>
              <Field label="Max loss in total" hint="The stop that ends this version.">
                <Input
                  aria-label="Maximum total loss"
                  type="number"
                  min={1}
                  value={maxLossTotal}
                  onChange={(e) => setMaxLossTotal(Number(e.target.value))}
                />
              </Field>
              <Field label="Max position size" hint="Per order, in quote currency.">
                <Input
                  aria-label="Maximum position size"
                  type="number"
                  min={1}
                  value={maxOrderSize}
                  onChange={(e) => setMaxOrderSize(Number(e.target.value))}
                />
              </Field>
              <Field label="Order refresh" hint="Seconds between quote updates.">
                <Input
                  aria-label="Order refresh seconds"
                  type="number"
                  min={1}
                  max={60}
                  value={refreshSec}
                  onChange={(e) => setRefreshSec(Number(e.target.value))}
                />
              </Field>
              <Field label="Hours" hint="When the bot is allowed to trade.">
                <Select
                  aria-label="Trading hours"
                  value={hours}
                  onChange={(e) => setHours(e.target.value as ScheduleId)}
                >
                  {SCHEDULE.hours.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <fieldset className="mt-5 border-t border-[var(--color-border)] pt-4">
              <legend className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                Notifications
              </legend>
              <div className="mt-2 flex flex-col gap-2">
                <Toggle label="When an order fills" checked={notifyFills} onChange={setNotifyFills} />
                <Toggle label="When an order is rejected" checked={notifyErrors} onChange={setNotifyErrors} />
                <Toggle label="A daily summary" checked={notifyDaily} onChange={setNotifyDaily} />
              </div>
            </fieldset>

            <div className="mt-5 border-t border-[var(--color-border)] pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Start mode</p>
              <SegmentedControl<StartMode>
                aria-label="Start mode"
                className="mt-2"
                value={startMode}
                onChange={setStartMode}
                options={[
                  { value: "paused", label: "Start paused" },
                  { value: "live", label: "Start live" },
                ]}
              />
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                Starting paused lets you watch the first quotes before it can fill.
              </p>
            </div>
          </Card>
        </div>

        {/* 3. Review + 4. Safety */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-4">
          <Card>
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Review</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Summary label="Bot" value={title || "Untitled draft"} />
              <Summary label="Kind" value={kind} />
              <Summary label="Venue" value={venue} />
              <Summary label="Capital" value={formatUsd(capital)} />
              <Summary label="Max positions" value={draft.maxPositions ? String(draft.maxPositions) : "3 (sample)"} />
              <Summary label="Daily stop" value={formatUsd(maxLossPerDay)} />
              <Summary label="Total stop" value={formatUsd(maxLossTotal)} />
              <Summary label="Starts" value={startMode === "paused" ? "Paused" : "Live"} />
            </dl>
          </Card>

          <Card className="border-[var(--color-yellow)]/40 bg-[var(--color-yellow)]/5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
              <AlertTriangle className="h-4 w-4 text-[var(--color-yellow)]" aria-hidden="true" />
              Real money
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-muted)]">
              Deploying starts real orders on {draft.exchange || "Binance"} with real funds. The stops above are the only
              thing between the bot and your balance. This screen is a mock: nothing is deployed.
            </p>
          </Card>

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={blocking || phase === "deploying"}
            onClick={() => setConfirmOpen(true)}
          >
            <Rocket className="h-4 w-4" aria-hidden="true" />
            {phase === "deploying" ? "Deploying…" : "Deploy bot"}
          </Button>
          {blocking && (
            <p className="text-xs text-[var(--color-red)]">
              A blocked check has to be fixed first: {rows.find((r) => r.status === "fail")?.label}.
            </p>
          )}
        </div>
      </div>

      {phase === "deploying" && <DeployingPanel stepIndex={stepIndex} />}

      {confirmOpen && (
      <ConfirmDeployDialog
        title={title || "Untitled draft"}
        blocking={blocking}
        openChecks={stillOpen}
        capital={capital}
        venue={venue}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={startDeploy}
      />
      )}
    </div>
  );
}

function CheckRow({ row, onGoTo }: { row: PreFlightRow; onGoTo: StageProps["goTo"] }) {
  const { tone, word, Icon } = STATUS[row.status];
  return (
    <li className="flex items-start gap-3 py-3">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          row.status === "pass"
            ? "text-[var(--color-green)]"
            : row.status === "fail"
              ? "text-[var(--color-red)]"
              : "text-[var(--color-yellow)]"
        }`}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--color-text)]">{row.label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-text-muted)]">{row.detail}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge tone={tone}>{word}</Badge>
        {row.id === "keys" && (
          <Link to="/settings?tab=keys" className="text-xs text-[var(--color-primary)] underline underline-offset-2">
            Settings › Keys and Wallets
          </Link>
        )}
        {row.fix && (
          <button
            type="button"
            onClick={() => onGoTo(row.fix!.to as Parameters<typeof onGoTo>[0])}
            className="text-xs text-[var(--color-primary)] underline underline-offset-2"
          >
            {row.fix.label}
          </button>
        )}
      </div>
    </li>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-[var(--color-text-muted)]">{label}</dt>
      <dd className="truncate text-right font-medium text-[var(--color-text)]">{value}</dd>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-[var(--color-text)]">
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--color-primary)]"
      />
    </label>
  );
}

function DeployingPanel({ stepIndex }: { stepIndex: number }) {
  return (
    <Card role="status" aria-live="polite" aria-label="Deploying the bot">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        Deploying…
      </h2>
      <ol className="mt-3 space-y-2">
        {DEPLOY_STEPS.map((step, i) => {
          const done = i < stepIndex;
          const current = i === stepIndex;
          return (
            <li key={step.id} className="flex items-start gap-3 text-sm" aria-current={current ? "step" : undefined}>
              <span
                className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full ${
                  done ? "text-[var(--color-green)]" : current ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"
                }`}
              >
                {done ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : current ? (
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <CircleDashed className="h-4 w-4" aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0">
                <span className={`block ${done || current ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]"}`}>
                  {step.label}
                </span>
                <span className="block text-xs text-[var(--color-text-muted)]">{step.detail}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/**
 * The typed gate. A modal with a heading and a description, focus taken on
 * open and kept inside, Escape cancels, and the confirm button disabled until
 * the operator types the bot title or DEPLOY.
 */
function ConfirmDeployDialog({
  title,
  blocking,
  openChecks,
  capital,
  venue,
  onCancel,
  onConfirm,
}: {
  title: string;
  blocking: boolean;
  openChecks: readonly PreFlightRow[];
  capital: number;
  venue: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const rootId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mounted only while open: take focus once, no state reset needed.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEscapeKey(true, onCancel);

  const allowed = !blocking && confirmMatches(typed, title);
  const titleId = `${rootId}-title`;
  const descId = `${rootId}-desc`;

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    const inside = !!dialogRef.current?.contains(active);
    if (e.shiftKey && (active === first || !inside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !inside)) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl"
      >
        <h2 id={titleId} className="text-lg font-semibold text-[var(--color-text)]">
          Deploy with real money?
        </h2>
        <p id={descId} className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
          {capital ? formatUsd(capital) : "$0"} of capital on {venue}. Type the bot title ({title}) or {CONFIRM_WORD} to
          confirm.
        </p>

        {openChecks.length > 0 && (
          <div className="mt-3 rounded-md border border-[var(--color-yellow)]/40 bg-[var(--color-yellow)]/5 p-3">
            <p className="text-xs font-semibold text-[var(--color-text)]">Still open</p>
            <ul className="mt-1 list-inside list-disc text-xs text-[var(--color-text-muted)]">
              {openChecks.map((row) => (
                <li key={row.id}>{row.label}</li>
              ))}
            </ul>
          </div>
        )}

        <Field label="Type to confirm" hint={`The bot title or ${CONFIRM_WORD}, case-insensitive.`} className="mt-4">
          <Input
            ref={inputRef}
            aria-label="Confirmation"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={title}
          />
        </Field>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" disabled={!allowed} onClick={onConfirm}>
            {openChecks.length ? "Deploy anyway" : "Deploy bot"}
          </Button>
        </div>
      </div>
    </div>
  );
}
