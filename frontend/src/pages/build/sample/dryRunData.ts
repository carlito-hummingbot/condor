/**
 * Sample data for the showcase Dry Run stage.
 *
 * A dry run is paper trading on live market data: same decisions, no orders.
 * Nothing here reaches a venue. The live view advances from a canned seed so
 * the numbers tick like a real session while the UI is being reviewed.
 */

export const DURATIONS = [
  { id: "1h", label: "1 hour", minutes: 60 },
  { id: "6h", label: "6 hours", minutes: 360 },
  { id: "24h", label: "24 hours", minutes: 1440 },
  { id: "7d", label: "7 days", minutes: 10_080 },
] as const;

export type DurationId = (typeof DURATIONS)[number]["id"];

export const DRY_RUN_DEFAULTS = {
  duration: "6h" as DurationId,
  paperBalance: 10_000,
  maxDrawdownPct: 5,
  stopLossPct: 8,
  notifyWhenDone: true,
} as const;

export interface OpenOrder {
  id: string;
  side: "Buy" | "Sell";
  pair: string;
  price: number;
  qty: number;
  filledPct: number;
}

export interface Fill {
  id: string;
  time: string;
  side: "Buy" | "Sell";
  pair: string;
  qty: number;
  price: number;
  pnl: number;
}

export const OPEN_ORDERS: readonly OpenOrder[] = [
  { id: "o1", side: "Buy", pair: "USDC-USDT", price: 0.9994, qty: 1200, filledPct: 0 },
  { id: "o2", side: "Sell", pair: "USDC-USDT", price: 1.0009, qty: 900, filledPct: 35 },
  { id: "o3", side: "Buy", pair: "USDC-USDT", price: 0.9988, qty: 2400, filledPct: 0 },
];

export const FILL_POOL: readonly Fill[] = [
  { id: "f1", time: "14:41:08", side: "Buy", pair: "USDC-USDT", qty: 600, price: 0.9996, pnl: 0.24 },
  { id: "f2", time: "14:38:52", side: "Sell", pair: "USDC-USDT", qty: 400, price: 1.0003, pnl: 0.28 },
  { id: "f3", time: "14:35:19", side: "Buy", pair: "USDC-USDT", qty: 800, price: 0.9991, pnl: -0.11 },
  { id: "f4", time: "14:31:44", side: "Sell", pair: "USDC-USDT", qty: 250, price: 1.0006, pnl: 0.19 },
  { id: "f5", time: "14:27:03", side: "Buy", pair: "USDC-USDT", qty: 1000, price: 0.9998, pnl: 0.37 },
  { id: "f6", time: "14:22:37", side: "Sell", pair: "USDC-USDT", qty: 500, price: 1.0001, pnl: 0.16 },
  { id: "f7", time: "14:18:02", side: "Buy", pair: "USDC-USDT", qty: 700, price: 0.9992, pnl: 0.31 },
  { id: "f8", time: "14:12:55", side: "Sell", pair: "USDC-USDT", qty: 300, price: 0.9999, pnl: -0.07 },
  { id: "f9", time: "14:07:31", side: "Buy", pair: "USDC-USDT", qty: 900, price: 0.9989, pnl: 0.42 },
];

/** The base of the live equity line before the ticking starts. */
export const EQUITY_SEED: readonly number[] = [
  10_000, 10_004, 10_001, 10_009, 10_012, 10_008, 10_015, 10_019, 10_016, 10_023, 10_027, 10_024,
  10_031, 10_036, 10_033, 10_039, 10_044, 10_041, 10_047, 10_052,
];

export interface Snapshot {
  tick: number;
  realised: number;
  unrealised: number;
  equity: number[];
  latencyMs: number;
  fillRate: number;
  filledOrders: number;
  /** Loss so far as a percentage of the paper balance, positive number. */
  lossPct: number;
  guardrailBreached: boolean;
}

/** One second of a canned session. Deterministic: the same tick always gives
 *  the same numbers, so tests can assert on them. */
export function snapshot(tick: number, paperBalance: number, stopLossPct: number): Snapshot {
  const wobble = Math.sin(tick / 3.1) * 1.9 + Math.cos(tick / 7.7) * 0.9;
  const realised = Math.round((4.2 + tick * 0.11 + wobble * 0.4) * 100) / 100;
  const unrealised = Math.round((1.6 + Math.sin(tick / 2.3) * 1.4) * 100) / 100;
  const last = EQUITY_SEED[EQUITY_SEED.length - 1];
  const equity = [...EQUITY_SEED, last + realised + unrealised];
  const lossPct = unrealised < 0 ? Math.round((-unrealised / paperBalance) * 10_000) / 100 : 0;
  return {
    tick,
    realised,
    unrealised,
    equity,
    latencyMs: 38 + (tick % 5),
    fillRate: Math.round((98.2 + (tick % 7) * 0.1) * 10) / 10,
    filledOrders: Math.min(9, 3 + Math.floor(tick / 4)),
    lossPct,
    guardrailBreached: lossPct >= stopLossPct,
  };
}

export interface CompareRow {
  id: string;
  label: string;
  backtest: string;
  paper: string;
  /** The gap in the metric's own units, signed. */
  delta: string;
  /** Green when the paper run did at least as well, red when it did worse. */
  better: boolean;
  note: string;
}

export const COMPARE: readonly CompareRow[] = [
  { id: "net", label: "Net return", backtest: "+18.4%", paper: "+0.7%", delta: "−17.7 pts", better: true, note: "a 5h session cannot earn 90 days of return; compare shape, not size" },
  { id: "dd", label: "Max drawdown", backtest: "−7.2%", paper: "−1.1%", delta: "+6.1 pts shallower", better: true, note: "well inside the 5% guardrail" },
  { id: "win", label: "Win rate", backtest: "61%", paper: "67%", delta: "+6 pts", better: true, note: "9 fills is too few to trust a rate" },
  { id: "sharpe", label: "Sharpe", backtest: "1.42", paper: "1.18", delta: "−0.24", better: false, note: "expected to sag over hours" },
  { id: "trades", label: "Fills", backtest: "168", paper: "9", delta: "−159", better: false, note: "a day of live fills is not a sample" },
];

export interface ChecklistItem {
  id: string;
  label: string;
  detail: string;
  pass: boolean;
}

export const CHECKLIST: readonly ChecklistItem[] = [
  { id: "ran", label: "The paper run reached its end or was stopped on purpose", detail: "6h session, stopped at 5h 12m", pass: true },
  { id: "guardrail", label: "Drawdown stayed inside the limit", detail: "worst 1.1% against a 5% limit", pass: true },
  { id: "fills", label: "Enough fills to judge the fills themselves", detail: "9 fills; a day or more would be a sample", pass: false },
];

export const GUARDRAIL_NOTE =
  "The dry run stops itself and tells you if the loss reaches the limit you set. It never sends an order.";
