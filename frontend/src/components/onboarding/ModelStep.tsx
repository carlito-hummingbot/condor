import { CircleCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BrainMenuBody } from "@/components/chat/BrainPicker";
import { Button } from "@/components/ui/Button";
import { usePatchPreferences } from "@/hooks/useUserPreferences";
import type { ChatAgentOption, CustomProvider } from "@/lib/api";
import {
  groupMissingModels,
  modelStepMode,
  preferredModel,
  splitModelOptions,
  type DetectedModel,
  type PreferencePatch,
} from "@/lib/onboarding";

import type { WizardAction } from "./MakeItYoursStep";

/**
 * A model `make setup` already made ready is confirmed. Otherwise this machine
 * is checked and every provider gets a row:
 *
 * - Found: a green "Detected" tag and what was found. Pick one (the recommended
 *   one is preselected) and the primary button names it.
 * - Not found: a Connect button that shows what to run on this machine. Condor
 *   cannot sign a command-line tool in or install it, so it says so and offers
 *   to check again. The primary button still says Next and carries on without a
 *   model (showcase only: a demo can click through without stopping here);
 *   nothing is saved, as with Skip.
 *
 * OpenRouter and custom endpoints open their own model lists, so they sit under
 * "More options". The chat stays quiet until one model is ready.
 */
export function ModelStep({
  model,
  agents,
  customProviders,
  busy,
  onContinue,
  onRecheck,
  onBind,
}: {
  model: DetectedModel | null;
  agents: ChatAgentOption[];
  customProviders: CustomProvider[];
  busy: boolean;
  onContinue: (patch: PreferencePatch) => void;
  onRecheck: () => void;
  onBind: (action: WizardAction | null) => void;
}) {
  const patch = usePatchPreferences();
  const mode = modelStepMode(model?.ready);
  const { found } = splitModelOptions(agents);
  const missing = groupMissingModels(agents);
  const pickers = agents.filter((agent) => agent.picker);
  const [chosen, setChosen] = useState<string | null>(null);
  const [showing, setShowing] = useState<string | null>(null);
  // A pick that is no longer found (after a re-check) falls back to the suggestion.
  const selected = found.find((row) => row.key === chosen) ?? preferredModel(found);

  const continueRef = useRef(onContinue);
  useEffect(() => {
    continueRef.current = onContinue;
  }, [onContinue]);

  const keep = async (key?: string) => {
    if (key) await patch.mutateAsync({ patch: {}, agentKey: key });
    continueRef.current({});
  };
  const keepRef = useRef(keep);
  useEffect(() => {
    keepRef.current = keep;
  });

  const targetKey = mode === "confirm" ? model?.key : selected?.key;
  const primaryLabel = mode === "choose" && selected ? `Connect ${selected.label}` : "Next";
  // With nothing found there is no model to save, so Next carries on the way
  // Skip does, one step at a time (`keep` only patches when it has a key).
  useEffect(() => {
    onBind({
      label: primaryLabel,
      disabled: busy || patch.isPending,
      run: () => void keepRef.current(targetKey),
    });
    return () => onBind(null);
  }, [busy, mode, onBind, patch.isPending, primaryLabel, targetKey]);

  if (mode === "confirm" && model) {
    return (
      <div>
        <h2 id="onboarding-title" className="text-xl font-bold text-[var(--color-text)]">
          AI model
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-text)]">
          {model.label} is ready on this machine.
        </p>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Setup already chose it, so this step does not ask again. You can change it later from the
          chat.
        </p>
      </div>
    );
  }

  const working = busy || patch.isPending;

  return (
    <div>
      <h2 id="onboarding-title" className="text-xl font-bold text-[var(--color-text)]">
        AI model
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
        {found.length > 0
          ? "Condor checked this machine and found these. Pick the one to chat with."
          : "Nothing ready was found on this machine. Connect shows what to run, then check again. Skip leaves the chat quiet. You can connect a model later from the chat."}
      </p>

      <ul className="mt-3 max-h-72 divide-y divide-[var(--color-border)] overflow-y-auto rounded-lg border border-[var(--color-border)]">
        {found.map((agent) => {
          const active = selected?.key === agent.key;
          return (
            <li key={agent.key}>
              <button
                type="button"
                aria-pressed={active}
                disabled={working}
                onClick={() => setChosen(agent.key)}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-surface-hover)] disabled:opacity-60 ${
                  active ? "bg-[var(--color-surface-hover)]" : ""
                }`}
              >
                <CircleCheck
                  aria-hidden="true"
                  className={`h-4 w-4 shrink-0 ${active ? "text-[var(--color-green)]" : "text-[var(--color-text-muted)]"}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-[var(--color-text)]">
                      {agent.label}
                    </span>
                    <span className="shrink-0 rounded-full border border-[var(--color-green)] px-2 py-px text-2xs font-semibold uppercase tracking-wide text-[var(--color-green)]">
                      Detected
                    </span>
                  </span>
                  {agent.detail && (
                    <span className="mt-0.5 block text-xs leading-relaxed text-[var(--color-text-muted)]">
                      {agent.detail}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
        {missing.map((row) => {
          const open = showing === row.key;
          return (
            <li key={row.key} className="px-3 py-2.5">
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-text)]">
                  {row.label}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={working}
                  aria-expanded={open}
                  aria-label={`Connect ${row.label}`}
                  onClick={() => setShowing(open ? null : row.key)}
                >
                  Connect
                </Button>
              </div>
              {open && (
                <div className="mt-2 text-xs leading-relaxed text-[var(--color-text-muted)]">
                  <p>
                    Condor cannot sign in or install this for you. On this machine:
                  </p>
                  <p className="mt-1 break-words rounded-md bg-[var(--color-bg)] px-2 py-1.5 font-mono text-[var(--color-text)]">
                    {row.detail}
                  </p>
                  <Button className="mt-2" variant="ghost" size="sm" onClick={onRecheck}>
                    Check again
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {pickers.length > 0 || customProviders.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
            More options (OpenRouter, custom endpoints)
          </summary>
          <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-[var(--color-border)]">
            <BrainMenuBody
              agents={pickers}
              customProviders={customProviders}
              selectedAgentKey={model?.key ?? ""}
              onSelect={(selection) => {
                if (selection.agentKey) void keep(selection.agentKey);
              }}
              onClose={() => {}}
            />
          </div>
        </details>
      ) : null}
    </div>
  );
}
