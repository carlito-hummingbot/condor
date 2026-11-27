import { ChevronDown, Circle, Server, Star } from "lucide-react";
import { useCallback, useState } from "react";

import { AnchoredMenu } from "@/components/ui/AnchoredMenu";
import { useServerRoster } from "@/hooks/useServerRoster";
import type { ServerInfo } from "@/lib/api";

export function ServerList({ onPicked }: { onPicked?: () => void }) {
  const { server, setServer, servers, isError, onlineServers, offlineServers, totalCount } =
    useServerRoster();

  return (
    <div role="group" aria-label="API servers">
      <div className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
        {servers ? `API Servers (${onlineServers.length}/${totalCount} online)` : "API Servers"}
      </div>
      {!servers && (
        <div className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
          {isError ? "Could not load servers" : "Loading…"}
        </div>
      )}
      {onlineServers.map((s: ServerInfo) => (
        <button
          key={s.name}
          type="button"
          onClick={() => {
            setServer(s.name);
            onPicked?.();
          }}
          className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-[var(--color-surface-hover)] ${
            s.name === server ? "bg-[var(--color-primary-fill)]/10 text-[var(--color-primary)]" : ""
          }`}
        >
          <Circle className="h-2 w-2 shrink-0 fill-current text-[var(--color-green)]" />
          <span className="truncate">{s.name}</span>
          {s.is_default && (
            <Star
              className="h-2.5 w-2.5 shrink-0 fill-current text-amber-400"
              aria-label="Default server"
            />
          )}
          {s.name === server && (
            <span className="ml-auto text-[10px] font-medium uppercase text-[var(--color-primary)]">
              Active
            </span>
          )}
        </button>
      ))}
      {offlineServers.length > 0 && onlineServers.length > 0 && (
        <div className="mx-3 my-1 border-t border-[var(--color-border)]" />
      )}
      {offlineServers.length > 0 && (
        <div className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
          Offline
        </div>
      )}
      {offlineServers.map((s: ServerInfo) => (
        <div
          key={s.name}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-muted)] opacity-50 cursor-not-allowed"
        >
          <Circle className="h-2 w-2 shrink-0 fill-current text-[var(--color-text-muted)]" />
          <span className="truncate">{s.name}</span>
        </div>
      ))}
    </div>
  );
}

export function ServerSelector() {
  const { current } = useServerRoster();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        ref={setAnchor}
        onClick={() => setOpen(!open)}
        title={current && !current.online ? `${current.name} is offline` : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-sm hover:bg-[var(--color-surface-hover)] transition-colors"
      >
        <Server className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
        <span className="truncate max-w-[120px]">{current?.name || "No server"}</span>
        {current && (
          <Circle
            className={`h-1.5 w-1.5 shrink-0 fill-current ${
              current.online ? "text-[var(--color-green)]" : "text-[var(--color-red)]"
            }`}
            aria-label={current.online ? "Online" : "Offline"}
          />
        )}
        <ChevronDown className={`h-3 w-3 shrink-0 text-[var(--color-text-muted)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnchoredMenu
        anchor={anchor}
        open={open}
        onClose={close}
        align="right"
        className="min-w-[220px] py-1"
      >
        <ServerList onPicked={close} />
      </AnchoredMenu>
    </>
  );
}
