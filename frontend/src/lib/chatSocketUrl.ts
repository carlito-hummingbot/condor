/**
 * Where the chat socket dials.
 *
 * The page's own host, so it works wherever the page is served from: behind
 * the production server, and in development through the Vite proxy, which
 * forwards `/api` (WebSocket upgrades included) to the backend. It used to dial
 * `localhost:8088` in development builds, which on a preview served to another
 * machine (a tunnel, a shared dev box) reaches the *viewer's* localhost, not the
 * server the page came from.
 *
 * `VITE_CHAT_WS_HOST` (`host:port`) overrides the host for a setup where the
 * socket has to go somewhere else than the page; unset by default, so
 * production dials `window.location.host` exactly as before.
 */
export function chatSocketUrl(
  location: Pick<Location, "protocol" | "host"> = window.location,
  hostOverride: string | undefined = import.meta.env.VITE_CHAT_WS_HOST,
): string {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const host = hostOverride?.trim() || location.host;
  return `${protocol}//${host}/api/v1/ws/chat`;
}
