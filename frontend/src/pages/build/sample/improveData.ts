/**
 * Sample data for the Improve stage: what a live bot did against what the
 * backtest and the dry run predicted, how healthy it looks, and what to change
 * next. All numbers are sample data.
 */

export const SAMPLE_DRAFT_LINE = "Sample draft: Stable Churn on Binance, USDC-USDT";

export type MetricUnit = "usd" | "pct" | "ratio" | "count";

export interface PerfRow {
  id: string;
  label: string;
  live: number;
  backtest: number;
  dryRun: number;
  unit: MetricUnit;
  /** False for drawdown and latency, where less is better. */
  higherIsBetter: boolean;
}

export const PERF_ROWS: readonly PerfRow[] = [
  { id: "pnl", label: "Net P&L", live: 412.8, backtest: 468.2, dryRun: 396.4, unit: "usd", higherIsBetter: true },
  { id: "return", label: "Return", live: 2.1, backtest: 2.4, dryRun: 2.0, unit: "pct", higherIsBetter: true },
  { id: "drawdown", label: "Max drawdown", live: 3.4, backtest: 2.8, dryRun: 3.9, unit: "pct", higherIsBetter: false },
  { id: "fill-rate", label: "Fill rate", live: 61, backtest: 72, dryRun: 58, unit: "pct", higherIsBetter: true },
  { id: "trades", label: "Fills", live: 1_284, backtest: 1_390, dryRun: 1_246, unit: "count", higherIsBetter: true },
  { id: "spread", label: "Captured spread", live: 1.9, backtest: 2.2, dryRun: 1.8, unit: "ratio", higherIsBetter: true },
];

export type HealthStatus = "ok" | "warn" | "bad";

export interface HealthRow {
  id: "fill-rate" | "latency" | "errors" | "uptime" | "inventory";
  label: string;
  value: string;
  status: HealthStatus;
  detail: string;
}

export const HEALTH_ROWS: readonly HealthRow[] = [
  { id: "fill-rate", label: "Fill rate", value: "61%", status: "ok", detail: "Above the 50% floor." },
  { id: "latency", label: "Latency p95", value: "240 ms", status: "ok", detail: "Under the 400 ms target." },
  { id: "errors", label: "Errors, 24h", value: "3", status: "warn", detail: "Three order rejections, all re-quoted." },
  { id: "uptime", label: "Uptime", value: "99.2%", status: "ok", detail: "Seven minutes of planned downtime." },
  { id: "inventory", label: "Inventory skew", value: "+$18", status: "warn", detail: "Slightly long USDC over the last hour." },
];

export type RiskLevel = "low" | "medium" | "high";

export interface Suggestion {
  id: string;
  title: string;
  reason: string;
  impact: string;
  risk: RiskLevel;
}

export const SUGGESTIONS: readonly Suggestion[] = [
  {
    id: "spread",
    title: "Widen the spread from 0.08% to 0.10%",
    reason: "Fills land 1.9 bp inside the backtest's captured spread, and the loss shows up in quiet hours.",
    impact: "About +$26 a day at the same fill rate",
    risk: "low",
  },
  {
    id: "skew",
    title: "Lean quotes against inventory after 2 fills",
    reason: "Inventory skew reached +$18 twice today; the backtest re-centres faster than the live bot does.",
    impact: "Less inventory risk, roughly flat P&L",
    risk: "medium",
  },
  {
    id: "hours",
    title: "Stop between 02:00 and 04:00 UTC",
    reason: "That window carries 31% of the drawdown and 6% of the P&L in the live results.",
    impact: "Drawdown from 3.4% to about 2.6%",
    risk: "high",
  },
];

export interface VersionRow {
  id: string;
  version: string;
  status: "live" | "draft" | "archived";
  changed: string;
  when: string;
}

export const VERSIONS: readonly VersionRow[] = [
  { id: "v2", version: "v2", status: "draft", changed: "Spread 0.10%, inventory lean", when: "Not deployed" },
  { id: "v1", version: "v1", status: "live", changed: "First deploy, 0.08% spread", when: "Deployed 3 days ago" },
];

export const SAMPLE_NOTE = "Sample data: live results are placeholders, not a real session.";

/** "+$55.40" / "-$28.10" — the sign is always shown, per the house rule. */
export function formatDelta(value: number, unit: MetricUnit): string {
  const sign = value > 0 ? "+" : value < 0 ? "\u2212" : "";
  const abs = Math.abs(value);
  if (unit === "usd") return `${sign}$${abs.toFixed(2)}`;
  if (unit === "pct") return `${sign}${abs.toFixed(1)}%`;
  if (unit === "count") return `${sign}${Math.round(abs).toLocaleString("en-US")}`;
  return `${sign}${abs.toFixed(1)}\u00d7`;
}

/** The live value, formatted for the table and the summary line. */
export function formatValue(value: number, unit: MetricUnit): string {
  if (unit === "usd") return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (unit === "pct") return `${value.toFixed(1)}%`;
  if (unit === "count") return value.toLocaleString("en-US");
  return `${value.toFixed(1)}\u00d7`;
}

/** Live minus the prediction, in the metric's own unit. */
export function delta(row: PerfRow, against: "backtest" | "dryRun"): number {
  return row.live - row[against];
}

/** Whether that delta is good news for this metric. */
export function deltaIsGood(row: PerfRow, against: "backtest" | "dryRun"): boolean | null {
  const d = delta(row, against);
  if (d === 0) return null;
  return row.higherIsBetter ? d > 0 : d < 0;
}

/** The text alternative for the bar chart: one sentence, read by a screen reader. */
export function perfSummary(rows: readonly PerfRow[] = PERF_ROWS): string {
  const parts = rows.map((row) => `${row.label} ${formatValue(row.live, row.unit)} live, ${formatValue(row.backtest, row.unit)} backtest`);
  return `Live against backtest: ${parts.join("; ")}.`;
}

/** v1 -> v2: strip an old version suffix, then add " v2". */
export function nextVersionTitle(title: string): string {
  const base = title.trim().replace(/\s+v\d+$/i, "") || "Untitled draft";
  return `${base} v2`;
}
