import { useQuery } from "@tanstack/react-query";
import { Workflow } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { LoopCardGrid } from "@/components/chat/LoopsPanel";
import { buttonClass } from "@/components/ui/buttonClass";
import { EmptyState } from "@/components/ui/EmptyState";
import { useLiveLoops } from "@/hooks/useLiveLoops";
import { agentsQuery } from "@/lib/queryClient";

/**
 * Every strategy, across every agent.
 *
 * The same cards the chat's strategies panel draws (`LoopCardGrid`, fed by
 * `fleet-map`). A card opens that strategy in the agent's workspace
 * (`/agents/:slug?strategy=`). The panel address `/?panel=loops` still works
 * for old links; this page is the rail's door.
 */
export function Strategies() {
  const navigate = useNavigate();
  const { loops, isLoading } = useLiveLoops();
  const { data: agents = [] } = useQuery(agentsQuery());

  if (!isLoading && loops.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <header className="shrink-0 border-b border-[var(--color-border)] px-4 py-3">
          <h1 className="text-sm font-semibold text-[var(--color-text)]">Strategies</h1>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Every strategy, across every agent
          </p>
        </header>
        <div className="flex flex-1 items-center justify-center overflow-y-auto">
          <EmptyState
            icon={<Workflow />}
            title="No strategies running"
            description="A strategy is a loop an agent runs for you on a schedule. Ask an agent to start one, or install one from the Hub."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link to="/" className={buttonClass("primary", "md")}>
                  Ask an agent
                </Link>
                <Link to="/hub" className={buttonClass("secondary", "md")}>
                  Browse the Hub
                </Link>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <section className="flex min-h-0 w-full max-w-xl flex-col border-[var(--color-border)] md:max-w-md md:border-r">
        <header className="shrink-0 border-b border-[var(--color-border)] px-4 py-3">
          <h1 className="text-sm font-semibold text-[var(--color-text)]">Strategies</h1>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Every strategy, across every agent
          </p>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          <LoopCardGrid
            loops={loops}
            isLoading={isLoading}
            agents={agents}
            emptyLabel="No strategies running right now"
            onOpenLoop={(agentSlug, strategySlug) =>
              navigate(`/agents/${agentSlug}?strategy=${encodeURIComponent(strategySlug)}`)
            }
          />
        </div>
      </section>
      <section className="hidden min-w-0 flex-1 flex-col items-center justify-center px-8 text-center md:flex">
        <p className="max-w-sm text-sm text-[var(--color-text-muted)]">
          Open a strategy to see it in the agent workspace — what it last did, and the run it is on.
        </p>
      </section>
    </div>
  );
}
