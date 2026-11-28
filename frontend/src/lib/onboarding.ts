/**
 * First-run wizard: when it opens, how a step moves, and what gets saved.
 *
 * Preferences live in `config.yml` under the signed-in user. The PATCH is a
 * shallow merge of top-level keys, so this module only ever builds
 * `onboarding`, `profile` and `ui` — never a partial `agent` object, which
 * would wipe `active_agent_key` and the chat bindings that sit beside it.
 */

export const ONBOARDING_VERSION = 1;

export const DEFAULT_DASHBOARD_TITLE = "Condor";

/** Long enough for a desk name, short enough that the top bar can still show the nav. */
export const DASHBOARD_TITLE_MAX = 40;

/** Hard cap so a pasted paragraph cannot become the top-bar label. */
export const DISPLAY_NAME_MAX = 80;

/**
 * Name field default when this user has not saved one. Valid on its own, so
 * Next works without typing. Not the Local-mode first name, which is "Local".
 */
export const DEFAULT_DISPLAY_NAME = "Algo Trader";

export interface OnboardingDetected {
  server?: string;
  server_online?: boolean;
  model_key?: string;
  model_label?: string;
  /** `null` when the catalogue had not been read yet. */
  model_ready?: boolean | null;
}

export interface OnboardingRecord {
  version: number;
  completed_at?: string;
  /** The user left the whole wizard. Distinct from skipping one step. */
  skipped_all?: boolean;
  /** Set when an install that was already in use was closed out quietly. */
  auto?: boolean;
  skipped?: string[];
  last_step?: string;
  detected?: OnboardingDetected;
}

export interface ProfileRecord {
  display_name?: string;
}

export interface UiRecord {
  dashboard_title?: string;
  theme?: "light" | "dark";
  colorblind?: boolean;
  currency?: string;
}

export interface UserPreferences {
  onboarding?: OnboardingRecord;
  profile?: ProfileRecord;
  ui?: UiRecord;
  /** Present on the wire. Callers must not PATCH a partial copy of it. */
  agent?: unknown;
  [key: string]: unknown;
}

export interface PreferencePatch {
  onboarding?: Partial<OnboardingRecord>;
  profile?: Partial<ProfileRecord>;
  ui?: Partial<UiRecord>;
}

/**
 * Every step the wizard can show, in order. A run shows only the ones that
 * `planStepIds` keeps: "check" opens it, and "model" and "connect" appear only
 * when the install still needs them. A build may render only some of the work
 * (`INSTALLED_STEP_IDS`); later steps stay in this list so the order cannot
 * drift when they land.
 */
export const STEP_DEFS = [
  { id: "check", title: "Your setup", skippable: false },
  { id: "profile", title: "Make it yours", skippable: false },
  { id: "model", title: "AI model", skippable: true },
  { id: "connect", title: "Connect where you trade", skippable: true },
  { id: "look", title: "Look & units", skippable: true },
  { id: "done", title: "You're set", skippable: false },
] as const;

export type StepId = (typeof STEP_DEFS)[number]["id"];

export interface StepDef {
  id: string;
  title: string;
  skippable: boolean;
}

/**
 * Steps this build actually renders. `done` stays last. Insert a new id here
 * when its screen ships; the order always follows `STEP_DEFS`.
 */
export const INSTALLED_STEP_IDS = [
  "check",
  "profile",
  "model",
  "connect",
  "look",
  "done",
] as const;

/** What the readiness check could read from this install. */
export interface Readiness {
  server: { name: string; online: boolean } | null;
  /** The model Condor will use, or null when none is chosen. */
  model: DetectedModel | null;
  /** Whether the model catalogue has been read. */
  modelStatus: "loading" | "error" | "loaded";
  /** Exchange keys or a Gateway wallet. "error" is an outage, not "none". */
  keys: "loading" | "error" | "none" | "some";
  /** Gateway only matters for DEX trading, so it is never a required step. */
  gateway: "loading" | "unknown" | "running" | "off";
}

/** "pending" is a read still in flight; "unknown" is one that failed. Neither is "missing". */
export type ReadinessStatus = "ok" | "todo" | "optional" | "pending" | "unknown";

export interface ReadinessRow {
  id: "server" | "model" | "keys" | "gateway";
  label: string;
  status: ReadinessStatus;
  detail: string;
}

