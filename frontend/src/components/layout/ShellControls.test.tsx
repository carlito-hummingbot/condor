/**
 * The strip above the page holds three controls and nothing else: the server,
 * Gateway status and the light/dark switch.
 *
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./ServerSelector", () => ({ ServerSelector: () => <span data-testid="server" /> }));
vi.mock("./GatewayIndicator", () => ({ GatewayIndicator: () => <span data-testid="gateway" /> }));

const { ShellControls } = await import("./ShellControls");

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

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

describe("ShellControls", () => {
  it("shows the server, Gateway status and Switch Mode, in that order, and no bell", () => {
    act(() => root.render(<ShellControls />));
    const strip = container.firstElementChild!;
    const kids = [...strip.children].map(
      (el) => el.getAttribute("data-testid") || el.getAttribute("aria-label"),
    );
    expect(kids).toHaveLength(3);
    expect(kids.slice(0, 2)).toEqual(["server", "gateway"]);
    expect(kids[2]).toMatch(/^Switch Mode/);
    expect(strip.querySelector('[aria-label*="otification"]')).toBeNull();
  });
});
