/**
 * The opener list sends on click and is reachable by keyboard.
 *
 * @vitest-environment jsdom
 */

import { Wallet } from "lucide-react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Starters, type Starter } from "./Starters";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const starters: Starter[] = [
  { icon: Wallet, title: "How is my portfolio doing?", hint: "Balances and PNL" },
  { icon: Wallet, title: "Short title", hint: "Hint", prompt: "A longer prompt" },
];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("Starters", () => {
  it("renders nothing without openers", async () => {
    await act(async () => root.render(<Starters starters={[]} onAsk={vi.fn()} />));
    expect(container.innerHTML).toBe("");
  });

  it("sends the title, or the prompt when there is one, on click", async () => {
    const onAsk = vi.fn();
    await act(async () => root.render(<Starters starters={starters} onAsk={onAsk} />));
    const buttons = container.querySelectorAll("button");
    await act(async () => buttons[0].click());
    await act(async () => buttons[1].click());
    expect(onAsk).toHaveBeenNthCalledWith(1, "How is my portfolio doing?");
    expect(onAsk).toHaveBeenNthCalledWith(2, "A longer prompt");
  });

  it("keeps each row a plain button whose name is the title and hint, not the arrow", async () => {
    await act(async () => root.render(<Starters starters={starters} onAsk={vi.fn()} />));
    const first = container.querySelector("button")!;
    expect(first.getAttribute("type")).toBe("button");
    expect(first.textContent).toBe("How is my portfolio doing?Balances and PNL");
    expect(first.querySelector("svg[aria-hidden='true']")).not.toBeNull();
  });

  it("uses the given label", async () => {
    await act(async () =>
      root.render(<Starters starters={starters} onAsk={vi.fn()} label="Try asking" />),
    );
    expect(container.textContent).toContain("Try asking");
  });
});
