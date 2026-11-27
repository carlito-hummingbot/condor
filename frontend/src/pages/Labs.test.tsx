/**
 * `/labs` is a placeholder page: a heading and one line.
 *
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Labs } from "@/pages/Labs";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("Labs", () => {
  it("shows the Labs heading and a line about what is coming", () => {
    act(() => root.render(<Labs />));
    expect(container.querySelector("h1")?.textContent).toBe("Labs");
    expect(container.textContent).toContain("Design, Backtest and Test Run");
  });
});
