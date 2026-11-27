/**
 * Tiles that are all waiting on a server say so once, under the group, and
 * on a phone the rail is a drawer that stays hidden until it is asked for.
 *
 * @vitest-environment jsdom
 */

import { Wallet } from "lucide-react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { WorkspaceRail, type RailGroup } from "./WorkspaceRail";

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

function item(id: string, disabled: boolean) {
  return {
    id,
    label: id,
    Icon: Wallet,
    hint: `${id} hint`,
    disabledHint: "Select a server first",
    active: false,
    disabled,
    onToggle: () => {},
  };
}

function render(groups: RailGroup[]) {
  act(() => root.render(<WorkspaceRail groups={groups} />));
}

describe("WorkspaceRail", () => {
  it("names the reason once when every tile in a group is disabled", () => {
    render([{ id: "desk", items: [item("Portfolio", true), item("Bots", true)] }]);
    const note = [...container.querySelectorAll("span")].filter((s) => s.textContent === "Pick a server");
    expect(note).toHaveLength(1);
    expect(note[0].getAttribute("title")).toBe("Select a server first");
  });

  it("adds no note when a tile can be opened", () => {
    render([{ id: "desk", items: [item("Portfolio", false), item("Bots", true)] }]);
    expect(container.textContent).not.toContain("Pick a server");
  });

  it("is hidden below md until opened, and always a strip from md up", () => {
    render([{ id: "desk", items: [item("Portfolio", false)] }]);
    const closed = container.querySelector('[data-testid="workspace-rail"]')!;
    expect(closed.className).toContain("max-md:hidden");
    expect(closed.className).toContain("md:flex");
    expect(closed.getAttribute("data-mobile-open")).toBe("false");

    act(() =>
      root.render(
        <WorkspaceRail groups={[{ id: "desk", items: [item("Portfolio", false)] }]} mobileOpen />,
      ),
    );
    const open = container.querySelector('[data-testid="workspace-rail"]')!;
    expect(open.className).toContain("max-md:absolute");
    expect(open.className).not.toContain("max-md:hidden");
    expect(open.getAttribute("data-mobile-open")).toBe("true");
  });

  it("closes the drawer after a tile is picked", () => {
    const picked: string[] = [];
    let closed = 0;
    const tile = { ...item("Portfolio", false), onToggle: () => picked.push("Portfolio") };
    act(() =>
      root.render(
        <WorkspaceRail
          groups={[{ id: "desk", items: [tile] }]}
          mobileOpen
          onMobileClose={() => closed++}
        />,
      ),
    );
    act(() => {
      (container.querySelector('button[aria-label="Portfolio"]') as HTMLButtonElement).click();
    });
    expect(picked).toEqual(["Portfolio"]);
    expect(closed).toBe(1);
  });

  it("has its own way out on a phone, because the drawer covers the bar's toggle", () => {
    let closed = 0;
    act(() =>
      root.render(
        <WorkspaceRail
          groups={[{ id: "desk", items: [item("Portfolio", false)] }]}
          mobileOpen
          onMobileClose={() => closed++}
        />,
      ),
    );
    const hide = container.querySelector('button[aria-label="Hide panels"]') as HTMLButtonElement;
    expect(hide.className).toContain("md:hidden");
    act(() => hide.click());
    expect(closed).toBe(1);
  });
});
