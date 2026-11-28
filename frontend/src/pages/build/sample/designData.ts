/**
 * The Design stage's sample data and its small pure helpers.
 *
 * Showcase only: the venues, pairs, hints and assistant replies below are
 * written by hand, nothing is fetched, and no value here is a live market.
 * The guide form, the "Your draft" panel and the design chat all read from
 * this one file, so the demo stays consistent with itself.
 */

import type { BotKind, Draft, MarketType, StrategyType } from "../types";

/* ── Bot kind ───────────────────────────────────────────────────────────── */

export interface BotKindInfo {
  value: BotKind;
  label: string;
  /** The one line that tells the two apart, shown under the control. */
  hint: string;
}

export const BOT_KINDS: readonly BotKindInfo[] = [
  {
    value: "strategy",
    label: "Strategy",
    hint: "A rule-based setup you configure: it does exactly what the rules say.",
  },
  {
    value: "agent",
    label: "Agent",
    hint: "AI-driven: it reads the market and decides, inside limits you set.",
  },
];

/* ── What it does ───────────────────────────────────────────────────────── */

export interface StrategyTypeInfo {
  value: StrategyType;
  /** The chip's one-line hint, shown under the chips and as its tooltip. */
  hint: string;
  /** The verb phrase "Suggest from my choices" and the chat use. */
  does: string;
}

export const STRATEGY_TYPES: readonly StrategyTypeInfo[] = [
  {
    value: "Market Making",
    hint: "Quotes both sides of the book and earns the spread.",
    does: "quotes both sides of the book to earn the spread",
  },
  {
    value: "Arbitrage",
    hint: "Buys on one venue, sells on another when the gap pays.",
    does: "buys and sells the same pair across venues when the gap pays",
  },
  {
    value: "Funding Rate",
    hint: "Holds a delta-neutral position to collect funding.",
    does: "holds a delta-neutral position to collect the funding payment",
  },
  {
    value: "Cross Exchange MM",
    hint: "Quotes on two venues at once to keep their prices in line.",
    does: "quotes on two venues at once to keep their prices in line",
  },
  {
    value: "Directional",
    hint: "Takes one side of a trend and exits on a stop.",
    does: "takes one side of the trend and exits on a stop",
  },
  {
    value: "LP",
    hint: "Provides liquidity in a pool and earns the fees.",
    does: "provides liquidity to the pool and earns the fees",
  },
];

export function strategyInfo(value: StrategyType | null): StrategyTypeInfo | null {
  return STRATEGY_TYPES.find((type) => type.value === value) ?? null;
}

/* ── Where it trades ────────────────────────────────────────────────────── */

export interface ExchangeInfo {
  id: string;
  label: string;
  kind: "CEX" | "DEX";
  /** The sample pairs this venue lists. */
  pairs: readonly string[];
  /** The market types the venue offers before the type adds LP. */
  markets: readonly MarketType[];
  note: string;
}

export const EXCHANGES: readonly ExchangeInfo[] = [
  {
    id: "Binance",
    label: "Binance",
    kind: "CEX",
    pairs: ["BTC-USDT", "ETH-USDT", "SOL-USDC", "BNB-USDT", "XRP-USDT", "DOGE-USDT"],
    markets: ["Spot", "Perps"],
    note: "Deepest book in the sample set.",
  },
  {
    id: "Bybit",
    label: "Bybit",
    kind: "CEX",
    pairs: ["BTC-USDT", "ETH-USDT", "SOL-USDT", "ARB-USDT", "TON-USDT"],
    markets: ["Spot", "Perps"],
    note: "Perps first, with a smaller spot book.",
  },
  {
    id: "Gate",
    label: "Gate",
    kind: "CEX",
    pairs: ["BTC-USDT", "ETH-USDT", "GT-USDT", "PEPE-USDT"],
    markets: ["Spot", "Perps"],
    note: "Long tail of small caps.",
  },
  {
    id: "OKX",
    label: "OKX",
    kind: "CEX",
    pairs: ["BTC-USDT", "ETH-USDT", "SOL-USDT", "OKB-USDT"],
    markets: ["Spot", "Perps"],
    note: "Good cross-venue arb counterpart.",
  },
  {
    id: "KuCoin",
    label: "KuCoin",
    kind: "CEX",
    pairs: ["BTC-USDT", "ETH-USDT", "KCS-USDT", "SUI-USDT"],
    markets: ["Spot", "Perps"],
    note: "Wide listing, thinner size.",
  },
  {
    id: "Hyperliquid",
    label: "Hyperliquid",
    kind: "DEX",
    pairs: ["BTC-USD", "ETH-USD", "SOL-USD", "HYPE-USD"],
    markets: ["Perps"],
    note: "On-chain order book, perps only.",
  },
  {
    id: "Meteora (DEX)",
    label: "Meteora (DEX)",
    kind: "DEX",
    pairs: ["SOL-USDC", "JUP-SOL", "JITO-SOL", "USDT-USDC"],
    markets: ["Spot", "LP"],
    note: "Solana pools: LP lives here.",
  },
  {
    id: "Uniswap (DEX)",
    label: "Uniswap (DEX)",
    kind: "DEX",
    pairs: ["ETH-USDC", "WBTC-ETH", "ARB-USDC"],
    markets: ["Spot", "LP"],
    note: "Ethereum pools, LP allowed.",
  },
];

