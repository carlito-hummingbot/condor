/**
 * The chat list's search box and its three filter chips.
 *
 * The chips replaced a dropdown that opened over New chat. This pins that the
 * filter is plain buttons in the panel and that the picked one is marked.
 *
 * Needs a DOM, so this file overrides vitest's default `node` environment.
 *
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type AgentSummary } from "@/lib/api";
import { ChatRail } from "./ChatRail";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const AGENTS: AgentSummary[] = [
  { slug: "condor", name: "Condor", description: "General" } as AgentSummary,
  { slug: "brigado", name: "Brigado", description: "MM" } as AgentSummary,
];

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

async function render() {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <QueryClientProvider
          client={
            new QueryClient({ defaultOptions: { queries: { retry: false } } })
          }
        >
          <ChatRail
            agents={AGENTS}
            runningTasks={0}
            activeSlug=""
            hasSession={false}
            hubActive={false}
            liveIds={new Set()}
            activeId=""
            open
            onClose={() => {}}
            onTalk={() => {}}
            onNew={() => {}}
            onOpenConversation={() => {}}
          />
        </QueryClientProvider>
      </MemoryRouter>,
    );
  });
}

describe("the chat list search and filter", () => {
  it("shows All, Answering and Waiting as buttons, with All pressed", async () => {
    await render();
    const group = container.querySelector('[role="group"][aria-label="Filter chats"]');
    expect(group).not.toBeNull();
    const chips = [...group!.querySelectorAll("button")];
    expect(chips.map((c) => c.textContent)).toEqual(["All", "Answering", "Waiting"]);
    expect(chips.map((c) => c.getAttribute("aria-pressed"))).toEqual(["true", "false", "false"]);
  });

  it("marks the chip that was picked and opens no popover", async () => {
    await render();
    const waiting = [...container.querySelectorAll('[aria-label="Filter chats"] button')].find(
      (c) => c.textContent === "Waiting",
    ) as HTMLButtonElement;
    await act(async () => {
      waiting.click();
    });
    expect(waiting.getAttribute("aria-pressed")).toBe("true");
    expect(document.body.querySelector('[role="menu"]')).toBeNull();
  });

  it("has a search box above New chat", async () => {
    await render();
    const input = container.querySelector('input[aria-label="Search chats"]');
    expect(input).not.toBeNull();
    const newChat = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("New chat"),
    );
    expect(input!.compareDocumentPosition(newChat!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
