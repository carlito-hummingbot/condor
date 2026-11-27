import { CircleCheck } from "lucide-react";
import { useEffect, useRef } from "react";

import { BrainMenuBody } from "@/components/chat/BrainPicker";
import { Button } from "@/components/ui/Button";
import { usePatchPreferences } from "@/hooks/useUserPreferences";
import type { ChatAgentOption, CustomProvider } from "@/lib/api";
import {
  modelStepMode,
  splitModelOptions,
  type DetectedModel,
  type PreferencePatch,
} from "@/lib/onboarding";

import type { WizardAction } from "./MakeItYoursStep";

/**
 * A model `make setup` already made ready is confirmed. Otherwise the models
 * this machine can already run are listed first, each with a Connect button, and
 * the rest sit below in the same list as the chat picker. The chat stays quiet
 * until one is ready.
 */
export function ModelStep({
  model,
  agents,
  customProviders,
  busy,
  onContinue,
  onBind,
}: {
  model: DetectedModel | null;
  agents: ChatAgentOption[];
  customProviders: CustomProvider[];
  busy: boolean;
  onContinue: (patch: PreferencePatch) => void;
  onBind: (action: WizardAction | null) => void;
}) {
  const patch = usePatchPreferences();
  const mode = modelStepMode(model?.ready);
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

  useEffect(() => {
    onBind({
      label: "Next",
      disabled: busy || patch.isPending || mode === "choose",
      run: () => void keepRef.current(model?.key),
    });
    return () => onBind(null);
  }, [busy, mode, model?.key, onBind, patch.isPending]);

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

  const { found, other } = splitModelOptions(agents);
  const working = busy || patch.isPending;
  const otherList = (
    <div className="max-h-56 overflow-y-auto rounded-lg border border-[var(--color-border)]">
      <BrainMenuBody
        agents={other}
        customProviders={customProviders}
        selectedAgentKey={model?.key ?? ""}
        onSelect={(selection) => {
          if (selection.agentKey) void keep(selection.agentKey);
        }}
        onClose={() => {}}
      />
    </div>
  );

  return (
    <div>
      <h2 id="onboarding-title" className="text-xl font-bold text-[var(--color-text)]">
        AI model
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
        {found.length > 0
          ? "Condor found these on this machine. Connect the one you want to chat with."
          : "Nothing ready was found on this machine. Subscriptions log in on this machine; a blocked row names the command. Skip leaves the chat quiet."}
      </p>
      {found.length > 0 && (
        <ul className="mt-3 divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
          {found.map((agent) => (
            <li key={agent.key} className="flex items-center gap-3 px-3 py-2.5">
              <CircleCheck aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--color-green)]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--color-text)]">{agent.label}</p>
                {agent.detail && (
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-text-muted)]">
                    {agent.detail}
                  </p>
                )}
              </div>
              <Button
                variant="primary"
                size="sm"
                disabled={working}
                aria-label={`Connect ${agent.label}`}
                onClick={() => void keep(agent.key)}
              >
                Connect
              </Button>
            </li>
          ))}
        </ul>
      )}
      {found.length > 0 ? (
        other.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
              Other options
            </summary>
            <div className="mt-2">{otherList}</div>
          </details>
        )
      ) : (
        <div className="mt-3">{otherList}</div>
      )}
    </div>
  );
}
