import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import {
  buildPreferenceUpdates,
  dashboardTitleFrom,
  displayNameFrom,
  withActiveAgentKey,
  type PreferencePatch,
  type UserPreferences,
} from "@/lib/onboarding";
import { preferencesQuery } from "@/lib/queryClient";

export function useUserPreferences() {
  return useQuery({
    ...preferencesQuery(),
    queryFn: () => api.getPreferences(),
  });
}

/**
 * PATCH `onboarding` / `profile` / `ui` as whole top-level keys.
 *
 * The cached map is read first so a title change cannot drop `theme`. If the
 * cache is empty the current map is fetched, because writing from `{}` would
 * replace a key the server already holds.
 */
export function usePatchPreferences() {
  const qc = useQueryClient();
  const key = preferencesQuery().queryKey;
  return useMutation({
    mutationFn: async (args: {
      patch: PreferencePatch;
      replaceOnboarding?: boolean;
      /** Sent as the whole `agent` object, never a partial. */
      agentKey?: string;
    }) => {
      const cached = qc.getQueryData<UserPreferences>(key);
      const current = cached ?? (await api.getPreferences());
      const updates = buildPreferenceUpdates(current, args.patch, args.replaceOnboarding);
      if (args.agentKey) Object.assign(updates, withActiveAgentKey(current, args.agentKey));
      return api.updatePreferences(updates);
    },
    onSuccess: (next) => {
      qc.setQueryData(key, next);
    },
  });
}

/** Saved name, else the Telegram first name, else "Algo Trader". Never "Local". */
export function useDisplayName(): string {
  const { data } = useUserPreferences();
  const { user } = useAuth();
  return displayNameFrom(data, user);
}

/** Top-bar label and `document.title`. The document title stays Condor until a save. */
export function useDashboardTitle(): string {
  const { data } = useUserPreferences();
  const title = dashboardTitleFrom(data);
  useEffect(() => {
    document.title = title;
  }, [title]);
  return title;
}
