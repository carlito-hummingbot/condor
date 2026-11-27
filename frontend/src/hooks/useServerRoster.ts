import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { fallbackServer, useServer } from "@/hooks/useServer";
import { api } from "@/lib/api";

/**
 * The roster and the auto-select rule, shared by the dropdown and the avatar
 * menu. The effect has to run while the shell is mounted, not only while the
 * menu is open — a deleted server used to stay selected forever (FU-09).
 */
export function useServerRoster() {
  const { server, setServer } = useServer();

  const { data: servers, dataUpdatedAt, isError } = useQuery({
    queryKey: ["servers"],
    queryFn: api.getServers,
    refetchInterval: 10000,
  });

  const onlineServers = servers?.filter((s) => s.online) ?? [];
  const offlineServers = servers?.filter((s) => !s.online) ?? [];
  const totalCount = servers?.length ?? 0;

  // Where to land when nothing usable is selected. The backend's default is
  // the same `chat_defaults` entry Telegram sets, so setting a default in
  // either surface is honoured by the other.
  const fallback = servers ? fallbackServer(servers) : null;
  const known = !!servers;
  const exists = servers?.some((s) => s.name === server) ?? false;

  // When the current selection was made. A name is only called missing by a
  // list fetched *after* it was selected: a server picked a moment after it was
  // added can be newer than the cached list, and must not be thrown out by it.
  const selectedAt = useRef(0);
  useEffect(() => {
    selectedAt.current = Date.now();
  }, [server]);

  // Auto-select when no server is saved yet — and when the saved one is gone.
  // A persisted name that was deleted, renamed or unshared used to stay
  // selected for good: the header said "No server" while every page kept
  // querying the dead name (FU-09). A server that is merely offline still
  // exists and stays selected; that is for the user to see, not to undo.
  useEffect(() => {
    if (!known || exists) return;
    if (server && dataUpdatedAt < selectedAt.current) return;
    if (fallback !== server) setServer(fallback);
  }, [known, exists, server, fallback, dataUpdatedAt, setServer]);

  const current = servers?.find((s) => s.name === server);

  return {
    server,
    setServer,
    servers,
    current,
    isError,
    onlineServers,
    offlineServers,
    totalCount,
  };
}
