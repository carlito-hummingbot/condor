import { CHAT_SLUG, type ConversationMeta } from "@/lib/api";

export type ChatListFilter = "all" | "answering" | "waiting";

/** Title, snippet, or the agent's name contains the query. A blank query matches. */
export function chatMatches(meta: ConversationMeta, query: string, agentName: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${meta.title}\n${meta.last_snippet}\n${agentName}`.toLowerCase().includes(q);
}

export function passesListFilter(
  id: string,
  filter: ChatListFilter,
  busyIds?: Set<string>,
  waitingIds?: Set<string>,
): boolean {
  if (filter === "answering") return !!busyIds?.has(id);
  if (filter === "waiting") return !!waitingIds?.has(id);
  return true;
}

/** The slug a chat is filed under when it is not archived. */
export function chatAgentSlug(meta: ConversationMeta): string {
  return meta.agent_slug || CHAT_SLUG;
}
