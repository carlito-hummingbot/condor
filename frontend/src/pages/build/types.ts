/**
 * The Build page's contract: the five stages of one bot's life, the draft they
 * share, and the props each stage component takes.
 *
 * The stage designers code against this file and nothing else in the shell, so
 * it is deliberately small: a flat draft (no nested objects to merge), one
 * setter that takes a patch, and one way to move between stages. Everything
 * else — where the draft is stored, the tabs, the stepper, the guards — is the
 * shell's business (`pages/build/Build.tsx`).
 *
 * Showcase only: the draft and every value a stage shows are sample data. No
 * stage calls the API.
 */

export type StageId = "design" | "backtest" | "dry-run" | "deploy" | "improve";
export type BotKind = "strategy" | "agent";
export type StrategyType =
  | "Market Making"
  | "Arbitrage"
  | "Funding Rate"
  | "Cross Exchange MM"
  | "Directional"
  | "LP";
export type MarketType = "Spot" | "Perps" | "LP";
export type StartingPoint = "import" | "scratch";
/** Max Positions: the user types a number, or the agent sizes it from the budget. */
export type MaxPositionsMode = "fixed" | "dynamic";

export interface Draft {
  botKind: BotKind | null;
  strategyType: StrategyType | null;
  exchange: string | null;
  marketType: MarketType | null;
  /** The first of `pairs`; the later stages read this one. */
  pair: string | null;
  /** Every pair the user entered, normalised and de-duplicated. */
  pairs: string[];
  /** The pair field as typed, so a bad entry stays on screen to be fixed. */
  pairsText: string;
  /** The agent picks the pairs itself; the field is then ignored. */
  pairsDynamic: boolean;
  /** Kept so an old saved draft still reads; the Markets form replaced it. */
  marketQty: number | null;
  maxPositions: number | null;
  maxPositionsMode: MaxPositionsMode | null;
  /** Market-making spread percentages as typed, e.g. "0.1, 0.3" — chips on screen. */
  spreads: string;
  /** Percentages, as typed; null until the user enters one. */
  targetProfit: number | null;
  stopLoss: number | null;
  startingPoint: StartingPoint | null;
  howItWorks: string;
  title: string;
  designDone: boolean;
  backtestDone: boolean;
  dryRunDone: boolean;
  deployed: boolean;
}

export interface StageProps {
  draft: Draft;
  setDraft: (patch: Partial<Draft>) => void;
  goTo: (stage: StageId) => void;
}
