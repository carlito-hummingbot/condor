import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { useServer } from "@/hooks/useServer";
import { usePatchPreferences, useUserPreferences } from "@/hooks/useUserPreferences";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import {
  advance,
  describeModel,
  installedStepDefs,
  jumpTo,
  markAnswered,
  markSkipped,
  readActiveAgentKey,
  resolveServerGate,
  retreat,
  startFlow,
  type FlowState,
  type PreferencePatch,
  type ServerGate as ServerGateState,
} from "@/lib/onboarding";

import { DoneStep } from "./DoneStep";
import { MakeItYoursStep, type WizardAction } from "./MakeItYoursStep";
import { ServerGate } from "./ServerGate";
import { StepDots } from "./StepDots";

const STEPS = installedStepDefs();

/**
 * First-run setup, in the same frosted card the keys overlay used.
 *
 * Escape and the backdrop do nothing: this is the first run, not a dialog
 * someone opened by accident. "Skip setup" is the way out, and it is recorded
 * so Settings can offer the run again.
 */
export function OnboardingWizard() {
  const { user } = useAuth();
  const { server, setServer } = useServer();
  const { data: prefs } = useUserPreferences();
  const patch = usePatchPreferences();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [flow, setFlow] = useState<FlowState>(() =>
    startFlow(STEPS, prefs?.onboarding?.last_step, prefs?.onboarding?.skipped),
  );
  const [action, setAction] = useState<WizardAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const serversQuery = useQuery({
    queryKey: ["servers"],
    queryFn: api.getServers,
  });
  const options = useQuery({
    queryKey: ["session-options"],
    queryFn: api.getSessionOptions,
    retry: false,
  });

  const gate: ServerGateState | { phase: "error" } = serversQuery.isError
    ? { phase: "error" }
    : resolveServerGate(serversQuery.isFetched ? (serversQuery.data ?? []) : undefined, server);

  const adopt = gate.phase === "ready" && gate.adopt ? gate.server : null;
  useEffect(() => {
    if (adopt && adopt !== server) setServer(adopt);
  }, [adopt, server, setServer]);

  const model = describeModel(readActiveAgentKey(prefs), options.data);
  const step = STEPS[flow.index] ?? STEPS[0];
  const onBind = useCallback((next: WizardAction | null) => {
    setAction(next);
  }, []);

  const clearForce = useCallback(() => {
    if (params.get("onboarding") !== "1") return;
    const next = new URLSearchParams(params);
    next.delete("onboarding");
    setParams(next, { replace: true });
  }, [params, setParams]);

  const save = useCallback(
    async (partial: PreferencePatch, replaceOnboarding = false) => {
      setBusy(true);
      setError(null);
      try {
        await patch.mutateAsync({ patch: partial, replaceOnboarding });
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save that.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [patch],
  );

  const continueStep = useCallback(
    async (partial: PreferencePatch, skippedStep: boolean) => {
      const marked = skippedStep
        ? markSkipped(flow, step.id, step.skippable)
        : markAnswered(flow, step.id);
      if (!marked) return;
      const next = advance(marked, STEPS.length);
      const saved = await save({
        ...partial,
        onboarding: {
          ...partial.onboarding,
          last_step: STEPS[next.index]?.id ?? step.id,
          skipped: marked.skipped,
        },
      });
      if (saved) setFlow(next);
    },
    [flow, save, step.id, step.skippable],
  );

  const finish = useCallback(
    async (to?: string) => {
      const saved = await save({
        onboarding: {
          completed_at: new Date().toISOString(),
          last_step: "done",
          skipped: flow.skipped,
          skipped_all: false,
        },
      });
      if (!saved) return;
      clearForce();
      if (to) navigate(to);
    },
    [clearForce, flow.skipped, navigate, save],
  );

  const skipAll = useCallback(async () => {
    const saved = await save({
      onboarding: {
        completed_at: new Date().toISOString(),
        skipped_all: true,
        last_step: step.id,
        skipped: flow.skipped,
      },
    });
    if (saved) clearForce();
  }, [clearForce, flow.skipped, save, step.id]);

  const preferences = prefs ?? {};

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[var(--color-bg)]/70 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="relative z-10 flex max-h-[min(640px,calc(100%-1rem))] w-full max-w-lg flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl shadow-black/20 sm:p-8"
      >
        {gate.phase === "ready" ? (
          <>
            <StepDots
              steps={STEPS}
              flow={flow}
              onJump={(index) => {
                const next = jumpTo(flow, index);
                if (next) setFlow(next);
              }}
            />
            <div className="min-h-0 flex-1 overflow-y-auto">
              {step.id === "profile" && (
                <MakeItYoursStep
                  prefs={preferences}
                  user={user}
                  gate={gate}
                  model={model}
                  busy={busy}
                  onContinue={(partial) => void continueStep(partial, false)}
                  onBind={onBind}
                />
              )}
              {step.id === "done" && (
                <DoneStep
                  prefs={preferences}
                  busy={busy}
                  onFinish={(to) => void finish(to)}
                  onBind={onBind}
                />
              )}
            </div>
            {error && <p className="mt-3 text-xs text-[var(--color-red)]">{error}</p>}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              {step.id !== "done" ? (
                <button
                  type="button"
                  onClick={() => void skipAll()}
                  disabled={busy}
                  className="self-start text-xs text-[var(--color-text-muted)] underline underline-offset-2 hover:text-[var(--color-text)] disabled:opacity-50"
                >
                  Skip setup
                </button>
              ) : (
                <span />
              )}
              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  disabled={busy || flow.index === 0}
                  onClick={() => setFlow((current) => retreat(current))}
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  disabled={busy || !action || action.disabled}
                  onClick={() => action?.run()}
                >
                  {busy ? "Saving…" : (action?.label ?? "Next")}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ServerGate gate={gate} onPicked={(name) => setServer(name)} />
            </div>
            {error && <p className="mt-3 text-xs text-[var(--color-red)]">{error}</p>}
            <button
              type="button"
              onClick={() => void skipAll()}
              disabled={busy}
              className="mt-4 self-start text-xs text-[var(--color-text-muted)] underline underline-offset-2 hover:text-[var(--color-text)] disabled:opacity-50"
            >
              Skip setup
            </button>
          </>
        )}
      </div>
    </div>
  );
}
