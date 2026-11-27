/**
 * The slice of `GET /api/v1/auth/preferences` the shell reads and writes.
 *
 * Onboarding (PR #2) owns the full map in `lib/onboarding.ts` (`profile`,
 * `ui`, `onboarding`, and the `agent` key a patch must never send partial).
 * This is the same wire object, and everything below that is not a type
 * (`DASHBOARD_TITLE_MAX`, `DISPLAY_NAME_MAX`, `clampDashboardTitle`,
 * `validateDisplayName`, `buildPreferenceUpdates`) is a copy of the function of
 * the same name there, so the wizard and the Account dialog edit the same
 * data the same way. On merge, delete this file, keep the onboarding one and
 * point `api.getPreferences` at it.
 */
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
  profile?: ProfileRecord;
  ui?: UiRecord;
  [key: string]: unknown;
}

export interface PreferencePatch {
  profile?: Partial<ProfileRecord>;
  ui?: Partial<UiRecord>;
}

/** Long enough for a desk name, short enough that the title still fits where it is shown. */
export const DASHBOARD_TITLE_MAX = 40;

/** Hard cap so a pasted paragraph cannot become the name on the dashboard. */
export const DISPLAY_NAME_MAX = 80;

export function clampDashboardTitle(title: string): string {
  return title.trim().slice(0, DASHBOARD_TITLE_MAX);
}

export function validateDisplayName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Tell us what to call you.";
  if (trimmed.length > DISPLAY_NAME_MAX) return `Keep it under ${DISPLAY_NAME_MAX} characters.`;
  return null;
}

/**
 * The body of `PATCH /api/v1/auth/preferences`: whole top-level keys, built
 * from the current map so a title change cannot drop `theme`. The server merge
 * is shallow, so each key goes out complete.
 */
export function buildPreferenceUpdates(
  current: UserPreferences,
  patch: PreferencePatch,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
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