export function findExchange(id: string | null): ExchangeInfo | null {
  if (!id) return null;
  return EXCHANGES.find((exchange) => exchange.id === id) ?? null;
}

/** The pairs the picker offers for a venue; every sample pair before one. */
export function pairsFor(exchange: string | null): string[] {
  const found = findExchange(exchange);
  if (!found) return [...new Set(EXCHANGES.flatMap((row) => row.pairs))];
  return [...found.pairs];
}

export interface MarketOption {
  value: MarketType;
  label: string;
  enabled: boolean;
  /** Why the option is off, or what choosing it means. */
  reason: string;
}

/**
 * Spot and Perps depend on the venue; LP needs the LP type or a DEX pool.
 * Every option keeps its reason so a disabled one can say why.
 */
export function marketOptions(exchange: string | null, strategyType: StrategyType | null): MarketOption[] {
  const found = findExchange(exchange);
  const lpByType = strategyType === "LP";
  const lpByVenue = found?.markets.includes("LP") ?? false;
  const lp = lpByType || lpByVenue;
  const venueAllows = (value: MarketType) => !found || found.markets.includes(value);

  return [
    {
      value: "Spot",
      label: "Spot",
      enabled: venueAllows("Spot"),
      reason: found && !venueAllows("Spot") ? `${found.label} does not list spot here.` : "Buy and sell the asset itself.",
    },
    {
      value: "Perps",
      label: "Perps",
      enabled: venueAllows("Perps"),
      reason:
        found && !venueAllows("Perps")
          ? `${found.label} offers no perpetuals here.`
          : "Perpetual futures: leveraged, no delivery.",
    },
    {
      value: "LP",
      label: "LP",
      enabled: lp,
      reason: lp
        ? lpByType
          ? "You chose the LP type: the bot provides liquidity to a pool."
          : `${found?.label ?? "This venue"} is a DEX: the bot provides liquidity to a pool.`
        : "LP needs the LP strategy type or a DEX such as Meteora.",
    },
  ];
}

export const MARKET_QTY_OPTIONS: readonly number[] = [1, 2, 10];
export const MAX_POSITIONS_OPTIONS: readonly number[] = [1, 3, 5];

/* ── Starting point ─────────────────────────────────────────────────────── */

export const STARTING_POINTS = [
  {
    value: "import" as const,
    label: "Import",
    hint: "Bring in a bot you already have: from Learn, a paste, or a file.",
  },
  {
    value: "scratch" as const,
    label: "Start from scratch",
    hint: "Answer the guide and the assistant writes the first description with you.",
  },
];

/** The "File" tab of the chooser: sample files, nothing is uploaded. */
export const IMPORT_FILES = [
  {
    id: "mm-yaml",
    name: "sample-market-making.yaml",
    detail: "Market Making · Binance spot · BTC-USDT",
    howItWorks:
      "Quotes both sides of BTC-USDT on Binance spot with a 0.12% band, 1% of book size per quote, and a 2% stop on each position. Sample file.",
  },
  {
    id: "agent-json",
    name: "sample-funding-agent.json",
    detail: "Funding Rate · Bybit perps · ETH-USDT",
    howItWorks:
      "Watches the ETH-USDT funding rate on Bybit perps and holds a delta-neutral position while the rate pays more than 0.01% per 8 hours. Sample file.",
  },
] as const;

