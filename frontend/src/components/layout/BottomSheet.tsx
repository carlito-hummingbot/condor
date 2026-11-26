import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import { useEscapeKey } from "@/hooks/useEscapeKey";

/**
 * A full-width sheet for the phone tab bar. Menus that hang off the rail are
 * side popovers; on a phone there is no hover and no side to hang from.
 */
export function BottomSheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  useEscapeKey(open, onClose);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end md:hidden">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label={label}
        className="relative max-h-[85vh] w-full overflow-y-auto rounded-t-xl border-t border-[var(--color-border)] bg-[var(--color-surface)] pb-[env(safe-area-inset-bottom)] shadow-xl"
      >
        <div className="mx-auto mt-2 h-1 w-8 rounded-full bg-[var(--color-border)]" />
        {children}
      </div>
    </div>,
    document.body,
  );
}
