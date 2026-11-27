/**
 * The test setup refuses a socket or request to a real Condor / Hummingbot API.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";

describe("test setup: no real ports", () => {
  it("refuses a WebSocket to localhost:8088 and :8000", () => {
    expect(() => new WebSocket("ws://localhost:8088/api/v1/ws/chat")).toThrow(/real server/);
    expect(() => new WebSocket("ws://127.0.0.1:8000/x")).toThrow(/real server/);
    expect(() => new WebSocket("wss://localhost:8088/x", ["p"])).toThrow(/real server/);
  });

  it("refuses fetch to localhost:8088 and :8000, as a string, URL or Request", () => {
    expect(() => fetch("http://localhost:8088/api/v1/auth/mode")).toThrow(/real server/);
    expect(() => fetch(new URL("http://127.0.0.1:8000/health"))).toThrow(/real server/);
    expect(() => fetch(new Request("http://localhost:8088/api"))).toThrow(/real server/);
  });

  it("does not touch other ports, hosts or relative URLs", async () => {
    // Port 9 (discard) refuses at once; the point is that the guard let it through.
    await expect(fetch("http://127.0.0.1:9/")).rejects.toBeDefined();
    const ws = new WebSocket("ws://127.0.0.1:9/");
    expect(ws).toBeInstanceOf(WebSocket);
    ws.close();
    await expect(fetch("/api/v1/x")).rejects.toBeDefined();
  });
});
