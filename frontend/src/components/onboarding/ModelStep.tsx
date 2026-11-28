import { useEffect, useRef } from "react";

import { BrainMenuBody } from "@/components/chat/BrainPicker";
import { usePatchPreferences } from "@/hooks/useUserPreferences";
import type { ChatAgentOption, CustomProvider } from "@/lib/api";
import {
  modelStepMode,
  type DetectedModel,
  type PreferencePatch,
} from "@/lib/onboarding";

import type { WizardAction } from "./MakeItYoursStep";

/**
 * A model `make setup` already made ready is confirmed. Otherwise the same
 * list as the chat picker, and the chat stays quiet until one is ready.
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

  return (
    <div>
      <h2 id="onboarding-title" className="text-xl font-bold text-[var(--color-text)]">
        AI model
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
        The chat cannot answer until a model is ready. Subscriptions log in on this machine; a
        blocked row names the command. Skip leaves the chat quiet.
      </p>
      <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-[var(--color-border)]">
        <BrainMenuBody
          agents={agents}
          customProviders={customProviders}
          selectedAgentKey={model?.key ?? ""}
          onSelect={(selection) => {
            if (selection.agentKey) void keep(selection.agentKey);
          }}
          onClose={() => {}}
        />
      </div>
    </div>
  );
}
