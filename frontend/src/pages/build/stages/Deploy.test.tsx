/**
 * Build → Deploy: the pre-flight list follows the draft flags, the typed gate
 * is the only way to the live state, and the canned steps clean up after
 * themselves.
 *
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Deploy from "./Deploy";
import {
  CONFIRM_WORD,
  SAMPLE_BALANCE,
  STEP_MS,
  preFlightRows,
} from "../sample/deployData";
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
  marketQty: 2,
  maxPositions: 3,
  startingPoint: "import",
  howItWorks: "Two-sided post-only quotes on a stablecoin pair.",
  title: "Stable Churn",
  designDone: true,
  backtestDone: true,
  dryRunDone: true,
  deployed: false,
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
    root.render(
      <MemoryRouter>
        <Deploy draft={d} setDraft={(patch) => patches.push(patch)} goTo={(stage) => stages.push(stage)} />
      </MemoryRouter>,
    );
  });
}

const text = () => container.textContent ?? "";
const button = (name: string) =>
  [...container.querySelectorAll("button")].find((b) => (b.textContent ?? "").trim() === name) as HTMLButtonElement | undefined;
const dialog = () => container.querySelector('[role="dialog"]') as HTMLElement | null;

async function click(el: Element | null | undefined) {
  await act(async () => {
    (el as HTMLElement).click();
  });
}

async function typeInto(value: string) {
  const input = dialog()?.querySelector("input") as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
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
  vi.useRealTimers();
});

describe("pre-flight", () => {
  it("reads the backtest and dry run flags from the draft", () => {
    const pending = preFlightRows({ backtestDone: false, dryRunDone: false, capital: 800 });
    expect(pending.find((r) => r.id === "backtest")?.status).toBe("action");
    expect(pending.find((r) => r.id === "dry-run")?.status).toBe("action");
    expect(pending.find((r) => r.id === "keys")?.status).toBe("pass");
    expect(pending.find((r) => r.id === "limits")?.status).toBe("pass");

    const done = preFlightRows({ backtestDone: true, dryRunDone: true, capital: 800 });
    expect(done.every((r) => r.status === "pass")).toBe(true);
  });

  it("blocks when the capital is above the sample balance", () => {
    const rows = preFlightRows({ backtestDone: true, dryRunDone: true, capital: SAMPLE_BALANCE + 1 });
    expect(rows.find((r) => r.id === "balance")?.status).toBe("fail");
  });

  it("shows the open checks in the panel and greys the primary when blocked", async () => {
    render(draft({ backtestDone: false, dryRunDone: false }));
    expect(text()).toContain("2 open");
    expect(text()).toContain("No backtest on this draft yet");

    // A capital above the sample balance fails the balance check.
    const range = container.querySelector('input[aria-label="Capital allocation"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(range, String(SAMPLE_BALANCE + 500));
      range.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(text()).toContain("Blocked");
    expect(button("Deploy bot")?.disabled).toBe(true);
  });

  it("falls back to the sample draft line when the draft has no title", () => {
    render(draft({ title: "" }));
    expect(text()).toContain("Sample draft: Stable Churn on Binance, USDC-USDT");
  });
});

describe("the typed gate", () => {
  it("will not deploy until the title or DEPLOY is typed", async () => {
    render();
    await click(button("Deploy bot"));
    expect(dialog()).not.toBeNull();

    const confirm = () => button("Deploy bot") ?? button("Deploy anyway");
    expect((dialog()!.querySelector("button:last-of-type") as HTMLButtonElement).disabled).toBe(true);

    await typeInto("nope");
    expect((dialog()!.querySelector("button:last-of-type") as HTMLButtonElement).disabled).toBe(true);

    await typeInto("stable churn"); // case-insensitive
    expect((dialog()!.querySelector("button:last-of-type") as HTMLButtonElement).disabled).toBe(false);
    expect(confirm()).toBeTruthy();
  });

  it("takes the word DEPLOY as well as the title", async () => {
    render();
    await click(button("Deploy bot"));
    await typeInto(CONFIRM_WORD);
    const go = dialog()!.querySelector("button:last-of-type") as HTMLButtonElement;
    expect(go.disabled).toBe(false);
    await click(go);
    expect(text()).toContain("Deploying…");
  });

  it("cancels on Escape and on Cancel without deploying", async () => {
    render();
    await click(button("Deploy bot"));
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(dialog()).toBeNull();
    expect(text()).not.toContain("Deploying…");

    await click(button("Deploy bot"));
    await click(button("Cancel"));
    expect(dialog()).toBeNull();
    expect(patches).toHaveLength(0);
  });

  it("repeats the open checks inside the dialog", async () => {
    render(draft({ backtestDone: false, dryRunDone: false }));
    await click(button("Deploy bot"));
    expect(dialog()?.textContent).toContain("Still open");
    expect(dialog()?.textContent).toContain("Backtest done");
    expect(dialog()?.textContent).toContain("Dry run done");
  });
});

describe("deploying and live", () => {
  it("walks the three canned steps and then reports the bot live", async () => {
    vi.useFakeTimers();
    render();
    await click(button("Deploy bot"));
    await typeInto("Stable Churn");
    await click(dialog()!.querySelector("button:last-of-type"));

    expect(text()).toContain("Validating the draft");
    expect(patches).toEqual([]);

    await act(async () => {
      vi.advanceTimersByTime(STEP_MS);
    });
    expect(text()).toContain("Starting the bot");

    await act(async () => {
      vi.advanceTimersByTime(STEP_MS * 3);
    });
    expect(text()).toContain("Your bot is live");
    expect(patches).toEqual([{ deployed: true }]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("goes to Improve and links to the Dashboard once live", async () => {
    vi.useFakeTimers();
    render();
    await click(button("Deploy bot"));
    await typeInto("Stable Churn");
    await click(dialog()!.querySelector("button:last-of-type"));
    await act(async () => {
      vi.advanceTimersByTime(STEP_MS * 4);
    });

    expect(container.querySelector('a[href="/"]')?.textContent).toContain("Dashboard");
    await click(button("Go to Improve"));
    expect(stages).toEqual(["improve"]);
  });

  it("says paused when started paused", async () => {
    vi.useFakeTimers();
    render();
    await click(button("Deploy bot"));
    await typeInto("Stable Churn");
    await click(dialog()!.querySelector("button:last-of-type"));
    await act(async () => {
      vi.advanceTimersByTime(STEP_MS * 4);
    });
    // Start mode defaults to paused, so the live card says so.
    expect(text()).toContain("Your bot is live, paused");
  });

  it("clears its timers when the stage unmounts mid-deploy", async () => {
    vi.useFakeTimers();
    render();
    await click(button("Deploy bot"));
    await typeInto("Stable Churn");
    await click(dialog()!.querySelector("button:last-of-type"));
    // Four timers: three steps and the finish.
    expect(vi.getTimerCount()).toBe(4);

    act(() => root.unmount());
    // The step timers are gone; React may leave one of its own flushes behind.
    expect(vi.getTimerCount()).toBeLessThan(4);
    await act(async () => {
      vi.runOnlyPendingTimers();
    });
    expect(vi.getTimerCount()).toBe(0);
    // Nothing wrote to the draft or moved the stepper after unmount.
    expect(patches).toEqual([]);

    root = createRoot(document.createElement("div"));
  });

  it("skips the step animation when the operator asked for less motion", async () => {
    window.matchMedia = ((query: string) => ({
      matches: /prefers-reduced-motion/.test(query),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    render();
    await click(button("Deploy bot"));
    await typeInto("Stable Churn");
    await click(dialog()!.querySelector("button:last-of-type"));
    expect(text()).toContain("Your bot is live");
    expect(patches).toEqual([{ deployed: true }]);
  });
});
