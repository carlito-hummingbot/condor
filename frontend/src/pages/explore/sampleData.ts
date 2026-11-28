/**
 * Everything the showcase Explore page shows. Sample data only, except where
 * the pack marks an item as real.
 *
 * Source: Shared/condor-ui-review/explore/content/explore-content.json (v1.0,
 * 28 Nov 2026). The 14 Botcamp Agent Builders Cup agents and the 10 strategy
 * names are real; builders, race points and volumes come from Botcamp. The
 * videos do not exist yet: every entry says "to be recorded". Live now cards,
 * Start here picks, news items and the two community agents are sample data.
 *
 * Showcase only (branch `preview/combined`). The real Explore page will read
 * this from the API and the content will be edited in a CMS.
 */

export type SourceKind = "hummingbot" | "botcamp" | "community";
export type Risk = "low" | "medium" | "high";
export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface Definition {
  term: string;
  definition: string;
}

export interface Channel {
  id: string;
  name: string;
  kind: "livestream" | "x" | "discord";
  url: string;
  note: string;
}

export interface Strategy {
  id: string;
  name: string;
  aka: string;
  oneLine: string;
  risk: Risk;
  difficulty: Difficulty;
  venue: string;
  video: string | null;
  videoStatus: string;
  real: boolean;
}

export interface RaceResult {
  season: string;
  points: number;
  pnlPct: string;
  volumeUsd: string;
}

export interface Agent {
  id: string;
  name: string;
  builder: string;
  team: string;
  sourceKind: SourceKind;
  kind: string;
  category: string;
  venue: string | null;
  oneLine: string;
  description: string;
  race: RaceResult | null;
  video: string | null;
  videoStatus: string;
  real: boolean;
}

export interface NewsItem {
  id: string;
  kind: "livestream" | "x" | "discord";
  date: string;
  title: string;
  summary: string;
  link: string;
  real: boolean;
}

export interface LiveNowCard {
  id: string;
  type: "agent" | "strategy";
  name: string;
  venue: string;
  pnl: string;
  realized: string;
  unrealized: string;
  pair: string;
  filledOrders: string;
  volume: string;
  agentStarted: string;
  totalRuntime: string;
  /** Seven sample daily P&L dollars, 22–28 Nov, oldest first. A red day or two each. */
  pnlSeries: readonly number[];
}

/** The seven day labels the Live Bots cards' P&L bars share, ending 28 Nov. */
export const PRICE_DAYS = ["22", "23", "24", "25", "26", "27", "28"] as const;

/** One of the four Get Started lessons: a title, what it teaches, and its video. */
export interface Lesson {
  id: string;
  title: string;
  description: string;
  /** Kept for the write-up; the page does not render it. */
  videoSummary: string;
  /** The YouTube id its video box opens. Official Hummingbot channel. */
  youtube: string;
}

export const DEFINITIONS: readonly Definition[] = [
  {
    "term": "Strategy",
    "definition": "A rule-based setup: fixed rules decide when to quote, enter and exit."
  },
  {
    "term": "Agent",
    "definition": "An AI-driven setup: a model decides, inside the limits you set."
  }
];

export const CHANNELS: readonly Channel[] = [
  {
    "id": "ch-youtube",
    "name": "Hummingbot on YouTube",
    "kind": "livestream",
    "url": "https://www.youtube.com/@hummingbot",
    "note": "Official channel; the livestream episodes are published here."
  },
  {
    "id": "ch-x",
    "name": "Hummingbot on X",
    "kind": "x",
    "url": "https://x.com/_hummingbot",
    "note": "Official handle linked from hummingbot.org."
  },
  {
    "id": "ch-discord",
    "name": "Hummingbot Discord",
    "kind": "discord",
    "url": "https://discord.gg/hummingbot",
    "note": "Official invite; announcements land in the community server."
  }
];

