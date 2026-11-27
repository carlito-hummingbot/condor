import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/hooks/useTheme";
import { GatewayIndicator } from "./GatewayIndicator";
import { ServerSelector } from "./ServerSelector";

/**
 * The slim strip above the page, with three controls on the right: the
 * server (Local, when that is the one in use), Gateway status and Switch Mode
 * (light or dark).
 *
 * Display currency and the bell left it. They are not in the rail either; the
 * avatar menu (`ui/account-menu`) decides what, if anything, takes them.
 */
export function ShellControls() {
  const { theme, toggleTheme } = useTheme();
  const target = theme === "dark" ? "light" : "dark";

  return (
    <div className="flex h-10 shrink-0 items-center justify-end gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3">
      <ServerSelector />
      <GatewayIndicator />
      <button
        type="button"
        onClick={toggleTheme}
        className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-accent)]"
        title={`Switch Mode: ${target} mode`}
        aria-label={`Switch Mode: ${target} mode`}
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    </div>
  );
}
