import { LogOut, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";

import { AnchoredMenu } from "@/components/ui/AnchoredMenu";
import { useDisplayName } from "@/hooks/useDisplayName";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/lib/auth";
import { CurrencyChoices } from "./CurrencySelector";
import { GatewayStatusRow } from "./GatewayIndicator";
import { ServerList } from "./ServerSelector";

/**
 * What the avatar opens: the controls that used to sit in the top bar, plus
 * logout and a way back into setup.
 *
 * "Run setup again" goes to `/welcome`, the route the onboarding wizard
 * (PR #2) uses. Until that PR lands the address falls through to the shell's
 * not-found page.
 */
export function AccountMenu({
  anchor,
  open,
  onClose,
}: {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
}) {
  const name = useDisplayName();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const role = user?.role === "admin" ? "Admin" : user?.role === "user" ? "User" : user?.role;

  return (
    <AnchoredMenu
      anchor={anchor}
      open={open}
      onClose={onClose}
      align="left"
      role="menu"
      className="min-w-[240px] py-1"
    >
      <div className="px-3 py-2">
        <div className="truncate text-sm font-medium text-[var(--color-text)]">{name}</div>
        {role && (
          <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
            {role}
          </div>
        )}
      </div>
      <div className="mx-3 border-t border-[var(--color-border)]" />
      <ServerList onPicked={onClose} />
      <GatewayStatusRow />
      <div className="mx-3 my-1 border-t border-[var(--color-border)]" />
      <CurrencyChoices onPicked={onClose} />
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <span className="text-sm text-[var(--color-text)]">Theme</span>
        <div role="group" aria-label="Theme" className="flex rounded-md border border-[var(--color-border)] p-0.5">
          {(["light", "dark"] as const).map((choice) => (
            <button
              key={choice}
              type="button"
              aria-pressed={theme === choice}
              onClick={() => setTheme(choice)}
              className={`rounded px-2 py-0.5 text-xs font-medium capitalize transition-colors ${
                theme === choice
                  ? "bg-[var(--color-nav-active)] text-[var(--on-nav-active)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {choice}
            </button>
          ))}
        </div>
      </div>
      <div className="mx-3 my-1 border-t border-[var(--color-border)]" />
      <Link
        to="/welcome"
        role="menuitem"
        onClick={onClose}
        className="flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-hover)]"
      >
        <RotateCcw className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
        Run setup again
      </Link>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          logout();
        }}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-red)]"
      >
        <LogOut className="h-4 w-4 shrink-0" />
        Logout
      </button>
    </AnchoredMenu>
  );
}