/* ── Suggestions ────────────────────────────────────────────────────────── */

/** "Suggest from my choices": one sentence built from the guide. */
export function suggestHowItWorks(draft: Draft): string {
  const info = strategyInfo(draft.strategyType);
  if (!info) return "";
  const kind = draft.botKind === "agent" ? "agent" : "bot";
  const venue = draft.exchange ?? "your exchange";
  const market = draft.marketType ? draft.marketType.toLowerCase() : "spot";
  const pair = draft.pair ?? "your pair";
  const positions = draft.maxPositions ?? 3;
  return `This ${kind} ${info.does} on ${venue} ${market} ${pair}. It watches up to ${
    draft.marketQty ?? 1
  } market${(draft.marketQty ?? 1) === 1 ? "" : "s"} at once, never holds more than ${positions} position${
    positions === 1 ? "" : "s"
  }, and stops out if a position moves 2% against entry.`;
}

/** A title from the type and the pair, editable like any other field. */
export function suggestTitle(draft: Draft): string {
  const parts = [draft.pair, draft.strategyType].filter(Boolean) as string[];
  if (parts.length === 0) return "";
  return `${parts.join(" ")} ${draft.botKind === "agent" ? "Agent" : "Bot"}`;
}

/* ── The guide's steps ─────────────────────────────────────────────────── */

/** The Design stage's steps, in order. `review` is the summary that starts the chat. */
export type DesignStepId = "starting" | "style" | "markets" | "limits" | "review";

export const DESIGN_STEPS: readonly { id: DesignStepId; title: string }[] = [
  { id: "starting", title: "Starting point" },
  { id: "style", title: "Trading Style" },
  { id: "markets", title: "Markets" },
  { id: "limits", title: "Limits" },
  { id: "review", title: "Review" },
];

/* ── Pairs and percentages, as typed ────────────────────────────────────── */

/** BASE-QUOTE: letters and digits on both sides, e.g. BTC-USDT, 1INCH-USDT. */
const PAIR_SHAPE = /^[A-Z0-9]{2,10}-[A-Z0-9]{2,10}$/;

export interface ParsedPairs {
  /** Every valid, normalised pair in typed order, duplicates dropped. */
  valid: string[];
  /** The entries that do not read as BASE-QUOTE, as typed (trimmed, uppercased). */
  invalid: string[];
}

/** Split a comma list into pairs: trimmed, uppercased, de-duplicated, each shape-checked. */
export function parsePairs(text: string): ParsedPairs {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const raw of text.split(",")) {
    const entry = raw.trim().toUpperCase();
    if (!entry) continue;
    if (!PAIR_SHAPE.test(entry)) {
      if (!invalid.includes(entry)) invalid.push(entry);
      continue;
    }
    if (!valid.includes(entry)) valid.push(entry);
  }
  return { valid, invalid };
}

/** The pair field is ready when it has one valid pair, or when the agent picks them. */
export function pairsReady(draft: Draft): boolean {
  return draft.pairsDynamic || parsePairs(draft.pairsText).valid.length > 0;
}

/** Spread percentages: positive numbers, comma separated, trimmed, de-duplicated. */
export interface ParsedSpreads {
  valid: number[];
  invalid: string[];
}

export function parseSpreads(text: string): ParsedSpreads {
  const valid: number[] = [];
  const invalid: string[] = [];
  for (const raw of text.split(",")) {
    const entry = raw.trim();
    if (!entry) continue;
    const value = Number(entry);
    if (!Number.isFinite(value) || value <= 0 || value > 100) {
      if (!invalid.includes(entry)) invalid.push(entry);
      continue;
    }
    if (!valid.includes(value)) valid.push(value);
  }
  return { valid, invalid };
}

/** Spreads are asked for, and count, only while the Trading Style is Market Making. */
export function spreadsShown(draft: Draft): boolean {
  return draft.strategyType === "Market Making";
}

