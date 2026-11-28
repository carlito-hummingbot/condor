/**
 * Sample data for the showcase Backtest stage.
 *
 * Everything here is canned: a seeded curve, a fixed set of trades and the
 * numbers a 90-day run would report. Nothing is fetched and nothing is
 * computed from a real market. Replace this module with the backtest service
 * when the run actually simulates.
 */

export const SAMPLE_BALANCE = 10_000;

/** The sample run the results screen describes when nobody changed anything. */
export const SAMPLE_RUN = {
  rangeDays: 90,
  interval: "5m",
  startingBalance: SAMPLE_BALANCE,
  feeTier: "0.02% maker / 0.05% taker",
  slippage: "2 bps",
} as const;

export interface EquityPoint {
  /** Day index from the start of the range. */
  day: number;
  /** Strategy equity in dollars. */
  strategy: number;
  /** Buy-and-hold equity in dollars, the line it is judged against. */
  hold: number;
}

export interface DrawdownPoint {
  day: number;
  /** Negative percentage from the running peak. */
  drawdown: number;
}

export interface WeekReturn {
  /** Label for the strip, e.g. "W1". */
  week: string;
  /** Percentage return for the week. */
  pct: number;
}

export interface TradeRow {
  id: string;
  time: string;
  side: "Buy" | "Sell";
  pair: string;
  qty: number;
  price: number;
  fee: number;
  pnl: number;
}

export interface Kpi {
  id: string;
  label: string;
  value: string;
  note: string;
  tone: "up" | "down" | "flat";
}

export interface RunRow {
  id: string;
  label: string;
  when: string;
  range: string;
  interval: string;
  netReturn: number;
  maxDrawdown: number;
  sharpe: number;
  trades: number;
}

/** A small seeded generator, so the curve is the same on every reload and in
 *  every test. Not a market model: a drift with a wobble. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function curve(days: number, drift: number, vol: number, seed: number): number[] {
  const rand = seeded(seed);
  let level = SAMPLE_BALANCE;
  const out = [level];
  for (let d = 1; d <= days; d += 1) {
    const shock = (rand() - 0.5) * 2 * vol;
    const pull = Math.sin(d / 9) * vol * 0.35;
    level = Math.max(level * 0.9, level * (1 + drift + shock + pull));
    out.push(level);
  }
  return out;
}

/** 91 points: day 0 plus one per day of the 90-day range. */
export const EQUITY: readonly EquityPoint[] = (() => {
  const strategy = curve(90, 0.0019, 0.0075, 20261128);
  const hold = curve(90, 0.0007, 0.011, 771);
  return strategy.map((value, day) => ({ day, strategy: Math.round(value), hold: Math.round(hold[day]) }));
})();

export const DRAWDOWN: readonly DrawdownPoint[] = (() => {
  let peak = EQUITY[0].strategy;
  return EQUITY.map(({ day, strategy }) => {
    peak = Math.max(peak, strategy);
    return { day, drawdown: Math.round(((strategy - peak) / peak) * 10000) / 100 };
  });
})();

export const WEEKLY_RETURNS: readonly WeekReturn[] = (() => {
  const out: WeekReturn[] = [];
  for (let w = 0; w < 13; w += 1) {
    const from = EQUITY[Math.min(w * 7, 90)].strategy;
    const to = EQUITY[Math.min(w * 7 + 7, 90)].strategy;
    out.push({ week: `W${w + 1}`, pct: Math.round(((to - from) / from) * 10000) / 100 });
  }
  return out;
})();

/** Six numbers: the row the operator reads first. */
export const KPIS: readonly Kpi[] = [
  { id: "net", label: "Net return", value: "+18.4%", note: "+$1,840 on $10,000", tone: "up" },
  { id: "dd", label: "Max drawdown", value: "−7.2%", note: "worst dip, day 41", tone: "down" },
  { id: "win", label: "Win rate", value: "61%", note: "103 of 168 trades", tone: "up" },
  { id: "sharpe", label: "Sharpe", value: "1.42", note: "90 days, 5m candles", tone: "up" },
  { id: "trades", label: "Trades", value: "168", note: "1.9 a day", tone: "flat" },
  { id: "fees", label: "Fees paid", value: "$214", note: "1.8% of gross", tone: "down" },
];

