/**
 * The Design stage: the guide's required-field gate, the options that depend on
 * the choices above them, the live draft panel, the jump into the chat, a
 * canned assistant reply, the design notes, and "I'm done designing".
 *
 * Showcase only: the component is mounted on its own with a local draft, the
 * way the shell mounts it, and no request is made.
 *
 * @vitest-environment jsdom
 */

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CATALOG_ITEMS } from "../sample/catalog";
import { emptyDraft } from "../draftStore";
import type { Draft, StageId } from "../types";
import Design from "./Design";

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
  act(() => {
    root.render(<Harness initial={initial} onGo={onGo} />);
  });
}

const text = () => container.textContent ?? "";

/** The canned reply lands on a 600ms timer; poll rather than guess at load. */
async function waitForText(fragment: string, timeout = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (text().includes(fragment)) return;
    await flush(100);
  }
  throw new Error(`timed out waiting for "${fragment}"`);
}
const draftNow = () =>
  JSON.parse(container.querySelector('[data-testid="draft"]')?.textContent ?? "{}") as Draft;
const summary = () => container.querySelector("aside")?.textContent ?? "";

function button(name: string | RegExp) {
  return [...container.querySelectorAll("button")].find((b) =>
    typeof name === "string" ? b.textContent?.trim() === name : name.test(b.textContent ?? ""),
  ) as HTMLButtonElement | undefined;
}

function radio(name: string | RegExp) {
  return [...container.querySelectorAll('[role="radio"]')].find((b) =>
    typeof name === "string" ? b.textContent?.trim() === name : name.test(b.textContent ?? ""),
  ) as HTMLButtonElement | undefined;
}

/** The market-type group's LP, not the strategy-type LP chip. */
function marketRadio(name: string) {
  const group = container.querySelector('[role="radiogroup"][aria-label="Market type"]');
  return [...(group?.querySelectorAll('[role="radio"]') ?? [])].find(
    (b) => b.textContent?.trim() === name,
  ) as HTMLButtonElement | undefined;
}

function byLabel(label: string) {
  return container.querySelector(`[aria-label="${label}"]`) as HTMLElement | null;
}

async function click(el: Element | null | undefined) {
  await act(async () => {
    (el as HTMLElement).click();
  });
  await flush();
}

