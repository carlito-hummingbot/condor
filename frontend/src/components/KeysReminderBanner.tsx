import { KeyRound } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/Button";

/**
 * The non-blocking replacement for the full-page keys overlay.
 *
 * It sits above the page, like the relaunch and telemetry strips, so portfolio
 * and trade stay usable. It leaves once this server has a key or a wallet.
 */
export function KeysReminderBanner() {
  const navigate = useNavigate();

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--color-border)] bg-[var(--color-primary-fill)]/10 px-4 py-2">
      <KeyRound className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
      <p className="min-w-0 flex-1 text-xs leading-relaxed text-[var(--color-text)]">
        <strong className="font-semibold">Connect an exchange or wallet.</strong>{" "}
        <span className="text-[var(--color-text-muted)]">
          Portfolio, trading, and bots unlock once this server has a key or a DEX wallet. Routines
          work either way.
        </span>
      </p>
      <Button size="sm" variant="primary" onClick={() => navigate("/settings?tab=keys")}>
        Connect keys
      </Button>
    </div>
  );
}
