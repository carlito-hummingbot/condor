import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useDashboardTitle, useDisplayName } from "@/hooks/useDisplayName";
import { formatDateTime } from "@/lib/formatters";
import { DEFAULT_DASHBOARD_TITLE } from "@/lib/onboarding";
import { BarChart, Gauge, PriceChart, Sparkline } from "./dashboard/charts";
import { SAMPLE, type AgentCard } from "./dashboard/sampleData";

/**
 * The showcase Dashboard: what a trader looks at first. Sample data only.
 *
 * Lives on `preview/combined` and nowhere else. Every number comes from
 * `dashboard/sampleData.ts`; nothing is fetched, nothing refreshes, and the
 * "Sample data" badges say so on the page. The real Dashboard is a later
 * proposal.
 */

const UP = "text-[var(--color-green)]";
const DOWN = "text-[var(--color-red)]";

const usd = (n: number, digits = 0) =>
  `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
/** "+$412.80" or "-$22.60". */
const signed = (n: number, digits = 0) => `${n < 0 ? "-" : "+"}${usd(n, digits)}`;
const tone = (n: number) => (n < 0 ? DOWN : UP);

function SampleBadge() {
  return (
    <span className="rounded-full border border-[var(--color-primary)]/55 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">
      Sample data
    </span>
  );
}

function LiveDot({ label = "Live" }: { label?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wider ${UP}`}>
      <i
        aria-hidden="true"
        className="h-2 w-2 rounded-full bg-[var(--color-green)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-green)_28%,transparent)]"
      />
      {label}
    </span>
  );
}

function Card({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <article className="min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5">
      <h2 className="mb-2 flex items-center justify-between text-[13px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        {title}
        {aside}
      </h2>
      {children}
    </article>
  );
}

function dayLabels(now: Date, count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (count - 1 - i));
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });
}

function hourLabels(now: Date, count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now);
    d.setHours(now.getHours() - (count - 1 - i));
    return `${String(d.getHours()).padStart(2, "0")}:00`;
  });
}

/** The Dashboard's cards have no ids of their own; this is the one Build names. */
const liveId = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

