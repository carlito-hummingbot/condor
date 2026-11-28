/**
 * Everything the showcase Dashboard shows. Every number and headline here is
 * made up: nothing is read from a server, an exchange or the news.
 *
 * Showcase only (branch `preview/combined`). The real Dashboard is a later
 * proposal and will read real data; this file is what that work deletes.
 */

export interface AgentCard {
  title: string;
  subtitle: string;
  pnl: number;
  pnlPct: number;
  realized: number;
  unrealized: number;
  pair: string;
  filledOrders: number;
  volume: number;
  /** Sample timestamps and runs, relative to a fixed sample "now" of 28-Nov-26 at 3:25 pm. */
  agentStarted: string;
  totalRuntime: string;
}

export interface NewsItem {
  tag: string;
  headline: string;
  ago: string;
}

export const SAMPLE = {
  funds: {
    total: 128_450,
    today: 1_284,
    spot: 92_100,
    perps: 36_350,
    accounts: 2,
    botsRunning: 3,
    spark: [2, 5, 3, 10, 15, 11, 18, 21, 20, 26, 30, 36],
  },
  pnl: {
    total: 12_840,
    sincePct: 11.1,
    realized: 9_420,
    unrealized: 3_420,
    today: 1_284,
    todayPct: 1.0,
    spark: [2, 6, 5, 10, 15, 13, 20, 23, 26, 30, 33, 36],
  },
  /** 0 is extreme fear, 100 is extreme greed. */
  meter: { value: 68, label: "Greed" },
  btc: {
    price: 97_419,
    changes: [
      { label: "1h", pct: 0.4 },
      { label: "24h", pct: 2.1 },
      { label: "7d", pct: 5.8 },
      { label: "30d", pct: 12.3 },
    ],
    /** 48 hourly closes, oldest first. */
    hourly: [
      96148, 95959, 96170, 95918, 96037, 96020, 95756, 95851, 95571, 95609, 95354, 95117,
      95147, 95499, 95288, 95156, 95347, 95795, 95948, 95955, 96426, 96153, 96530, 96452,
      96257, 96041, 95978, 96321, 96155, 96310, 96512, 96499, 96628, 96369, 96106, 95960,
      96195, 96227, 96169, 96327, 96379, 96309, 96635, 96883, 96770, 96919, 97029, 97419,
    ],
  },
  /** Last 14 days of combined P&L in dollars, oldest first. */
  daily: [420, 310, -90, 680, 540, 721, 260, -140, 891, 760, 640, 1010, 480, 1285],
  /** Last 24 hours of combined P&L in dollars, oldest first. */
  hourly: [
    22, 35, 18, -12, 40, 55, 31, 28, -8, 46, 62, 38, 25, 44, -15, 52, 71, 66, 48, 39, 57, 80,
    64, 73,
  ],
  news: [
    { tag: "Market", headline: "Bitcoin holds weekly gains on rising volume", ago: "1h" },
    { tag: "Macro", headline: "Traders eye rate-decision week", ago: "2h" },
    { tag: "On-chain", headline: "Exchange balances keep falling", ago: "4h" },
    { tag: "Ethereum", headline: "Network activity rises, fees stay low", ago: "5h" },
    { tag: "Rules", headline: "Crypto reporting guidance open for comment", ago: "8h" },
  ] satisfies NewsItem[],
  agents: [
    {
      title: "Stable Churn",
      subtitle: "Binance (spot)",
      pnl: 412.8,
      pnlPct: 2.1,
      realized: 388.1,
      unrealized: 24.7,
      pair: "USDC-USDT",
      filledOrders: 1_284,
      volume: 186_420,
      agentStarted: "25-Nov-26 at 12:55 pm",
      totalRuntime: "3D 2H 30Mins",
    },
    {
      title: "GateForum",
      subtitle: "Gate (perps)",
      pnl: 1_236.4,
      pnlPct: 4.8,
      realized: 1_102.6,
      unrealized: 133.8,
      pair: "BTC-USDT perp",
      filledOrders: 312,
      volume: 842_950,
      agentStarted: "26-Nov-26 at 9:40 am",
      totalRuntime: "2D 5H 45Mins",
    },
    {
      title: "JEV",
      subtitle: "Meteora",
      pnl: 96.3,
      pnlPct: 1.3,
      realized: 118.9,
      unrealized: -22.6,
      pair: "SOL-USDC",
      filledOrders: 74,
      volume: 24_310,
      agentStarted: "28-Nov-26 at 12:55 pm",
      totalRuntime: "2H 30Mins",
    },
  ] satisfies AgentCard[],
} as const;
