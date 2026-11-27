/**
 * The local-mode probe survives StrictMode's double mount.
 *
 * In development StrictMode mounts, cleans up and mounts every effect again.
 * The probe effect latched on a ref and cancelled its fetch in the cleanup, so
 * the second run was skipped and the first answer was thrown away: the page sat
 * on "Signing in..." forever. A production build mounts once and never hit it.
 *
 * Needs a DOM, so this file overrides vitest's default `node` environment.
 *
 * @vitest-environment jsdom
 */

import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loginLocal = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    isAuthenticated: false,
    loginWithToken: vi.fn(),
    loginLocal,
  }),
}));

const { Login } = await import("./Login");

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
const fetchMock = vi.fn();

function answerMode(body: unknown) {
  fetchMock.mockImplementation(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(body) }),
  );
}

async function render(strict: boolean) {
  const tree = (
    <MemoryRouter initialEntries={["/login"]}>
      {/* Routed like the app: a successful sign-in leaves /login, which unmounts it. */}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<p>dashboard</p>} />
      </Routes>
    </MemoryRouter>
  );
  await act(async () => {
    root.render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  });
  await act(async () => {});
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  loginLocal.mockReset().mockResolvedValue(undefined);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("Login probe", () => {
  it.each([false, true])("signs in locally once (StrictMode: %s)", async (strict) => {
    answerMode({ mode: "local" });
    await render(strict);
    expect(loginLocal).toHaveBeenCalledTimes(1);
  });

  it("leaves 'Signing in...' for the Telegram card under StrictMode", async () => {
    answerMode({ mode: "telegram" });
    await render(true);
    expect(container.textContent).not.toContain("Signing in...");
    expect(container.textContent).toContain("/web");
    expect(loginLocal).not.toHaveBeenCalled();
  });

  it("shows the unreachable card under StrictMode when nothing answers", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error("offline")));
    await render(true);
    expect(container.textContent).not.toContain("Signing in...");
    expect(container.textContent).toContain("could not reach Condor");
  });

  it("Retry on the unreachable card asks again", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error("offline")));
    await render(true);
    answerMode({ mode: "local" });
    const retry = [...container.querySelectorAll("button")].find((b) => b.textContent === "Retry")!;
    await act(async () => retry.click());
    await act(async () => {});
    expect(loginLocal).toHaveBeenCalledTimes(1);
  });
});
