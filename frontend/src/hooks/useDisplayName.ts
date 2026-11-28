import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import {
  buildPreferenceUpdates,
  clampDashboardTitle,
  type PreferencePatch,
  type UserPreferences,
} from "@/lib/preferences";
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
  const title = clampDashboardTitle(prefs?.ui?.dashboard_title ?? "");
  return title || DEFAULT_DASHBOARD_TITLE;
}

export function usePreferences() {
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

/**
 * PATCH `profile` / `ui` as whole top-level keys, the way the wizard does.
 *
 * Same name and argument shape as `usePatchPreferences` in the onboarding PR
 * (`{ patch }`), so the Account dialog and the wizard write identical data. The
 * cached map is read first (fetched if empty: writing from `{}` would replace
 * a key the server already holds), and the response replaces the cache, so the
 * avatar initial, the greeting and the Dashboard title update at once.
 */
export function usePatchPreferences() {
  const qc = useQueryClient();
  const key = preferencesQuery().queryKey;
  return useMutation({
    mutationFn: async (args: { patch: PreferencePatch }) => {
      const current = qc.getQueryData<UserPreferences>(key) ?? (await api.getPreferences());
      return api.updatePreferences(buildPreferenceUpdates(current, args.patch));
    },
    onSuccess: (next) => {
      qc.setQueryData(key, next);
    },
  });
}