/** Type into a controlled input the way a browser does: value setter + input. */
async function typeInto(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  await act(async () => {
    setter?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await flush();
}

async function choose(el: HTMLSelectElement | null, value: string) {
  if (!el) throw new Error("no select");
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(el, value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flush();
}

const pairInput = () => container.querySelector("#design-pair") as HTMLInputElement;
const exchangeSelect = () => container.querySelector("#design-exchange") as HTMLSelectElement;

/** Fill the six required fields, leaving the title to the suggestion. */
async function fillGuide() {
  await click(radio("Strategy"));
  await click(radio("Market Making"));
  await choose(exchangeSelect(), "Binance");
  await click(radio("Spot"));
  await typeInto(pairInput(), "BTC-USDT");
}

async function openChat() {
  render();
  await flush();
  await fillGuide();
  await click(button("Start designing"));
  await flush();
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("Design guide", () => {
  it("keeps Start designing disabled and names every required field still empty", async () => {
    render();
    await flush();

    expect(button("Start designing")?.disabled).toBe(true);
    expect(text()).toContain(
      "Still needed: Bot type, Strategy or agent type, Target exchange, Market type, Market pair, Desired title.",
    );

    await fillGuide();

    // The title was suggested from the type and the pair, so nothing is missing.
    expect(draftNow().title).toBe("BTC-USDT Market Making Bot");
    expect(button("Start designing")?.disabled).toBe(false);
    expect(text()).toContain("Ready: the assistant will take it from here.");
  });

  it("shows the summary panel in step as the guide is filled", async () => {
    render();
    await flush();
    await fillGuide();

    expect(summary()).toContain("Market Making");
    expect(summary()).toContain("Binance");
    expect(summary()).toContain("Spot");
    expect(summary()).toContain("BTC-USDT");
    expect(summary()).toContain("BTC-USDT Market Making Bot");

    await typeInto(container.querySelector("#design-title") as HTMLInputElement, "Churn v2");
    expect(summary()).toContain("Churn v2");
  });

  it("enables LP only for the LP type or a DEX, and says why not", async () => {
    render();
    await flush();
    await choose(exchangeSelect(), "Binance");

    expect(marketRadio("LP")?.disabled).toBe(true);
    expect(text()).toContain("LP needs the LP strategy type or a DEX such as Meteora.");

    // A DEX with pools enables LP on its own.
    await choose(exchangeSelect(), "Meteora (DEX)");
    expect(marketRadio("LP")?.disabled).toBe(false);

    // The LP type enables it on any venue.
    await choose(exchangeSelect(), "Binance");
    expect(marketRadio("LP")?.disabled).toBe(true);
    await click(radio("LP"));
    expect(marketRadio("LP")?.disabled).toBe(false);
  });

  it("lists the chosen exchange's pairs and drops a pair the new venue lacks", async () => {
    render();
    await flush();
    await choose(exchangeSelect(), "Binance");

    await typeInto(pairInput(), "SOL");
    expect(container.querySelector('[role="listbox"]')?.textContent).toContain("SOL-USDC");

    await click(container.querySelector('[role="option"]'));
    expect(draftNow().pair).toBe("SOL-USDC");

    await choose(exchangeSelect(), "Bybit");
    // Bybit's sample list has SOL-USDT, not SOL-USDC: the stale pair is gone.
    expect(draftNow().pair).toBe(null);
    await typeInto(pairInput(), "SOL");
    const listed = container.querySelector('[role="listbox"]')?.textContent ?? "";
    expect(listed).toContain("SOL-USDT");
    expect(listed).not.toContain("SOL-USDC");
  });

  it("fills How it works from the choices and the import chooser", async () => {
    render();
    await flush();
    await fillGuide();

    await click(button("Suggest from my choices"));
    expect(draftNow().howItWorks).toContain("Binance spot BTC-USDT");
    expect((container.querySelector("#design-how") as HTMLTextAreaElement).value).toContain(
      "quotes both sides",
    );

    // Import: the Explore sample list, the paste box, the sample file.
    await click(radio(/^Import/));
    await click(button(new RegExp(CATALOG_ITEMS[0].name)));
    expect(draftNow().startingPoint).toBe("import");
    expect(draftNow().title.length).toBeGreaterThan(0);

    await click(button("Paste"));
    await typeInto(container.querySelector("textarea[aria-label='Paste a bot description']") as HTMLTextAreaElement, "Quote ETH on Bybit.");
    await click(button("Use this text"));
    expect(draftNow().howItWorks).toBe("Quote ETH on Bybit.");

    await click(button("File"));
    await click(button("Import sample"));
    expect(draftNow().howItWorks).toContain("Sample file");
  });
});

describe("Design chat", () => {
  it("starts designing: the guide collapses and the chat opens with three bullets and one question", async () => {
    await openChat();

    expect(container.querySelector("#design-guide")).toBe(null);
    expect(text()).toContain("Edit guide");
    expect(text()).toContain("Design with the assistant");

    const bullets = container.querySelectorAll('[role="log"] li');
    expect(bullets).toHaveLength(3);
    expect(bullets[0].textContent).toContain("Market Making");
    expect(text()).toContain("Before Backtest:");

    // Focus lands on the chat's heading when the chat appears.
    expect(document.activeElement?.textContent).toBe("Design with the assistant");

    // The chip bar carries the draft's values.
    expect(text()).toContain("BTC-USDT Market Making Bot");
  });

  it("answers a typed reply with canned text, without a request", async () => {
    await openChat();

    await typeInto(
      container.querySelector("input[aria-label='Reply to the assistant']") as HTMLInputElement,
      "Please add a 2% stop-loss.",
    );
    await click(byLabel("Send reply"));

    expect(text()).toContain("Please add a 2% stop-loss.");
    expect(text()).toContain("Assistant is writing…");

    await waitForText("a leg that runs past that is closed");
    expect(text()).not.toContain("Assistant is writing…");
  });

  it("grows Design notes with each accepted suggestion and answers it", async () => {
    await openChat();
    expect(text()).toContain("Nothing yet. Accept a suggestion");

    await click(button("Add a stop-loss"));
    await waitForText("Added a 2% stop-loss on each position.");
    expect(text()).toContain("Stop-loss: close a position that moves 2% against entry.");

    await click(button("Explain how it works"));
    await waitForText("Short version: it quotes both sides");
    expect(container.querySelectorAll("ol li")).toHaveLength(2);
  });

  it("finishes the design, writing designDone and moving to Backtest", async () => {
    const goTo = vi.fn();
    render(undefined, goTo);
    await flush();
    await fillGuide();
    await click(button("Start designing"));

    await click(button("I'm done designing"));

    expect(draftNow().designDone).toBe(true);
    expect(goTo).toHaveBeenCalledWith("backtest");
  });

  it("opens a returning, finished draft in its chat and treats Escape as harmless", async () => {
    render({
      botKind: "agent",
      strategyType: "Funding Rate",
      exchange: "Bybit",
      marketType: "Perps",
      pair: "ETH-USDT",
      marketQty: 2,
      maxPositions: 3,
      startingPoint: "scratch",
      howItWorks: "Collect funding, stay neutral.",
      title: "ETH Funding Agent",
      designDone: true,
    });
    await flush();

    expect(text()).toContain("Design with the assistant");
    expect(text()).toContain("Design done");

    await act(async () => {
      container.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await flush();

    expect(text()).toContain("Design with the assistant");
    expect(draftNow().designDone).toBe(true);
    expect(draftNow().title).toBe("ETH Funding Agent");

    // Back to guide reopens the form with everything still in it.
    await click(button("Back to guide"));
    expect(container.querySelector("#design-guide")).not.toBe(null);
    expect((container.querySelector("#design-title") as HTMLInputElement).value).toBe(
      "ETH Funding Agent",
    );
  });
});
