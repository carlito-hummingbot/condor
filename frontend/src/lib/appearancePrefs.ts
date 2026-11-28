import { api } from "@/lib/api";
import { buildPreferenceUpdates, type UiRecord, type UserPreferences } from "@/lib/onboarding";
import { preferencesQuery, queryClient } from "@/lib/queryClient";

/**
 * Write a theme, colour-blind or currency change into the same preferences the
 * wizard saved. Skips the request when the cache already matches, and when
 * preferences have not loaded yet — a missing cache must not invent a patch.
 */
export function persistAppearance(partial: Partial<UiRecord>): void {
  const key = preferencesQuery().queryKey;
  const current = queryClient.getQueryData<UserPreferences>(key);
  if (!current) return;
  const ui = current.ui ?? {};
  const same = (Object.keys(partial) as (keyof UiRecord)[]).every((name) => partial[name] === ui[name]);
  if (same) return;
  const updates = buildPreferenceUpdates(current, { ui: partial });
  void api.updatePreferences(updates).then(
    (next) => queryClient.setQueryData(key, next),
    () => {},
  );
}
