/**
 * The chat socket URL: the page's own host by default, an optional override.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";

import { chatSocketUrl } from "./chatSocketUrl";

describe("chatSocketUrl", () => {
  it("dials the page's own host over ws on http", () => {
    expect(chatSocketUrl({ protocol: "http:", host: "localhost:5173" }, undefined)).toBe(
      "ws://localhost:5173/api/v1/ws/chat",
    );
  });

  it("dials the page's own host over wss on https, port included", () => {
    expect(chatSocketUrl({ protocol: "https:", host: "condor.example.com:8443" }, undefined)).toBe(
      "wss://condor.example.com:8443/api/v1/ws/chat",
    );
  });

  it("uses VITE_CHAT_WS_HOST when it is set, with the page's protocol", () => {
    expect(chatSocketUrl({ protocol: "http:", host: "localhost:5201" }, "backend.local:8110")).toBe(
      "ws://backend.local:8110/api/v1/ws/chat",
    );
    expect(chatSocketUrl({ protocol: "https:", host: "a.example" }, "b.example")).toBe(
      "wss://b.example/api/v1/ws/chat",
    );
  });

  it("falls back to the page's host for an empty or blank override", () => {
    expect(chatSocketUrl({ protocol: "http:", host: "h:1" }, "")).toBe("ws://h:1/api/v1/ws/chat");
    expect(chatSocketUrl({ protocol: "http:", host: "h:1" }, "  ")).toBe("ws://h:1/api/v1/ws/chat");
  });

  it("reads window.location by default", () => {
    expect(chatSocketUrl()).toMatch(/^wss?:\/\/[^/]+\/api\/v1\/ws\/chat$/);
    expect(chatSocketUrl()).not.toContain("8088");
  });
});