/* ── The numeric limits ─────────────────────────────────────────────────── */

/** Percent fields keep a plain number; the bounds are the form's own, not a promise. */
export function percentError(value: number | null, label: string): string | null {
  if (value === null || Number.isNaN(value)) return `${label} is required.`;
  if (value <= 0) return `${label} must be greater than 0.`;
  if (value > 100) return `${label} must be 100 or less.`;
  return null;
}

/** Max Positions, when Fixed: a whole number, at least 1, no upper guessing beyond 100. */
export function positionsError(value: number | null): string | null {
  if (value === null || Number.isNaN(value)) return "Max positions is required.";
  if (!Number.isInteger(value)) return "Max positions must be a whole number.";
  if (value < 1) return "Max positions must be at least 1.";
  if (value > 100) return "Max positions must be 100 or less.";
  return null;
}

/* ── Gating ─────────────────────────────────────────────────────────────── */

export interface RequiredField {
  key: "botKind" | "strategyType" | "exchange" | "marketType" | "pair" | "title";
  label: string;
  filled: (draft: Draft) => boolean;
}

export const REQUIRED_FIELDS: readonly RequiredField[] = [
  { key: "botKind", label: "Bot type", filled: (d) => Boolean(d.botKind) },
  { key: "strategyType", label: "Trading Style", filled: (d) => Boolean(d.strategyType) },
  { key: "exchange", label: "Target exchange", filled: (d) => Boolean(d.exchange) },
  { key: "marketType", label: "Market type", filled: (d) => Boolean(d.marketType) },
  { key: "pair", label: "Market pair(s)", filled: (d) => d.pairsDynamic || d.pairs.length > 0 },
  { key: "title", label: "Desired title", filled: (d) => Boolean(d.title.trim()) },
];

/** The labels of the required fields still empty, in form order. */
export function missingRequired(draft: Draft): string[] {
  return REQUIRED_FIELDS.filter((field) => !field.filled(draft)).map((field) => field.label);
}

/** What one step still needs, in the wizard's own order. Empty means Next may go on. */
export function stepProblems(draft: Draft, step: DesignStepId): string[] {
  const problems: string[] = [];
  switch (step) {
    case "starting":
      if (!draft.botKind) problems.push("Bot type");
      if (!draft.startingPoint) problems.push("Starting point");
      return problems;
    case "style":
      if (!draft.strategyType) problems.push("Trading Style");
      return problems;
    case "markets": {
      if (!draft.exchange) problems.push("Target exchange");
      if (!draft.marketType) problems.push("Market type");
      if (!draft.pairsDynamic && parsePairs(draft.pairsText).valid.length === 0) problems.push("Market pair(s)");
      return problems;
    }
    case "limits": {
      if (spreadsShown(draft) && parseSpreads(draft.spreads).valid.length === 0) problems.push("Spreads");
      if (percentError(draft.targetProfit, "Target Profit")) problems.push("Target Profit");
      if (percentError(draft.stopLoss, "Stop Loss")) problems.push("Stop Loss");
      if (!draft.maxPositionsMode) problems.push("Max positions");
      if (draft.maxPositionsMode === "fixed" && positionsError(draft.maxPositions)) problems.push("Max positions");
      return problems;
    }
    case "review":
      if (!draft.title.trim()) problems.push("Desired title");
      return problems;
  }
}

/** Every value the summary panel and the chip bar show, in step order. */
export function draftRows(draft: Draft): { label: string; value: string }[] {
  const pairs = draft.pairsDynamic
    ? "Dynamic (chosen by the agent)"
    : draft.pairs.length > 0
      ? draft.pairs.join(", ")
      : "—";
  const rows: { label: string; value: string }[] = [
    { label: "Bot type", value: draft.botKind === "agent" ? "Agent" : draft.botKind === "strategy" ? "Strategy" : "—" },
    { label: "Trading Style", value: draft.strategyType ?? "—" },
    { label: "Exchange", value: draft.exchange ?? "—" },
    { label: "Market", value: draft.marketType ?? "—" },
    { label: "Pairs", value: pairs },
  ];
  if (spreadsShown(draft)) {
    const spreads = parseSpreads(draft.spreads).valid;
    rows.push({ label: "Spreads", value: spreads.length ? `${spreads.join(", ")}%` : "—" });
  }
  rows.push(
    { label: "Target profit", value: draft.targetProfit === null ? "—" : `${draft.targetProfit}%` },
    { label: "Stop loss", value: draft.stopLoss === null ? "—" : `${draft.stopLoss}%` },
    {
      label: "Max positions",
      value:
        draft.maxPositionsMode === "dynamic"
          ? "Dynamic (depends on budget)"
          : draft.maxPositionsMode === "fixed" && draft.maxPositions
            ? String(draft.maxPositions)
            : "—",
    },
    {
      label: "Starting point",
      value: draft.startingPoint === "import" ? "Import" : draft.startingPoint === "scratch" ? "From scratch" : "—",
    },
    { label: "Title", value: draft.title.trim() || "—" },
  );
  return rows;
}

