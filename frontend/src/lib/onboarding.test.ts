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
  isTradingSurface,
  jumpTo,
  markAnswered,
  markSkipped,
  modelAlreadyReady,
  onboardingPending,
  prefillName,
  resolveServerGate,
  restartedOnboarding,
  resumeIndex,
  retreat,
  shouldAutoComplete,
  shouldShowKeysBanner,
  shouldShowWizard,
  startFlow,
  validateDisplayName,
  type OnboardingSignals,
  type UserPreferences,
} from "./onboarding";

function signals(over: Partial<OnboardingSignals> = {}): OnboardingSignals {
  return {
    prefsReady: true,
    prefsError: false,
    completed: false,
    force: false,
    keysReady: true,
    keysError: false,
    hasKeys: false,
    activityReady: true,
    hasActivity: false,
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

  it("does not open the wizard when preferences cannot be read", () => {
    const outage = signals({ prefsError: true, prefsReady: false });
    expect(shouldShowWizard(outage)).toBe(false);
    expect(shouldAutoComplete(outage)).toBe(false);
    expect(onboardingPending(outage)).toBe(false);
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
    expect(resumeIndex(steps, "connect")).toBe(2);
    expect(startFlow(steps, "connect").furthest).toBe(2);
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
    expect(state.index).toBe(3);
    expect(state.skipped).toEqual(["model"]);
  });

  it("ships profile and done in this build, with done last in the full list", () => {
    expect(installedStepDefs().map((step) => step.id)).toEqual(["profile", "done"]);
    expect(STEP_DEFS.map((step) => step.id)).toEqual([
      "profile",
      "model",
      "connect",
      "look",
      "alerts",
      "done",
    ]);
    expect(STEP_DEFS.filter((step) => step.skippable).map((step) => step.id)).toEqual([
      "model",
      "connect",
      "look",
      "alerts",
    ]);
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

  it("keeps the dashboard title at Condor until one is saved", () => {
    expect(dashboardTitleFrom(undefined)).toBe("Condor");
    expect(dashboardTitleFrom({ ui: { dashboard_title: "Ada's Desk" } })).toBe("Ada's Desk");
    expect(dashboardTitleFrom({ ui: { dashboard_title: "  " } })).toBe("Condor");
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
    expect(onboarding.last_step).toBe("profile");
    expect(onboarding).not.toHaveProperty("agent");
  });

  it("clears a blank dashboard title without dropping the rest of ui", () => {
    const updates = buildPreferenceUpdates(current, { ui: { dashboard_title: "  " } });
    expect(updates.ui).toEqual({ theme: "dark" });
  });

  it("drops a blank display name instead of storing it", () => {
    const updates = buildPreferenceUpdates(current, { profile: { display_name: " " } });
    expect(updates.profile).toEqual({});
  });
});