export const STRATEGIES: readonly Strategy[] = [
  {
    "id": "pure-market-making",
    "name": "Pure market making",
    "aka": "pure_market_making (V1); pmm_simple and pmm_dynamic (V2 controllers)",
    "oneLine": "Quotes both sides of one pair around the mid and earns the spread.",
    "risk": "medium",
    "difficulty": "beginner",
    "venue": "CEX spot or perpetual (one pair)",
    "video": null,
    "videoStatus": "to be recorded",
    "real": true
  },
  {
    "id": "cross-exchange-market-making",
    "name": "Cross-exchange market making",
    "aka": "cross_exchange_market_making (V1); xemm_multiple_levels (V2 controller)",
    "oneLine": "Market makes on one venue and hedges the fill on another, so inventory risk is small.",
    "risk": "medium",
    "difficulty": "intermediate",
    "venue": "Two CEXs, spot or perp",
    "video": null,
    "videoStatus": "to be recorded",
    "real": true
  },
  {
    "id": "avellaneda-market-making",
    "name": "Avellaneda market making",
    "aka": "avellaneda_market_making (V1)",
    "oneLine": "Market making with a reservation price and a spread derived from inventory risk.",
    "risk": "high",
    "difficulty": "advanced",
    "venue": "CEX spot or perpetual (one pair)",
    "video": null,
    "videoStatus": "to be recorded",
    "real": true
  },
  {
    "id": "perpetual-market-making",
    "name": "Perpetual market making",
    "aka": "perpetual_market_making (V1)",
    "oneLine": "Market making on perpetual futures, where funding also moves the P&L.",
    "risk": "high",
    "difficulty": "advanced",
    "venue": "CEX perpetuals",
    "video": null,
    "videoStatus": "to be recorded",
    "real": true
  },
  {
    "id": "spot-perpetual-arbitrage",
    "name": "Spot-perpetual arbitrage",
    "aka": "spot_perpetual_arbitrage (V1)",
    "oneLine": "Trades the gap between a spot price and a perpetual price on the same asset.",
    "risk": "medium",
    "difficulty": "intermediate",
    "venue": "One CEX with spot and perp, or two exchanges",
    "video": null,
    "videoStatus": "to be recorded",
    "real": true
  },
  {
    "id": "amm-arbitrage",
    "name": "AMM arbitrage",
    "aka": "amm_arb (V1); arbitrage_controller (V2 controller)",
    "oneLine": "Takes the price gap between an AMM pool on a DEX and a centralised exchange.",
    "risk": "high",
    "difficulty": "intermediate",
    "venue": "A DEX pool plus a CEX, through Gateway",
    "video": null,
    "videoStatus": "to be recorded",
    "real": true
  },
  {
    "id": "grid",
    "name": "Grid trading",
    "aka": "grid_strike and multi_grid_strike (V2 controllers); Grid Executor",
    "oneLine": "Lays orders on a ladder of prices and profits when price walks up and down through it.",
    "risk": "medium",
    "difficulty": "beginner",
    "venue": "CEX spot or perpetual (ranging market)",
    "video": null,
    "videoStatus": "to be recorded",
    "real": true
  },
  {
    "id": "directional",
    "name": "Directional trading controllers",
    "aka": "bollinger_v1, bollinger_v2, macd_bb_v1, supertrend_v1, bollingrid (V2 controllers)",
    "oneLine": "Enters a position when an indicator signal says the market is about to trend.",
    "risk": "high",
    "difficulty": "intermediate",
    "venue": "CEX perpetuals (a trending market)",
    "video": null,
    "videoStatus": "to be recorded",
    "real": true
  },
  {
    "id": "dex-liquidity",
    "name": "DEX liquidity provision",
    "aka": "lp_rebalancer (V2 controller, new in v2.13.0); LP Executor",
    "oneLine": "Provides concentrated liquidity in a DEX pool and rebalances the range as price moves.",
    "risk": "high",
    "difficulty": "advanced",
    "venue": "CLMM DEX (Solana or EVM) through Gateway",
    "video": null,
    "videoStatus": "to be recorded",
    "real": true
  },
  {
    "id": "stat-arb",
    "name": "Statistical arbitrage",
    "aka": "stat_arb (V2 controller)",
    "oneLine": "Trades the spread between related markets instead of the direction of one.",
    "risk": "high",
    "difficulty": "advanced",
    "venue": "Two related CEX pairs",
    "video": null,
    "videoStatus": "to be recorded",
    "real": true
  }
];

