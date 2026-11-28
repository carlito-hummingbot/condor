/**
 * Backtest, the second stage of Build: configure, run, read, decide.
 *
 * Four things in one screen, in the order an operator uses them:
 *
 * 1. **Setup** — the range, the candle interval, the money and the costs. The
 *    draft's pair and market type are read-only chips: they come from Design
 *    and are not a backtest setting.
 * 2. **Running** — a progress bar with the three things a simulation does. The
 *    timing is canned (about 2.4 s); there is no job behind it yet.
 * 3. **Results** — six numbers, the equity curve against buy-and-hold, the
 *    drawdown, a weekly return strip, the trades behind it and the assumptions
 *    that produced them. The verdict says what the numbers mean in a sentence,
 *    and names the ways a backtest lies.
 * 4. **Decide** — refine the design, run again, or carry the run into Dry Run.
 *
 * Everything shown is sample data from `sample/backtestData`. The only things
 * that leave this file are the two stage actions and the `backtestDone` flag.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import type { StageProps } from "../types";
import {
  ASSUMPTIONS,
  DRAWDOWN,
  EQUITY,
  INTERVALS,
  KPIS,
  RANGE_PRESETS,
  RUN_HISTORY,
  SAMPLE_BALANCE,
  SAMPLE_DRAFT_LABEL,
  TRADES,
  VERDICT,
  WEEKLY_RETURNS,
  money,
  pct,
} from "../sample/backtestData";
import type { RunRow } from "../sample/backtestData";

type Phase = "setup" | "running" | "results";
type SortKey = "time" | "side" | "qty" | "price" | "fee" | "pnl";

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

const FEE_TIERS = [
  { id: "zero", label: "0.00% / 0.00%", note: "fee-free venue" },
  { id: "retail", label: "0.02% / 0.05%", note: "VIP 0" },
  { id: "taker", label: "0.05% / 0.10%", note: "market orders" },
] as const;

const SLIPPAGE = [
  { id: "0", label: "0 bps" },
  { id: "2", label: "2 bps" },
  { id: "5", label: "5 bps" },
  { id: "10", label: "10 bps" },
] as const;

const STEPS = ["Loading data", "Simulating", "Computing metrics"] as const;

/** The demo's "today". Fixed so the date presets and the tests are stable. */
const TODAY = "2026-11-28";

