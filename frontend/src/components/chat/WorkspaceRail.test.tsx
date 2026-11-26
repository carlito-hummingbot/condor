/**
 * Tiles that are all waiting on a server say so once, under the group.
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
});