export const AGENTS: readonly Agent[] = [
  {
    "id": "hb-agents\\churn.html",
    "name": "Churn",
    "builder": "wei hong",
    "team": "Botcamp",
    "sourceKind": "botcamp",
    "kind": "Condor Agent",
    "category": "Market making",
    "venue": "Binance spot (USD1-USDT, zero-fee book)",
    "oneLine": "Quotes both sides post-only at the best bid and ask of one stablecoin pair. An autonomous Condor agent supervises it, so volume accrues near-free with no crypto price risk.",
    "description": "A volume-churning algorithm for stablecoins. Two-sided post-only market making at the best bid and ask of Binance's zero-fee USD1/USDT book, supervised by an autonomous Condor agent: near-free volume, no crypto price risk.",
    "race": {
      "season": "Agent Builders Cup, Season 1 (Aug 1 - Oct 9, 2026)",
      "points": 62,
      "pnlPct": "+1.13%",
      "volumeUsd": "$2,872,232"
    },
    "video": null,
    "videoStatus": "to be recorded",
    "real": true
  },
  {
    "id": "hb-agents\\jev-decision-maker-at-me.html",
    "name": "JEV - Decision Maker at Meteora",
    "builder": "Cedar",
    "team": "Meteora",
    "sourceKind": "botcamp",
    "kind": "Condor Agent",
    "category": "Liquidity provision",
    "venue": "Meteora DLMM (Solana)",
    "oneLine": "Each tick it scans Meteora's top, trending, new and RWA books, runs eight rug-check flags on the strongest bases, ranks survivors on fee yield, depth and trust, then holds 3 to 5 pools under a slot budget.",
    "description": "JEV is a decision agent for Meteora DLMM liquidity. Each tick it scans Top Performers, Trending, New, and RWA books, runs live eight-flag rug cards on the strongest unique bases, then ranks survivors on fee yield, depth, and trust. It holds a portfolio of 3–5 distinct-base pools on an 800 USDC competition book, under a slot budget and a minimum size floor (at most two from the New tab). Position size and range width come from market condition and trust. Bin step is fixed on-chain; JEV only chooses width. A cost tier scales the slice: fee at 1.2× the open cost opens full size, 0.5×–1.2× opens a trimmed slice, below 0.5× no slice. Dry-run until a human sets the live note. Model proposes; math can still refuse.",
    "race": {
      "season": "Agent Builders Cup, Season 1 (Aug 1 - Oct 9, 2026)",
      "points": 56,
      "pnlPct": "+0.96%",
      "volumeUsd": "$1,028,542"
    },
    "video": null,
    "videoStatus": "to be recorded",
    "real": true
  },
  {
    "id": "hb-agents\\delta-raptor-volume-hunt.html",
    "name": "Delta Raptor — Volume-Hunting Market Maker",
    "builder": "HBMiner fan",
    "team": "XRPL",
    "sourceKind": "botcamp",
    "kind": "Condor Agent",
    "category": "Market making",
    "venue": "XRPL native CLOB (fair value from Binance XRP-USDT)",
    "oneLine": "Two modes: park the envelope where volume just spiked and sit new-best on both sides, or keep $100 live and $700 idle until a fill unlocks the sell. Inventory turns only through the cheaper of CLOB and native AMM.",
    "description": "A volume-hunting market maker on the XRPL native CLOB with two hunting modes. Mode 1 Race (incentivized): park the $800 envelope where volume just spiked (≥3×), sit new best both sides, never leave. Mode 2 Harvest (unincentivized, default): $100 BUY live, $700 idle, SELL unlocks on fill; hunt still flies the live perch. Fair value from Binance XRP-USDT, never the ledger mid. Widen ~1% on a spike (Mode 2: the $100, not the envelope). Inventory turns only through the cheaper of CLOB vs native AMM, ≤ 25 bps, live perch only.",
    "race": {
      "season": "Agent Builders Cup, Season 1 (Aug 1 - Oct 9, 2026)",
      "points": 42,
      "pnlPct": "−0.10%",
      "volumeUsd": "$318,076"
    },
    "video": null,
    "videoStatus": "to be recorded",
    "real": true
  },
  {
    "id": "hb-agents\\gateforum-multi-agent-re.html",
    "name": "GateForum - Multi-Agent Research & Decision Trader",
    "builder": "ctrader xt",
    "team": "Gate",
    "sourceKind": "botcamp",
    "kind": "Condor Agent",
    "category": "Research / decision",
    "venue": "Gate.io perpetuals",
    "oneLine": "A 12-role research council: four analysts brief the book, a bull and a bear argue, a judge rules, three risk analysts size it. Only verdicts above 65% consensus become positions, run by a V2 position executor.",
    "description": "An interpretable 12-role research council for Gate.io perpetuals. Four analysts brief the book, a bull and a bear argue, a research judge rules, then three risk analysts size the idea. Only BUY/SELL verdicts that clear 65% consensus become positions. Hummingbot V2 position_executor owns the lifecycle. Condor never trades on a dead or stale council.",
    "race": {
      "season": "Agent Builders Cup, Season 1 (Aug 1 - Oct 9, 2026)",
      "points": 42,
      "pnlPct": "−1.01%",
      "volumeUsd": "$2,071,200"
    },
    "video": null,
    "videoStatus": "to be recorded",
    "real": true
  },
  {
    "id": "hb-agents\\midas-market-maker-w-adv.html",
    "name": "MIDAS - Market Maker w/ Adverse Selection Detection, Dynamic Hedging,Position Sizing, Self-Correcting Logic",
    "builder": "Elle",
    "team": "Bitget",
    "sourceKind": "botcamp",
    "kind": "Condor Agent",
    "category": "Market making",
    "venue": "Bitget (spot + perpetual, same pair)",
    "oneLine": "Quotes both books of one pair and stays delta-neutral, with the perp as the hedge. It steps aside when an informed-flow shield fires; the edge is spread, basis and funding, not direction.",
    "description": "A hybrid spot + perpetual market maker on Bitget. It quotes both books of the same pair, stays delta-neutral, and steps aside when an informed-flow shield fires. Edge is the spread, the spot↔perp basis, and funding on the hedge — not a directional bet. BTC, ETH, and SOL run two books; XAU-USDT is perp-only.",
    "race": {
      "season": "Agent Builders Cup, Season 1 (Aug 1 - Oct 9, 2026)",
      "points": 42,
      "pnlPct": "−1.13%",
      "volumeUsd": "$2,053,309"
    },
    "video": null,
    "videoStatus": "to be recorded",
    "real": true
  },
  {
    "id": "hb-agents\\aegis-defensive-market-m.html",
    "name": "AEGIS - Defensive Market Making",
    "builder": "Aven",
    "team": "XRPL",
    "sourceKind": "botcamp",
    "kind": "Condor Agent",
    "category": "Market making",
    "venue": "XRP Ledger (XRP-RLUSD, XRP-USDC), hedged on Gate XRP-USDT perp",
    "oneLine": "Quotes two XRP books and turns fills into one XRP pile. While that pile is heavy, a 1x Gate XRP-USDT perpetual short shields the dollars; a +6% moon cuts the short, a snap back inside +3% puts it back on.",
    "description": "A defensive dual-book market maker on the XRP Ledger. It quotes XRP-RLUSD and XRP-USDC. Fills become one XRP pile. While that pile is heavy, a 1× Gate XRP-USDT perpetual short is a shield — not a bet that XRP goes down. A dump must not hollow out the dollars. A real moon (+6% from hedge entry) cuts the short only; the coins stay. If price snaps back inside +3%, the shield goes back on. Both books stay on. One Hummingbot bot (aegis-aegis_operator) runs both pmm_simple controllers; the shield is a position_executor.",
    "race": {
      "season": "Agent Builders Cup, Season 1 (Aug 1 - Oct 9, 2026)",
      "points": 40,
      "pnlPct": "+1.25%",
      "volumeUsd": "$329"
    },
    "video": null,
    "videoStatus": "to be recorded",
    "real": true
  },
  {
    "id": "hb-agents\\adaptive-orca-lp-agent.html",
    "name": "Adaptive Orca LP agent",
    "builder": "Victor Adeleke",
    "team": "Orca",
    "sourceKind": "botcamp",
    "kind": "Condor Agent",
    "category": "Liquidity provision",
    "venue": "Orca (Solana)",
    "oneLine": "Sample text: manages a set of Orca concentrated-liquidity positions and adapts its ranges as price moves. The Botcamp page only says 'New Adaptive Orca LP strategy', so this line is sample, not the builder's own words.",
    "description": "New Adaptive Orca LP strategy",
    "race": {
      "season": "Agent Builders Cup, Season 1 (Aug 1 - Oct 9, 2026)",
      "points": 38,
      "pnlPct": "−0.59%",
      "volumeUsd": "$4,973"
    },
    "video": null,
    "videoStatus": "to be recorded",
    "real": true
  },
  {
    "id": "hb-agents\\theta-covered-call-hedge.html",
    "name": "THETA - Covered-Call Hedge Desk",
    "builder": "Golden",
    "team": "Derive",
    "sourceKind": "botcamp",
    "kind": "Condor Agent",
    "category": "Volatility / options",
    "venue": "Derive (XRP options + XRP-USDC perpetual)",
    "oneLine": "Posts XRP as FXRP margin, shorts a matching XRP-USDC perpetual so a dump cannot empty the wallet, and collects the funding print. Sells one call only when the options tape says the week is expensive.",
    "description": "An hour collector on Derive. It posts the XRP you already wanted to keep as FXRP margin, shorts a matching XRP-USDC perpetual so a dump cannot empty the wallet, and takes the funding print while that hedge is on. When the options tape says the week is expensive it may sell one call. When the week is cheap it SITs. Funding still prints. One book. One underlying. Two tickets at most.",
    "race": {
      "season": "Agent Builders Cup, Season 1 (Aug 1 - Oct 9, 2026)",
      "points": 36,
      "pnlPct": "+1.57%",
      "volumeUsd": "$320"
    },
    "video": null,
    "videoStatus": "to be recorded",
    "real": true
  },
  {
    "id": "hb-agents\\trend-aware-lp-rebalance.html",
    "name": "Trend-Aware LP Rebalancer Agent",
    "builder": "Hoang La",
    "team": "Orca",
    "sourceKind": "botcamp",
    "kind": "Condor Agent",
    "category": "Liquidity provision",
    "venue": "Orca (Solana)",
    "oneLine": "Scans and ranks Orca pools, sets each position's next range from the market trend, and lets a Hummingbot controller handle execution and cleanup between agent cycles.",
    "description": "Built on Condor and powered by Hummingbot, Trend-Aware LP Rebalancer manages a portfolio of Orca concentrated-liquidity positions on Solana within the operator's budget and position limits. It scans and ranks eligible pools, adapts each position's next range to market trend, and lets a Hummingbot controller handle continuous execution and cleanup between Agent cycles.",
    "race": {
      "season": "Agent Builders Cup, Season 1 (Aug 1 - Oct 9, 2026)",
      "points": 34,
      "pnlPct": "−1.82%",
      "volumeUsd": "$7,031"
    },
    "video": null,
    "videoStatus": "to be recorded",
    "real": true
  },
  {
    "id": "hb-agents\\regime-switch-lp.html",
    "name": "Regime Switch LP",
    "builder": "Neil Mascarenhas",
    "team": "Meteora",
    "sourceKind": "botcamp",
    "kind": "Condor Agent",
    "category": "Liquidity provision",
    "venue": "Meteora DLMM (Solana), with a Gate hedge",
    "oneLine": "Pauses the DEX book in a trend, a volatility spike, a crash or a 4% drawdown, and runs an aggressive or balanced DLMM range when the market is quiet or ranging.",
    "description": "A Meteora LP agent that pauses the DEX in trend, volatility, crash, or 4% equity drawdown, and runs an aggressive or balanced DLMM book in quiet/ranging markets. Same ranked pool and Gate hedge as Strategy 1; the operator tick is the difference.",
    "race": {
      "season": "Agent Builders Cup, Season 1 (Aug 1 - Oct 9, 2026)",
      "points": 32,
      "pnlPct": "−0.01%",
      "volumeUsd": "$209"
    },
    "video": null,
    "videoStatus": "to be recorded",
    "real": true
  },
  {
    "id": "hb-agents\\cohort-13-market-making-.html",
    "name": "Market Making At-The-Touch",
    "builder": "Raj Kundi",
    "team": "Botcamp",
    "sourceKind": "botcamp",
    "kind": "Hummingbot V2 Controller",
    "category": "Market making",
    "venue": null,
    "oneLine": "Places orders only at the best bid and best ask, never deeper in the book. It learns from live order-book and trade data and quotes a side only when a fill there is expected to pay.",
    "description": "A market maker that places orders only at the best bid and best ask. It learns from live market data how the order book and trades behave, and only quotes a side when a fill there is expected to make money.",
    "race": {
      "season": "Agent Builders Cup, Season 1 (Aug 1 - Oct 9, 2026)",
      "points": 28,
      "pnlPct": "−2.28%",
      "volumeUsd": "$65,568"
    },
    "video": null,
    "videoStatus": "to be recorded",
    "real": true
  },
  {
    "id": "hb-agents\\quad-threat.html",
    "name": "Quad Threat 🔥",
    "builder": "Crypto T",
    "team": "Bitget",
    "sourceKind": "botcamp",
    "kind": "Condor Agent",
    "category": "Multi-engine",
    "venue": "Bitget USDT-M perpetuals",
    "oneLine": "One agent runs three engines on a shared account: a momentum trader for P&L, a BTC/ETH maker for volume, and an LLM breakout trader that also risk-manages the other two. Hard stops sit on the exchange.",
    "description": "Quad Threat is one Condor agent running three engines on a shared $800 Bitget USDT-M account: Engine 1 for momentum P&L, Engine 4 a BTC/ETH maker for volume, and Engine 2 an LLM breakout trader that is also the risk manager for Engines 1 and 2. Hard stops sit on the exchange; the agent takes profit from live P&L.",
    "race": {
      "season": "Agent Builders Cup, Season 1 (Aug 1 - Oct 9, 2026)",
      "points": 28,
      "pnlPct": "−9.69%",
      "volumeUsd": "$220,862"
    },
    "video": null,
    "videoStatus": "to be recorded",
    "real": true
  },
  {
    "id": "hb-agents\\flyby-long-volatility-co.html",
    "name": "Flyby — Long-Volatility Collector Desk",
    "builder": "David Pere",
    "team": "Derive",
    "sourceKind": "botcamp",
    "kind": "Condor Agent",
    "category": "Volatility / options",
    "venue": "Derive (options)",
    "oneLine": "Scores volatility with SVI plus HAR+EWMA forecasts and event signals, then buys cheap puts or synthetic hedges. Strict collateral and drawdown limits; at most one position open at a time.",
    "description": "A long-volatility collector on Derive that uses SVI, HAR+EWMA volatility forecasts, and CESF event signals to identify cheap volatility and selectively buy puts or synthetic hedges. The strategy prioritizes controlled convexity exposure, strict collateral and drawdown limits, and a maximum of one active position at a time.",
    "race": {
      "season": "Agent Builders Cup, Season 1 (Aug 1 - Oct 9, 2026)",
      "points": 26,
      "pnlPct": "+0.86%",
      "volumeUsd": "$256"
    },
    "video": null,
    "videoStatus": "to be recorded",
    "real": true
  },
  {
    "id": "hb-agents\\self-improving-market-ma.html",
    "name": "Self-Improving Market Making Fleet",
    "builder": "Blas Palmisciano",
    "team": "Gate",
    "sourceKind": "botcamp",
    "kind": "Condor Agent",
    "category": "Market making",
    "venue": "Gate (market not stated)",
    "oneLine": "Runs several market-making configs, backtests variants, keeps the winners by volume and P&L, pushes them live and repeats, so the fleet keeps sharpening itself.",
    "description": "We run market making bots and let AI agents handle the optimization: backtest the configs with different variants, keep the winners by volume and PnL, push them live, repeat so the fleet keeps sharpening itself.",
    "race": {
      "season": "Agent Builders Cup, Season 1 (Aug 1 - Oct 9, 2026)",
      "points": 26,
      "pnlPct": "−1.98%",
      "volumeUsd": "$86,075"
    },
    "video": null,
    "videoStatus": "to be recorded",
    "real": true
  },
  {
    "id": "sample-hummingbot-1",
    "name": "Sample agent — V2 controller template",
    "builder": "sample",
    "team": "Hummingbot",
    "sourceKind": "hummingbot",
    "kind": "Sample",
    "category": "Market making",
    "venue": "Sample: CEX spot",
    "oneLine": "Sample text: loads a controller, quotes both sides, stops at a loss limit.",
    "description": "Sample agent. Stands in for a Hummingbot-published V2 controller template.",
    "race": null,
    "video": null,
    "videoStatus": "to be recorded",
    "real": false
  },
  {
    "id": "sample-community-1",
    "name": "Sample agent — community grid",
    "builder": "sample",
    "team": "Community",
    "sourceKind": "community",
    "kind": "Sample",
    "category": "Grid",
    "venue": "Sample: CEX perpetual",
    "oneLine": "Sample text: lay a grid, re-arm each rung, stop out of range.",
    "description": "Sample agent. Stands in for a community-built grid agent.",
    "race": null,
    "video": null,
    "videoStatus": "to be recorded",
    "real": false
  },
  {
    "id": "sample-community-2",
    "name": "Sample agent — community LP rebalancer",
    "builder": "sample",
    "team": "Community",
    "sourceKind": "community",
    "kind": "Sample",
    "category": "Liquidity provision",
    "venue": "Sample: Solana DEX",
    "oneLine": "Sample text: open a range, widen it on trend, close on drawdown.",
    "description": "Sample agent. Stands in for a community LP rebalancing agent.",
    "race": null,
    "video": null,
    "videoStatus": "to be recorded",
    "real": false
  }
];