/**
 * One row per thing setup may or may not have done, read from the install.
 * "ok" is done, "todo" needs the user, "optional" can wait, and "unknown"
 * means a read has not finished or failed, which is never reported as missing.
 */
export function readinessRows(r: Readiness): ReadinessRow[] {
  const server: ReadinessRow = !r.server
    ? { id: "server", label: "Server", status: "todo", detail: "No Hummingbot API server is configured." }
    : r.server.online
      ? { id: "server", label: "Server", status: "ok", detail: `Connected to ${r.server.name}.` }
      : {
          id: "server",
          label: "Server",
          status: "todo",
          detail: `${r.server.name} is configured but not responding. It may still be starting.`,
        };

  let model: ReadinessRow;
  if (r.modelStatus === "loading") {
    model = { id: "model", label: "AI model", status: "pending", detail: "Checking…" };
  } else if (r.modelStatus === "error") {
    model = { id: "model", label: "AI model", status: "unknown", detail: "Could not check the model list." };
  } else if (!r.model) {
    model = { id: "model", label: "AI model", status: "todo", detail: "No model is chosen. The chat cannot answer yet." };
  } else if (r.model.ready === true) {
    model = { id: "model", label: "AI model", status: "ok", detail: `${r.model.label} is ready.` };
  } else if (r.model.ready === false) {
    model = {
      id: "model",
      label: "AI model",
      status: "todo",
      detail: `${r.model.label} still needs a login or install on this machine.`,
    };
  } else {
    model = { id: "model", label: "AI model", status: "todo", detail: `${r.model.label} is chosen but not confirmed ready.` };
  }

  const keys: ReadinessRow =
    r.keys === "some"
      ? { id: "keys", label: "Exchange or wallet", status: "ok", detail: "A key or wallet is connected." }
      : r.keys === "none"
        ? {
            id: "keys",
            label: "Exchange or wallet",
            status: "todo",
            detail: "None yet. Portfolio and trading stay locked until you add one.",
          }
        : r.keys === "error"
          ? { id: "keys", label: "Exchange or wallet", status: "unknown", detail: "Could not check. Settings, Keys & Wallets has it." }
          : { id: "keys", label: "Exchange or wallet", status: "pending", detail: "Checking…" };

  const gateway: ReadinessRow =
    r.gateway === "running"
      ? { id: "gateway", label: "DEX Gateway", status: "ok", detail: "Running." }
      : r.gateway === "off"
        ? { id: "gateway", label: "DEX Gateway", status: "optional", detail: "Not set up. Only needed for DEX trading." }
        : { id: "gateway", label: "DEX Gateway", status: "optional", detail: "Not checked." };

  return [server, model, keys, gateway];
}

/** True while any row is still being read. The summary waits instead of guessing. */
export function readinessLoading(r: Readiness): boolean {
  return r.modelStatus === "loading" || r.keys === "loading";
}

/**
 * The steps this run shows, by id. Name and look are preferences with
 * no way to detect them, so they always appear. The model and the exchange step
 * appear only when the install still needs them; a read that failed is left
 * out rather than guessed, because the user can still reach both in Settings.
 */
export function planStepIds(r: Readiness): StepId[] {
  const ids: StepId[] = ["check", "profile"];
  if (r.modelStatus === "loaded" && r.model?.ready !== true) ids.push("model");
  if (r.keys === "none") ids.push("connect");
  ids.push("look", "done");
  return ids;
}

/** The step defs for a plan, in plan order. Unknown ids are dropped. */
export function stepsForPlan(ids: readonly string[]): StepDef[] {
  const installed = new Set<string>(INSTALLED_STEP_IDS);
  return ids
    .map((id) => STEP_DEFS.find((step) => step.id === id))
    .filter((step): step is (typeof STEP_DEFS)[number] => !!step && installed.has(step.id));
}

/**
 * Apply a saved appearance only where this browser has not chosen one.
 * A later change in Settings or the top bar lives in localStorage and must
 * survive the next reload.
 */
export function savedAppearanceToApply(input: {
  storedTheme: string | null;
  storedColorblind: string | null;
  storedCurrency: string | null;
  theme?: "dark" | "light";
  colorblind?: boolean;
  currency?: string;
}): { theme?: "dark" | "light"; colorblind?: boolean; currency?: string } {
  const out: { theme?: "dark" | "light"; colorblind?: boolean; currency?: string } = {};
  const themeUnset =
    input.storedTheme !== "dark" && input.storedTheme !== "light" && input.storedTheme !== "colorblind";
  if (themeUnset && (input.theme === "dark" || input.theme === "light")) out.theme = input.theme;
  if (input.storedColorblind === null && input.colorblind === true) out.colorblind = true;
  if (!input.storedCurrency && input.currency) out.currency = input.currency;
  return out;
}

