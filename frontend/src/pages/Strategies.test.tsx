/**
 * `/strategies` lists every live strategy and opens one in the agent workspace.
 *
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getFleetMap } = vi.hoisted(() => ({
  getFleetMap: vi.fn(async () => ({
    owners: [
        {
          runKey: "trader.grid",
          agentSlug: "trader",
          agentName: "Trader",
          strategySlug: "grid",
          strategyName: "Grid",
          namespace: "trader-grid",
          declaredBots: [],
          agentIds: [],
          live: {
            agentId: "a1",
            sessionNum: 2,
            status: "running",
            tickCount: 4,
            lastTickAt: 0,
            frequencySec: 60,
            lastReadingAt: 0,
            lastSuccessfulActionAt: 0,
            lastTickDuration: 0,
            lastAction: "watching the book",
            lastDid: null,
            lastError: "",
          },
        },
    ],
  })),
}));

vi.mock("@/lib/api", () => ({
  api: {
    getAgents: async () => [],
    getFleetMap,
  },
}));

const { Strategies } = await import("./Strategies");

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

function Landed() {
  const { pathname, search } = useLocation();
  return <div data-testid="landed">{pathname + search}</div>;
}

let container: HTMLDivElement;
let root: Root;

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  });
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

describe("Strategies", () => {
  it("lists a live strategy and opens it in the agent workspace", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    act(() => {
      root.render(
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={["/strategies"]}>
            <Routes>
              <Route path="/strategies" element={<Strategies />} />
              <Route path="/agents/:slug" element={<Landed />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });
    await flush();

    expect(container.textContent).toContain("Strategies");
    expect(container.textContent).toContain("Trader");
    expect(container.textContent).toContain("Grid");

    const card = container.querySelector('[data-loop-row="trader/grid"]') as HTMLButtonElement;
    expect(card).not.toBeNull();
    await act(async () => {
      card.click();
    });
    await flush();

    expect(container.querySelector("[data-testid=landed]")?.textContent).toBe(
      "/agents/trader?strategy=grid",
    );
  });

  it("says so when nothing is running", async () => {
    getFleetMap.mockResolvedValueOnce({ owners: [] } as never);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    act(() => {
      root.render(
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <Strategies />
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });
    await flush();
    expect(container.textContent).toContain("No strategies running");
    expect(container.querySelector("h1")?.textContent).toBe("Strategies");
    const links = [...container.querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href")]);
    expect(links).toEqual([
      ["Ask an agent", "/"],
      ["Browse the Hub", "/hub"],
    ]);
  });
});
