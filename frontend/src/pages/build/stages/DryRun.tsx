/**
 * Dry Run, the third stage of Build: paper trading on live market data.
 *
 * The design has been replayed on past candles; this is the one rehearsal with
 * a real clock. Same decisions, same fills, no orders: nothing here can lose
 * money, which is exactly why it is worth watching before Deploy.
 *
 * 1. **Setup** — how long, how much paper money, and the two limits at which
 *    the run stops itself.
 * 2. **Live** — a canned session that ticks once a second: the paper P&L, the
 *    orders resting, the fills arriving, a one-line equity curve, the health of
 *    the feed, and how much of the loss limit is used. Pause, stop, or wait for
 *    the clock to run out (about 90 s at this speed).
 * 3. **Review** — the paper run beside the backtest, the fills, and three checks
 *    that answer "ready to go live?". Only then does Continue to Deploy unlock.
 *
 * Numbers tick once a second and are deterministic (`sample/dryRunData`); there
 * is no websocket behind them. With `prefers-reduced-motion` the figures still
 * change — that is data, not motion — but the pulse and the transitions stop.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { usePrefersReducedMotion } from "../../../hooks/usePrefersReducedMotion";
import type { StageProps } from "../types";
import {
  CHECKLIST,
  COMPARE,
  DRY_RUN_DEFAULTS,
  DURATIONS,
  EQUITY_SEED,
  FILL_POOL,
  GUARDRAIL_NOTE,
  OPEN_ORDERS,
  snapshot,
} from "../sample/dryRunData";
import type { DurationId } from "../sample/dryRunData";
import { SAMPLE_DRAFT_LABEL, money } from "../sample/backtestData";

type Phase = "setup" | "live" | "review";

/** Simulated minutes per real second: a 6h rehearsal takes about 90 s. */
const MINUTES_PER_TICK = 4;

const CARD =
  "min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]";
const PRIMARY =
  "inline-flex h-8 items-center justify-center rounded-md bg-[var(--color-primary)] px-3 text-[13px] font-semibold text-[var(--on-primary)] disabled:cursor-not-allowed disabled:opacity-45";
const SECONDARY =
  "inline-flex h-8 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] font-medium text-[var(--color-text)] hover:border-[var(--color-border-hover)]";
const FIELD =
  "h-8 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]";
const LABEL = "text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]";
const TH =
  "px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]";
const TD = "whitespace-nowrap px-2.5 py-1.5 text-[12.5px] text-[var(--color-text)]";

function clock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

