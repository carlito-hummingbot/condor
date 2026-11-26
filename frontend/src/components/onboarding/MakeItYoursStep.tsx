import { useEffect, useRef, useState } from "react";

import { Field, Input } from "@/components/ui/Field";
import type { User } from "@/lib/auth";
import {
  prefillName,
  validateDisplayName,
  type DetectedModel,
  type PreferencePatch,
  type ServerGate as ServerGateState,
  type UserPreferences,
} from "@/lib/onboarding";

export interface WizardAction {
  label: string;
  disabled: boolean;
  run: () => void;
}

/**
 * Name, required, and an optional title for this user's dashboard. The agent
 * stays named Condor — the title is only the label in the top bar.
 */
export function MakeItYoursStep({
  prefs,
  user,
  gate,
  model,
  busy,
  onContinue,
  onBind,
}: {
  prefs: UserPreferences;
  user: User | null;
  gate: Extract<ServerGateState, { phase: "ready" }>;
  model: DetectedModel | null;
  busy: boolean;
  onContinue: (patch: PreferencePatch) => void;
  onBind: (action: WizardAction | null) => void;
}) {
  const [name, setName] = useState(
    () => prefs.profile?.display_name?.trim() || prefillName(user),
  );
  const [title, setTitle] = useState(() => prefs.ui?.dashboard_title?.trim() ?? "");
  const [tried, setTried] = useState(false);
  const nameError = tried ? validateDisplayName(name) : null;
  const valid = validateDisplayName(name) === null;

  const runRef = useRef<() => void>(() => {});
  useEffect(() => {
    runRef.current = () => {
      setTried(true);
      if (validateDisplayName(name)) return;
      const detected: NonNullable<UserPreferences["onboarding"]>["detected"] = {
        server: gate.server,
        server_online: gate.online,
      };
      if (model) {
        detected.model_key = model.key;
        detected.model_label = model.label;
        detected.model_ready = model.ready;
      }
      onContinue({
        profile: { display_name: name.trim() },
        ui: { dashboard_title: title.trim() },
        onboarding: { detected },
      });
    };
  }, [name, title, gate.server, gate.online, model, onContinue]);

  useEffect(() => {
    onBind({
      label: "Next",
      disabled: busy || !valid,
      run: () => runRef.current(),
    });
    return () => onBind(null);
  }, [busy, valid, onBind]);

  return (
    <div>
      <h2 id="onboarding-title" className="text-xl font-bold text-[var(--color-text)]">
        Make it yours
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
        This is the name the dashboard greets you with. The assistant stays Condor.
      </p>
      <SetupFound gate={gate} model={model} />
      <div className="mt-4 space-y-3">
        <Field
          label="What should we call you?"
          htmlFor="onboarding-name"
          error={nameError}
          hint={nameError ? undefined : "Required"}
        >
          <Input
            id="onboarding-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            autoComplete="nickname"
            maxLength={80}
          />
        </Field>
        <Field
          label="Dashboard title"
          htmlFor="onboarding-title-field"
          hint="Optional. Shown in the top bar. Leave blank to keep Condor."
        >
          <Input
            id="onboarding-title-field"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Condor"
          />
        </Field>
      </div>
    </div>
  );
}

function SetupFound({
  gate,
  model,
}: {
  gate: Extract<ServerGateState, { phase: "ready" }>;
  model: DetectedModel | null;
}) {
  const serverLine = gate.online
    ? `Connected to ${gate.server}`
    : `${gate.server} is configured, currently offline`;
  let modelLine: string | null = null;
  if (model?.ready === true) modelLine = `${model.label} is ready`;
  else if (model?.ready === false) modelLine = `${model.label} still needs a login on this machine`;
  else if (model) modelLine = model.label;

  return (
    <p className="mt-3 text-xs leading-relaxed text-[var(--color-text-muted)]">
      {serverLine}
      {modelLine ? ` · ${modelLine}` : ""}
    </p>
  );
}
