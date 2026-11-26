import { Link } from "react-router-dom";

import { useGatewayStatus } from "@/hooks/useGatewayStatus";
import { useServer } from "@/hooks/useServer";

/**
 * Gateway's health, in the top bar beside the server it belongs to.
 *
 * Every DEX surface depends on Gateway, and its state used to be visible only
 * under Settings → Gateway: with it stopped, the server dot stayed green and
 * the DEX pages failed with messages that blamed the wrong cause. Down, this
 * is a red pill that goes straight to where it is started; up, a quiet dot.
 *
 * Reads `useGatewayStatus`, the cache entry Settings and the DEX pages share,
 * so this adds no request of its own.
 */
/** A row for the avatar menu: where Gateway is, and a link to start it. */
export function GatewayStatusRow() {
  const { server } = useServer();
  const { known, running, unreachable } = useGatewayStatus(server);
  const label = !known
    ? "Gateway"
    : unreachable
      ? "Gateway: status unknown"
      : running
        ? "Gateway: running"
        : "Gateway: not running";

  return (
    <Link
      to="/settings?tab=gateway"
      className="flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-hover)]"
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          !known
            ? "bg-[var(--color-text-muted)]"
            : running
              ? "bg-[var(--color-green)]"
              : "bg-[var(--color-red)]"
        }`}
      />
      {label}
    </Link>
  );
}

export function GatewayIndicator() {
  const { server } = useServer();
  const { known, running, unreachable: isError } = useGatewayStatus(server);

  // Nothing to say until there is an answer — a server still loading is not
  // a server with Gateway down.
  if (!known) return null;

  if (running) {
    return (
      <span
        className="hidden items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] md:inline-flex"
        title="Gateway is running — DEX trading and liquidity are available"
      >
        <span className="h-2 w-2 rounded-full bg-[var(--color-green)]" />
        <span className="hidden xl:inline">Gateway</span>
      </span>
    );
  }

  return (
    <Link
      to="/settings?tab=gateway"
      title={
        isError
          ? "Could not reach Gateway's status — open Gateway settings"
          : "Gateway is stopped — DEX trading and liquidity are unavailable. Open Gateway settings to start it."
      }
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-red)]/30 bg-[var(--color-red)]/10 px-2.5 py-1 text-xs font-medium text-[var(--color-red)] transition-colors hover:bg-[var(--color-red)]/15"
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      {isError ? "Gateway status?" : "Gateway off"}
    </Link>
  );
}
