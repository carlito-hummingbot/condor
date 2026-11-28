/**
 * The Design stage: a five-step wizard (Starting point, Trading Style, Markets,
 * Limits, Review) with progress dots, then the design chat.
 *
 * Mounted on its own with a local draft, the way the shell mounts it, and with
 * the providers the page has in the app (the heading reads the profile name
 * through the preferences query). Nothing here makes a request.
 *
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emptyDraft } from "../draftStore";
import type { Draft, StageId } from "../types";

const prefs = vi.hoisted(() => ({ current: { profile: { display_name: "Ada" } } as Record<string, unknown> }));

vi.mock("@/lib/api", async (original) => {
  const actual = await original<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, getPreferences: async () => prefs.current } };
});
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ token: "t", user: { id: 1, username: "local", first_name: "Local", role: "admin" } }),
}));

const { default: Design } = await import("./Design");

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

async function flush(ms = 0) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

/** The stage alone, with the draft the shell would own, and a way to read it. */
function Harness({ initial, onGo }: { initial?: Partial<Draft>; onGo: (stage: StageId) => void }) {
  const [draft, setDraftState] = useState<Draft>({ ...emptyDraft(), ...initial });
  const setDraft = (patch: Partial<Draft>) => setDraftState((current) => ({ ...current, ...patch }));
  return (
    <>
      <Design draft={draft} setDraft={setDraft} goTo={onGo} />
      <pre data-testid="draft">{JSON.stringify(draft)}</pre>
    </>
  );
}

function render(initial?: Partial<Draft>, onGo: (stage: StageId) => void = () => {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <Harness initial={initial} onGo={onGo} />
      </QueryClientProvider>,
    );
  });
}

const text = () => container.textContent ?? "";
const draft = () => JSON.parse(container.querySelector('[data-testid="draft"]')!.textContent ?? "{}") as Draft;

async function click(el: Element | null | undefined) {
  await act(async () => {
    (el as HTMLElement | undefined)?.click();
  });
  await flush();
}

const button = (name: string | RegExp) =>
  [...container.querySelectorAll("button")].find((b) =>
    typeof name === "string" ? b.textContent?.trim() === name : name.test(b.textContent ?? ""),
  ) as HTMLButtonElement | undefined;

/** The Next / Back pair under the step card. */
const next = () => button(/^(Next|Start designing)$/);
const back = () => button("Back");

/** The dots, in order. */
const dots = () => [...container.querySelectorAll('nav[aria-label="Design progress"] button')] as HTMLButtonElement[];
const currentDot = () => dots().findIndex((d) => d.getAttribute("aria-current") === "step");
/** "Step 2 of 5: Trading Style" — the caption under the dots. */
const stepLabel = () => container.querySelector('nav[aria-label="Design progress"] p')?.textContent ?? "";

