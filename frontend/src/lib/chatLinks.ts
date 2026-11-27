/**
 * Query parameters that only the chat workspace reads. An address that carries
 * one is a chat link from before the Dashboard took `/` (`/?panel=loops`,
 * `/?conversation=…`, `/?agent=…`); `Home` sends it on to `/chat` with its
 * query string intact. Showcase only (preview/combined).
 */
export const CHAT_PARAMS = ["panel", "desk", "conversation", "agent", "ask", "who", "loop", "run"] as const;

export function isChatLink(search: string): boolean {
  const params = new URLSearchParams(search);
  return CHAT_PARAMS.some((p) => params.has(p));
}
