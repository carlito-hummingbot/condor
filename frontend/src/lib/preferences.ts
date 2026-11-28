/**
 * The slice of `GET /api/v1/auth/preferences` the shell reads.
 *
 * Onboarding (PR #2) owns the full map in `lib/onboarding.ts` (`profile`,
 * `ui`, `onboarding`, and the `agent` key a patch must never send partial).
 * This is the same wire object. On merge, keep that type and point
 * `api.getPreferences` at it; the fields below are the ones the rail needs.
 */
export interface UserPreferences {
  profile?: { display_name?: string };
  ui?: { dashboard_title?: string };
  [key: string]: unknown;
}
