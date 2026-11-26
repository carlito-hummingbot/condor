/**
 * Search and the answering/waiting filter narrow the chats already loaded.
 *
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, type AgentSummary, type ConversationMeta } from "@/lib/api";
import { chatMatches } from "./conversationFilter";
import { ConversationList, type AgentGroupHeader } from "./ConversationList";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const AGENTS = [
  { slug: "condor", name: "Condor" },
  { slug: "grid", name: "Grid Trader" },
] as AgentSummary[];

function conv(id: string, over: Partial<ConversationMeta> = {}): ConversationMeta {
  return {
    id,
    user_id: 1,
    surface: "web",
    title: id,
    agent_key: "",
    agent_slug: "grid",
    server_name: null,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    turn_count: 1,
    last_snippet: "",
    ...over,
  } as ConversationMeta;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  vi.spyOn(api, "listConversations").mockImplementation(async () => [
    conv("book", { title: "How is the book", last_snippet: "flat overnight" }),
    conv("funding", { title: "Funding", agent_slug: "condor" }),
  ]);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

async function render(props: { search?: string; listFilter?: "all" | "answering" | "waiting"; busyIds?: Set<string> }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <ConversationList
          agents={AGENTS}
          activeId={null}
          onOpen={() => {}}
          {...props}
          renderAgent={(h: AgentGroupHeader) => <div data-group={h.name}>{h.name}</div>}
        />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

const names = () =>
  [...container.querySelectorAll("[data-group]")].map((el) => el.getAttribute("data-group"));

describe("chatMatches", () => {
  it("matches a title, a snippet, or the agent name", () => {
    const meta = conv("book", { title: "How is the book", last_snippet: "flat overnight" });
    expect(chatMatches(meta, "book", "Grid Trader")).toBe(true);
    expect(chatMatches(meta, "OVERNIGHT", "Grid Trader")).toBe(true);
    expect(chatMatches(meta, "grid", "Grid Trader")).toBe(true);
    expect(chatMatches(meta, "dex", "Grid Trader")).toBe(false);
    expect(chatMatches(meta, "  ", "Grid Trader")).toBe(true);
  });
});

describe("the list filter", () => {
  it("keeps only the chats whose title matches", async () => {
    await render({ search: "funding" });
    expect(names()).toEqual(["Condor"]);
    expect(container.textContent).toContain("Funding");
    expect(container.textContent).not.toContain("How is the book");
  });

  it("keeps only chats that are answering", async () => {
    await render({ listFilter: "answering", busyIds: new Set(["book"]) });
    expect(names()).toEqual(["Grid Trader"]);
    expect(container.textContent).toContain("How is the book");
    expect(container.textContent).not.toContain("Funding");
  });
});