export function installedStepDefs(): StepDef[] {
  const installed = new Set<string>(INSTALLED_STEP_IDS);
  return STEP_DEFS.filter((step) => installed.has(step.id));
}

export interface FlowState {
  index: number;
  /** Highest index the user has already reached. Dots at or below it are done. */
  furthest: number;
  skipped: string[];
}

export function resumeIndex(steps: readonly { id: string }[], lastStep: string | undefined): number {
  if (!lastStep) return 0;
  const index = steps.findIndex((step) => step.id === lastStep);
  return index < 0 ? 0 : index;
}

export function startFlow(
  steps: readonly { id: string }[],
  lastStep?: string,
  skipped: readonly string[] = [],
): FlowState {
  const index = resumeIndex(steps, lastStep);
  const known = new Set(steps.map((step) => step.id));
  return {
    index,
    furthest: index,
    skipped: skipped.filter((id) => known.has(id)),
  };
}

export function advance(state: FlowState, stepCount: number): FlowState {
  if (stepCount <= 0) return state;
  const index = Math.min(state.index + 1, stepCount - 1);
  return { ...state, index, furthest: Math.max(state.furthest, index) };
}

export function retreat(state: FlowState): FlowState {
  return { ...state, index: Math.max(0, state.index - 1) };
}

/** A dot is clickable once that step has been reached, and it is not the current one. */
export function canJumpTo(index: number, target: number, furthest: number): boolean {
  return target >= 0 && target <= furthest && target !== index;
}

export function jumpTo(state: FlowState, target: number): FlowState | null {
  if (!canJumpTo(state.index, target, state.furthest)) return null;
  return { ...state, index: target };
}

/** Skipping a required step is refused. The caller advances after a successful mark. */
export function markSkipped(state: FlowState, stepId: string, skippable: boolean): FlowState | null {
  if (!skippable) return null;
  if (state.skipped.includes(stepId)) return state;
  return { ...state, skipped: [...state.skipped, stepId] };
}

export function markAnswered(state: FlowState, stepId: string): FlowState {
  if (!state.skipped.includes(stepId)) return state;
  return { ...state, skipped: state.skipped.filter((id) => id !== stepId) };
}

export interface OnboardingSignals {
  prefsReady: boolean;
  prefsError: boolean;
  completed: boolean;
  /**
   * The raw `completed_at`, not just "is it set". A run that is opened again on
   * a finished install must tell the completion it started with apart from the
   * one its own Finish writes, so it knows when to close.
   */
  completedAt?: string | null;
  /** `?onboarding=1` — Settings asked to run setup again. */
  force: boolean;
  keysReady: boolean;
  keysError: boolean;
  /**
   * Exchange credentials or any Gateway wallet (`useCredentials().hasKeys`).
   * Either one means this install is already past first run.
   */
  hasKeys: boolean;
  activityReady: boolean;
  /** A conversation or a bot: the dashboard has already been used. */
  hasActivity: boolean;
  /**
   * The wizard is already on screen. A server the user just picked can make
   * the credentials probe load, then fail, and that must not dismiss setup.
   */
  wizardEngaged?: boolean;
  /** `completedAt` at the moment the wizard opened. See `finishedThisRun`. */
  engagedCompletedAt?: string | null;
}

export function isOnboardingComplete(prefs: UserPreferences | undefined): boolean {
  const at = prefs?.onboarding?.completed_at;
  return typeof at === "string" && at.length > 0;
}

export function isExistingUser(signals: Pick<OnboardingSignals, "hasKeys" | "hasActivity">): boolean {
  return signals.hasKeys || signals.hasActivity;
}

/**
 * True once the run on screen has written its own completion — Finish, Skip
 * setup, or a fresh completion from another tab. A completion that was already
 * there when the wizard opened (a re-run) is not one, or setup would shut
 * itself the moment it started.
 */
export function finishedThisRun(
  s: Pick<OnboardingSignals, "wizardEngaged" | "completedAt" | "engagedCompletedAt">,
): boolean {
  if (!s.wizardEngaged) return false;
  return (s.completedAt || null) !== (s.engagedCompletedAt || null);
}

