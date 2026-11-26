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
    force,
    keysReady,
    keysError,
    hasKeys,
    activityReady,
    hasActivity,
  };

  // Once setup is on screen, selecting a server starts a credentials probe.
  // An offline API fails that probe; the outage rule still applies to a wizard
  // that has not opened, and must not close one that has. Adjusted during
  // render so the next pass keeps the same answer without an effect.
  const [engaged, setEngaged] = useState(false);
  const showWizard = shouldShowWizard({ ...signals, wizardEngaged: engaged });
  if (showWizard && !engaged) setEngaged(true);
  else if (!showWizard && engaged && (completed || hasKeys)) setEngaged(false);

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

  const auto = shouldAutoComplete(signals);
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