function shiftDays(from: string, days: number): string {
  const d = new Date(`${from}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function tone(value: number): string {
  if (value > 0) return "text-[var(--color-green)]";
  if (value < 0) return "text-[var(--color-red)]";
  return "text-[var(--color-text-muted)]";
}

function signed(value: number, digits = 2): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(digits)}`;
}

export default function Backtest({ draft, setDraft, goTo }: StageProps) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [step, setStep] = useState(0);
  const [presetId, setPresetId] = useState<string>("90d");
  const [from, setFrom] = useState(shiftDays(TODAY, 90));
  const [to, setTo] = useState(TODAY);
  const [interval, setInterval] = useState<string>("5m");
  const [balance, setBalance] = useState<number>(SAMPLE_BALANCE);
  const [feeTier, setFeeTier] = useState<string>("retail");
  const [slippage, setSlippage] = useState<string>("2");
  const [runs, setRuns] = useState<readonly RunRow[]>(RUN_HISTORY);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "time", dir: "desc" });
  const [compareId, setCompareId] = useState<string | null>(null);

  const timers = useRef<number[]>([]);

  /** One place that clears every canned step, on unmount or on Cancel. */
  const clearTimers = () => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  };

  // A run in flight must not tick a stage that has been unmounted.
  useEffect(() => {
    const pending = timers;
    return () => {
      for (const t of pending.current) window.clearTimeout(t);
      pending.current = [];
    };
  }, []);

  const emptyDraft = !draft.strategyType && !draft.pair && !draft.exchange;
  const chips = [
    { label: "Strategy", value: draft.strategyType ?? "Stable Churn" },
    { label: "Exchange", value: draft.exchange ?? "Binance" },
    { label: "Market", value: draft.marketType ?? "Spot" },
    { label: "Pair", value: draft.pair ?? "USDC-USDT" },
  ];

  const rangeDays = RANGE_PRESETS.find((p) => p.id === presetId)?.days ?? 90;
  const rangeLabel = `${rangeDays} days`;

  function pickPreset(id: string) {
    const found = RANGE_PRESETS.find((p) => p.id === id);
    if (!found) return;
    setPresetId(id);
    setTo(TODAY);
    setFrom(shiftDays(TODAY, found.days));
  }

  function run() {
    clearTimers();
    setStep(0);
    setPhase("running");
    timers.current = [
      window.setTimeout(() => setStep(1), 900),
      window.setTimeout(() => setStep(2), 1700),
      window.setTimeout(() => setStep(3), 2400),
      window.setTimeout(() => {
        setPhase("results");
        setRuns((prev) => [
          {
            id: `run-${prev.length + 1}`,
            label: `run ${prev.length + 1}`,
            when: "just now",
            range: rangeLabel,
            interval,
            netReturn: 18.4,
            maxDrawdown: -7.2,
            sharpe: 1.42,
            trades: 168,
          },
          ...prev,
        ]);
      }, 2500),
    ];
  }

  function cancel() {
    clearTimers();
    setStep(0);
    setPhase("setup");
  }

  const trades = useMemo(() => {
    const rows = TRADES.map((t, index) => ({ ...t, index }));
    const direction = sort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      if (sort.key === "time") return (a.index - b.index) * direction;
      if (sort.key === "side") return a.side.localeCompare(b.side) * direction;
      return (a[sort.key] - b[sort.key]) * direction;
    });
    return rows;
  }, [sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" },
    );
  }

  const newest = runs[0];
  const compared = runs.find((r) => r.id === compareId) ?? null;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-5 sm:px-6" data-testid="backtest-stage">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={LABEL}>Stage 2 of 5</p>
          <h1 className="mt-1 text-xl font-bold text-[var(--color-text)]">Backtest</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--color-text-muted)]">
            Replay the design on past candles before any money moves. One run answers one question: did this
            idea work on this data, after costs?
          </p>
        </div>
        <span className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Sample data
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
          chips.map((chip) => (
            <span
              key={chip.label}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[12.5px] text-[var(--color-text)]"
            >
              <span className="text-[var(--color-text-muted)]">{chip.label}: </span>
              {chip.value}
            </span>
          ))
        )}
      </div>

      {phase === "setup" && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]" data-testid="backtest-setup">
          <div className={`${CARD} p-4`}>
            <h2 className="text-[13px] font-semibold text-[var(--color-text)]">Data range</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--color-text-muted)]">
              Longer ranges are harder to overfit; shorter ones react faster to a change.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Data range presets">
              {RANGE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={presetId === p.id}
                  onClick={() => pickPreset(p.id)}
                  className={
                    presetId === p.id
                      ? "h-8 rounded-md border border-[var(--color-primary)]/55 bg-[var(--color-primary)]/12 px-3 text-[12.5px] font-semibold text-[var(--color-primary)]"
                      : "h-8 rounded-md border border-[var(--color-border)] px-3 text-[12.5px] text-[var(--color-text)] hover:border-[var(--color-border-hover)]"
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={LABEL}>From</span>
                <input
                  type="date"
                  className={`${FIELD} mt-1 w-full`}
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setPresetId("custom");
                  }}
                />
              </label>
              <label className="block">
                <span className={LABEL}>To</span>
                <input
                  type="date"
                  className={`${FIELD} mt-1 w-full`}
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setPresetId("custom");
                  }}
                />
              </label>
            </div>

            <h2 className="mt-5 text-[13px] font-semibold text-[var(--color-text)]">Candle interval</h2>
            <div className="mt-2 flex gap-1.5" role="group" aria-label="Candle interval">
              {INTERVALS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={interval === value}
                  onClick={() => setInterval(value)}
                  className={
                    interval === value
                      ? "h-8 min-w-[52px] rounded-md border border-[var(--color-primary)]/55 bg-[var(--color-primary)]/12 px-3 text-[12.5px] font-semibold text-[var(--color-primary)]"
                      : "h-8 min-w-[52px] rounded-md border border-[var(--color-border)] px-3 text-[12.5px] text-[var(--color-text)] hover:border-[var(--color-border-hover)]"
                  }
                >
                  {value}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[12px] text-[var(--color-text-muted)]">
              Fine candles cost more to simulate and add noise; coarse ones miss the fills.
            </p>
          </div>

          <div className={`${CARD} p-4`}>
            <h2 className="text-[13px] font-semibold text-[var(--color-text)]">Money and costs</h2>
            <label className="mt-3 block">
              <span className={LABEL}>Starting balance</span>
              <div className="mt-1 flex items-center gap-1">
                <span className="text-[13px] text-[var(--color-text-muted)]">$</span>
                <input
                  type="number"
                  min={100}
                  step={100}
                  className={`${FIELD} w-full`}
                  value={balance}
                  onChange={(e) => setBalance(Number(e.target.value))}
                />
              </div>
            </label>
            <label className="mt-3 block">
              <span className={LABEL}>Fee tier assumption</span>
              <select
                className={`${FIELD} mt-1 w-full`}
                value={feeTier}
                onChange={(e) => setFeeTier(e.target.value)}
              >
                {FEE_TIERS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label} — {f.note}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block">
              <span className={LABEL}>Slippage assumption</span>
              <select
                className={`${FIELD} mt-1 w-full`}
                value={slippage}
                onChange={(e) => setSlippage(e.target.value)}
              >
                {SLIPPAGE.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-3 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
              A signal that only survives at zero fees is not a signal. These two decide whether the run is
              honest.
            </p>
            <button type="button" className={`${PRIMARY} mt-4 w-full`} onClick={run}>
              Run backtest
            </button>
            <p className="mt-2 text-center text-[11.5px] text-[var(--color-text-muted)]">
              {rangeLabel} · {interval} · {money(balance)} · fees {FEE_TIERS.find((f) => f.id === feeTier)?.label} ·{" "}
              {SLIPPAGE.find((s) => s.id === slippage)?.label}
            </p>
          </div>
        </div>
      )}

      {phase === "running" && (
        <div className={`${CARD} mt-4 p-5`} data-testid="backtest-running">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[13px] font-semibold text-[var(--color-text)]">Running the backtest</h2>
            <button type="button" className={SECONDARY} onClick={cancel}>
              Cancel
            </button>
          </div>
          <div
            className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--color-bg)]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={step === 0 ? 8 : step === 1 ? 45 : step === 2 ? 78 : 100}
            aria-label="Backtest progress"
            data-testid="backtest-progress"
          >
            <div
              className="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-700 ease-out motion-reduce:transition-none"
              style={{ width: `${step === 0 ? 8 : step === 1 ? 45 : step === 2 ? 78 : 100}%` }}
            />
          </div>
          <ol className="mt-4 space-y-2">
            {STEPS.map((name, index) => {
              const done = index < step;
              const active = index === step;
              return (
                <li key={name} className="flex items-center gap-2 text-[13px]">
                  <span
                    aria-hidden="true"
                    className={
                      done
                        ? "flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-green)] text-[10px] font-bold text-[var(--color-bg)]"
                        : active
                          ? "h-4 w-4 animate-pulse rounded-full border-2 border-[var(--color-primary)] motion-reduce:animate-none"
                          : "h-4 w-4 rounded-full border border-[var(--color-border)]"
                    }
                  >
                    {done ? "✓" : ""}
                  </span>
                  <span className={done || active ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]"}>
                    {name}
                  </span>
                  {active && <span className="text-[12px] text-[var(--color-text-muted)]">…</span>}
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-[12px] text-[var(--color-text-muted)]">
            {rangeLabel} · {interval} · sample data, so the run finishes in a couple of seconds.
          </p>
        </div>
      )}

      {phase === "results" && (
        <div className="mt-4 space-y-4" data-testid="backtest-results">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[13px] font-semibold text-[var(--color-text)]">
              Results · {rangeLabel} · {interval} · {money(balance)}
            </h2>
            <p className="text-[12px] text-[var(--color-text-muted)]">Sample results, one path</p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6" data-testid="backtest-kpis">
            {KPIS.map((kpi) => (
              <div key={kpi.id} className={`${CARD} p-3`}>
                <p className={LABEL}>{kpi.label}</p>
                <p
                  className={`mt-1 text-lg font-bold tabular-nums ${
                    kpi.tone === "up"
                      ? "text-[var(--color-green)]"
                      : kpi.tone === "down"
                        ? "text-[var(--color-red)]"
                        : "text-[var(--color-text)]"
                  }`}
                >
                  {kpi.value}
                </p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--color-text-muted)]">{kpi.note}</p>
              </div>
            ))}
          </div>

          <div className={`${CARD} p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[13px] font-semibold text-[var(--color-text)]">Equity against buy-and-hold</h3>
              <ul className="flex items-center gap-3 text-[11.5px] text-[var(--color-text-muted)]">
                <li className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="h-0.5 w-4 rounded bg-[var(--color-primary)]" />
                  Strategy
                </li>
                <li className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="h-0.5 w-4 rounded bg-[var(--color-text-muted)]" />
                  Buy and hold
                </li>
              </ul>
            </div>
            <p className="sr-only">
              Equity curve: the strategy ends at {money(EQUITY[EQUITY.length - 1].strategy)} and buy-and-hold at{" "}
              {money(EQUITY[EQUITY.length - 1].hold)}, both from {money(SAMPLE_BALANCE)}, over 90 days.
            </p>
            <EquityChart />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className={`${CARD} flex flex-col p-4`}>
              <h3 className="text-[13px] font-semibold text-[var(--color-text)]">Drawdown</h3>
              <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                How far below the last peak the account sat. The worst was {pct(-7.2)} on day 41.
              </p>
              <p className="sr-only">
                Drawdown strip: mostly between zero and minus four percent, with one dip to minus 7.2 percent
                around day 41.
              </p>
              <DrawdownChart />
            </div>
            <div className={`${CARD} p-4`}>
              <h3 className="text-[13px] font-semibold text-[var(--color-text)]">Weekly returns</h3>
              <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                Thirteen weeks, green up and red down. A run that only wins in one week is not a run.
              </p>
              <p className="sr-only">
                Weekly returns: {WEEKLY_RETURNS.filter((w) => w.pct > 0).length} of 13 weeks positive, best{" "}
                {pct(Math.max(...WEEKLY_RETURNS.map((w) => w.pct)))}, worst{" "}
                {pct(Math.min(...WEEKLY_RETURNS.map((w) => w.pct)))}.
              </p>
              <HeatStrip />
            </div>
          </div>

          <div className={`${CARD} overflow-hidden`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 p-4 pb-2">
              <h3 className="text-[13px] font-semibold text-[var(--color-text)]">Trades</h3>
              <p className="text-[12px] text-[var(--color-text-muted)]">Showing the 10 most recent of 168</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" data-testid="backtest-trades">
                <caption className="sr-only">
                  The ten most recent trades of the run, sortable by column. A positive profit and loss is in
                  green with a plus sign, a loss in red with a minus sign.
                </caption>
                <thead>
                  <tr className="border-y border-[var(--color-border)]">
                    {(
                      [
                        ["time", "Time"],
                        ["side", "Side"],
                        ["qty", "Quantity"],
                        ["price", "Price"],
                        ["fee", "Fee"],
                        ["pnl", "P&L"],
                      ] as const
                    ).map(([key, label]) => (
                      <th
                        key={key}
                        scope="col"
                        className={TH}
                        aria-sort={
                          sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"
                        }
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort(key)}
                          className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-[var(--color-text)]"
                        >
                          {label}
                          <span aria-hidden="true" className="text-[9px]">
                            {sort.key === key ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </button>
                      </th>
                    ))}
                    <th scope="col" className={TH}>
                      Pair
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade) => (
                    <tr key={trade.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className={TD}>{trade.time}</td>
                      <td className={`${TD} font-medium`}>{trade.side}</td>
                      <td className={`${TD} tabular-nums`}>{trade.qty.toLocaleString("en-US")}</td>
                      <td className={`${TD} tabular-nums`}>{trade.price.toFixed(4)}</td>
                      <td className={`${TD} tabular-nums text-[var(--color-text-muted)]`}>
                        ${trade.fee.toFixed(2)}
                      </td>
                      <td className={`${TD} tabular-nums font-semibold ${tone(trade.pnl)}`}>
                        {signed(trade.pnl)}
                      </td>
                      <td className={`${TD} text-[var(--color-text-muted)]`}>{trade.pair}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`${CARD} border-[var(--color-green)]/35 bg-[var(--color-green)]/8 p-4`}>
            <p className="text-[14px] font-semibold text-[var(--color-text)]">{VERDICT.headline}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">{VERDICT.detail}</p>
            <ul className="mt-2 space-y-1">
              {VERDICT.caveats.map((caveat) => (
                <li key={caveat} className="flex gap-2 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
                  <span aria-hidden="true" className="text-[var(--color-yellow)]">
                    !
                  </span>
                  {caveat}
                </li>
              ))}
            </ul>
          </div>

          <div className={`${CARD} p-4`} data-testid="backtest-history">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-[13px] font-semibold text-[var(--color-text)]">Run history</h3>
              <p className="text-[12px] text-[var(--color-text-muted)]">Same design, different settings</p>
            </div>
            <ul className="mt-2 divide-y divide-[var(--color-border)]">
              {runs.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium text-[var(--color-text)]">
                      v1 {row.label} <span className="text-[var(--color-text-muted)]">· {row.when}</span>
                    </p>
                    <p className="text-[11.5px] text-[var(--color-text-muted)]">
                      {row.range} · {row.interval} · net {pct(row.netReturn)} · drawdown {pct(row.maxDrawdown)} ·
                      Sharpe {row.sharpe.toFixed(2)} · {row.trades} trades
                    </p>
                  </div>
                  {runs.length > 1 && row.id !== newest.id && (
                    <button
                      type="button"
                      className={SECONDARY}
                      aria-pressed={compareId === row.id}
                      onClick={() => setCompareId(compareId === row.id ? null : row.id)}
                    >
                      {compareId === row.id ? "Hide compare" : `Compare with ${newest.label}`}
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {compared && newest && compared.id !== newest.id && (
              <div className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  {compared.label} against {newest.label}
                </p>
                <dl className="mt-1.5 grid gap-1.5 text-[12.5px] sm:grid-cols-3">
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-[var(--color-text-muted)]">Net return</dt>
                    <dd className={`tabular-nums font-semibold ${tone(newest.netReturn - compared.netReturn)}`}>
                      {signed(newest.netReturn - compared.netReturn)} pts
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-[var(--color-text-muted)]">Max drawdown</dt>
                    <dd
                      className={`tabular-nums font-semibold ${tone(compared.maxDrawdown - newest.maxDrawdown)}`}
                    >
                      {signed(compared.maxDrawdown - newest.maxDrawdown)} pts{" "}
                      {compared.maxDrawdown >= newest.maxDrawdown ? "shallower" : "deeper"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 sm:block">
                    <dt className="text-[var(--color-text-muted)]">Trades</dt>
                    <dd className="tabular-nums font-semibold text-[var(--color-text)]">
                      {newest.trades - compared.trades}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>

          <div className={`${CARD} p-4`}>
            <h3 className="text-[13px] font-semibold text-[var(--color-text)]">Assumptions behind these numbers</h3>
            <ul className="mt-2 space-y-1.5">
              {ASSUMPTIONS.map((line) => (
                <li key={line} className="text-[12px] leading-relaxed text-[var(--color-text-muted)]">
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button type="button" className={SECONDARY} onClick={() => goTo("design")}>
              Refine the design
            </button>
            <button type="button" className={SECONDARY} onClick={() => setPhase("setup")}>
              Run again with changes
            </button>
            <button
              type="button"
              className={PRIMARY}
              data-testid="continue-dry-run"
              onClick={() => {
                setDraft({ backtestDone: true });
                goTo("dry-run");
              }}
            >
              Continue to Dry Run
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Two lines from the same $10,000, drawn to the size of the card. */
function EquityChart() {
  const W = 640;
  const H = 200;
  const pad = 6;
  const all = EQUITY.flatMap((p) => [p.strategy, p.hold]);
  const hi = Math.max(...all);
  const lo = Math.min(...all);
  const span = hi - lo || 1;
  const x = (day: number) => pad + (day / (EQUITY.length - 1)) * (W - pad * 2);
  const y = (v: number) => pad + ((hi - v) / span) * (H - pad * 2);
  const line = (key: "strategy" | "hold") =>
    EQUITY.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.day).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  const area = `${line("strategy")} L${x(EQUITY.length - 1).toFixed(1)},${H - pad} L${x(0).toFixed(1)},${H - pad} Z`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mt-2 h-auto w-full"
      role="img"
      aria-label="Equity curve against buy-and-hold (sample data)"
    >
      <defs>
        <linearGradient id="bt-equity-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#bt-equity-fill)" />
      <path d={line("hold")} fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeDasharray="4 3" />
      <path d={line("strategy")} fill="none" stroke="var(--color-primary)" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}

/** Filled area under zero: the deeper the dip, the taller the red. */
function DrawdownChart() {
  const W = 320;
  const H = 110;
  const pad = 4;
  const worst = Math.min(...DRAWDOWN.map((p) => p.drawdown)) || -1;
  const x = (day: number) => pad + (day / 90) * (W - pad * 2);
  const y = (v: number) => pad + (Math.abs(v) / Math.abs(worst)) * (H - pad * 2);
  const line = DRAWDOWN.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.day).toFixed(1)},${y(p.drawdown).toFixed(1)}`).join(" ");
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mt-2 min-h-[120px] w-full flex-1"
      role="img"
      aria-label="Drawdown under the running peak (sample data)"
      preserveAspectRatio="none"
    >
      <path d={`${line} L${W - pad},${pad} L${pad},${pad} Z`} fill="var(--color-red)" fillOpacity="0.18" />
      <path d={line} fill="none" stroke="var(--color-red)" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

/** Thirteen cells, one per week, opacity by size of the move. */
function HeatStrip() {
  const worst = Math.max(...WEEKLY_RETURNS.map((w) => Math.abs(w.pct))) || 1;
  return (
    <div
      className="mt-3 grid gap-1.5"
      style={{ gridTemplateColumns: "repeat(13, minmax(0, 1fr))" }}
      role="img"
      aria-label="Weekly returns (sample data)"
    >
      {WEEKLY_RETURNS.map((week) => {
        const up = week.pct >= 0;
        const alpha = 0.15 + (Math.abs(week.pct) / worst) * 0.7;
        return (
          <div key={week.week} className="flex min-w-0 flex-col items-center gap-1">
            <div
              className="h-9 w-full rounded-md border border-[var(--color-border)]"
              style={{
                backgroundColor: up
                  ? `color-mix(in srgb, var(--color-green) ${Math.round(alpha * 100)}%, transparent)`
                  : `color-mix(in srgb, var(--color-red) ${Math.round(alpha * 100)}%, transparent)`,
              }}
              title={`${week.week}: ${pct(week.pct)}`}
            />
            <span className="text-[9px] tabular-nums text-[var(--color-text-muted)] sm:text-[10px]">
              {up ? "+" : "−"}
              {Math.abs(week.pct).toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
