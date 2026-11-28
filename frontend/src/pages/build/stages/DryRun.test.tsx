/**
 * Dry Run, the third Build stage: setup, watch, review.
 *
 * The session is canned but it has a clock, so most of what is worth testing is
 * the interval: that the figures move, that Pause stops them, that the session
 * ends on its own, and that nothing keeps ticking after the stage is gone.
 *
 * Needs a DOM, so this file overrides vitest's default `node` environment.
 *
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Draft, StageId } from "../types";

const { default: DryRun } = await import("./DryRun");

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const EMPTY: Draft = {
  botKind: null,
  strategyType: null,
  exchange: null,
  marketType: null,
  pair: null,
  pairs: [],
  pairsText: "",
  pairsDynamic: false,
  marketQty: null,
  maxPositions: null,
  maxPositionsMode: "fixed",
  spreads: "",
  targetProfit: null,
  stopLoss: null,
  startingPoint: null,
  howItWorks: "",
  title: "",
  designDone: false,
  backtestDone: false,
  dryRunDone: false,
  deployed: false,
};

const DESIGNED: Draft = {
  ...EMPTY,
  botKind: "strategy",
  strategyType: "Market Making",
  exchange: "Binance",
  marketType: "Perps",
  pair: "USDC-USDT",
  pairs: ["USDC-USDT"],
  pairsText: "USDC-USDT",
  pairsDynamic: false,
  designDone: true,
  backtestDone: true,
};

let container: HTMLDivElement;
let root: Root;
let setDraft: (patch: Partial<Draft>) => void;
let goTo: (stage: StageId) => void;

function mount(draft: Draft = EMPTY) {
  setDraft = vi.fn();
  goTo = vi.fn();
  act(() => {
    root.render(<DryRun draft={draft} setDraft={setDraft} goTo={goTo} />);
  });
}

async function elapse(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function byText(pattern: RegExp): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll("button")).find((b) =>
    pattern.test(b.textContent ?? ""),
  );
  if (!found) throw new Error(`no button matching ${pattern}`);
  return found;
}

function click(b: HTMLElement) {
  act(() => b.click());
}

function testid(id: string): HTMLElement | null {
  return container.querySelector(`[data-testid="${id}"]`);
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("Dry Run", () => {
  it("names a sample draft and offers the four session lengths", () => {
    mount(EMPTY);
    expect(testid("sample-draft")?.textContent).toContain(
      "Sample draft: Stable Churn on Binance, USDC-USDT",
    );
    const radios = Array.from(container.querySelectorAll('[role="radio"]')).map((r) => r.textContent);
    expect(radios).toEqual(["1 hour", "6 hours", "24 hours", "7 days"]);
    // 6 hours is the default.
    const chosen = container.querySelector('[role="radio"][aria-checked="true"]');
    expect(chosen?.textContent).toBe("6 hours");
  });

  it("starts paper trading and ticks the figures every second", async () => {
    mount(DESIGNED);
    click(byText(/^Start dry run$/));

    expect(testid("dry-run-live")).not.toBeNull();
    expect(testid("dry-run-setup")).toBeNull();
    expect(container.textContent).toContain("Paper trading");

    const realised = () => testid("realised")?.textContent ?? "";
    const first = realised();
    await elapse(1000);
    const second = realised();
    expect(second).not.toBe(first);
    expect(testid("dry-run-clock")?.textContent).toContain("elapsed");
    // The open-orders table is captioned for a screen reader.
    expect(container.querySelector("table caption")?.textContent).toContain("Orders resting");
  });

  it("pauses the tick and resumes it", async () => {
    mount(DESIGNED);
    click(byText(/^Start dry run$/));
    await elapse(2000);

    click(byText(/^Pause$/));
    expect(container.textContent).toContain("Paused");
    const held = testid("realised")?.textContent;
    await elapse(3000);
    expect(testid("realised")?.textContent).toBe(held);
    expect(vi.getTimerCount()).toBe(0);

    click(byText(/^Resume$/));
    await elapse(1000);
    expect(testid("realised")?.textContent).not.toBe(held);
  });

  it("reviews the run with the backtest beside it and three checks", async () => {
    mount(DESIGNED);
    click(byText(/^Start dry run$/));
    await elapse(3000);
    click(byText(/^Stop and review$/));

    expect(testid("dry-run-review")).not.toBeNull();
    expect(testid("dry-run-live")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);

    const compare = testid("dry-run-compare")?.textContent ?? "";
    expect(compare).toContain("Max drawdown");
    expect(compare).toContain("+6.1 pts shallower");
    expect(compare).toContain("−0.24");

    const text = container.textContent ?? "";
    expect(text).toContain("Ready to go live?");
    expect(text).toContain("Enough fills to judge the fills themselves");
    expect(text).toContain("Two of three passed");
    // The failing check is not colour only: it says so in words too.
    expect(text).toContain("(not passed)");
  });

  it("marks the draft and goes to Deploy only from the review", async () => {
    mount(DESIGNED);
    expect(testid("continue-deploy")).toBeNull();

    click(byText(/^Start dry run$/));
    expect(testid("continue-deploy")).toBeNull();
    click(byText(/^Stop and review$/));

    click(testid("continue-deploy")!);
    expect(setDraft).toHaveBeenCalledWith({ dryRunDone: true });
    expect(goTo).toHaveBeenCalledWith("deploy");
    expect(goTo).toHaveBeenCalledTimes(1);
  });

  it("goes back to the backtest, or back to setup for another run", async () => {
    mount(DESIGNED);
    click(byText(/^Start dry run$/));
    click(byText(/^Stop and review$/));

    click(byText(/^Back to Backtest$/));
    expect(goTo).toHaveBeenCalledWith("backtest");

    click(byText(/^Run another dry run$/));
    expect(testid("dry-run-setup")).not.toBeNull();
    expect(testid("dry-run-review")).toBeNull();
  });

  it("ends the session on its own clock and reviews it", async () => {
    mount(DESIGNED);
    click(byText(/^1 hour$/));
    click(byText(/^Start dry run$/));
    expect(testid("dry-run-live")).not.toBeNull();

    // Four simulated minutes a second, so an hour of session is fifteen ticks.
    await elapse(16_000);
    expect(testid("dry-run-review")).not.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    expect(container.textContent).toContain("1h 00m of a 1h 00m session");
  });

  it("stops ticking when it unmounts mid-session", async () => {
    mount(DESIGNED);
    click(byText(/^Start dry run$/));
    await elapse(2000);
    expect(vi.getTimerCount()).toBe(1);

    act(() => root.unmount());
    expect(vi.getTimerCount()).toBe(0);
    // The shared afterEach unmounts again: give it an empty root to do it on.
    root = createRoot(container);
  });
});