export const NEWS: readonly NewsItem[] = [
  {
    "id": "news-1",
    "kind": "livestream",
    "date": "2026-11-26",
    "title": "market making in a quiet book",
    "summary": "Sample item. A walk through spreads, inventory and when to sit out — replace with the real episode.",
    "link": "#",
    "real": false
  },
  {
    "id": "news-2",
    "kind": "x",
    "date": "2026-11-25",
    "title": "new controller walkthrough",
    "summary": "Sample item. Placeholder for a short post announcing a controller walkthrough.",
    "link": "#",
    "real": false
  },
  {
    "id": "news-3",
    "kind": "discord",
    "date": "2026-11-24",
    "title": "Agent Builders Cup recap",
    "summary": "Sample item. Placeholder for a recap announcement in the community server.",
    "link": "#",
    "real": false
  },
  {
    "id": "news-4",
    "kind": "livestream",
    "date": "2026-11-21",
    "title": "reading the order book",
    "summary": "Sample item. Placeholder for an episode about order-book signals and maker fills.",
    "link": "#",
    "real": false
  },
  {
    "id": "news-5",
    "kind": "x",
    "date": "2026-11-19",
    "title": "grid vs market making",
    "summary": "Sample item. Placeholder for a comparison post.",
    "link": "#",
    "real": false
  },
  {
    "id": "news-6",
    "kind": "discord",
    "date": "2026-11-18",
    "title": "office hours moved",
    "summary": "Sample item. Placeholder for a schedule change notice.",
    "link": "#",
    "real": false
  },
  {
    "id": "news-7",
    "kind": "livestream",
    "date": "2026-11-14",
    "title": "DEX liquidity ranges",
    "summary": "Sample item. Placeholder for an episode about concentrated liquidity and rebalancing.",
    "link": "#",
    "real": false
  },
  {
    "id": "news-8",
    "kind": "x",
    "date": "2026-11-12",
    "title": "weekly volume milestone",
    "summary": "Sample item. Placeholder for a milestone post; the number must come from a real source.",
    "link": "#",
    "real": false
  }
];

