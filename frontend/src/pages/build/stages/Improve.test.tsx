/**
 * Build → Improve: the comparison, the health cards, the three suggestion
 * actions, and the v2 reset that sends the draft back to Design.
 *
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import Improve from "./Improve";
import { HEALTH_ROWS, SUGGESTIONS, nextVersionTitle, perfSummary } from "../sample/improveData";
import type { Draft, StageId } from "../types";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const BASE_DRAFT: Draft = {
  botKind: "strategy",
  strategyType: "Market Making",
  exchange: "Binance",
  marketType: "Spot",
  pair: "USDC-USDT",
  pairs: ["USDC-USDT"],
  pairsText: "USDC-USDT",
  pairsDynamic: false,
  marketQty: 2,
  maxPositions: 3,
  maxPositionsMode: "fixed",
  spreads: "",
  targetProfit: null,
  stopLoss: null,
  startingPoint: "import",
  howItWorks: "Two-sided post-only quotes on a stablecoin pair.",
  title: "Stable Churn",
  designDone: true,
  backtestDone: true,
  dryRunDone: true,
  deployed: true,
};

let container: HTMLDivElement;
let root: Root;
let patches: Array<Partial<Draft>>;
let stages: StageId[];

function draft(over: Partial<Draft> = {}): Draft {
  return { ...BASE_DRAFT, ...over };
}

function render(d: Draft = draft()) {
  act(() => {
    root.render(<Improve draft={d} setDraft={(patch) => patches.push(patch)} goTo={(stage) => stages.push(stage)} />);
  });
}

const text = () => container.textContent ?? "";
const buttons = () => [...container.querySelectorAll("button")] as HTMLButtonElement[];
const button = (name: string) => buttons().find((b) => (b.textContent ?? "").trim() === name);
const nth = (name: string, index: number) => buttons().filter((b) => (b.textContent ?? "").trim() === name)[index];

async function click(el: Element | null | undefined) {
  await act(async () => {
    (el as HTMLElement).click();
  });
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  patches = [];
  stages = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("performance review", () => {
  it("compares live with the backtest and the dry run, with a caption and a text alternative", () => {
    render();
    const table = container.querySelector("table") as HTMLTableElement;
    expect(table.querySelector("caption")?.textContent).toContain("Live results against the backtest");
    expect(text()).toContain("$412.80"); // live P&L
    expect(text()).toContain("$468.20"); // backtest P&L
    expect(text()).toContain("$396.40"); // dry run P&L

    const chart = container.querySelector('[role="img"]') as HTMLElement;
    expect(chart.getAttribute("aria-label")).toBe(perfSummary());
    expect(chart.getAttribute("aria-label")).toContain("Net P&L");
  });

  it("signs and colours each delta, and reads a lower drawdown as good", () => {
    render();
    const rows = [...container.querySelectorAll("tbody tr")];
    const drawdown = rows.find((r) => r.textContent?.includes("Max drawdown")) as HTMLElement;
    // Live 3.4% against a 2.8% backtest is 0.6 points worse: a plus, and red, because lower is better.
    expect(drawdown.textContent).toContain("+0.6%");
    expect(drawdown.innerHTML).toContain("text-[var(--color-red)]");

    const pnl = rows.find((r) => r.textContent?.includes("Net P&L")) as HTMLElement;
    expect(pnl.textContent).toContain("\u2212$55.40");
  });
});

describe("health", () => {
  it("shows every diagnostic with its own status word", () => {
    render();
    for (const row of HEALTH_ROWS) {
      expect(text()).toContain(row.label);
      expect(text()).toContain(row.value);
    }
    expect(text()).toContain("Watch"); // errors and inventory skew
    expect(text()).toContain("Good");
  });
});

describe("suggestions", () => {
  it("accepts and dismisses, one state per suggestion", async () => {
    render();
    await click(nth("Accept", 0));
    expect(text()).toContain("Accepted");
    await click(nth("Accept", 0)); // same button again clears the decision
    expect(text()).not.toContain("Accepted");

    await click(nth("Dismiss", 0));
    expect(text()).toContain("Dismissed");
    expect(SUGGESTIONS.length).toBe(3);
  });

  it("sends a suggestion to Backtest", async () => {
    render();
    await click(nth("Test in Backtest", 1));
    expect(stages).toEqual(["backtest"]);
  });
});

describe("iterating", () => {
  it("creates a v2 draft with the flags reset and opens Design", async () => {
    render();
    await click(button("Create v2 draft"));
    expect(patches).toEqual([
      { title: "Stable Churn v2", designDone: false, backtestDone: false, dryRunDone: false, deployed: false },
    ]);
    expect(stages).toEqual(["design"]);
  });

  it("does not stack version suffixes", () => {
    expect(nextVersionTitle("Stable Churn")).toBe("Stable Churn v2");
    expect(nextVersionTitle("Stable Churn v2")).toBe("Stable Churn v2");
    expect(nextVersionTitle("  ")).toBe("Untitled draft v2");
  });

  it("pauses and resumes the bot in the UI only", async () => {
    render();
    expect(text()).toContain("Live");
    await click(button("Pause bot"));
    expect(text()).toContain("Paused");
    expect(text()).toContain("Resume bot");
    expect(patches).toEqual([]);
  });
});
