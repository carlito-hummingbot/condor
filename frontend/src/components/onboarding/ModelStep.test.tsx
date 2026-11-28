/**
 * The AI model step's primary button.
 *
 * The wizard binds that button through `onBind` (`OnboardingWizard` draws it
 * from the binding), so these tests render the step with the same harness: one
 * primary button whose label and disabled state come from the binding, plus a
 * click. The rule under test is the showcase one — with nothing ready the
 * button is a normal Next that carries on and saves no model, and with a model
 * to offer it still names that model.
 *
 * @vitest-environment jsdom
 */

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatAgentOption } from "@/lib/api";
import type { DetectedModel, PreferencePatch } from "@/lib/onboarding";

import type { WizardAction } from "./MakeItYoursStep";

const { patchModel } = vi.hoisted(() => ({ patchModel: vi.fn(async () => undefined) }));

vi.mock("@/hooks/useUserPreferences", () => ({
  usePatchPreferences: () => ({ mutateAsync: patchModel, isPending: false }),
}));

const { ModelStep } = await import("./ModelStep");

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  patchModel.mockClear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function flush(ms = 0) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

/** Claude is ready here; Codex is installed but its login is unproven. */
const FOUND: ChatAgentOption[] = [
  { key: "claude-acp:sonnet", label: "Claude Sonnet", ready: true, state: "ready" },
  { key: "codex-acp:", label: "Codex", ready: true, state: "unverified" },
];

/** Nothing on this machine can chat: Codex is listed under Connect only. */
const NONE_FOUND: ChatAgentOption[] = [
  { key: "codex-acp:", label: "Codex", ready: false, state: "missing" },
];

const CONFIRMED: DetectedModel = { key: "claude-acp:sonnet", label: "Claude Sonnet", ready: true };

/** The step plus the wizard's primary button, wired the way the wizard does it. */
function Harness({
  agents,
  model,
  onContinue,
}: {
  agents: ChatAgentOption[];
  model: DetectedModel | null;
  onContinue: (patch: PreferencePatch) => void;
}) {
  const [action, setAction] = useState<WizardAction | null>(null);
  return (
    <div>
      <ModelStep
        model={model}
        agents={agents}
        customProviders={[]}
        busy={false}
        onContinue={onContinue}
        onRecheck={() => {}}
        onBind={setAction}
      />
      <button id="primary" disabled={!action || action.disabled} onClick={() => action?.run()}>
        {action?.label ?? "Next"}
      </button>
    </div>
  );
}

const primary = () => container.querySelector<HTMLButtonElement>("#primary")!;

async function render(
  agents: ChatAgentOption[],
  model: DetectedModel | null = null,
  onContinue = vi.fn(),
) {
  await act(async () => {
    root.render(<Harness agents={agents} model={model} onContinue={onContinue} />);
  });
  await flush();
  return onContinue;
}

describe("ModelStep primary button", () => {
  it("is an enabled Next with nothing found, and carries on without saving a model", async () => {
    const onContinue = await render(NONE_FOUND);

    expect(primary().textContent).toBe("Next");
    expect(primary().disabled).toBe(false);
    // The one sentence that says a model can come later.
    expect(container.textContent).toContain("You can connect a model later from the chat.");

    await act(async () => primary().click());
    await flush();

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledWith({});
    expect(patchModel).not.toHaveBeenCalled();
  });

  it("names the recommended model when one is found, and saves it on the way on", async () => {
    const onContinue = await render(FOUND);

    expect(primary().textContent).toBe("Connect Claude Sonnet");
    expect(primary().disabled).toBe(false);

    await act(async () => primary().click());
    await flush();

    expect(patchModel).toHaveBeenCalledWith({ patch: {}, agentKey: "claude-acp:sonnet" });
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("keeps the confirm case as it was: a ready model is Next, and it stays the active one", async () => {
    const onContinue = await render(FOUND, CONFIRMED);

    expect(primary().textContent).toBe("Next");
    expect(primary().disabled).toBe(false);

    await act(async () => primary().click());
    await flush();

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(patchModel).toHaveBeenCalledWith({ patch: {}, agentKey: "claude-acp:sonnet" });
  });

  it("leaves Skip to the wizard: the step adds no Skip of its own", async () => {
    const onContinue = await render(NONE_FOUND);

    const buttons = [...container.querySelectorAll("button")].map((b) => b.textContent?.trim());
    expect(buttons).not.toContain("Skip");
    expect(buttons).not.toContain("Skip setup");

    // And the binding only ever continues: there is no skip flag to set here.
    await act(async () => primary().click());
    await flush();
    expect(onContinue).toHaveBeenCalledWith({});
  });
});
