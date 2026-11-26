import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import type { UserPreferences } from "@/lib/preferences";
import { preferencesQuery } from "@/lib/queryClient";

/**
 * What the name field offers when this user has not saved one.
 *
 * The same default the onboarding wizard prefills (PR #2). Local mode signs
 * in as `first_name: "Local"`, which nobody chose, so that is not a name.
 */
export const DEFAULT_DISPLAY_NAME = "Algo Trader";

export const DEFAULT_DASHBOARD_TITLE = "Condor";

/**
 * Saved `profile.display_name`, else a real first name, else "Algo Trader".
 *
 * Matches `displayNameFrom` in the onboarding PR. On merge, call that
 * function from here and delete this copy so the two cannot drift.
 */
export function displayNameFrom(
  prefs: UserPreferences | undefined,
  user: { first_name?: string | null; username?: string | null } | null | undefined,
): string {
  const chosen = prefs?.profile?.display_name?.trim();
  if (chosen) return chosen;
  const first = user?.first_name?.trim() ?? "";
  if (!first || first.toLowerCase() === "local") return DEFAULT_DISPLAY_NAME;
  return first;
}

/** First letters of the first two words, uppercased. "?" when there is nothing. */
export function initialsFrom(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

/** `ui.dashboard_title`, or "Condor". The rail has no text title, so this is the logo's tooltip. */
export function dashboardTitleFrom(prefs: UserPreferences | undefined): string {
  const title = prefs?.ui?.dashboard_title?.trim();
  return title || DEFAULT_DASHBOARD_TITLE;
}

function usePreferences() {
  const { token } = useAuth();
  return useQuery({
    ...preferencesQuery(),
    queryFn: () => api.getPreferences(),
    enabled: !!token,
  });
}

/** The name on the avatar. Reads `profile.display_name`, the same preference the wizard writes. */
export function useDisplayName(): string {
  const { user } = useAuth();
  const { data } = usePreferences();
  return displayNameFrom(data, user);
}

/** Logo tooltip. Does not set `document.title` — the wizard owns that once it lands. */
export function useDashboardTitle(): string {
  const { data } = usePreferences();
  return dashboardTitleFrom(data);
}