/* ── The design chat ────────────────────────────────────────────────────── */

export interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  text?: string;
  bullets?: string[];
}

/** The assistant's first message: the draft in three bullets, one question. */
export function openingMessage(draft: Draft): ChatMessage {
  const kind = draft.botKind === "agent" ? "agent" : "strategy";
  const info = strategyInfo(draft.strategyType);
  const venue = draft.exchange ?? "an exchange to pick";
  const markets = `${draft.marketType ?? "—"} ${draft.pair ?? "—"}`;
  return {
    id: "opening",
    role: "assistant",
    bullets: [
      `A ${kind}: ${draft.strategyType ?? "type to pick"}, titled “${draft.title.trim() || "Untitled"}”.`,
      `It trades ${markets} on ${venue}, up to ${draft.marketQty ?? 1} market${
        (draft.marketQty ?? 1) === 1 ? "" : "s"
      } and ${draft.maxPositions ?? 3} open position${(draft.maxPositions ?? 3) === 1 ? "" : "s"}.`,
      `In your words: ${draft.howItWorks.trim() || `${info?.does ?? "it trades"} (no description yet).`}`,
    ],
    text:
      draft.strategyType === "Market Making"
        ? "Before Backtest: how wide should the quotes be when the book is thin, and do you want a stop-loss on each position?"
        : draft.strategyType === "LP"
          ? "Before Backtest: which fee tier should the pool sit in, and how much of the position may sit out of range?"
          : "Before Backtest: what should it do when volatility doubles — quote wider, trade smaller, or stand still?",
  };
}

/** The canned reply to typed text; the demo never leaves the page. */
const CANNED_REPLIES = [
  "Understood — I added a 2% stop-loss on each position, so a leg that runs past that is closed. Everything else stays as it is. Anything else before Backtest?",
  "Done. In volatile windows the bot will quote wider and smaller instead of pulling out, and I've written that down under Design notes. Ready to test it?",
  "Noted. I'll keep the size cap you described and check it again in Dry Run. One more: do you want a daily loss limit before we finish designing?",
  "Here is how it stands: it watches your pair on your exchange, quotes inside your bands, and never holds more positions than the cap you set. Should I tighten the spread band?",
];

export function cannedReply(turn: number): string {
  return CANNED_REPLIES[turn % CANNED_REPLIES.length];
}

/** The three chips under the composer, each with the note it leaves behind. */
export const SUGGESTIONS = [
  {
    id: "stop-loss",
    label: "Add a stop-loss",
    note: "Stop-loss: close a position that moves 2% against entry.",
    reply:
      "Added a 2% stop-loss on each position. If a leg moves that far against entry it is closed and the bot re-quotes when the book settles.",
  },
  {
    id: "wider",
    label: "Make spreads wider in volatile markets",
    note: "Wider spreads when volatility spikes: 0.35% instead of 0.12%.",
    reply:
      "Done: when volatility doubles, spreads widen to 0.35% and size per quote drops by half. The bot keeps quoting instead of pulling out.",
  },
  {
    id: "explain",
    label: "Explain how it works",
    note: "Explanation added to the draft: quotes both sides, sizes from the cap, exits on the stop.",
    reply:
      "Short version: it quotes both sides of the pair inside your bands, sizes each quote from the position cap, and closes a leg on the stop. In Dry Run you will see every fill before any money moves.",
  },
] as const;