/**
 * Show the wizard for a signed-in user who has not finished it and has nothing
 * on the install yet. Existing users are marked complete instead, unless they
 * asked to run setup again.
 *
 * A wizard that is already on screen outranks every "this install is past first
 * run" answer: saving an exchange key in the Connect step, or a credentials
 * probe the server just picked breaks, must not close setup under the user.
 * Only its own Finish or Skip does that (see `finishedThisRun`).
 */
export function shouldShowWizard(s: OnboardingSignals): boolean {
  if (!s.prefsReady || s.prefsError) return false;
  if (s.force) return true;
  if (s.wizardEngaged) return !finishedThisRun(s);
  if (s.completed || s.hasKeys) return false;
  if (!s.keysReady || s.keysError) return false;
  if (!s.activityReady || s.hasActivity) return false;
  return true;
}

/**
 * Quietly write `completed_at` for an install that was already in use, so an
 * upgrade never drops a long-time user into the wizard.
 */
export function shouldAutoComplete(s: OnboardingSignals): boolean {
  if (!s.prefsReady || s.prefsError || s.completed || s.force) return false;
  // Setup is on screen: the run in progress decides when it is over. A key
  // saved in Connect is not a reason to write `completed_at` behind it.
  if (s.wizardEngaged) return false;
  if (!s.keysReady || s.keysError) return false;
  if (s.hasKeys) return true;
  if (!s.activityReady) return false;
  return s.hasActivity;
}

/**
 * True while the shell must not choose yet — neither the wizard nor the
 * keys reminder — because a preference or credential answer is still out.
 */
export function onboardingPending(s: OnboardingSignals): boolean {
  if (s.prefsError) return false;
  if (!s.prefsReady) return true;
  if (s.force || s.completed) return false;
  if (!s.keysReady) return true;
  if (s.keysError || s.hasKeys) return false;
  return !s.activityReady;
}

export function shouldShowKeysBanner(input: {
  showWizard: boolean;
  pending: boolean;
  hasKeys: boolean;
  keysReady: boolean;
  keysError: boolean;
  hasServer: boolean;
  trading: boolean;
}): boolean {
  if (input.showWizard || input.pending) return false;
  if (!input.trading || !input.hasServer || !input.keysReady || input.keysError || input.hasKeys) {
    return false;
  }
  return true;
}

/**
 * Pages the old blocking overlay covered. Home, routines, settings and the
 * Hub stay clear; everything else is a trading surface for the reminder.
 */
export function isTradingSurface(pathname: string): boolean {
  if (pathname === "/" || pathname === "/chat") return false;
  return !["/routines", "/settings", "/hub"].some((route) => pathname.startsWith(route));
}

export function forceOnboarding(search: string): boolean {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get("onboarding") === "1";
}

/**
 * Where the wizard hands back to when the user finishes or skips a run that was
 * opened on purpose: the page that opened it (router state `from`, or
 * `?from=`), and the Dashboard otherwise.
 *
 * Only a same-app path is accepted, so this can never be turned into a redirect
 * somewhere else; the wizard's own entry points fall back to the Dashboard.
 */
export function setupReturnPath(state: unknown, search: string): string {
  const fromState =
    state && typeof state === "object" && typeof (state as { from?: unknown }).from === "string"
      ? (state as { from: string }).from
      : null;
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const path = (fromState ?? params.get("from") ?? "").trim();
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  // Never bounce straight back into the forced wizard.
  if (path === "/welcome" || path.startsWith("/welcome?") || path.includes("onboarding=1")) return "/";
  return path;
}

/**
 * What the name field shows before a profile name is saved.
 *
 * A saved `profile.display_name` is applied by the caller and wins. Telegram's
 * first name is a real prefill. Local mode signs in as `first_name: "Local"`,
 * which nobody chose, so that falls through to "Algo Trader" — a name the
 * field will accept, so Next is available without typing.
 */
export function prefillName(
  user: { first_name?: string | null; username?: string | null } | null | undefined,
): string {
  const first = user?.first_name?.trim() ?? "";
  if (!first || first.toLowerCase() === "local") return DEFAULT_DISPLAY_NAME;
  return first;
}

