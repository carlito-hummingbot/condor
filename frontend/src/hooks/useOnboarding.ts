import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { fallbackServer, useServer } from "@/hooks/useServer";
import { useCredentials } from "@/hooks/useCredentials";
import { usePatchPreferences, useUserPreferences } from "@/hooks/useUserPreferences";
import { api } from "@/lib/api";
import {
  forceOnboarding,
  isOnboardingComplete,
  isTradingSurface,
  onboardingPending,
  shouldAutoComplete,
  shouldShowKeysBanner,
  shouldShowWizard,
} from "@/lib/onboarding";

/**
 * Whether the shell shows the wizard or the non-blocking keys reminder.
 *
 * An install that already has keys, a wallet, a conversation or a bot is
 * marked complete on the way past, so it never sees the wizard. A credentials
 * failure is left alone: that is an outage, not a first run and not a
 * finished one (the same rule the old overlay used).
 */
export function useOnboarding() {
  const { pathname, search } = useLocation();
  const { server } = useServer();
  const { hasKeys, isLoading: keysLoading, isError: keysError } = useCredentials();
  const prefsQuery = useUserPreferences();
  const { mutate } = usePatchPreferences();

  const serversQuery = useQuery({
    queryKey: ["servers"],
    queryFn: api.getServers,
  });

  const prefsReady = prefsQuery.isFetched && !prefsQuery.isError;
  const completed = isOnboardingComplete(prefsQuery.data);
  const completedAt = prefsQuery.data?.onboarding?.completed_at ?? null;
  const force = forceOnboarding(search);
  const keysReady = !keysLoading;
  const needActivity =
    prefsReady && !force && !completed && keysReady && !keysError && !hasKeys;

  // ServerSelector adopts an online server on its own. Wait for that before
  // deciding a keyless install has no bots, or the wizard flashes and closes.
  const adopting =
    needActivity &&
    !server &&
    (!serversQuery.isFetched || fallbackServer(serversQuery.data ?? []) !== null);

  const convos = useQuery({
    queryKey: ["onboarding-conversations"],
    queryFn: () => api.listConversations(1),
    enabled: needActivity,
    retry: false,
    staleTime: 60_000,
  });

  const bots = useQuery({
    queryKey: ["onboarding-bots", server],
    queryFn: () => api.getBots(server!),
    enabled: needActivity && !!server,
    retry: false,
    staleTime: 60_000,
  });

  const convosSettled = !needActivity || convos.isFetched || convos.isError;
  const botsSettled = !needActivity || !server || bots.isFetched || bots.isError;
  const activityReady = !needActivity || (!adopting && convosSettled && botsSettled);
  const hasActivity = (convos.data?.length ?? 0) > 0 || (bots.data?.bots.length ?? 0) > 0;

  const signals = {
    prefsReady,
    prefsError: prefsQuery.isError,
    completed,
    completedAt,
    force,
    keysReady,
    keysError,
    hasKeys,
    activityReady,
    hasActivity,
  };

  // Once setup is on screen, selecting a server starts a credentials probe and
  // the Connect step can save a key. Both say "this install is past first run",
  // and neither may close a wizard that is already up: the outage and existing
  // user rules still apply to one that has not opened. The completion the run
  // started with is remembered, so the wizard closes only when its own Finish or
  // Skip writes a newer one. Adjusted during render so the next pass keeps the
  // same answer without an effect.
  const [engaged, setEngaged] = useState(false);
  const [engagedAt, setEngagedAt] = useState<string | null>(null);
  const showWizard = shouldShowWizard({
    ...signals,
    wizardEngaged: engaged,
    engagedCompletedAt: engagedAt,
  });
  if (showWizard && !engaged) {
    setEngaged(true);
    setEngagedAt(completedAt);
  } else if (!showWizard && engaged) {
    setEngaged(false);
  }

  const pending = onboardingPending(signals);
  const showKeysBanner = shouldShowKeysBanner({
    showWizard,
    pending,
    hasKeys,
    keysReady,
    keysError,
    hasServer: !!server,
    trading: isTradingSurface(pathname),
  });

  const auto = shouldAutoComplete({ ...signals, wizardEngaged: engaged });
  const sent = useRef(false);
  useEffect(() => {
    if (!auto || sent.current) return;
    sent.current = true;
    mutate(
      {
        patch: {
          onboarding: {
            completed_at: new Date().toISOString(),
            auto: true,
          },
        },
      },
      { onError: () => { sent.current = false; } },
    );
  }, [auto, mutate]);

  return { showWizard, showKeysBanner };
}