export const LIVE_NOW: readonly LiveNowCard[] = [
  {
    "id": "live-agent-stable-churn",
    "type": "agent",
    "name": "Stable Churn",
    "venue": "Binance (spot)",
    "pnl": "+$412.80 (+2.1%)",
    "realized": "+$388.10",
    "unrealized": "+$24.70",
    "pair": "USDC-USDT",
    "filledOrders": "1,284",
    "volume": "$186,420",
    "agentStarted": "25-Nov-26 at 12:55 pm",
    "totalRuntime": "3D 2H 30Mins",
    "pnlSeries": [412, 320, 240, -45, 510, 380, 295]
  },
  {
    "id": "live-agent-gateforum",
    "type": "agent",
    "name": "GateForum",
    "venue": "Gate (perps)",
    "pnl": "+$1,236.40 (+4.8%)",
    "realized": "+$1,102.60",
    "unrealized": "+$133.80",
    "pair": "BTC-USDT perp",
    "filledOrders": "312",
    "volume": "$842,950",
    "agentStarted": "26-Nov-26 at 9:40 am",
    "totalRuntime": "2D 5H 45Mins",
    "pnlSeries": [820, 640, -310, 950, 420, 610, -180]
  },
  {
    "id": "live-agent-jev",
    "type": "agent",
    "name": "JEV",
    "venue": "Meteora",
    "pnl": "+$96.30 (+1.3%)",
    "realized": "+$118.90",
    "unrealized": "-$22.60",
    "pair": "SOL-USDC",
    "filledOrders": "74",
    "volume": "$24,310",
    "agentStarted": "28-Nov-26 at 12:55 pm",
    "totalRuntime": "2H 30Mins",
    "pnlSeries": [-60, 180, 240, -35, 310, 150, 280]
  },
  {
    "id": "live-strategy-pmm",
    "type": "strategy",
    "name": "Pure market making",
    "venue": "Kraken (spot)",
    "pnl": "+$228.60 (+1.4%)",
    "realized": "+$204.30",
    "unrealized": "+$24.30",
    "pair": "ETH-USDT",
    "filledOrders": "860",
    "volume": "$96,240",
    "agentStarted": "27-Nov-26 at 8:05 am",
    "totalRuntime": "1D 7H 20Mins",
    "pnlSeries": [228, 340, 290, 160, -70, 410, 260]
  },
  {
    "id": "live-strategy-grid",
    "type": "strategy",
    "name": "Grid trading",
    "venue": "Bybit (perps)",
    "pnl": "+$641.15 (+3.2%)",
    "realized": "+$530.45",
    "unrealized": "+$110.70",
    "pair": "SOL-USDT perp",
    "filledOrders": "2,046",
    "volume": "$412,780",
    "agentStarted": "26-Nov-26 at 4:30 pm",
    "totalRuntime": "1D 22H 55Mins",
    "pnlSeries": [641, 480, 520, -240, 700, 380, -90]
  },
  {
    "id": "live-strategy-xemm",
    "type": "strategy",
    "name": "Cross-exchange market making",
    "venue": "Binance + OKX",
    "pnl": "+$154.90 (+0.9%)",
    "realized": "+$171.20",
    "unrealized": "-$16.30",
    "pair": "XRP-USDT",
    "filledOrders": "505",
    "volume": "$58,610",
    "agentStarted": "28-Nov-26 at 6:10 am",
    "totalRuntime": "9H 15Mins",
    "pnlSeries": [-45, 155, 210, 120, 300, 240, 180]
  }
];

