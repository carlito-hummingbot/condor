/**
 * What the rail and the phone bar read: the avatar's name and initials, and
 * the logo's title.
 *
 * The preference plumbing (type, query, `displayNameFrom`, `dashboardTitleFrom`)
 * belongs to onboarding (`lib/onboarding.ts`, `hooks/useUserPreferences.ts`).
 * The rail used its own copy until the two stacks met; this file now only
 * re-exports those and keeps `initialsFrom`, which is a rail concern.
 */
export { DEFAULT_DASHBOARD_TITLE, DEFAULT_DISPLAY_NAME, dashboardTitleFrom, displayNameFrom } from "@/lib/onboarding";
export { useDashboardTitle, useDisplayName } from "@/hooks/useUserPreferences";

/** First letters of the first two words, uppercased. "?" when there is nothing. */
export function initialsFrom(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}