function AgentCardView({ agent }: { agent: AgentCard }) {
  const navigate = useNavigate();
  return (
    <article className="relative min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 pb-2 pt-4">
      <span
        role="img"
        aria-label="Live"
        className="absolute right-3.5 top-3.5 h-[9px] w-[9px] rounded-full bg-[var(--color-green)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-green)_26%,transparent)]"
      />
      <h3 className="text-center text-[19px] font-bold tracking-tight">{agent.title}</h3>
      <p className="mb-1.5 mt-0.5 text-center text-sm text-[var(--color-text-muted)]">{agent.subtitle}</p>
      {/* Showcase continuity: the same bot opens in Build's Improve stage. */}
      <div className="mb-2 flex justify-center">
        <button
          type="button"
          onClick={() =>
            navigate(`/build?stage=improve&from=dashboard&item=${encodeURIComponent(liveId(agent.title))}`)
          }
          aria-label={`Improve ${agent.title}`}
          className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-[12px] font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
        >
          Improve
        </button>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 pb-3 tabular-nums">
        <div>
          <span className="mb-0.5 block text-[12.5px] text-[var(--color-text-muted)]">P&amp;L</span>
          <b className={`whitespace-nowrap text-[15px] ${tone(agent.pnl)}`}>
            {signed(agent.pnl, 2)} ({agent.pnlPct >= 0 ? "+" : ""}
            {agent.pnlPct.toFixed(1)}%)
          </b>
        </div>
        <div className="ml-auto text-right">
          <span className="mb-0.5 block text-[12.5px] text-[var(--color-text-muted)]">Realized / Unrealized</span>
          <b className="whitespace-nowrap text-[15px]">
            <span className={tone(agent.realized)}>{signed(agent.realized, 2)}</span> /{" "}
            <span className={tone(agent.unrealized)}>{signed(agent.unrealized, 2)}</span>
          </b>
        </div>
      </div>
      <dl className="m-0 tabular-nums">
        {(
          [
            ["Pair", agent.pair],
            ["Filled Orders Qty", agent.filledOrders.toLocaleString("en-US")],
            ["Volume", usd(agent.volume)],
            ["Agent Started", agent.agentStarted],
            ["Total Runtime", agent.totalRuntime],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 border-t border-[var(--color-border)] py-2.5 text-[14.5px]">
            <dt className="shrink-0 text-[var(--color-text-muted)]">{label}</dt>
            <dd className="m-0 min-w-0 text-right font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

export function Dashboard() {
  const name = useDisplayName();
  const savedTitle = useDashboardTitle();
  // The title chosen in Account or the wizard replaces the page heading; without one it reads "Condor Dashboard".
  const heading = savedTitle === DEFAULT_DASHBOARD_TITLE ? "Condor Dashboard" : savedTitle;
  // Taken once on load: nothing on this page refreshes, so "Updated" says when it was drawn.
  const [now] = useState(() => new Date());
  const { funds, pnl, meter, btc } = SAMPLE;

  return (
    <div className="mx-auto w-full max-w-[1400px] text-[var(--color-text)]">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight">{heading}</h1>
          <p className="mt-1 text-[15px] text-[var(--color-text-muted)]">Welcome back, {name}.</p>
        </div>
        <div className="flex items-center gap-2.5 whitespace-nowrap text-[13px] text-[var(--color-text-muted)]">
          <SampleBadge />
          <span>Updated {formatDateTime(now.getTime())}</span>
        </div>
      </header>

      <section aria-label="Summary" className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="Combined Funds">
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-[30px] font-bold leading-tight tracking-tight">{usd(funds.total)}</div>
              <div className={`mt-1 text-sm ${UP}`}>{signed(funds.today)} today</div>
            </div>
            <Sparkline values={funds.spark} />
          </div>
          <div className="mt-1 text-sm text-[var(--color-text-muted)]">
            Spot {usd(funds.spot)} · Perps {usd(funds.perps)}
          </div>
          <div className="mt-1 text-sm text-[var(--color-text-muted)]">
            {funds.accounts} accounts, {funds.botsRunning} bots running
          </div>
        </Card>
        <Card title="Combined P&L">
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className={`text-[30px] font-bold leading-tight tracking-tight ${tone(pnl.total)}`}>{signed(pnl.total)}</div>
              <div className={`mt-1 text-sm ${tone(pnl.total)}`}>+{pnl.sincePct}% since start</div>
            </div>
            <Sparkline values={pnl.spark} />
          </div>
          <div className="mt-1 text-sm text-[var(--color-text-muted)]">
            Realized {signed(pnl.realized)} · Unrealized {signed(pnl.unrealized)}
          </div>
          <div className="mt-1 text-sm text-[var(--color-text-muted)]">
            Today {signed(pnl.today)} (+{pnl.todayPct.toFixed(1)}%)
          </div>
        </Card>
        <Card title="BTC Meter">
          <div className="-mt-1 flex flex-col items-center">
            <Gauge value={meter.value} />
            <div className="mt-0.5 text-center leading-tight">
              <b className="block text-[26px]">{meter.value}</b>
              <span className={`text-[13px] font-semibold ${UP}`}>{meter.label}</span>
            </div>
          </div>
        </Card>
        <Card title="BTC Price Timeframes" aside={<LiveDot />}>
          <div className="text-[30px] font-bold leading-tight tracking-tight">{usd(btc.price)}</div>
          <div className="mt-2 grid grid-cols-2 gap-x-2.5 gap-y-1.5">
            {btc.changes.map((c) => (
              <div
                key={c.label}
                className="flex items-baseline justify-between rounded-lg bg-[var(--color-text-muted)]/10 px-2.5 py-1.5 text-sm"
              >
                <span className="text-[var(--color-text-muted)]">{c.label}</span>
                <b className={tone(c.pct)}>
                  {c.pct >= 0 ? "+" : "-"}
                  {Math.abs(c.pct).toFixed(1)}%
                </b>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section aria-label="P&L charts" className="mt-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <Card title="Daily P&L (Combined)">
          <BarChart values={SAMPLE.daily} labels={dayLabels(now, SAMPLE.daily.length)} labelEvery={3} ticks={[500, 1000]} />
        </Card>
        <Card title="Hourly P&L (Combined)">
          <BarChart values={SAMPLE.hourly} labels={hourLabels(now, SAMPLE.hourly.length)} labelEvery={6} ticks={[40, 80]} />
        </Card>
      </section>

      <section aria-label="Market" className="mt-3.5 grid grid-cols-1 gap-3.5 xl:grid-cols-[1.5fr_1fr]">
        <Card title="BTC hourly" aside={<LiveDot />}>
          <PriceChart values={btc.hourly} labels={hourLabels(now, btc.hourly.length)} />
        </Card>
        <Card title="Top News" aside={<SampleBadge />}>
          <ul className="m-0 list-none p-0">
            {SAMPLE.news.map((n) => (
              <li
                key={n.headline}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-2 border-t border-[var(--color-border)] py-2.5 text-[14.5px] first:border-t-0 first:pt-0.5"
              >
                <span className="min-w-[62px] rounded-[5px] bg-[var(--color-primary)]/15 px-1.5 py-0.5 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">
                  {n.tag}
                </span>
                {/* Example links: they go nowhere. */}
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="w-fit max-w-full truncate border-b border-[var(--color-primary)]/55 text-[var(--color-text)] no-underline"
                >
                  {n.headline}
                </a>
                <span className="text-[13px] text-[var(--color-text-muted)]">{n.ago}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11.5px] text-[var(--color-text-muted)]">Example headlines and links.</p>
        </Card>
      </section>

      <h2 className="mb-2.5 mt-5 flex items-center gap-3 text-base font-semibold">
        Live Agents
        <LiveDot label={`${SAMPLE.agents.length} running`} />
      </h2>
      <section aria-label="Live agents" className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {SAMPLE.agents.map((a) => (
          <AgentCardView key={a.title} agent={a} />
        ))}
      </section>
    </div>
  );
}