/**
 * The four Get Started lessons, in the order the user asked for them. Each one
 * opens a sample video frame and its summary under the Start here box; no video
 * is loaded and there is no third-party embed.
 */
export const LESSONS: readonly Lesson[] = [
  {
    id: "lesson-hummingbot",
    title: "What is Hummingbot & How does it work?",
    description:
      "Hummingbot is the open-source engine this app runs on. It connects to exchanges and keeps a bot working from the rules and limits you set.",
    videoSummary:
      "Condor is the screen. Hummingbot is the engine underneath. You pick a bot, and Hummingbot runs it on an exchange.",
    youtube: "Xau4MeN6foM",
  },
  {
    id: "lesson-bot-types",
    title: "What is a bot, its types, and trading style?",
    description:
      "A bot is one trading job. Its type is Strategy, which follows rules you write, or Agent, which decides inside limits you set. Trading style is what it does, such as market making or arbitrage, and both types share those styles.",
    videoSummary:
      "Strategy follows your rules. An agent decides inside limits you set. Trading style is separate, and both types can use market making, arbitrage, and the rest.",
    youtube: "jmq9TkoXN_o",
  },
  {
    id: "lesson-design",
    title: "How to design a bot Strategy/Agent?",
    description:
      "Design starts with a short guide: type, trading style, exchange, and pair. You can answer it yourself or with the assistant, and the draft carries into a backtest.",
    videoSummary:
      "Open Build, answer the Design guide, and leave with a draft you can test. The assistant can fill the same answers with you.",
    youtube: "t3Su_F_SY_0",
  },
  {
    id: "lesson-improve",
    title: "How to improve a bot Strategy/Agent?",
    description:
      "Improve starts from a bot that is already running. Change one thing, check it in a backtest and a dry run, then send that version live.",
    videoSummary:
      "From a live bot, open Improve, change one setting, and walk it through backtest, dry run, and deploy before it goes live.",
    youtube: "AU7h7tQpbaM",
  },
];

/** The Next livestream card beside the lessons. Sample date and links. */
export const LIVESTREAM = {
  why: "Sample card. Replace the date and link with the real schedule before the page ships.",
  when: "Sample date: Thu 3 Dec 2026, 16:00 UTC",
} as const;

export const SOURCE_COUNTS = { hummingbot: 1, botcamp: 14, community: 2 } as const;