/** Ten rows is what the table shows; the run did 168 trades. */
export const TRADES: readonly TradeRow[] = [
  { id: "t1", time: "Nov 27, 14:05", side: "Buy", pair: "USDC-USDT", qty: 1200, price: 0.9998, fee: 0.24, pnl: 1.86 },
  { id: "t2", time: "Nov 27, 16:40", side: "Sell", pair: "USDC-USDT", qty: 1200, price: 1.0004, fee: 0.3, pnl: 0.42 },
  { id: "t3", time: "Nov 26, 09:12", side: "Buy", pair: "USDC-USDT", qty: 2400, price: 0.9991, fee: 0.48, pnl: 3.12 },
  { id: "t4", time: "Nov 25, 22:31", side: "Sell", pair: "USDC-USDT", qty: 900, price: 1.0007, fee: 0.23, pnl: 1.44 },
  { id: "t5", time: "Nov 25, 11:58", side: "Buy", pair: "USDC-USDT", qty: 1500, price: 0.9995, fee: 0.3, pnl: -0.68 },
  { id: "t6", time: "Nov 24, 18:03", side: "Sell", pair: "USDC-USDT", qty: 1500, price: 0.9995, fee: 0.3, pnl: -0.68 },
  { id: "t7", time: "Nov 23, 07:47", side: "Buy", pair: "USDC-USDT", qty: 3000, price: 0.9989, fee: 0.6, pnl: 2.95 },
  { id: "t8", time: "Nov 22, 15:19", side: "Sell", pair: "USDC-USDT", qty: 1100, price: 1.0002, fee: 0.28, pnl: 0.77 },
  { id: "t9", time: "Nov 21, 20:44", side: "Buy", pair: "USDC-USDT", qty: 800, price: 0.9993, fee: 0.16, pnl: 0.51 },
  { id: "t10", time: "Nov 20, 12:26", side: "Sell", pair: "USDC-USDT", qty: 800, price: 1.0, fee: 0.16, pnl: 0.4 },
];

export const ASSUMPTIONS = [
  "Fills at the mid price of the 5m candle, plus the slippage assumption below.",
  "Maker fee 0.02% when the order rests, taker 0.05% when it crosses; the tier comes from the setup card.",
  "No funding is charged on the stablecoin pair in this sample.",
  "The curve is one path, not an average of many: read it as an example, not a forecast.",
] as const;

/** The two runs already on the board, newest first. */
export const RUN_HISTORY: readonly RunRow[] = [
  { id: "run-2", label: "run 2", when: "today, 14:02", range: "30 days", interval: "15m", netReturn: 6.1, maxDrawdown: -4.4, sharpe: 1.03, trades: 71 },
  { id: "run-1", label: "run 1", when: "today, 13:51", range: "90 days", interval: "5m", netReturn: 18.4, maxDrawdown: -7.2, sharpe: 1.42, trades: 168 },
];

export const VERDICT = {
  headline: "Looks promising: positive return with moderate drawdown",
  detail:
    "+18.4% over 90 days against +6.1% for buy-and-hold, and the worst dip was 7.2%. That is a real edge on this sample, not a certain one.",
  caveats: [
    "One pair, one venue, one 90-day window: a strategy fitted to this window can look better than it is.",
    "168 trades is a thin sample for a 61% win rate.",
    "Fees and slippage are assumptions, and they matter more than the signal at this trade size.",
  ],
} as const;

export const RANGE_PRESETS = [
  { id: "7d", label: "7D", days: 7 },
  { id: "30d", label: "30D", days: 30 },
  { id: "90d", label: "90D", days: 90 },
  { id: "1y", label: "1Y", days: 365 },
] as const;

export const INTERVALS = ["1m", "5m", "1h"] as const;

/** The header shown when the demo opens straight on Backtest, with no draft. */
export const SAMPLE_DRAFT_LABEL = "Sample draft: Stable Churn on Binance, USDC-USDT";

export function money(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function pct(n: number, digits = 1): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(digits)}%`;
}