function signed(value: number, digits = 2): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(digits)}`;
}


export default function DryRun({ draft, setDraft, goTo }: StageProps) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [duration, setDuration] = useState<DurationId>(DRY_RUN_DEFAULTS.duration);
  const [paperBalance, setPaperBalance] = useState<number>(DRY_RUN_DEFAULTS.paperBalance);
  const [maxDrawdownPct, setMaxDrawdownPct] = useState<number>(DRY_RUN_DEFAULTS.maxDrawdownPct);
  const [stopLossPct, setStopLossPct] = useState<number>(DRY_RUN_DEFAULTS.stopLossPct);
  const [notifyWhenDone, setNotifyWhenDone] = useState<boolean>(DRY_RUN_DEFAULTS.notifyWhenDone);
  const [tick, setTick] = useState(0);
  const [paused, setPaused] = useState(false);

  const reducedMotion = usePrefersReducedMotion();
  const timer = useRef<number | null>(null);
  const ticks = useRef(0);

  const sessionMinutes = DURATIONS.find((d) => d.id === duration)?.minutes ?? 360;
  const maxTicks = Math.max(1, Math.ceil(sessionMinutes / MINUTES_PER_TICK));
  const live = useMemo(() => snapshot(tick, paperBalance, stopLossPct), [tick, paperBalance, stopLossPct]);
  const elapsed = Math.min(sessionMinutes, tick * MINUTES_PER_TICK);
  const remaining = Math.max(0, sessionMinutes - elapsed);
  const guardrailUsed = Math.min(100, Math.round((live.lossPct / (stopLossPct || 1)) * 100));

  const emptyDraft = !draft.strategyType && !draft.pair && !draft.exchange;
  const pair = draft.pair ?? "USDC-USDT";
  const strategy = draft.strategyType ?? "Stable Churn";

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  // One interval, cleared on pause, on stop, on unmount and when the clock runs out.
  useEffect(() => clearTimer, [clearTimer]);

  function review() {
    clearTimer();
    setPhase("review");
  }

  /** The clock counts in a ref as well as in state: the interval can stop
   *  itself on the last tick without a second effect that writes state. */
  useEffect(() => {
    if (phase !== "live" || paused) return;
    const id = window.setInterval(() => {
      ticks.current = Math.min(ticks.current + 1, maxTicks);
      setTick(ticks.current);
      if (ticks.current >= maxTicks) {
        window.clearInterval(id);
        timer.current = null;
      }
    }, 1000);
    timer.current = id;
    return () => {
      window.clearInterval(id);
      timer.current = null;
    };
  }, [phase, paused, maxTicks]);

  /** A session that reached its end shows its review without a second state
   *  write: the tick is the clock. */
  const finished = phase === "live" && tick >= maxTicks;
  const view: Phase = finished ? "review" : phase;

  function start() {
    clearTimer();
    ticks.current = 0;
    setTick(0);
    setPaused(false);
    setPhase("live");
  }

  const fills = FILL_POOL.slice(0, Math.min(FILL_POOL.length, 1 + Math.floor(tick / 3)));

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-5 sm:px-6" data-testid="dry-run-stage">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={LABEL}>Stage 3 of 5</p>
          <h1 className="mt-1 text-xl font-bold text-[var(--color-text)]">Dry Run</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--color-text-muted)]">
            Paper trading on live market data: the design trades against the real book with no orders sent.
            This is where the backtest meets a clock.
          </p>
        </div>
        <span className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Paper only
        </span>
      </header>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {emptyDraft ? (
          <p
            className="rounded-lg border border-dashed border-[var(--color-border)] px-3 py-1.5 text-[12.5px] text-[var(--color-text-muted)]"
            data-testid="sample-draft"
          >
            {SAMPLE_DRAFT_LABEL}
          </p>
        ) : (
          <>
            <span className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[12.5px] text-[var(--color-text)]">
              <span className="text-[var(--color-text-muted)]">Strategy: </span>
              {strategy}
            </span>
            <span className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[12.5px] text-[var(--color-text)]">
              <span className="text-[var(--color-text-muted)]">Pair: </span>
              {pair}
            </span>
          </>
        )}
      </div>

      {view === "setup" && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]" data-testid="dry-run-setup">
          <div className={`${CARD} p-4`}>
            <h2 className="text-[13px] font-semibold text-[var(--color-text)]">Session length</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--color-text-muted)]">
              Long enough to see a full cycle of the pair, short enough to watch.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Session length">
              {DURATIONS.map((d) => {
                const active = duration === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setDuration(d.id)}
                    className={
                      active
                        ? "h-9 rounded-md border border-[var(--color-primary)]/55 bg-[var(--color-primary)]/12 text-[12.5px] font-semibold text-[var(--color-primary)]"
                        : "h-9 rounded-md border border-[var(--color-border)] text-[12.5px] text-[var(--color-text)] hover:border-[var(--color-border-hover)]"
                    }
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>

            <h2 className="mt-5 text-[13px] font-semibold text-[var(--color-text)]">Paper balance</h2>
            <label className="mt-2 block max-w-[220px]">
              <span className={LABEL}>Starting balance</span>
              <div className="mt-1 flex items-center gap-1">
                <span className="text-[13px] text-[var(--color-text-muted)]">$</span>
                <input
                  type="number"
                  min={100}
                  step={100}
                  className={`${FIELD} w-full`}
                  value={paperBalance}
                  onChange={(e) => setPaperBalance(Number(e.target.value))}
                />
              </div>
            </label>

            <h2 className="mt-5 text-[13px] font-semibold text-[var(--color-text)]">Guardrails</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--color-text-muted)]">{GUARDRAIL_NOTE}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={LABEL}>Alert above drawdown</span>
                <div className="mt-1 flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    className={`${FIELD} w-full`}
                    value={maxDrawdownPct}
                    onChange={(e) => setMaxDrawdownPct(Number(e.target.value))}
                  />
                  <span className="text-[13px] text-[var(--color-text-muted)]">%</span>
                </div>
              </label>
              <label className="block">
                <span className={LABEL}>Stop the run at a loss of</span>
                <div className="mt-1 flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    className={`${FIELD} w-full`}
                    value={stopLossPct}
                    onChange={(e) => setStopLossPct(Number(e.target.value))}
                  />
                  <span className="text-[13px] text-[var(--color-text-muted)]">%</span>
                </div>
              </label>
            </div>

            <label className="mt-4 flex items-center gap-2.5 text-[13px] text-[var(--color-text)]">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
                checked={notifyWhenDone}
                onChange={(e) => setNotifyWhenDone(e.target.checked)}
              />
              Notify me when the run finishes
            </label>
          </div>

          <div className={`${CARD} flex flex-col p-4`}>
            <h2 className="text-[13px] font-semibold text-[var(--color-text)]">What this will do</h2>
            <ul className="mt-2 space-y-2 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
              <li>Trades the design against live {pair} prices with paper money.</li>
              <li>Sends no orders to {draft.exchange ?? "Binance"}; nothing leaves this screen.</li>
              <li>Stops itself at a {stopLossPct}% loss and tells you if drawdown passes {maxDrawdownPct}%.</li>
              <li>Then shows the paper run beside the backtest, so the two can be compared.</li>
            </ul>
            <div className="mt-auto pt-4">
              <button type="button" className={`${PRIMARY} w-full`} onClick={start}>
                Start dry run
              </button>
              <p className="mt-2 text-center text-[11.5px] text-[var(--color-text-muted)]">
                {clock(sessionMinutes)} · {money(paperBalance)} paper
              </p>
            </div>
          </div>
        </div>
      )}

      {view === "live" && (
        <div className="mt-4 space-y-4" data-testid="dry-run-live">
          <div className={`${CARD} p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-green)]/45 bg-[var(--color-green)]/10 px-2.5 py-1 text-[11.5px] font-semibold text-[var(--color-green)]">
                  <span
                    aria-hidden="true"
                    className={
                      paused
                        ? "h-1.5 w-1.5 rounded-full bg-[var(--color-green)]"
                        : "h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-green)] motion-reduce:animate-none"
                    }
                  />
                  {paused ? "Paused" : "Paper trading"}
                </span>
                <span className="text-[12.5px] text-[var(--color-text-muted)]" data-testid="dry-run-clock">
                  {clock(elapsed)} elapsed · {clock(remaining)} left
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={SECONDARY}
                  onClick={() => {
                    setPaused((p) => !p);
                    clearTimer();
                  }}
                >
                  {paused ? "Resume" : "Pause"}
                </button>
                <button type="button" className={SECONDARY} onClick={review}>
                  Stop and review
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div>
                <p className={LABEL}>Realised P&amp;L</p>
                <p
                  className={`mt-0.5 text-lg font-bold tabular-nums ${
                    live.realised >= 0 ? "text-[var(--color-green)]" : "text-[var(--color-red)]"
                  }`}
                  data-testid="realised"
                >
                  {signed(live.realised)}
                </p>
              </div>
              <div>
                <p className={LABEL}>Unrealised</p>
                <p
                  className={`mt-0.5 text-lg font-bold tabular-nums ${
                    live.unrealised >= 0 ? "text-[var(--color-green)]" : "text-[var(--color-red)]"
                  }`}
                >
                  {signed(live.unrealised)}
                </p>
              </div>
              <div>
                <p className={LABEL}>Paper equity</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-[var(--color-text)]">
                  {money(live.equity[live.equity.length - 1])}
                </p>
              </div>
              <div>
                <p className={LABEL}>Fills</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-[var(--color-text)]">{live.filledOrders}</p>
              </div>
            </div>

            <div className="mt-3 h-10">
              <p className="sr-only">
                Live equity: started at {money(EQUITY_SEED[0])}, now {money(live.equity[live.equity.length - 1])}.
              </p>
              <Sparkline values={live.equity} reducedMotion={reducedMotion} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className={`${CARD} overflow-hidden`}>
              <h3 className="p-4 pb-2 text-[13px] font-semibold text-[var(--color-text)]">Open orders</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <caption className="sr-only">Orders resting in the paper account, with how much has filled.</caption>
                  <thead>
                    <tr className="border-y border-[var(--color-border)]">
                      <th scope="col" className={TH}>
                        Side
                      </th>
                      <th scope="col" className={TH}>
                        Price
                      </th>
                      <th scope="col" className={TH}>
                        Quantity
                      </th>
                      <th scope="col" className={TH}>
                        Filled
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {OPEN_ORDERS.map((order) => (
                      <tr key={order.id} className="border-b border-[var(--color-border)] last:border-0">
                        <td className={`${TD} font-medium`}>{order.side}</td>
                        <td className={`${TD} tabular-nums`}>{order.price.toFixed(4)}</td>
                        <td className={`${TD} tabular-nums`}>{order.qty.toLocaleString("en-US")}</td>
                        <td className={`${TD} tabular-nums text-[var(--color-text-muted)]`}>{order.filledPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={`${CARD} p-4`}>
              <h3 className="text-[13px] font-semibold text-[var(--color-text)]">Recent fills</h3>
              <ul className="mt-2 space-y-1" aria-live="polite">
                {fills.map((fill) => (
                  <li key={fill.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="text-[var(--color-text-muted)] tabular-nums">{fill.time}</span>
                    <span className="text-[var(--color-text)]">
                      {fill.side} {fill.qty.toLocaleString("en-US")}
                    </span>
                    <span className={`tabular-nums font-semibold ${fill.pnl >= 0 ? "text-[var(--color-green)]" : "text-[var(--color-red)]"}`}>
                      {signed(fill.pnl)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11.5px] text-[var(--color-text-muted)]">
                {pair} only · {strategy}
              </p>
            </div>
          </div>

          <div className={`${CARD} p-4`}>
            <h3 className="text-[13px] font-semibold text-[var(--color-text)]">Health and guardrails</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <dl className="grid grid-cols-3 gap-2 text-[12.5px]">
                <div>
                  <dt className="text-[var(--color-text-muted)]">Data feed</dt>
                  <dd className="flex items-center gap-1 font-medium text-[var(--color-green)]">
                    <span aria-hidden="true">●</span> OK
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-muted)]">Latency</dt>
                  <dd className="tabular-nums text-[var(--color-text)]">{live.latencyMs} ms</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-muted)]">Fill rate</dt>
                  <dd className="tabular-nums text-[var(--color-text)]">{live.fillRate}%</dd>
                </div>
              </dl>
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[12.5px] text-[var(--color-text-muted)]">Loss limit used</p>
                  <p
                    className={`tabular-nums text-[12.5px] font-semibold ${
                      live.guardrailBreached ? "text-[var(--color-red)]" : "text-[var(--color-text)]"
                    }`}
                  >
                    {live.lossPct.toFixed(1)}% of {stopLossPct}%
                  </p>
                </div>
                <div
                  className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-bg)]"
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={guardrailUsed}
                  aria-label="Share of the stop-loss limit used"
                >
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${
                      guardrailUsed >= 100 ? "bg-[var(--color-red)]" : "bg-[var(--color-yellow)]"
                    }`}
                    style={{ width: `${guardrailUsed}%` }}
                  />
                </div>
                <p className="mt-1 text-[11.5px] text-[var(--color-text-muted)]">
                  {live.guardrailBreached
                    ? "Limit reached: the run would stop here."
                    : "The run stops itself if the loss reaches the limit."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === "review" && (
        <div className="mt-4 space-y-4" data-testid="dry-run-review">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[13px] font-semibold text-[var(--color-text)]">
              Paper run · {clock(elapsed)} of a {clock(sessionMinutes)} session · {money(paperBalance)}
            </h2>
            <p className="text-[12px] text-[var(--color-text-muted)]">Sample results</p>
          </div>

          <div className={`${CARD} overflow-hidden`}>
            <h3 className="p-4 pb-2 text-[13px] font-semibold text-[var(--color-text)]">
              Paper beside backtest
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" data-testid="dry-run-compare">
                <caption className="sr-only">
                  The paper run next to the backtest it repeats. A better number is green and carries a plus
                  sign; a worse one is red with a minus sign.
                </caption>
                <thead>
                  <tr className="border-y border-[var(--color-border)]">
                    <th scope="col" className={TH}>
                      Measure
                    </th>
                    <th scope="col" className={TH}>
                      Backtest
                    </th>
                    <th scope="col" className={TH}>
                      Paper
                    </th>
                    <th scope="col" className={TH}>
                      Difference
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--color-border)] last:border-0">
                      <th scope="row" className={`${TD} text-left font-medium`}>
                        {row.label}
                        <span className="block text-[11px] font-normal leading-snug text-[var(--color-text-muted)]">
                          {row.note}
                        </span>
                      </th>
                      <td className={`${TD} tabular-nums text-[var(--color-text-muted)]`}>{row.backtest}</td>
                      <td className={`${TD} tabular-nums`}>{row.paper}</td>
                      <td
                        className={`${TD} tabular-nums font-semibold ${
                          row.better ? "text-[var(--color-green)]" : "text-[var(--color-red)]"
                        }`}
                      >
                        {row.delta}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-4 pb-3 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">
              A paper run is hours and a backtest is months, so compare the shape of the two rather than the
              size. Green means the paper run did at least as well as the backtest on that measure.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className={`${CARD} overflow-hidden`}>
              <h3 className="p-4 pb-2 text-[13px] font-semibold text-[var(--color-text)]">Fills</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <caption className="sr-only">Every fill of the paper session, with its own profit or loss.</caption>
                  <thead>
                    <tr className="border-y border-[var(--color-border)]">
                      <th scope="col" className={TH}>
                        Time
                      </th>
                      <th scope="col" className={TH}>
                        Side
                      </th>
                      <th scope="col" className={TH}>
                        Quantity
                      </th>
                      <th scope="col" className={TH}>
                        P&amp;L
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {FILL_POOL.map((fill) => (
                      <tr key={fill.id} className="border-b border-[var(--color-border)] last:border-0">
                        <td className={`${TD} tabular-nums text-[var(--color-text-muted)]`}>{fill.time}</td>
                        <td className={`${TD} font-medium`}>{fill.side}</td>
                        <td className={`${TD} tabular-nums`}>{fill.qty.toLocaleString("en-US")}</td>
                        <td className={`${TD} tabular-nums font-semibold ${fill.pnl >= 0 ? "text-[var(--color-green)]" : "text-[var(--color-red)]"}`}>
                          {signed(fill.pnl)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={`${CARD} p-4`}>
              <h3 className="text-[13px] font-semibold text-[var(--color-text)]">Ready to go live?</h3>
              <ul className="mt-2 space-y-2">
                {CHECKLIST.map((item) => (
                  <li key={item.id} className="flex gap-2">
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        item.pass
                          ? "bg-[var(--color-green)]/20 text-[var(--color-green)]"
                          : "bg-[var(--color-red)]/20 text-[var(--color-red)]"
                      }`}
                    >
                      {item.pass ? "✓" : "!"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-medium text-[var(--color-text)]">
                        {item.label}
                        <span className="sr-only">{item.pass ? " (passed)" : " (not passed)"}</span>
                      </p>
                      <p className="text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">
                Two of three passed. The third is not a failure of the strategy, it is a reason to run one
                longer session before money is involved.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button type="button" className={SECONDARY} onClick={() => goTo("backtest")}>
              Back to Backtest
            </button>
            <button
              type="button"
              className={SECONDARY}
              onClick={() => {
                clearTimer();
                ticks.current = 0;
                setTick(0);
                setPaused(false);
                setPhase("setup");
              }}
            >
              Run another dry run
            </button>
            <button
              type="button"
              className={PRIMARY}
              data-testid="continue-deploy"
              onClick={() => {
                setDraft({ dryRunDone: true });
                goTo("deploy");
              }}
            >
              Continue to Deploy
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** The live equity, one polyline, no axes: it only has to move. */
function Sparkline({ values, reducedMotion }: { values: readonly number[]; reducedMotion: boolean }) {
  const W = 320;
  const H = 40;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values
    .map(
      (v, i) =>
        `${((i / (values.length - 1)) * (W - 4) + 2).toFixed(1)},${(H - 3 - ((v - min) / span) * (H - 6)).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-10 w-full"
      role="img"
      aria-label="Paper equity since the session started (sample data)"
      preserveAspectRatio="none"
    >
      <polyline
        points={pts}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        className={reducedMotion ? undefined : "transition-all duration-500"}
      />
    </svg>
  );
}
