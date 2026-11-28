import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { displayNameFrom, usePatchPreferences, usePreferences } from "@/hooks/useDisplayName";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useAuth } from "@/lib/auth";
import {
  DASHBOARD_TITLE_MAX,
  DISPLAY_NAME_MAX,
  clampDashboardTitle,
  validateDisplayName,
} from "@/lib/preferences";

/** How long "Saved." stays on screen before the dialog closes. */
const SAVED_MS = 600;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * "Your account": edit the name and the Dashboard title.
 *
 * The same two fields, labels, limits and saved data as the onboarding "Make it
 * yours" step (`profile.display_name`, `ui.dashboard_title`), written through
 * the same PATCH, so the wizard and this dialog edit one record. A standalone
 * modal: the rail opens it today and the phone Account sheet reuses it, so it
 * knows nothing about either.
 *
 * Escape and Cancel close without saving. Focus moves into the dialog, stays
 * inside it, and goes back to `returnFocusTo` (the avatar) on close, or to
 * whatever was focused before when no element is given.
 */
export function AccountDialog({
  open,
  onOpenChange,
  returnFocusTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes on close. Needed when the opener unmounts first, as the menu row does. */
  returnFocusTo?: HTMLElement | null;
}) {
  useEscapeKey(open, () => onOpenChange(false));
  if (!open) return null;
  return <AccountDialogBody onClose={() => onOpenChange(false)} returnFocusTo={returnFocusTo} />;
}

function AccountDialogBody({
  onClose,
  returnFocusTo,
}: {
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const { user } = useAuth();
  const { data: prefs } = usePreferences();
  const patch = usePatchPreferences();
  const currentName = displayNameFrom(prefs, user);
  const currentTitle = clampDashboardTitle(prefs?.ui?.dashboard_title ?? "");

  const [name, setName] = useState(currentName);
  const [title, setTitle] = useState(currentTitle);
  const [saved, setSaved] = useState(false);
  const rootId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const opener = useRef<Element | null>(null);
  // Latest values for the effects below, which must not re-run when they change.
  const returnRef = useRef(returnFocusTo);
  const closeRef = useRef(onClose);
  useEffect(() => {
    returnRef.current = returnFocusTo;
    closeRef.current = onClose;
  });

  // Take focus on open, give it back on close.
  useEffect(() => {
    opener.current = document.activeElement;
    nameRef.current?.focus();
    return () => {
      const wanted = returnRef.current;
      const target = wanted && wanted.isConnected ? wanted : (opener.current as HTMLElement | null);
      if (target && target.isConnected) target.focus();
    };
  }, []);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => closeRef.current(), SAVED_MS);
    return () => clearTimeout(timer);
  }, [saved]);

  const nameError = validateDisplayName(name);
  const changed = name.trim() !== currentName || clampDashboardTitle(title) !== currentTitle;
  const canSave = changed && !nameError && !patch.isPending && !saved;
  // Only complain about the name once it has been touched.
  const shownNameError = name !== currentName ? nameError : null;

  const save = () => {
    if (!canSave) return;
    patch.mutate(
      {
        patch: {
          profile: { display_name: name.trim() },
          ui: { dashboard_title: clampDashboardTitle(title) },
        },
      },
      { onSuccess: () => setSaved(true) },
    );
  };

  // Keep Tab inside the dialog.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    const inside = !!dialogRef.current?.contains(active);
    if (e.shiftKey && (active === first || !inside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !inside)) {
      e.preventDefault();
      first.focus();
    }
  };

  const titleId = `${rootId}-title`;
  const descId = `${rootId}-desc`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl"
      >
        <h2 id={titleId} className="text-lg font-semibold text-[var(--color-text)]">
          Your account
        </h2>
        <p id={descId} className="mt-1 text-sm leading-relaxed text-[var(--color-text-muted)]">
          This is the name the dashboard greets you with. The assistant stays Condor.
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Field
            label="What should we call you?"
            htmlFor={`${rootId}-name`}
            error={shownNameError}
            hint="Required"
          >
            <Input
              id={`${rootId}-name`}
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="nickname"
              maxLength={DISPLAY_NAME_MAX}
            />
          </Field>
          <Field
            label="Dashboard title"
            htmlFor={`${rootId}-dashboard-title`}
            hint="Optional. Leave blank to keep Condor."
          >
            <Input
              id={`${rootId}-dashboard-title`}
              value={title}
              maxLength={DASHBOARD_TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Condor"
            />
          </Field>

          <div className="min-h-4 text-xs" role="status" aria-live="polite">
            {saved && <span className="text-[var(--color-green)]">Saved.</span>}
            {patch.isError && (
              <span className="text-[var(--color-red)]">Could not save. Try again.</span>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!canSave}>
              {patch.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
