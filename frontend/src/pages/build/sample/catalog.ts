/**
 * The sample catalogue both entry points read: the 14 Botcamp agents of the
 * Explore content pack, each with the Design fields a draft is seeded from.
 *
 * One list, two readers: Explore's "Improve this" and "Use as starting point"
 * link here through `/build?from=explore&item=<id>`, and the Design stage's
 * Import chooser can offer the same 14. Nothing is fetched; a real catalogue
 * would replace `CATALOG_ITEMS` and keep `pickCatalogItem` as it is.
 *
 * The fields are derived from what the pack already says about each agent
 * (category, venue), so the sample stays consistent with the Explore page.
 */

import { SAMPLE } from "@/pages/dashboard/sampleData";
import { AGENTS, STRATEGIES } from "@/pages/explore/sampleData";

import type { BotKind, MarketType, StartingPoint, StrategyType } from "../types";

export interface CatalogItem {
  id: string;
  name: string;
  /** One line of provenance for the buttons and the origin banner. */
  source: string;
  fields: {
    botKind: BotKind;
    strategyType: StrategyType;
    exchange: string;
    marketType: MarketType;
    pair: string | null;
    startingPoint: StartingPoint;
    howItWorks: string;
    title: string;
  };
}

/** The pack's category wording onto the Design form's six strategy types. */
function strategyTypeOf(category: string): StrategyType {
  const lower = category.toLowerCase();
  if (lower.includes("liquidity") || lower.includes("lp")) return "LP";
  if (lower.includes("arbitrage")) return "Arbitrage";
  if (lower.includes("funding")) return "Funding Rate";
  if (lower.includes("cross")) return "Cross Exchange MM";
  if (lower.includes("directional") || lower.includes("trend")) return "Directional";
  return "Market Making";
}

/** "Binance spot (USD1-USDT, zero-fee book)" -> Binance, Spot, USD1-USDT. */
function venueOf(venue: string | null): {
  exchange: string;
  marketType: MarketType;
  pair: string | null;
} {
  if (!venue) return { exchange: "Binance", marketType: "Spot", pair: null };
  const lower = venue.toLowerCase();
  const exchange = venue.split(/[\s(]/)[0] || "Binance";
  const marketType: MarketType = lower.includes("perp")
    ? "Perps"
    : lower.includes("dlmm") || lower.includes("lp") || lower.includes("pool")
      ? "LP"
      : "Spot";
  const pair = venue.match(/\b([A-Z0-9]{2,10}-[A-Z0-9]{2,10})\b/)?.[1] ?? null;
  return { exchange, marketType, pair };
}

/** Every agent of the Explore pack, with its Design fields. */
const AGENT_ITEMS: readonly CatalogItem[] = AGENTS.map((agent) => {
  const venue = venueOf(agent.venue);
  return {
    id: agent.id,
    name: agent.name,
    source: "Explore, sample",
    fields: {
      botKind: "agent",
      strategyType: strategyTypeOf(agent.category),
      exchange: venue.exchange,
      marketType: venue.marketType,
      pair: venue.pair,
      startingPoint: "import",
      howItWorks: agent.oneLine,
      title: agent.name,
    },
  };
});

/**
 * The strategies of the Explore pack. A strategy row has no venue pair of its
 * own, so the draft starts without one and the Design stage asks for it.
 */
const STRATEGY_ITEMS: readonly CatalogItem[] = STRATEGIES.map((strategy) => ({
  id: strategy.id,
  name: strategy.name,
  source: "Explore, sample",
  fields: {
    botKind: "strategy",
    strategyType: strategyTypeOf(`${strategy.name} ${strategy.aka}`),
    exchange: strategy.venue.split(/[\s(]/)[0] || "Binance",
    marketType: strategy.venue.toLowerCase().includes("perp") ? "Perps" : "Spot",
    pair: null,
    startingPoint: "import",
    howItWorks: strategy.oneLine,
    title: strategy.name,
  },
}));

/** The 14 real Botcamp Agent Builders Cup entries: the Import list. */
export const CATALOG_ITEMS: readonly CatalogItem[] = AGENT_ITEMS.filter((item) =>
  AGENTS.some((agent) => agent.id === item.id && agent.sourceKind === "botcamp"),
);

/** Everything a catalogue link can name, agents first, then strategies. */
const ALL_ITEMS: readonly CatalogItem[] = [...AGENT_ITEMS, ...STRATEGY_ITEMS];

export function findCatalogItem(id: string | null | undefined): CatalogItem | null {
  if (!id) return null;
  return ALL_ITEMS.find((item) => item.id === id) ?? null;
}

/**
 * The Design fields for one catalogue item, ready for `setDraft`. `variant`
 * names the copy: `copy` for "Use as starting point", `v2` for "Improve this",
 * which starts a version rather than a fork.
 */
export function pickCatalogItem(
  id: string | null | undefined,
  variant: "copy" | "v2" = "copy",
): CatalogItem["fields"] & { title: string } | null {
  const item = findCatalogItem(id);
  if (!item) return null;
  return { ...item.fields, title: `${item.name} ${variant === "v2" ? "v2" : "(copy)"}` };
}

/**
 * The Dashboard's three sample Live Agents, with ids so a link can name one.
 * Their fields come from the card itself (subtitle, pair), the same way the
 * Explore rows do, and they are seeded as running bots: version 1, all stages
 * done, so "Improve" opens the last stage of the lifecycle.
 */
export const DASHBOARD_AGENTS: readonly CatalogItem[] = SAMPLE.agents.map((card) => {
  const lower = card.subtitle.toLowerCase();
  return {
    id: card.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name: card.title,
    source: "Dashboard, sample",
    fields: {
      botKind: "agent",
      strategyType: /churn|mm|market/.test(card.title.toLowerCase()) ? "Market Making" : "Directional",
      exchange: card.subtitle.split(/[\s(]/)[0] || "Binance",
      marketType: lower.includes("perp") ? "Perps" : "Spot",
      pair: card.pair.replace(/\s*perp$/, ""),
      startingPoint: "import",
      howItWorks: `Live on ${card.subtitle}, ${card.pair}, started ${card.agentStarted}. Sample data.`,
      title: `${card.title} v1`,
    },
  };
});

export function findDashboardAgent(id: string | null | undefined): CatalogItem | null {
  if (!id) return null;
  return DASHBOARD_AGENTS.find((item) => item.id === id) ?? null;
}
