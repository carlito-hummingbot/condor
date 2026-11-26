import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { useSetTelemetryLevel } from "@/hooks/useTelemetry";
import { api } from "@/lib/api";
import { canContinueAlerts, type PreferencePatch } from "@/lib/onboarding";
import { PermissionDeniedError, pushSupport, subscribe } from "@/lib/push";

import type { WizardAction } from "./MakeItYoursStep";

/**
 * Push is optional. Telegram is a status line. Telemetry has no default:
 * Next stays disabled until the user picks yes or no.
 */
export function AlertsStep({
  busy,
  onContinue,
  onBind,
}: {
  busy: boolean;
  onContinue: (patch: PreferencePatch) => void;
  onBind: (action: WizardAction | null) => void;
}) {
  const [choice, setChoice] = useState<"yes" | "no" | null>(null);
  const [pushNote, setPushNote] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const telemetry = useSetTelemetryLevel();
  const mode = useQuery({
    queryKey: ["auth-mode"],
    queryFn: () => api.getAuthMode(),
    staleTime: 60_000,
  });
  const continueRef = useRef(onContinue);
  useEffect(() => {
    continueRef.current = onContinue;
  }, [onContinue]);

  const support = pushSupport();
  const ready = canContinueAlerts(choice);
  const saveRef = useRef(telemetry.mutateAsync);
  useEffect(() => {
    saveRef.current = telemetry.mutateAsync;
  });

  useEffect(() => {
    onBind({
      label: "Next",
      disabled: busy || telemetry.isPending || !ready,
      run: () => {
        if (!choice) return;
        void saveRef
          .current(choice === "yes" ? "usage" : "off")
          .then(() => continueRef.current({}))
          .catch(() => {});
      },
    });
    return () => onBind(null);
  }, [busy, choice, onBind, ready, telemetry.isPending]);

  const enablePush = async () => {
    setPushBusy(true);
    setPushNote(null);
    try {
      await subscribe();
      setPushNote("Alerts are on for this browser.");
    } catch (err) {
      setPushNote(
        err instanceof PermissionDeniedError
          ? "This browser is blocking notifications."
          : err instanceof Error
            ? err.message
            : "Could not enable alerts.",
      );
    } finally {
      setPushBusy(false);
    }
  };

  const telegram =
    mode.data?.mode === "telegram"
      ? "Telegram is linked."
      : "Telegram is not connected. Set it up with make setup → Telegram. This screen cannot add a bot token.";

  return (
    <div>
      <h2 id="onboarding-title" className="text-xl font-bold text-[var(--color-text)]">
        Stay in the loop
      </h2>
      <div className="mt-4 space-y-4">
        <section>
          <h3 className="text-sm font-medium text-[var(--color-text)]">Alerts on this device</h3>
          {support === "supported" ? (
            <Button className="mt-2" variant="secondary" disabled={pushBusy} onClick={() => void enablePush()}>
              {pushBusy ? "Asking…" : "Enable push alerts"}
            </Button>
          ) : (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {support === "insecure-context"
                ? "Push needs a secure address. This connection cannot ask the browser."
                : "This browser does not support push alerts."}
            </p>
          )}
          {pushNote && <p className="mt-2 text-xs text-[var(--color-text-muted)]">{pushNote}</p>}
        </section>
        <section className="border-t border-[var(--color-border)] pt-4">
          <h3 className="text-sm font-medium text-[var(--color-text)]">Telegram</h3>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">{telegram}</p>
        </section>
        <section className="border-t border-[var(--color-border)] pt-4">
          <h3 className="text-sm font-medium text-[var(--color-text)]">Usage summaries</h3>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
            Anonymous counts of how the dashboard is used. Nothing is selected until you choose.
          </p>
          <div className="mt-3 flex gap-2" role="group" aria-label="Telemetry consent">
            <Button
              variant={choice === "yes" ? "primary" : "secondary"}
              aria-pressed={choice === "yes"}
              onClick={() => setChoice("yes")}
            >
              Yes
            </Button>
            <Button
              variant={choice === "no" ? "primary" : "secondary"}
              aria-pressed={choice === "no"}
              onClick={() => setChoice("no")}
            >
              No
            </Button>
          </div>
          {telemetry.isError && (
            <p className="mt-2 text-xs text-[var(--color-red)]">
              {telemetry.error instanceof Error ? telemetry.error.message : "Could not save that choice."}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
