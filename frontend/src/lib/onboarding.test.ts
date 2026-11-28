import { describe, expect, it } from "vitest";

import {
  STEP_DEFS,
  advance,
  buildPreferenceUpdates,
  canJumpTo,
  dashboardTitleFrom,
  describeModel,
  DEFAULT_DISPLAY_NAME,
  displayNameFrom,
  forceOnboarding,
  installedStepDefs,
  planStepIds,
  readinessLoading,
  readinessRows,
  groupMissingModels,
  isDetected,
  preferredModel,
  splitModelOptions,
  stepsForPlan,
  type Readiness,
  isTradingSurface,
  jumpTo,
  markAnswered,
  markSkipped,
  modelAlreadyReady,
  modelStepMode,
  onboardingPending,
  prefillName,
  resolveServerGate,
  savedAppearanceToApply,
  restartedOnboarding,
  resumeIndex,
  retreat,
  finishedThisRun,
  setupReturnPath,
  shouldAutoComplete,
  shouldShowKeysBanner,
  shouldShowWizard,
  startFlow,
  validateDisplayName,
  withActiveAgentKey,
  type OnboardingSignals,
  type UserPreferences,
} from "./onboarding";

function signals(over: Partial<OnboardingSignals> = {}): OnboardingSignals {
  return {
    prefsReady: true,
    prefsError: false,
    completed: false,
    completedAt: null,
    force: false,
    keysReady: true,
    keysError: false,
    hasKeys: false,
    activityReady: true,
    hasActivity: false,
    wizardEngaged: false,
    engagedCompletedAt: null,
    ...over,
  };
}

const readyUser = signals();

