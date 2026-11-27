// jsdom doesn't implement every DOM API browsers do. An unguarded call to one
// of them (`scrollIntoView` is the one that has bitten us — CORR-1062, and
// before that the ChatThread fix) throws unhandled inside a React effect and
// exits the whole `vitest run` with 1 while every test still reports green.
// Stubbing the gap here, once, means a new call site doesn't need its own
// hand-rolled guard or per-file `Element.prototype.scrollIntoView = () => {}`
// to avoid reintroducing that flake.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

// Same gap, a different API: `useTheme` reads `window.matchMedia` at module
// top level (`let currentTheme = getStoredTheme()`), so any test file whose
// module graph reaches it — anything importing `CodeEditor`, directly or
// through `StrategyConfigEditor`/the import review step (FEAT-202) — throws
// before a single test runs, with no stack trace pointing at the test's own
// code. Stubbed once here rather than per file, same reasoning as above.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = ((media: string) => ({
    matches: false,
    media,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// No test may reach a real Condor or Hummingbot API. In development builds
// (`import.meta.env.DEV`, which Vitest also sets) the chat socket dials
// `ws://localhost:8088` directly, and a dev machine usually has the real
// Condor listening there; `localhost:8000` is the Hummingbot API. A test that
// mounts something which opens a socket or fetches an absolute URL on one of
// those ports without stubbing it would talk to the developer's live
// instance. Guard both calls here, once: the call throws, so the test that
// made it fails loudly instead of quietly succeeding against a real server.
// Tests that stub `WebSocket` or `fetch` themselves replace these wrappers and
// are not affected.
const REAL_SERVER = /^(?:wss?|https?):\/\/(?:localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0):(?:8088|8000)(?:[/?#]|$)/i;

function assertNotRealServer(target: unknown, how: string): void {
  const url =
    typeof target === "string"
      ? target
      : target instanceof URL
        ? target.href
        : typeof (target as { url?: unknown } | null)?.url === "string"
          ? (target as { url: string }).url
          : "";
  if (REAL_SERVER.test(url)) {
    throw new Error(
      `A test tried to reach a real server with ${how}: ${url}. ` +
        "Stub WebSocket or fetch in the test (ports 8088 and 8000 belong to a live Condor).",
    );
  }
}

if (typeof globalThis.WebSocket === "function") {
  const RealWebSocket = globalThis.WebSocket;
  const GuardedWebSocket = function (
    this: unknown,
    url: string | URL,
    protocols?: string | string[],
  ) {
    assertNotRealServer(url, "new WebSocket()");
    return Reflect.construct(RealWebSocket, [url, protocols], new.target ?? GuardedWebSocket);
  } as unknown as typeof WebSocket;
  GuardedWebSocket.prototype = RealWebSocket.prototype;
  for (const key of ["CONNECTING", "OPEN", "CLOSING", "CLOSED"] as const) {
    Object.defineProperty(GuardedWebSocket, key, { value: RealWebSocket[key] });
  }
  globalThis.WebSocket = GuardedWebSocket;
}

if (typeof globalThis.fetch === "function") {
  const realFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    assertNotRealServer(input, "fetch()");
    return realFetch(input, init);
  }) as typeof fetch;
}