export function displayNameFrom(
  prefs: UserPreferences | undefined,
  user: { first_name?: string | null; username?: string | null } | null | undefined,
): string {
  const chosen = prefs?.profile?.display_name?.trim();
  if (chosen) return chosen;
  return prefillName(user);
}

export function clampDashboardTitle(title: string): string {
  return title.trim().slice(0, DASHBOARD_TITLE_MAX);
}

export function dashboardTitleFrom(prefs: UserPreferences | undefined): string {
  const title = clampDashboardTitle(prefs?.ui?.dashboard_title ?? "");
  return title || DEFAULT_DASHBOARD_TITLE;
}

export function validateDisplayName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Tell us what to call you.";
  if (trimmed.length > DISPLAY_NAME_MAX) return `Keep it under ${DISPLAY_NAME_MAX} characters.`;
  return null;
}

export interface ModelOption {
  key: string;
  label: string;
  ready?: boolean;
  picker?: boolean;
}

export interface DetectedModel {
  key: string;
  label: string;
  /** `null` when the row was not in the catalogue, so readiness is unknown. */
  ready: boolean | null;
}

export function readActiveAgentKey(prefs: UserPreferences | undefined): string | null {
  const agent = prefs?.agent;
  if (!agent || typeof agent !== "object") return null;
  const key = (agent as { active_agent_key?: unknown }).active_agent_key;
  return typeof key === "string" && key.trim() ? key.trim() : null;
}

/**
 * What `make setup` already chose, if anything. A picker sentinel
 * (`openrouter:`, `custom:`) is a menu, not a model, so it does not count.
 * An explicit `active_agent_key` wins over the catalogue default.
 */
export function describeModel(
  activeKey: string | null,
  options: { agents?: ModelOption[]; default_agent?: string } | undefined,
): DetectedModel | null {
  const fallback = options?.default_agent?.trim() || null;
  const key = activeKey || fallback;
  if (!key) return null;
  const row = options?.agents?.find((agent) => agent.key === key);
  if (row?.picker) return null;
  if (key.endsWith(":") && !row) return null;
  return {
    key,
    label: row?.label || key,
    // Absent `ready` means the probe did not run; the catalogue still offers it.
    ready: row ? row.ready !== false : null,
  };
}

export function modelAlreadyReady(model: DetectedModel | null): boolean {
  return model?.ready === true;
}

export interface ServerProbe {
  name: string;
  online: boolean;
  is_default?: boolean;
}

export type ServerGate =
  | { phase: "loading" }
  | { phase: "ready"; server: string; online: boolean; adopt: boolean }
  | { phase: "add" }
  | { phase: "pick"; servers: { name: string; online: boolean }[] };

/**
 * The hidden first check. A server `make setup` already created is confirmed,
 * not re-asked. `adopt` means the browser has not selected it yet and should.
 * No server at all, or only offline ones with nothing selected, stays on screen.
 */
export function resolveServerGate(
  servers: readonly ServerProbe[] | undefined,
  selected: string | null,
): ServerGate {
  if (!servers) return { phase: "loading" };
  const current = servers.find((server) => server.name === selected);
  if (current) return { phase: "ready", server: current.name, online: current.online, adopt: false };
  if (servers.length === 0) return { phase: "add" };
  const online = servers.filter((server) => server.online);
  const pick = online.find((server) => server.is_default) ?? online[0];
  if (pick) return { phase: "ready", server: pick.name, online: true, adopt: true };
  return {
    phase: "pick",
    servers: servers.map((server) => ({ name: server.name, online: server.online })),
  };
}

/**
 * Build the PATCH body for the keys this screen owns.
 *
 * `replaceOnboarding` drops `completed_at` and the rest of the stored record
 * (Run setup again). Otherwise the stored record is spread first so a single
 * field write cannot erase `detected` or `skipped`.
 */
/**
 * The full `agent` object with one key changed. A partial `agent` PATCH would
 * wipe `chat_binding` and custom providers, so callers send this whole value.
 */
export function withActiveAgentKey(
  current: UserPreferences,
  agentKey: string,
): { agent: Record<string, unknown> } {
  const existing =
    current.agent && typeof current.agent === "object"
      ? { ...(current.agent as Record<string, unknown>) }
      : {};
  return { agent: { ...existing, active_agent_key: agentKey } };
}

/**
 * Whether the backend proved this model is usable here: installed and logged in
 * (`state: "ready"`). An installed tool whose login cannot be proven is
 * `"unverified"` and is not detected, even though `ready` is true for it. A
 * backend that does not send `state` (older, or the probe failed) falls back to
 * `ready`, which is the looser flag.
 */
