import { LogOut, RotateCcw, UserRound } from "lucide-react";

import { AnchoredMenu } from "@/components/ui/AnchoredMenu";
import { useDisplayName } from "@/hooks/useDisplayName";
import { useAuth } from "@/lib/auth";

/**
 * What the avatar opens: who is signed in, an Account link (name and Dashboard
 * title, in `AccountDialog`), Run setup again (the onboarding wizard, at
 * `RUN_SETUP_PATH`) and Logout. User functions only; server, currency and
 * theme live elsewhere.
 *
 * Run setup again is here for the walkthrough as much as for a real re-run: it
 * closes the popup and goes to the wizard's own route, so the wizard starts at
 * its first step rather than trusting whatever the account holds.
 */
export function AccountMenu({
  anchor,
  open,
  onClose,
  onAccount,
  onRunSetup,
}: {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  /** Opens the Account dialog. The menu closes first. */
  onAccount: () => void;
  /** Goes to the setup wizard. The menu closes first. */
  onRunSetup: () => void;
}) {
  const name = useDisplayName();
  const { user, logout } = useAuth();
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
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          onAccount();
        }}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-hover)]"
      >
        <UserRound className="h-4 w-4 shrink-0" />
        Account
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          onRunSetup();
        }}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-hover)]"
      >
        <RotateCcw className="h-4 w-4 shrink-0" />
        Run setup again
      </button>
      <div className="mx-3 my-1 border-t border-[var(--color-border)]" />
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
