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
 * The six dots of the finished wizard, in order. A build may render only a
 * prefix of the work (`INSTALLED_STEP_IDS`); later steps stay in this list so
 * the order cannot drift when they land.
 */
export const STEP_DEFS = [
  { id: "profile", title: "Make it yours", skippable: false },
  { id: "model", title: "AI model", skippable: true },
  { id: "connect", title: "Connect where you trade", skippable: true },
  { id: "look", title: "Look & units", skippable: true },
  { id: "alerts", title: "Stay in the loop", skippable: true },
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
export const INSTALLED_STEP_IDS = ["profile", "done"] as const;

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
}

export function isOnboardingComplete(prefs: UserPreferences | undefined): boolean {
  const at = prefs?.onboarding?.completed_at;
  return typeof at === "string" && at.length > 0;
}

export function isExistingUser(signals: Pick<OnboardingSignals, "hasKeys" | "hasActivity">): boolean {
  return signals.hasKeys || signals.hasActivity;
}

/**
 * Show the wizard for a signed-in user who has not finished it and has nothing
 * on the install yet. Existing users are marked complete instead, unless they
 * asked to run setup again.
 */
export function shouldShowWizard(s: OnboardingSignals): boolean {
  if (!s.prefsReady || s.prefsError) return false;
  if (s.force) return true;
  if (s.completed || !s.keysReady || s.keysError || s.hasKeys) return false;
  if (!s.activityReady || s.hasActivity) return false;
  return true;
}

/**
 * Quietly write `completed_at` for an install that was already in use, so an
 * upgrade never drops a long-time user into the wizard.
 */
export function shouldAutoComplete(s: OnboardingSignals): boolean {
  if (!s.prefsReady || s.prefsError || s.completed || s.force) return false;
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
  if (pathname === "/") return false;
  return !["/routines", "/settings", "/hub"].some((route) => pathname.startsWith(route));
}

export function forceOnboarding(search: string): boolean {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get("onboarding") === "1";
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

export function dashboardTitleFrom(prefs: UserPreferences | undefined): string {
  const title = prefs?.ui?.dashboard_title?.trim();
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
    if (patch.ui.dashboard_title !== undefined && !patch.ui.dashboard_title.trim()) {
      delete ui.dashboard_title;
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
