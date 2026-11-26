import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/Button";
import { usePatchPreferences, useUserPreferences } from "@/hooks/useUserPreferences";
import { restartedOnboarding } from "@/lib/onboarding";

/** Settings → Appearance. Clears completion and opens the wizard again. */
export function RunSetupAgain() {
  const navigate = useNavigate();
  const { data, isFetched, isError } = useUserPreferences();
  const patch = usePatchPreferences();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="secondary"
        disabled={!isFetched || isError || patch.isPending}
        onClick={() => {
          setError(null);
          patch.mutate(
            {
              patch: { onboarding: restartedOnboarding(data?.onboarding) },
              replaceOnboarding: true,
            },
            {
              onSuccess: () => navigate("/?onboarding=1"),
              onError: (err) => {
                setError(err instanceof Error ? err.message : "Could not restart setup.");
              },
            },
          );
        }}
      >
        {patch.isPending ? "Starting…" : "Run setup again"}
      </Button>
      {error && <p className="text-xs text-[var(--color-red)]">{error}</p>}
    </div>
  );
}