/** Type into a controlled field the way a browser does. */
async function type(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const proto = el instanceof HTMLSelectElement ? window.HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  await act(async () => {
    setter.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
  await flush();
}

const field = (id: string) => container.querySelector(`#${id}`) as HTMLInputElement | HTMLSelectElement | null;
const radio = (name: string) =>
  [...container.querySelectorAll('[role="radio"]')].find((r) => r.textContent?.trim() === name) as
    | HTMLButtonElement
    | undefined;

/** Walk steps 1–3 with valid answers so a test can start where it cares. */
async function toLimits(patch: Partial<Draft> = {}, onGo: (stage: StageId) => void = () => {}) {
  render({ botKind: "strategy", startingPoint: "scratch", strategyType: "Market Making", spreads: "0.1", ...patch }, onGo);
  await flush();
  await click(next()); // 1 → 2
  await click(next()); // 2 → 3
  await type(field("design-exchange")!, "Binance");
  await click(radio("Spot"));
  await type(field("design-pairs")!, "BTC-USDT");
  await click(next()); // 3 → 4
}

beforeEach(() => {
  prefs.current = { profile: { display_name: "Ada" } };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("Design wizard", () => {
  it("greets the person by the name onboarding stored", async () => {
    render();
    await flush();
    await flush();
    expect(text()).toContain("What are we building, Ada?");
  });

  it("falls back to the plain 'algo trader' when no name is stored", async () => {
    prefs.current = {};
    render();
    await flush();
    await flush();
    expect(text()).toContain("What are we building, algo trader?");
  });

  it("opens on Starting point, with five dots and a step counter", async () => {
    render();
    await flush();
    expect(currentDot()).toBe(0);
    expect(dots()).toHaveLength(5);
    expect(dots().map((d) => d.getAttribute("aria-label"))).toEqual([
      "Step 1 of 5",
      "Step 2 of 5",
      "Step 3 of 5",
      "Step 4 of 5",
      "Step 5 of 5",
    ]);
    expect(stepLabel()).toBe("Step 1 of 5: Starting point");
    // Starting point is on step 1, not later.
    expect(text()).toContain("Start from scratch");
    expect(text()).toContain("Bot type");
    // Later steps are not clickable yet.
    expect(dots()[4].disabled).toBe(true);
  });

  it("calls the second question Trading Style, and nothing says 'Strategy or agent type'", async () => {
    render({ botKind: "strategy", startingPoint: "scratch" });
    await flush();
    await click(next());
    expect(stepLabel()).toBe("Step 2 of 5: Trading Style");
    expect(text()).toContain("Trading Style");
    expect(text()).not.toContain("Strategy or agent type");
    expect(container.querySelector('[role="radiogroup"][aria-label="Trading Style"]')).toBeTruthy();
  });

  it("puts exchange, market type and pairs on one Markets step, with no old Markets picker", async () => {
    render({ botKind: "strategy", startingPoint: "scratch", strategyType: "Market Making" });
    await flush();
    await click(next());
    await click(next());
    expect(stepLabel()).toBe("Step 3 of 5: Markets");
    expect(field("design-exchange")).toBeTruthy();
    expect(container.querySelector('[role="radiogroup"][aria-label="Market type"]')).toBeTruthy();
    expect(field("design-pairs")).toBeTruthy();
    // The old "Markets" 1 / 2 / 10 picker and the pair combobox are gone.
    expect(container.querySelector('[role="radiogroup"][aria-label="How many markets"]')).toBeNull();
    expect(container.querySelector('[role="combobox"]')).toBeNull();
  });

  it("turns comma entries into chips, drops duplicates and flags a bad pair", async () => {
    render({ botKind: "strategy", startingPoint: "scratch", strategyType: "Market Making" });
    await flush();
    await click(next());
    await click(next());
    await type(field("design-exchange")!, "Binance");
    await click(radio("Spot"));

    await type(field("design-pairs")!, "btc-usdt, eth-usdt, BTC-USDT");
    const chips = [...container.querySelectorAll('ul[aria-label="Market pair(s) entries"] li')].map((li) =>
      li.textContent?.replace("×", "").trim(),
    );
    expect(chips).toEqual(["BTC-USDT", "ETH-USDT"]);
    expect(draft().pairs).toEqual(["BTC-USDT", "ETH-USDT"]);

    await type(field("design-pairs")!, "BTC-USDT, NOPE");
    expect(text()).toContain("Not reading as a valid entry: NOPE");
    // The good entry still counts, so Next is not blocked by the bad one.
    expect(next()!.disabled).toBe(false);

    // A field with nothing valid blocks Next.
    await type(field("design-pairs")!, "NOPE");
    expect(next()!.disabled).toBe(true);
  });

  it("greys the pair field under Dynamic, unblocks Next, and restores the text", async () => {
    render({ botKind: "strategy", startingPoint: "scratch", strategyType: "Market Making" });
    await flush();
    await click(next());
    await click(next());
    await type(field("design-exchange")!, "Binance");
    await click(radio("Spot"));
    await type(field("design-pairs")!, "BTC-USDT");

    const dynamic = () => container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await click(dynamic());

    const input = field("design-pairs") as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(input.getAttribute("aria-disabled")).toBe("true");
    expect(input.tabIndex).toBe(-1);
    expect(draft().pairsDynamic).toBe(true);
    expect(next()!.disabled).toBe(false);

    // The typed text is kept while the field is off…
    await click(dynamic());
    expect((field("design-pairs") as HTMLInputElement).value).toBe("BTC-USDT");
    expect((field("design-pairs") as HTMLInputElement).disabled).toBe(false);
  });

  it("shows Spreads only for Market Making, and keeps what was typed across a switch", async () => {
    await toLimits();
    expect(text()).toContain("Spreads (%)");
    await type(field("design-spreads")!, "0.1, 0.3");
    expect(draft().spreads).toBe("0.1, 0.3");

    // Back to Trading Style, choose Directional: Spreads leaves the step.
    await click(back());
    await click(back());
    await click(radio("Directional"));
    await click(next());
    await click(next());
    expect(text()).not.toContain("Spreads (%)");
    expect(draft().spreads).toBe("0.1, 0.3");

    // Back again to Market Making: the typed spreads are still there.
    await click(back());
    await click(back());
    await click(radio("Market Making"));
    await click(next());
    await click(next());
    expect(text()).toContain("Spreads (%)");
    expect((field("design-spreads") as HTMLInputElement).value).toBe("0.1, 0.3");
  });

  it("requires Target Profit and Stop Loss as positive numbers, prefilled with nothing", async () => {
    await toLimits();
    expect((field("design-target-profit") as HTMLInputElement).value).toBe("");
    expect((field("design-stop-loss") as HTMLInputElement).value).toBe("");
    expect(next()!.disabled).toBe(true);
    expect(text()).toContain("Target Profit is required.");
    expect(text()).toContain("Stop Loss is required.");

    await type(field("design-target-profit")!, "2");
    await type(field("design-stop-loss")!, "0");
    expect(text()).toContain("Stop Loss must be greater than 0.");

    await type(field("design-stop-loss")!, "1.5");
    expect(text()).not.toContain("Stop Loss must be greater than 0.");
  });

  it("has no preset Max Positions: no default, no 1/3/5 buttons, Fixed needs a number", async () => {
    await toLimits();
    expect(draft().maxPositionsMode).toBeNull();
    expect(field("design-max-positions")).toBeNull();
    const quickPicks = [...container.querySelectorAll("button")].filter((b) =>
      ["1", "3", "5"].includes(b.textContent?.trim() ?? ""),
    );
    expect(quickPicks).toHaveLength(0);

    await type(field("design-target-profit")!, "2");
    await type(field("design-stop-loss")!, "1.5");
    expect(next()!.disabled).toBe(true);

    await click(radio("Dynamic"));
    expect(text()).toContain("Depends on your budget");
    expect(field("design-max-positions")).toBeNull();
    expect(next()!.disabled).toBe(false);

    await click(radio("Fixed"));
    expect(next()!.disabled).toBe(true);
    await type(field("design-max-positions")!, "2.5");
    expect(text()).toContain("Max positions must be a whole number.");
    await type(field("design-max-positions")!, "4");
    expect(next()!.disabled).toBe(false);
    expect(draft().maxPositions).toBe(4);
  });

  it("starts an older saved draft at step 1 without crashing", async () => {
    // The old shape: no pairs, no limits, a single pair and the old market quantity.
    const old = {
      botKind: "agent",
      strategyType: "LP",
      exchange: "Meteora",
      marketType: "LP",
      pair: "SOL-USDC",
      marketQty: 2,
      maxPositions: 3,
      startingPoint: "import",
      howItWorks: "old notes",
      title: "Old draft",
    } as unknown as Partial<Draft>;
    render(old);
    await flush();
    expect(currentDot()).toBe(0);
    expect(stepLabel()).toBe("Step 1 of 5: Starting point");
    // It keeps what it had and fills the rest with empties.
    expect(draft().title).toBe("Old draft");
    expect(draft().pairs).toEqual([]);
    expect(draft().maxPositionsMode).toBeNull();
  });

  it("keeps the answers when Back is used", async () => {
    render({ botKind: "strategy", startingPoint: "scratch", strategyType: "Market Making" });
    await flush();
    await click(next());
    await click(next());
    await type(field("design-exchange")!, "Binance");
    await type(field("design-pairs")!, "BTC-USDT, ETH-USDT");
    await click(back());
    await click(next());
    expect((field("design-exchange") as HTMLSelectElement).value).toBe("Binance");
    expect((field("design-pairs") as HTMLInputElement).value).toBe("BTC-USDT, ETH-USDT");
  });

  it("reviews the answers, then opens the chat and finishes on Backtest", async () => {
    const goTo = vi.fn();
    await toLimits({}, goTo);
    await type(field("design-target-profit")!, "2");
    await type(field("design-stop-loss")!, "1.5");
    await click(radio("Fixed"));
    await type(field("design-max-positions")!, "4");
    await click(next());

    expect(stepLabel()).toBe("Step 5 of 5: Review");
    expect(text()).toContain("Trading Style");
    expect(text()).toContain("BTC-USDT");
    expect(text()).toContain("2%");
    expect(text()).toContain("1.5%");
    expect(text()).toContain("Max positions");

    await type(field("design-title")!, "BTC-USDT Market Making Bot");
    await click(next());
    // The chat is open now.
    expect(text()).toContain("Design with the assistant");
    const done = button(/I'm done designing/);
    expect(done, "the chat should offer I'm done designing").toBeTruthy();
    await click(done);
    expect(draft().designDone).toBe(true);
    expect(goTo).toHaveBeenCalledWith("backtest");
  });
});