describe("who sees the wizard", () => {
  it("shows it to a new user with no keys, wallets, conversations or bots", () => {
    expect(shouldShowWizard(readyUser)).toBe(true);
    expect(shouldAutoComplete(readyUser)).toBe(false);
    expect(onboardingPending(readyUser)).toBe(false);
  });

  it("marks an install that already has keys or wallets complete, and never shows the wizard", () => {
    // Wallets set `hasKeys` the same way exchange credentials do.
    const existing = signals({ hasKeys: true });
    expect(shouldShowWizard(existing)).toBe(false);
    expect(shouldAutoComplete(existing)).toBe(true);
  });

  it("treats a conversation or a bot as an existing user, even with no keys", () => {
    const existing = signals({ hasActivity: true });
    expect(shouldShowWizard(existing)).toBe(false);
    expect(shouldAutoComplete(existing)).toBe(true);
  });

  it("does not show the wizard once setup has been finished", () => {
    const done = signals({ completed: true });
    expect(shouldShowWizard(done)).toBe(false);
    expect(shouldAutoComplete(done)).toBe(false);
  });

  it("opens again when setup is run from Settings, even for an existing user", () => {
    const again = signals({ force: true, completed: true, hasKeys: true });
    expect(shouldShowWizard(again)).toBe(true);
    expect(shouldAutoComplete(again)).toBe(false);
  });

  it("waits while preferences, keys or activity are still unknown", () => {
    expect(shouldShowWizard(signals({ prefsReady: false }))).toBe(false);
    expect(onboardingPending(signals({ prefsReady: false }))).toBe(true);
    expect(shouldShowWizard(signals({ keysReady: false }))).toBe(false);
    expect(onboardingPending(signals({ keysReady: false }))).toBe(true);
    expect(shouldShowWizard(signals({ activityReady: false }))).toBe(false);
    expect(onboardingPending(signals({ activityReady: false }))).toBe(true);
    // Keys already answer "existing"; don't wait on the conversation list.
    expect(shouldAutoComplete(signals({ hasKeys: true, activityReady: false }))).toBe(true);
    expect(shouldAutoComplete(signals({ hasActivity: true, activityReady: false }))).toBe(false);
  });

  it("does not treat a credentials outage as a new user or an old one", () => {
    const outage = signals({ keysError: true, keysReady: true });
    expect(shouldShowWizard(outage)).toBe(false);
    expect(shouldAutoComplete(outage)).toBe(false);
    expect(onboardingPending(outage)).toBe(false);
  });

  it("keeps an open wizard up while the server just picked is probed, including an upstream error", () => {
    expect(shouldShowWizard(signals({ wizardEngaged: true, keysReady: false }))).toBe(true);
    expect(shouldShowWizard(signals({ wizardEngaged: true, keysError: true, keysReady: true }))).toBe(true);
  });

  it("keeps an open wizard up after a key is saved in the Connect step", () => {
    // The walkthrough killer: `hasKeys` used to be checked before the run that
    // is already on screen, so connecting an exchange ended setup on the spot.
    const savedKey = signals({
      wizardEngaged: true,
      hasKeys: true,
      completedAt: null,
      engagedCompletedAt: null,
    });
    expect(shouldShowWizard(savedKey)).toBe(true);
    expect(finishedThisRun(savedKey)).toBe(false);
    // Nor does it close a run that was opened again on a finished install.
    expect(
      shouldShowWizard({
        ...savedKey,
        completed: true,
        completedAt: "2026-01-01T00:00:00.000Z",
        engagedCompletedAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("closes only when the run itself finishes or is skipped", () => {
    const at = "2026-01-01T00:00:00.000Z";
    const later = "2026-02-02T00:00:00.000Z";
    // Finish or Skip setup wrote a newer completed_at.
    expect(
      shouldShowWizard(
        signals({ wizardEngaged: true, completed: true, completedAt: later, engagedCompletedAt: at }),
      ),
    ).toBe(false);
    expect(finishedThisRun({ wizardEngaged: true, completedAt: later, engagedCompletedAt: at })).toBe(
      true,
    );
    // A completion that predates the run is the one it started with.
    expect(finishedThisRun({ wizardEngaged: true, completedAt: at, engagedCompletedAt: at })).toBe(
      false,
    );
    // Nothing is "this run" until the wizard is actually up.
    expect(finishedThisRun({ wizardEngaged: false, completedAt: later, engagedCompletedAt: at })).toBe(
      false,
    );
    expect(
      shouldShowWizard(signals({ wizardEngaged: false, completed: true, hasKeys: true })),
    ).toBe(false);
  });

  it("never auto-completes an install under an open wizard", () => {
    expect(shouldAutoComplete(signals({ wizardEngaged: true, hasKeys: true }))).toBe(false);
    expect(shouldAutoComplete(signals({ wizardEngaged: true, hasActivity: true }))).toBe(false);
    // The same install with no wizard up is still marked complete quietly.
    expect(shouldAutoComplete(signals({ hasKeys: true }))).toBe(true);
  });

  it("does not open the wizard when preferences cannot be read", () => {
    const outage = signals({ prefsError: true, prefsReady: false });
    expect(shouldShowWizard(outage)).toBe(false);
    expect(shouldAutoComplete(outage)).toBe(false);
    expect(onboardingPending(outage)).toBe(false);
  });
});

describe("run setup again", () => {
  const fullPlan = ["check", "profile", "model", "connect", "look", "done"];

  it("starts at step 1 whatever the stored last step or skip list was", () => {
    // A run that was asked for by hand passes no last_step and no skips, so an
    // install that finished on "done" opens again on the first step.
    const forced = startFlow(stepsForPlan(fullPlan), undefined, []);
    expect(forced.index).toBe(0);
    expect(forced.furthest).toBe(0);
    expect(forced.skipped).toEqual([]);
    // Opening it again reads the record; it does not rewrite it.
    expect(resumeIndex(stepsForPlan(fullPlan), "done")).toBe(5);
  });

  it("hands back to the page that opened it, and to the dashboard otherwise", () => {
    expect(setupReturnPath({ from: "/settings?tab=appearance" }, "?onboarding=1")).toBe(
      "/settings?tab=appearance",
    );
    expect(setupReturnPath(null, "?onboarding=1&from=%2Fportfolio")).toBe("/portfolio");
    expect(setupReturnPath(null, "?onboarding=1")).toBe("/");
    expect(setupReturnPath(undefined, "")).toBe("/");
    // Not an open redirect, and never straight back into the wizard.
    expect(setupReturnPath(null, "?from=https%3A%2F%2Fevil.example")).toBe("/");
    expect(setupReturnPath({ from: "//evil.example" }, "")).toBe("/");
    expect(setupReturnPath({ from: "/welcome" }, "?onboarding=1")).toBe("/");
    expect(setupReturnPath({ from: "/?onboarding=1" }, "")).toBe("/");
  });

  it("counts its steps from the install, so the dots match both cases", () => {
    const ready: Readiness = {
      server: { name: "local", online: true },
      model: { key: "claude-acp:sonnet", label: "Claude Sonnet", ready: true },
      modelStatus: "loaded",
      keys: "some",
      gateway: "off",
    };
    const steps = (r: Readiness) => stepsForPlan(planStepIds(r)).map((step) => step.id);
    // Nothing to connect: the model step stays out, and so does Connect.
    expect(steps(ready)).toEqual(["check", "profile", "look", "done"]);
    // A ready model with no key yet: 5.
    expect(steps({ ...ready, keys: "none" })).toEqual([
      "check",
      "profile",
      "connect",
      "look",
      "done",
    ]);
    // No model on the install: the model step is back, 5, or 6 with no key.
    expect(steps({ ...ready, model: null })).toEqual([
      "check",
      "profile",
      "model",
      "look",
      "done",
    ]);
    expect(steps({ ...ready, model: null, keys: "none" })).toEqual(fullPlan);
  });
});

describe("the keys reminder", () => {
  const open = {
    showWizard: false,
    pending: false,
    hasKeys: false,
    keysReady: true,
    keysError: false,
    hasServer: true,
    trading: true,
  };

  it("shows on a trading page once setup is over and the server has no keys", () => {
    expect(shouldShowKeysBanner(open)).toBe(true);
  });

  it("stays hidden while the wizard is up, still deciding, or the page is exempt", () => {
    expect(shouldShowKeysBanner({ ...open, showWizard: true })).toBe(false);
    expect(shouldShowKeysBanner({ ...open, pending: true })).toBe(false);
    expect(shouldShowKeysBanner({ ...open, trading: false })).toBe(false);
    expect(shouldShowKeysBanner({ ...open, hasKeys: true })).toBe(false);
    expect(shouldShowKeysBanner({ ...open, keysError: true })).toBe(false);
    expect(shouldShowKeysBanner({ ...open, hasServer: false })).toBe(false);
  });

  it("uses the same pages the blocking overlay used to cover", () => {
    expect(isTradingSurface("/")).toBe(false);
    expect(isTradingSurface("/routines")).toBe(false);
    expect(isTradingSurface("/settings")).toBe(false);
    expect(isTradingSurface("/settings?tab=keys")).toBe(false);
    expect(isTradingSurface("/hub")).toBe(false);
    expect(isTradingSurface("/portfolio")).toBe(true);
    expect(isTradingSurface("/trade")).toBe(true);
    expect(isTradingSurface("/dex")).toBe(true);
    expect(isTradingSurface("/bots")).toBe(true);
    expect(isTradingSurface("/agents/condor")).toBe(true);
  });
});

describe("step flow", () => {
  const steps = STEP_DEFS;

  it("starts on the first step, or on the step that was saved", () => {
    expect(startFlow(steps).index).toBe(0);
    expect(resumeIndex(steps, "connect")).toBe(3);
    expect(startFlow(steps, "connect").furthest).toBe(3);
    expect(startFlow(steps, "not-a-step").index).toBe(0);
  });

  it("moves forward and back without passing the ends", () => {
    const started = startFlow(steps);
    const next = advance(started, steps.length);
    expect(next.index).toBe(1);
    expect(next.furthest).toBe(1);
    expect(retreat(next).index).toBe(0);
    expect(retreat(started).index).toBe(0);
    const last = { index: steps.length - 1, furthest: steps.length - 1, skipped: [] };
    expect(advance(last, steps.length).index).toBe(steps.length - 1);
  });

  it("lets a dot open a step already reached, and no step beyond it", () => {
    const state = { index: 3, furthest: 3, skipped: [] };
    expect(canJumpTo(state.index, 1, state.furthest)).toBe(true);
    expect(jumpTo(state, 1)?.index).toBe(1);
    expect(canJumpTo(state.index, 3, state.furthest)).toBe(false);
    expect(jumpTo(state, 4)).toBeNull();
    expect(jumpTo(state, -1)).toBeNull();
    // Going back does not forget how far the user got.
    const back = jumpTo(state, 1)!;
    expect(canJumpTo(back.index, 3, back.furthest)).toBe(true);
  });

  it("skips only a skippable step, and answering it clears the skip", () => {
    const state = startFlow(steps);
    expect(markSkipped(state, "profile", false)).toBeNull();
    const onModel = { ...state, index: 1, furthest: 1 };
    const skipped = markSkipped(onModel, "model", true);
    expect(skipped?.skipped).toEqual(["model"]);
    expect(markSkipped(skipped!, "model", true)?.skipped).toEqual(["model"]);
    expect(markAnswered(skipped!, "model").skipped).toEqual([]);
  });

  it("keeps the saved skip list when a run is resumed", () => {
    const state = startFlow(steps, "look", ["model", "gone"]);
    expect(state.index).toBe(4);
    expect(state.skipped).toEqual(["model"]);
  });

  it("ships the steps this build renders, with done last in the full list", () => {
    expect(installedStepDefs().map((step) => step.id)).toEqual(STEP_DEFS.map((step) => step.id));
    expect(STEP_DEFS.map((step) => step.id)).toEqual([
      "check",
      "profile",
      "model",
      "connect",
      "look",
      "done",
    ]);
    expect(STEP_DEFS.filter((step) => step.skippable).map((step) => step.id)).toEqual([
      "model",
      "connect",
      "look",
    ]);
    expect(
      savedAppearanceToApply({
        storedTheme: "light",
        storedColorblind: null,
        storedCurrency: "EUR",
        theme: "dark",
        colorblind: true,
        currency: "USDT",
      }),
    ).toEqual({ colorblind: true });
    expect(
      savedAppearanceToApply({
        storedTheme: null,
        storedColorblind: "1",
        storedCurrency: null,
        theme: "dark",
        colorblind: false,
        currency: "BTC",
      }),
    ).toEqual({ theme: "dark", currency: "BTC" });
    expect(installedStepDefs().at(-1)?.id).toBe("done");
  });
});

describe("name, title and the hidden server check", () => {
  it("prefills a Telegram first name, and Algo Trader when the account has none", () => {
    expect(prefillName({ first_name: "Carlito", username: "carlito" })).toBe("Carlito");
    expect(prefillName({ first_name: "Local", username: "local" })).toBe(DEFAULT_DISPLAY_NAME);
    expect(prefillName({ first_name: "local", username: "local" })).toBe(DEFAULT_DISPLAY_NAME);
    expect(prefillName({ first_name: "  ", username: "local" })).toBe(DEFAULT_DISPLAY_NAME);
    expect(prefillName(null)).toBe("Algo Trader");
  });

  it("uses the saved name, then the prefill", () => {
    const prefs: UserPreferences = { profile: { display_name: "Ada" } };
    expect(displayNameFrom(prefs, { first_name: "Local" })).toBe("Ada");
    expect(displayNameFrom(prefs, { first_name: "Carlito" })).toBe("Ada");
    expect(displayNameFrom({}, { first_name: "Carlito" })).toBe("Carlito");
    expect(displayNameFrom({ profile: { display_name: "  " } }, { first_name: "Local" })).toBe(
      "Algo Trader",
    );
  });

  it("requires a name and caps its length", () => {
    expect(validateDisplayName("  ")).toMatch(/call you/);
    expect(validateDisplayName("Algo Trader")).toBeNull();
    expect(validateDisplayName("Ada")).toBeNull();
    expect(validateDisplayName("a".repeat(81))).toMatch(/80/);
  });

  it("keeps the dashboard title at Condor until one is saved, and caps a long one", () => {
    expect(dashboardTitleFrom(undefined)).toBe("Condor");
    expect(dashboardTitleFrom({ ui: { dashboard_title: "Ada's Desk" } })).toBe("Ada's Desk");
    expect(dashboardTitleFrom({ ui: { dashboard_title: "  " } })).toBe("Condor");
    const long = "A".repeat(80);
    expect(dashboardTitleFrom({ ui: { dashboard_title: long } })).toHaveLength(40);
    expect(dashboardTitleFrom({ ui: { dashboard_title: long } })).toBe("A".repeat(40));
  });

  it("confirms a server that is already selected, including an offline one", () => {
    const servers = [
      { name: "desk", online: false, is_default: true },
      { name: "other", online: true },
    ];
    expect(resolveServerGate(undefined, null)).toEqual({ phase: "loading" });
    expect(resolveServerGate([], null)).toEqual({ phase: "add" });
    expect(resolveServerGate(servers, "desk")).toEqual({
      phase: "ready",
      server: "desk",
      online: false,
      adopt: false,
    });
  });

  it("adopts the default online server instead of asking again", () => {
    const servers = [
      { name: "desk", online: true, is_default: true },
      { name: "other", online: true },
    ];
    expect(resolveServerGate(servers, null)).toEqual({
      phase: "ready",
      server: "desk",
      online: true,
      adopt: true,
    });
  });

  it("asks for a pick when every configured server is offline and none is selected", () => {
    const gate = resolveServerGate([{ name: "desk", online: false }], null);
    expect(gate.phase).toBe("pick");
  });

  it("reads ?onboarding=1 as a request to run setup again", () => {
    expect(forceOnboarding("?onboarding=1")).toBe(true);
    expect(forceOnboarding("onboarding=1&tab=keys")).toBe(true);
    expect(forceOnboarding("?onboarding=0")).toBe(false);
    expect(forceOnboarding("")).toBe(false);
  });
});

describe("model already configured by setup", () => {
  const agents = [
    { key: "claude-acp:sonnet", label: "Claude Sonnet", ready: true },
    { key: "openrouter:", label: "OpenRouter", picker: true },
    { key: "ollama:", label: "Ollama", ready: false },
  ];

  it("prefers the saved model and ignores a picker sentinel", () => {
    const saved = describeModel("claude-acp:sonnet", {
      default_agent: "ollama:",
      agents,
    });
    expect(saved).toEqual({ key: "claude-acp:sonnet", label: "Claude Sonnet", ready: true });
    expect(modelAlreadyReady(saved)).toBe(true);
    expect(modelStepMode(saved?.ready)).toBe("confirm");
    expect(modelStepMode(false)).toBe("choose");
    expect(modelStepMode(null)).toBe("choose");
    expect(describeModel(null, { default_agent: "openrouter:", agents })).toBeNull();
    expect(describeModel(null, { default_agent: "custom:" })).toBeNull();
  });

  it("reports a model that still needs a login, and nothing when none is set", () => {
    const blocked = describeModel(null, { default_agent: "ollama:", agents });
    expect(blocked?.ready).toBe(false);
    expect(modelAlreadyReady(blocked)).toBe(false);
    expect(describeModel(null, undefined)).toBeNull();
    expect(describeModel("claude-code", undefined)).toEqual({
      key: "claude-code",
      label: "claude-code",
      ready: null,
    });
  });
});

describe("preference patches", () => {
  const current: UserPreferences = {
    agent: { active_agent_key: "claude-acp:sonnet", chat_binding: { condor: "keep" } },
    onboarding: { version: 1, detected: { server: "desk" }, skipped: ["model"] },
    profile: { display_name: "Ada" },
    ui: { theme: "dark", dashboard_title: "Desk" },
  };

  it("sets the model on a full copy of agent, keeping the other fields", () => {
    const updates = withActiveAgentKey(current, "claude-acp:haiku");
    expect(updates.agent).toEqual({
      active_agent_key: "claude-acp:haiku",
      chat_binding: { condor: "keep" },
    });
  });

  it("writes only the top-level keys it was given, and never agent", () => {
    const updates = buildPreferenceUpdates(current, {
      profile: { display_name: "Grace" },
    });
    expect(Object.keys(updates)).toEqual(["profile"]);
    expect(updates.profile).toEqual({ display_name: "Grace" });
    expect(updates).not.toHaveProperty("agent");
  });

  it("merges onboarding so a step save keeps what was already detected", () => {
    const updates = buildPreferenceUpdates(current, {
      onboarding: { last_step: "done" },
    });
    expect(updates.onboarding).toEqual({
      version: 1,
      detected: { server: "desk" },
      skipped: ["model"],
      last_step: "done",
    });
  });

  it("replaces onboarding when setup is run again, dropping completed_at", () => {
    const stored = {
      ...current,
      onboarding: { ...current.onboarding!, completed_at: "2026-01-01T00:00:00.000Z", auto: true },
    };
    const updates = buildPreferenceUpdates(
      stored,
      { onboarding: restartedOnboarding(stored.onboarding) },
      true,
    );
    const onboarding = updates.onboarding as { completed_at?: string; auto?: boolean; last_step?: string };
    expect(onboarding.completed_at).toBeUndefined();
    expect(onboarding.auto).toBeUndefined();
    expect(onboarding.last_step).toBe("check");
    expect(onboarding).not.toHaveProperty("agent");
  });

  it("clears a blank dashboard title without dropping the rest of ui", () => {
    const updates = buildPreferenceUpdates(current, { ui: { dashboard_title: "  " } });
    expect(updates.ui).toEqual({ theme: "dark" });
  });

  it("stores at most 40 characters of a dashboard title", () => {
    const updates = buildPreferenceUpdates(current, { ui: { dashboard_title: "B".repeat(80) } });
    expect(updates.ui).toEqual({ theme: "dark", dashboard_title: "B".repeat(40) });
  });

  it("drops a blank display name instead of storing it", () => {
    const updates = buildPreferenceUpdates(current, { profile: { display_name: " " } });
    expect(updates.profile).toEqual({});
  });
});

describe("readiness check", () => {
  const ready: Readiness = {
    server: { name: "local", online: true },
    model: { key: "claude-acp:sonnet", label: "Claude (ACP) - Sonnet", ready: true },
    modelStatus: "loaded",
    keys: "some",
    gateway: "off",
  };
  const ids = (r: Readiness) => planStepIds(r);
  const status = (r: Readiness, id: string) => readinessRows(r).find((row) => row.id === id)?.status;

  it("asks only for the name and preferences when setup did everything", () => {
    expect(ids(ready)).toEqual(["check", "profile", "look", "done"]);
  });

  it("adds the model step only when the model is not ready", () => {
    const notReady = { ...ready, model: { ...ready.model!, ready: false } };
    expect(ids(notReady)).toContain("model");
    expect(ids({ ...ready, model: null })).toContain("model");
    expect(ids({ ...ready, model: { ...ready.model!, ready: null } })).toContain("model");
    expect(ids(ready)).not.toContain("model");
  });

  it("adds the exchange step only when there is no key or wallet", () => {
    expect(ids({ ...ready, keys: "none" })).toContain("connect");
    expect(ids({ ...ready, keys: "some" })).not.toContain("connect");
  });

  it("never treats a failed or unfinished read as missing", () => {
    expect(ids({ ...ready, keys: "error" })).not.toContain("connect");
    expect(ids({ ...ready, keys: "loading" })).not.toContain("connect");
    expect(ids({ ...ready, modelStatus: "error", model: null })).not.toContain("model");
    expect(ids({ ...ready, modelStatus: "loading", model: null })).not.toContain("model");
    expect(status({ ...ready, keys: "error" }, "keys")).toBe("unknown");
    expect(status({ ...ready, modelStatus: "error" }, "model")).toBe("unknown");
    expect(status({ ...ready, keys: "loading" }, "keys")).toBe("pending");
    expect(status({ ...ready, modelStatus: "loading" }, "model")).toBe("pending");
  });

  it("keeps the order of the full flow whatever is missing", () => {
    const everything: Readiness = { ...ready, model: null, keys: "none" };
    expect(ids(everything)).toEqual(["check", "profile", "model", "connect", "look", "done"]);
    expect(stepsForPlan(ids(everything)).map((step) => step.id)).toEqual(ids(everything));
    expect(stepsForPlan(["check", "nope", "done"]).map((step) => step.id)).toEqual(["check", "done"]);
  });

  it("marks each row ready, needs you, or optional", () => {
    expect(readinessRows(ready).map((row) => row.status)).toEqual(["ok", "ok", "ok", "optional"]);
    const bare: Readiness = {
      server: { name: "local", online: false },
      model: null,
      modelStatus: "loaded",
      keys: "none",
      gateway: "running",
    };
    expect(readinessRows(bare).map((row) => row.status)).toEqual(["todo", "todo", "todo", "ok"]);
    expect(status({ ...ready, server: null }, "server")).toBe("todo");
  });

  it("waits for the model list and the key check before it lets the user continue", () => {
    expect(readinessLoading(ready)).toBe(false);
    expect(readinessLoading({ ...ready, keys: "loading" })).toBe(true);
    expect(readinessLoading({ ...ready, modelStatus: "loading" })).toBe(true);
    expect(readinessLoading({ ...ready, keys: "error", modelStatus: "error" })).toBe(false);
  });
});

describe("model step detection", () => {
  const rows = [
    { key: "claude-code", label: "Claude Code", ready: true, detail: "installed and logged in" },
    { key: "gemini", label: "Gemini CLI", ready: false, detail: "not installed" },
    { key: "ollama:", label: "Ollama", ready: undefined },
    { key: "openrouter:", label: "OpenRouter", ready: true, picker: true },
  ];

  it("lists only what this machine can run as found", () => {
    const { found, other } = splitModelOptions(rows);
    expect(found.map((row) => row.key)).toEqual(["claude-code"]);
    expect(other.map((row) => row.key)).toEqual(["gemini", "ollama:", "openrouter:"]);
  });

  it("never calls an unprobed row or a picker found", () => {
    expect(splitModelOptions([rows[2], rows[3]]).found).toEqual([]);
    expect(splitModelOptions([]).found).toEqual([]);
  });
});

describe("model step rows", () => {
  it("names the recommended model on the primary button, else the first found", () => {
    const found = [{ key: "codex" }, { key: "claude-acp:sonnet" }, { key: "gemini" }];
    expect(preferredModel(found)?.key).toBe("claude-acp:sonnet");
    expect(preferredModel(found.slice(2))?.key).toBe("gemini");
    expect(preferredModel([])).toBeNull();
  });

  it("shows one row per provider that is not found, with what to run", () => {
    const rows = groupMissingModels([
      { key: "claude-code", label: "Claude Code", ready: false, detail: "not installed" },
      { key: "claude-acp:opus", label: "Claude (ACP) — Opus", ready: false, detail: "not installed — npm i" },
      { key: "claude-acp:sonnet", label: "Claude (ACP) — Sonnet", ready: false, detail: "not installed — npm i" },
      { key: "codex", label: "ChatGPT Codex", ready: true, detail: "installed and logged in" },
      { key: "ollama:", label: "Ollama", detail: undefined },
      { key: "openrouter:", label: "OpenRouter", ready: false, picker: true },
    ]);
    expect(rows.map((row) => row.label)).toEqual(["Claude Code", "Claude (ACP)", "Ollama"]);
    expect(rows[1].detail).toBe("not installed — npm i");
    expect(rows[2].detail).toBe("Could not be checked from here.");
  });
});

describe("detected means proven ready", () => {
  it("uses state when the backend sends it", () => {
    expect(isDetected({ state: "ready", ready: true })).toBe(true);
    expect(isDetected({ state: "unverified", ready: true })).toBe(false);
    expect(isDetected({ state: "missing", ready: false })).toBe(false);
  });

  it("falls back to ready when state is absent", () => {
    expect(isDetected({ ready: true })).toBe(true);
    expect(isDetected({ ready: false })).toBe(false);
    expect(isDetected({})).toBe(false);
  });

  it("never calls a picker detected", () => {
    expect(isDetected({ state: "ready", ready: true, picker: true })).toBe(false);
  });

  it("keeps an unproven login out of found and preselect, and gives it a Connect row", () => {
    const rows = [
      { key: "gemini", label: "Gemini CLI", ready: true, state: "unverified" as const, detail: "installed; run `npx @google/gemini-cli` once and log in" },
      { key: "codex", label: "ChatGPT Codex", ready: true, state: "ready" as const, detail: "installed and logged in" },
      { key: "copilot", label: "GitHub Copilot CLI", ready: false, state: "missing" as const, detail: "not installed" },
    ];
    const { found } = splitModelOptions(rows);
    expect(found.map((row) => row.key)).toEqual(["codex"]);
    expect(preferredModel(found)?.key).toBe("codex");
    const missing = groupMissingModels(rows);
    expect(missing.map((row) => row.key)).toEqual(["gemini", "copilot"]);
    expect(missing[0].detail).toContain("log in");
  });
});
