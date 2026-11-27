/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // Where the dev server proxies `/api` (HTTP and WebSocket). Dev-time only; the
  // production build never reads it. Default is the Condor on this machine.
  // `VITE_API_TARGET=http://127.0.0.1:8110 npm run dev` points a dev server at a
  // backend on another port (a preview, a stub API). The dev server itself is
  // moved with Vite's own flags: `npm run dev -- --host 127.0.0.1 --port 5201`;
  // nothing listens beyond localhost unless `--host` is given.
  const apiTarget = loadEnv(mode, __dirname, "VITE_").VITE_API_TARGET || "http://localhost:8088";

  return {
    plugins: [react(), tailwindcss()],
    build: {
      chunkSizeWarningLimit: 600,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    test: {
      // Pure helpers are the common case — no DOM, no React — so `node` stays the
      // default and keeps the run fast. A component test that needs a DOM opts in
      // per file with a `@vitest-environment jsdom` docblock (see
      // components/ui/AnchoredMenu.test.tsx).
      environment: "node",
      include: ["src/**/*.test.{ts,tsx}"],
      setupFiles: ["./src/test/setup.ts"],
      // `lightweight-charts` is resolved dynamically by every chart component, so
      // two mounts in one `act()` request it concurrently and Vitest's mocker
      // answers a per-file `vi.mock` to one of them and raw-imports the real
      // library for the other — a real chart widget in a canvas-less jsdom, whose
      // draw frame fires after teardown and exits the run 1 while every test
      // reports green (CORR-360, CORR-368). Substituting at the resolver instead
      // of per file catches every resolution, including the losing one, so no
      // test can reach the real library even by forgetting to mock it.
      alias: {
        "lightweight-charts": path.resolve(__dirname, "./src/test/lightweight-charts-double.ts"),
      },
    },
    server: {
      proxy: {
        // `ws: true` so the chat socket (`/api/v1/ws/chat`) and the channel socket
        // (`/api/v1/ws`) upgrade through the proxy; a bare string target only
        // forwards plain HTTP, which is why the chat used to dial :8088 directly.
        "/api": { target: apiTarget, ws: true },
        "/ws": {
          target: apiTarget.replace(/^http/, "ws"),
          ws: true,
        },
      },
    },
  };
});