export function isDetected(agent: {
  ready?: boolean;
  state?: "ready" | "unverified" | "missing";
  picker?: boolean;
}): boolean {
  if (agent.picker) return false;
  return agent.state !== undefined ? agent.state === "ready" : agent.ready === true;
}

/**
 * Split the model catalogue for the setup screen. "found" is what this machine
 * can run right now and the backend proved it (see `isDetected`). A row the
 * backend could not probe, or could not prove, is not called found. Pickers
 * (OpenRouter, custom) open a list and are never a one-click connection, so they
 * stay in "other".
 */
export function splitModelOptions<
  T extends {
    ready?: boolean;
    state?: "ready" | "unverified" | "missing";
    picker?: boolean;
  },
>(agents: readonly T[]): { found: T[]; other: T[] } {
  const found = agents.filter(isDetected);
  const other = agents.filter((agent) => !found.includes(agent));
  return { found, other };
}

/**
 * The model Condor suggests when several are found, if it is among them. Named
 * `_ID`, not `_KEY`: `sessionState.keys.test.ts` reserves a module constant
 * whose name contains KEY for persisted storage keys, and this is a model id.
 */
export const RECOMMENDED_MODEL_ID = "claude-acp:sonnet";

/** Which found model the primary button names: the recommended one, else the first. */
export function preferredModel<T extends { key: string }>(found: readonly T[]): T | null {
  return found.find((row) => row.key === RECOMMENDED_MODEL_ID) ?? found[0] ?? null;
}

export interface MissingModelRow {
  key: string;
  label: string;
  /** What to run on this machine, or why it could not be checked. */
  detail: string;
}

/**
 * Rows that are not detected, one per provider. Four Claude models that all say
 * "not installed" are one row, named for the provider rather than for the model.
 * An installed tool whose login is unproven is here too, with its own sentence
 * ("run claude once and log in"). A row the backend could not probe says so
 * instead of showing an empty line.
 */
export function groupMissingModels<
  T extends {
    key: string;
    label: string;
    ready?: boolean;
    state?: "ready" | "unverified" | "missing";
    picker?: boolean;
    detail?: string;
  },
>(agents: readonly T[]): MissingModelRow[] {
  const groups = new Map<string, T[]>();
  for (const agent of agents) {
    if (agent.picker || isDetected(agent)) continue;
    const base = agent.key.split(":")[0];
    groups.set(base, [...(groups.get(base) ?? []), agent]);
  }
  return [...groups.values()].map((rows) => {
    const first = rows[0];
    return {
      key: first.key,
      label: rows.length > 1 ? first.label.split(" — ")[0] : first.label,
      detail: rows.find((row) => row.detail)?.detail ?? "Could not be checked from here.",
    };
  });
}

/** A ready model is confirmed. Anything else is a choice. */
export function modelStepMode(ready: boolean | null | undefined): "confirm" | "choose" {
  return ready === true ? "confirm" : "choose";
}

export function buildPreferenceUpdates(
  current: UserPreferences,
  patch: PreferencePatch,
  replaceOnboarding = false,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  if (patch.onboarding) {
    updates.onboarding = replaceOnboarding
      ? { ...patch.onboarding, version: ONBOARDING_VERSION }
      : { ...current.onboarding, ...patch.onboarding, version: ONBOARDING_VERSION };
  }
  if (patch.profile) {
    const profile: ProfileRecord = { ...current.profile, ...patch.profile };
    if (!profile.display_name?.trim()) delete profile.display_name;
    updates.profile = profile;
  }
  if (patch.ui) {
    const ui: UiRecord = { ...current.ui, ...patch.ui };
    if (patch.ui.dashboard_title !== undefined) {
      const title = clampDashboardTitle(patch.ui.dashboard_title);
      if (!title) delete ui.dashboard_title;
      else ui.dashboard_title = title;
    }
    updates.ui = ui;
  }
  return updates;
}

/** A fresh run. Omits `completed_at` on purpose so the merge must replace. */
export function restartedOnboarding(current: OnboardingRecord | undefined): OnboardingRecord {
  const first = installedStepDefs()[0]?.id ?? "profile";
  return {
    version: ONBOARDING_VERSION,
    detected: current?.detected,
    skipped: [],
    last_step: first,
  };
}
