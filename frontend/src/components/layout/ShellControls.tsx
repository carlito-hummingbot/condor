import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/hooks/useTheme";
import { CurrencySelector } from "./CurrencySelector";
import { GatewayIndicator } from "./GatewayIndicator";
import { NotificationBell } from "./NotificationBell";
import { ServerSelector } from "./ServerSelector";

/**
 * The old top-bar controls, parked in a slim strip until the avatar menu
 * takes them (`ui/account-menu`). The rail is too narrow for a server name.
 */
export function ShellControls() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex h-10 shrink-0 items-center justify-end gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3">
      <ServerSelector />
      <GatewayIndicator />
      <CurrencySelector />
      <NotificationBell />
      <button
        type="button"
        onClick={toggleTheme}
        className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-accent)]"
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    </div>
  );
}
