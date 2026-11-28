import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  ExternalLink,
  MessagesSquare,
  Play,
  Radio,
  Video,
  X,
} from "lucide-react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";

import {
  AGENTS,
  CHANNELS,
  LIVE_NOW,
  NEWS,
  START_HERE,
  STRATEGIES,
  type Agent,
  type LiveNowCard,
  type NewsItem,
  type SourceKind,
  type Strategy,
} from "./explore/sampleData";

/**
 * Explore: the second rail door in the showcase.
 *
 * A catalogue of things to run, split into four tabs (Overview, Strategies,
 * Agents, What's new) with the tab in `?tab=`. Everything is sample data from
 * `explore/sampleData.ts`; the pack marks the 14 Botcamp agents and the 10
 * strategy names as real, and the videos are placeholders. Nothing here calls
 * the API.
 *
 * Laid out from Designer 3's final pictures in
 * Shared/condor-ui-review/explore/final/.
 *
 * Showcase only: the rail item and the phone tab are renamed here, while the
 * rail PRs still say Agents until the user approves the rename. `/hub` is now
 * a redirect, so the old Agent Hub page is unreachable in the showcase.
 */

type TabId = "overview" | "strategies" | "agents" | "news";
type AgentFilter = "all" | SourceKind;
type NewsFilter = "all" | NewsItem["kind"];

const TABS: readonly { id: TabId; label: string; count?: number }[] = [
  { id: "overview", label: "Overview" },
  { id: "strategies", label: "Strategies", count: STRATEGIES.length },
  { id: "agents", label: "Agents", count: AGENTS.length },
  { id: "news", label: "What's new", count: NEWS.length },
];

const SOURCE_LABEL: Record<SourceKind, string> = {
  hummingbot: "Hummingbot",
  botcamp: "Botcamp Hackathon",
  community: "Community",
};

const RISK_STYLE: Record<Strategy["risk"], string> = {
  low: "text-[var(--color-green)]",
  medium: "text-[var(--color-primary)]",
  high: "text-[var(--color-red)]",
};

const UP = "text-[var(--color-green)]";
const DOWN = "text-[var(--color-red)]";

const CARD = "min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]";

const SOURCE_STYLE: Record<SourceKind, string> = {
  hummingbot: "border-[var(--color-primary)]/50 bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
  botcamp: "border-[#a78bfa]/50 bg-[#a78bfa]/10 text-[#a78bfa]",
  community: "border-[#2dd4bf]/50 bg-[#2dd4bf]/10 text-[#2dd4bf]",
};

const SOURCE_DOT: Record<SourceKind, string> = {
  hummingbot: "bg-[var(--color-primary)]",
  botcamp: "bg-[#a78bfa]",
  community: "bg-[#2dd4bf]",
};

const isNegative = (value: string) => value.trim().startsWith("-") || value.trim().startsWith("\u2212");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function newsDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return `${String(date.getUTCDate()).padStart(2, "0")} ${MONTHS[date.getUTCMonth()].toUpperCase()}`;
}

/** "$2,872,232" -> "$2.87M", "$329" stays "$329". */
function compactVolume(volume: string): string {
  const n = Number(volume.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return volume;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

function SampleBadge() {
  return (
    <span className="rounded-full border border-[var(--color-primary)]/55 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">
      Sample data
    </span>
  );
}

function SourceBadge({ kind }: { kind: SourceKind }) {
  return (
    <span className={`rounded-[5px] border px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${SOURCE_STYLE[kind]}`}>
      {SOURCE_LABEL[kind]}
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

function SectionHead({
  title,
  hint,
  aside,
}: {
  title: string;
  hint?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-2.5 mt-6 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <h2 className="text-[18px] font-bold tracking-tight">{title}</h2>
      {hint && <span className="text-[13px] text-[var(--color-text-muted)]">{hint}</span>}
      {aside && <span className="ml-auto flex flex-wrap items-center gap-2.5">{aside}</span>}
    </div>
  );
}

/**
 * The two ways into Build from a catalogue item (showcase: continuity only).
 *
 * "Use as starting point" opens the Design stage with the item's fields in the
 * draft; "Improve this" opens the same draft in Design with its chat already
 * asking how to improve it. Both name the item, so Build can prefill it and say
 * where it came from.
 */
function BuildFromItem({ id, name, className = "" }: { id: string; name: string; className?: string }) {
  const navigate = useNavigate();
  const open = (intent: "use" | "improve") =>
    navigate(`/build?stage=design&from=explore&intent=${intent}&item=${encodeURIComponent(id)}`);
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => open("use")}
        aria-label={`Use ${name} as a starting point`}
        className="inline-flex h-8 items-center justify-center rounded-md bg-[var(--color-primary)] px-3 text-[13px] font-semibold text-[var(--on-primary)]"
      >
        Use as starting point
      </button>
      <button
        type="button"
        onClick={() => open("improve")}
        aria-label={`Improve ${name}`}
        className="inline-flex h-8 items-center justify-center rounded-md border border-[var(--color-border)] px-3 text-[13px] font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
      >
        Improve this
      </button>
    </div>
  );
}

/** The video is a placeholder: the button looks live but does nothing. */
function VideoThumb({
  badge,
  sample,
  label = "How it works",
  className = "",
}: {
  badge?: ReactNode;
  sample?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={`relative aspect-video overflow-hidden rounded-lg border border-[var(--color-border)] bg-[linear-gradient(160deg,hsl(0_0%_14%),hsl(0_0%_6%))] ${className}`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 opacity-60 [background:radial-gradient(120%_95%_at_12%_0%,color-mix(in_srgb,var(--color-primary)_18%,transparent),transparent_62%)]"
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 200 112"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <path
          d="M0 84 L14 74 L28 78 L42 64 L56 70 L70 58 L84 64 L98 50 L112 56 L126 44 L140 50 L154 38 L168 44 L182 30 L200 24"
          fill="none"
          stroke="var(--color-green)"
          strokeWidth="1.6"
          opacity="0.55"
        />
      </svg>
      {badge && <span className="absolute left-2 top-2 flex flex-wrap gap-1">{badge}</span>}
      {sample && <span className="absolute right-2 top-2"><SampleBadge /></span>}
      <span className="absolute inset-0 flex items-center justify-center">
        <button
          type="button"
          title="Video coming"
          aria-label={`${label} video, coming soon`}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-[0_8px_22px_rgba(0,0,0,0.5)]"
        >
          <Play aria-hidden="true" className="ml-0.5 h-4 w-4 fill-[#111]" />
        </button>
      </span>
      <span className="absolute bottom-2 left-2 rounded-[5px] bg-black/55 px-1.5 py-0.5 text-[11.5px] font-semibold text-white">
        Video coming
      </span>
    </div>
  );
}

function StrategyRow({ strategy }: { strategy: Strategy }) {
  return (
    <li className="flex flex-col gap-3 border-t border-[var(--color-border)] p-3 first:border-t-0 sm:flex-row sm:items-start">
      <VideoThumb label={strategy.name} className="w-full shrink-0 sm:w-[150px]" />
      <div className="min-w-0 flex-1">
        <h3 className="text-[16px] font-bold leading-snug tracking-tight">{strategy.name}</h3>
        <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{strategy.aka}</p>
        <p className="mt-1 text-[13.5px] leading-snug text-[var(--color-text-muted)]">{strategy.oneLine}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11.5px]">
          <span className={`rounded-[5px] bg-[var(--color-text-muted)]/10 px-1.5 py-0.5 font-semibold ${RISK_STYLE[strategy.risk]}`}>
            Risk: {strategy.risk}
          </span>
          <span className="rounded-[5px] bg-[var(--color-text-muted)]/10 px-1.5 py-0.5 capitalize text-[var(--color-text-muted)]">
            {strategy.difficulty}
          </span>
          <span className="rounded-[5px] bg-[var(--color-text-muted)]/10 px-1.5 py-0.5 text-[var(--color-text-muted)]">
            {strategy.venue}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 gap-2 sm:w-[190px] sm:flex-col sm:items-stretch">
        <BuildFromItem id={strategy.id} name={strategy.name} className="sm:flex-col" />
      </div>
    </li>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  const race = agent.race;
  return (
    <article className={`${CARD} flex flex-col overflow-hidden`}>
      <VideoThumb
        label={agent.name}
        sample={!agent.real}
        badge={<SourceBadge kind={agent.sourceKind} />}
        className="rounded-b-none border-0 border-b"
      />
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <h3 className="text-[16px] font-bold leading-snug tracking-tight">{agent.name}</h3>
        <p className="text-[12px] text-[var(--color-text-muted)]">
          by {agent.builder} · {agent.team}
        </p>
        <p className="line-clamp-3 min-h-[54px] text-[13px] leading-snug text-[var(--color-text-muted)]">
          {agent.oneLine}
        </p>
        {race && (
          <p className="text-[12px] text-[var(--color-text-muted)]">
            {race.points} pts · {race.pnlPct} · {compactVolume(race.volumeUsd)} volume
          </p>
        )}
        <p className="text-[12px] text-[var(--color-text-muted)]">
          Where: {agent.venue ?? "not stated"}
        </p>
        <div className="mt-auto pt-2">
          <BuildFromItem id={agent.id} name={agent.name} />
        </div>
      </div>
    </article>
  );
}

function LiveAgentCard({ item }: { item: LiveNowCard }) {
  const rows: [string, string][] = [
    ["Pair", item.pair],
    ["Filled Orders Qty", item.filledOrders],
    ["Volume", item.volume],
    ["Agent Started", item.agentStarted],
    ["Total Runtime", item.totalRuntime],
  ];
  return (
    <article className="relative min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 pb-2 pt-4">
      <div className="relative mb-0.5 flex items-center justify-center">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
          {item.type === "agent" ? "Agent" : "Strategy"}
        </span>
        <span className="absolute right-0 top-0 flex items-center gap-2">
          <LiveDot />
          <button
            type="button"
            title="Chart coming soon"
            aria-label="Open chart, coming soon"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-text-muted)]"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 13V8M8 13V3M13 13V6" />
            </svg>
          </button>
        </span>
      </div>
      <h3 className="text-center text-[19px] font-bold tracking-tight">{item.name}</h3>
      <p className="mb-3.5 mt-0.5 text-center text-sm text-[var(--color-text-muted)]">{item.venue}</p>
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 pb-3 tabular-nums">
        <div>
          <span className="mb-0.5 block text-[12.5px] text-[var(--color-text-muted)]">P&amp;L</span>
          <b className={`whitespace-nowrap text-[15px] ${isNegative(item.pnl) ? DOWN : UP}`}>{item.pnl}</b>
        </div>
        <div className="ml-auto text-right">
          <span className="mb-0.5 block text-[12.5px] text-[var(--color-text-muted)]">Realized / Unrealized</span>
          <b className="whitespace-nowrap text-[15px]">
            <span className={isNegative(item.realized) ? DOWN : UP}>{item.realized}</span> /{" "}
            <span className={isNegative(item.unrealized) ? DOWN : UP}>{item.unrealized}</span>
          </b>
        </div>
      </div>
      <dl className="m-0 tabular-nums">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 border-t border-[var(--color-border)] py-2.5 text-[14.5px]">
            <dt className="shrink-0 text-[var(--color-text-muted)]">{label}</dt>
            <dd className="m-0 min-w-0 text-right font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function OverviewPanel({ onSelect }: { onSelect: (tab: TabId) => void }) {
  const navigate = useNavigate();
  const picks = START_HERE.filter((p) => p.pick !== "livestream");
  const livestream = START_HERE.find((p) => p.pick === "livestream");
  const livePreview = [...LIVE_NOW.filter((i) => i.type === "agent").slice(0, 2), LIVE_NOW.find((i) => i.type === "strategy")!];
  const strategyTeasers = STRATEGIES.slice(0, 3);
  const agentTeasers = AGENTS.slice(0, 3);
  const newsTeasers = NEWS.slice(0, 3);
  const when = livestream?.when?.replace("Sample date: ", "") ?? "";
  const [date, time] = when.split(", ");

  return (
    <div className="pt-1">
      <SectionHead title="Start here" hint="Three ways in; the agent pick shows what a hackathon entry looks like." />
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.55fr_1fr]">
        <ul className={`${CARD} m-0 list-none p-0`}>
          {picks.map((pick, i) => (
            <li key={pick.id} className="flex min-w-0 gap-3 border-t border-[var(--color-border)] px-4 py-3 first:border-t-0">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--color-primary)]/60 text-[12.5px] font-bold text-[var(--color-primary)]">
                {i + 1}
              </span>
              <div className="min-w-0">
                <h3 className="text-[15.5px] font-bold leading-snug">{pick.title}</h3>
                <p className="mt-1 text-[13.5px] leading-snug text-[var(--color-text-muted)]">{pick.why}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <button
                    type="button"
                    title="Video coming"
                    className="inline-flex items-center gap-1 border-b border-[var(--color-primary)]/55 text-[13px] font-semibold"
                  >
                    <Play aria-hidden="true" className="h-2.5 w-2.5 fill-[var(--color-primary)] text-[var(--color-primary)]" />
                    Watch · video coming
                  </button>
                  {pick.pick === "strategy" ? (
                    <button
                      type="button"
                      onClick={() => navigate("/build")}
                      className="text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    >
                      Try in Build
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelect("agents")}
                      className="text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    >
                      Import
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>

        {livestream && (
          <article className="flex min-w-0 flex-col rounded-xl border border-[var(--color-primary)]/45 bg-[linear-gradient(160deg,color-mix(in_srgb,var(--color-primary)_9%,transparent),transparent)] px-4 py-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
                Next livestream
              </span>
              <SampleBadge />
            </div>
            <p className="mt-2 text-[24px] font-bold leading-tight tracking-tight">{date}</p>
            <p className="text-[14px] text-[var(--color-text-muted)]">{time}</p>
            <p className="mt-2 text-[13px] leading-snug text-[var(--color-text-muted)]">
              {livestream.why}
            </p>
            <div className="mt-auto flex flex-wrap gap-2 pt-5">
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center rounded-md bg-[var(--color-primary)] px-3 text-[13px] font-semibold text-[var(--on-primary)]"
              >
                Set a reminder
              </button>
              <a
                href={CHANNELS[0].url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-[var(--color-border)] px-3 text-[13px] font-semibold text-[var(--color-text)]"
              >
                YouTube <ExternalLink aria-hidden="true" className="h-3 w-3" />
              </a>
            </div>
          </article>
        )}
      </div>

      <SectionHead
        title="Live now"
        aside={
          <>
            <LiveDot label={`${livePreview.length} running`} />
            <SampleBadge />
            <button
              type="button"
              onClick={() => navigate("/")}
              className="text-[13.5px] text-[var(--color-text-muted)] underline decoration-[var(--color-border)] underline-offset-4 hover:text-[var(--color-text)]"
            >
              All 6 in the Dashboard
            </button>
          </>
        }
      />
      <section aria-label="Live strategies and agents" className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {livePreview.map((item) => (
          <LiveAgentCard key={item.id} item={item} />
        ))}
      </section>

      <SectionHead title="Browse" hint="A short taste of each tab." />
      <section aria-label="Catalogue previews" className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        <TeaserCard
          title="Strategies"
          all={`All ${STRATEGIES.length}`}
          onAll={() => onSelect("strategies")}
          items={strategyTeasers.map((s) => ({ id: s.id, title: s.name, sub: s.oneLine, right: s.difficulty }))}
        />
        <TeaserCard
          title="Agents"
          all={`All ${AGENTS.length}`}
          onAll={() => onSelect("agents")}
          items={agentTeasers.map((a) => ({
            id: a.id,
            title: a.name,
            sub: a.oneLine,
            right: a.race ? `${a.race.points} pts` : "",
          }))}
        />
        <TeaserCard
          title="What's new"
          all={`All ${NEWS.length}`}
          onAll={() => onSelect("news")}
          items={newsTeasers.map((n) => ({ id: n.id, title: n.title, sub: n.summary, kind: n.kind, right: "sample" }))}
        />
      </section>
    </div>
  );
}

function NewsKind({ kind, withIcon = true }: { kind: NewsItem["kind"]; withIcon?: boolean }) {
  const label = kind === "livestream" ? "Livestream" : kind === "discord" ? "Discord" : "X";
  const style =
    kind === "livestream"
      ? "border-[var(--color-primary)]/50 bg-[var(--color-primary)]/12 text-[var(--color-primary)]"
      : kind === "x"
        ? "border-[#7dd3fc]/50 bg-[#7dd3fc]/12 text-[#7dd3fc]"
        : "border-[#a78bfa]/50 bg-[#a78bfa]/12 text-[#a78bfa]";
  return (
    <span className={`inline-flex items-center gap-1 rounded-[5px] border px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${style}`}>
      {withIcon && kind !== "x" && (kind === "livestream" ? <Video className="h-3 w-3" /> : <MessagesSquare className="h-3 w-3" />)}
      {label}
    </span>
  );
}

function TeaserCard({
  title,
  all,
  onAll,
  items,
}: {
  title: string;
  all: string;
  onAll: () => void;
  items: { id: string; title: string; sub: string; right?: string; kind?: NewsItem["kind"] }[];
}) {
  return (
    <article className={`${CARD} px-4 pb-1 pt-3`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{title}</h2>
        <button type="button" onClick={onAll} className="whitespace-nowrap text-[12.5px] text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          {all} →
        </button>
      </div>
      <ul className="m-0 list-none p-0">
        {items.map((item) => (
          <li key={item.id} className="grid grid-cols-[78px_1fr_auto] items-center gap-2.5 border-t border-[var(--color-border)] py-2.5 first:border-t-0">
            {item.kind ? (
              <NewsKind kind={item.kind} withIcon={false} />
            ) : (
              <span className="relative flex h-9 w-[62px] items-center justify-center overflow-hidden rounded-md border border-[var(--color-border)] bg-[linear-gradient(150deg,hsl(0_0%_15%),hsl(0_0%_6%))]">
                <Play aria-hidden="true" className="h-2.5 w-2.5 fill-white/90 text-white/90" />
              </span>
            )}
            <span className="min-w-0">
              <b className="block truncate text-[14px] font-semibold">{item.title}</b>
              <span className="block truncate text-[12.5px] text-[var(--color-text-muted)]">{item.sub}</span>
            </span>
            {item.right && <span className="whitespace-nowrap text-[11.5px] text-[var(--color-text-muted)]">{item.right}</span>}
          </li>
        ))}
      </ul>
    </article>
  );
}

function DefinitionBar({ term, definition, count }: { term: string; definition: string; count?: string }) {
  return (
    <div className="mt-4 flex flex-wrap items-start gap-2.5 rounded-[10px] border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/5 px-3.5 py-2.5 text-[14px]">
      <i className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--color-primary)]/60 text-[12px] font-bold not-italic text-[var(--color-primary)]">
        i
      </i>
      <div className="min-w-0 flex-1">
        <b className="block font-semibold sm:inline">{term}</b> = {definition}
      </div>
      {count && <span className="ml-auto hidden whitespace-nowrap pl-3 text-[12.5px] text-[var(--color-text-muted)] sm:block">{count}</span>}
    </div>
  );
}

function StrategiesPanel() {
  return (
    <div className="pt-1">
      <DefinitionBar
        term="Strategy"
        definition="a rule-based setup: fixed rules decide when to quote, enter and exit. Agents are AI-driven and have their own tab."
        count={`${STRATEGIES.length} strategies`}
      />
      <p className="mt-2 text-[12.5px] text-[var(--color-text-muted)]">
        Names and one-liners checked against the Hummingbot docs · hummingbot.org/strategies
      </p>
      <ul aria-label="Strategies, video first" className={`${CARD} m-0 mt-3 list-none p-0`}>
        {STRATEGIES.map((strategy) => (
          <StrategyRow key={strategy.id} strategy={strategy} />
        ))}
      </ul>
      <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">
        Risk and difficulty are sample judgements, not ratings from Hummingbot. Each entry opens a video when it is
        recorded; every video is “to be recorded”.
      </p>
    </div>
  );
}

function AgentsPanel({ onSelect }: { onSelect: (tab: TabId) => void }) {
  const [filter, setFilter] = useState<AgentFilter>("botcamp");
  const counts: Record<AgentFilter, number> = {
    all: AGENTS.length,
    hummingbot: AGENTS.filter((a) => a.sourceKind === "hummingbot").length,
    botcamp: AGENTS.filter((a) => a.sourceKind === "botcamp").length,
    community: AGENTS.filter((a) => a.sourceKind === "community").length,
  };
  const shown = filter === "all" ? AGENTS : AGENTS.filter((a) => a.sourceKind === filter);
  const filters: { id: AgentFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "hummingbot", label: "Hummingbot" },
    { id: "botcamp", label: "Botcamp Hackathon" },
    { id: "community", label: "Community" },
  ];

  return (
    <div className="pt-1">
      <DefinitionBar
        term="Agent"
        definition="an AI-driven setup: a model decides, inside the limits you set. Strategies are rule-based and have their own tab."
        count={`${shown.length} of ${AGENTS.length} shown`}
      />
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-[var(--color-text-muted)]">
        <span className="rounded-[5px] bg-[var(--color-primary)]/15 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-primary)]">
          Source
        </span>
        <span className="min-w-0">
          From the Botcamp Agent Builders Cup, Season 1: 14 selected agents. Names, venues and results are as
          published there.
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Filter agents by source">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] ${
              filter === f.id
                ? "border-[var(--color-primary)]/55 bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {f.id !== "all" && <i aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${SOURCE_DOT[f.id]}`} />}
            {f.label}
            <span className="text-[11.5px] tabular-nums opacity-80">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      <section aria-label="Agents, video first" className="mt-3 grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </section>

      {filter !== "all" && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[13px] text-[var(--color-text)]"
          >
            {filter === "botcamp" ? "Show 3 more: 1 Hummingbot and 2 Community" : `Show all ${AGENTS.length}`} →
          </button>
        </div>
      )}

      <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">
        Sample where marked. Agent names, builders, venues, points, P&amp;L and volume come from the Botcamp Agent
        Builders Cup Season 1 pages; the Hummingbot and Community agents are sample. Videos are to be recorded, and
        the Import button is a placeholder.
      </p>
      <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
        <button type="button" onClick={() => onSelect("strategies")} className="underline decoration-[var(--color-border)] underline-offset-4">
          Looking for rule-based setups? Strategies tab
        </button>
      </p>
    </div>
  );
}

function NewsPanel() {
  const [filter, setFilter] = useState<NewsFilter>("all");
  const counts: Record<NewsFilter, number> = {
    all: NEWS.length,
    livestream: NEWS.filter((n) => n.kind === "livestream").length,
    x: NEWS.filter((n) => n.kind === "x").length,
    discord: NEWS.filter((n) => n.kind === "discord").length,
  };
  const shown = filter === "all" ? NEWS : NEWS.filter((n) => n.kind === filter);
  const filters: { id: NewsFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "livestream", label: "Livestream" },
    { id: "x", label: "X" },
    { id: "discord", label: "Discord" },
  ];
  const dot = (kind: NewsItem["kind"]) =>
    kind === "livestream" ? "bg-[var(--color-primary)]" : kind === "x" ? "bg-[#7dd3fc]" : "bg-[#a78bfa]";

  return (
    <div className="pt-1">
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-[18px] font-bold tracking-tight">What&apos;s new</h2>
        <SampleBadge />
        <span className="text-[13px] text-[var(--color-text-muted)]">
          One timeline: livestreams, X posts and Discord announcements.
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Filter updates by source">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] ${
              filter === f.id
                ? "border-[var(--color-primary)]/55 bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {f.label}
            <span className="text-[11.5px] tabular-nums opacity-80">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3.5 lg:grid-cols-[1.6fr_1fr]">
        <article className={`${CARD} px-4 py-1`}>
          <ol className="m-0 list-none p-0">
            {shown.map((item) => (
              <li key={item.id} className="grid grid-cols-[52px_auto_1fr] items-start gap-x-2 border-t border-[var(--color-border)] py-3 first:border-t-0">
                <span className="pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  {newsDate(item.date)}
                </span>
                <span className={`mt-1 h-2 w-2 rounded-full ${dot(item.kind)}`} aria-hidden="true" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <NewsKind kind={item.kind} />
                    <h3 className="text-[15px] font-semibold leading-snug">{item.title}</h3>
                  </div>
                  <p className="mt-1 text-[13.5px] leading-snug text-[var(--color-text-muted)]">{item.summary}</p>
                  <div className="mt-1 flex items-center gap-2.5">
                    <a
                      href={item.link}
                      onClick={(e) => e.preventDefault()}
                      className="border-b border-[var(--color-primary)]/55 text-[13px] text-[var(--color-text)] no-underline"
                    >
                      Open post
                    </a>
                    <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                      Sample
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </article>

        <aside className={`${CARD} self-start p-4`} aria-label="Follow the official channels">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Follow</h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--color-text-muted)]">The three official channels.</p>
          <ul className="m-0 mt-1 list-none p-0">
            {CHANNELS.map((channel) => (
              <li key={channel.id} className="border-t border-[var(--color-border)] py-2 first:border-t-0">
                <a
                  href={channel.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 no-underline"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)]">
                    {channel.kind === "livestream" ? <Radio className="h-3.5 w-3.5" /> : channel.kind === "x" ? <X className="h-3.5 w-3.5" /> : <MessagesSquare className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold">{channel.name}</span>
                    <span className="block text-[11.5px] text-[var(--color-text-muted)]">
                      {channel.kind === "livestream" ? "Livestream episodes" : channel.kind === "x" ? "Posts and threads" : "Announcements"}
                    </span>
                  </span>
                  <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-1 border-t border-[var(--color-border)] pt-2 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">
            Channel links are real and were opened while checking the pack. Every post above is sample, so its link
            is a placeholder.
          </p>
        </aside>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-2 text-[11.5px] text-[var(--color-text-muted)]">
        <SampleBadge />
        All {NEWS.length} posts are sample, and their links are placeholders. The three channels are real: YouTube, X
        and the Discord invite, checked on hummingbot.org.
      </p>
    </div>
  );
}

/** `/hub` used to be the Agent Hub; in the showcase it lands on Explore. */
export function HubRedirect() {
  return <Navigate to="/explore" replace />;
}

export function Explore() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: TabId = TABS.some((t) => t.id === raw) ? (raw as TabId) : "overview";
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (id: TabId) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", id);
      return next;
    });
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    if (next === null) return;
    event.preventDefault();
    select(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] text-[var(--color-text)]">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight">Explore</h1>
          <p className="mt-1 max-w-[75ch] text-[15px] text-[var(--color-text-muted)]">
            Explore is where you find something to run: watch a 30-second video, read one line, then try it in Build or
            import it.
          </p>
        </div>
        <div className="hidden whitespace-nowrap text-[13px] text-[var(--color-text-muted)] sm:block">
          14 hackathon agents · 10 strategies
        </div>
      </header>

      <div
        role="tablist"
        aria-label="Explore sections"
        className="mt-4 flex gap-0.5 overflow-x-auto overflow-y-hidden border-b border-[var(--color-border)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((t, i) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`explore-tab-${t.id}`}
              aria-selected={active}
              aria-controls={`explore-panel-${t.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => select(t.id)}
              onKeyDown={(e) => onTabKeyDown(e, i)}
              className={`relative -mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-lg px-3 py-2.5 text-[15px] ${
                active
                  ? "font-semibold text-[var(--color-text)] after:absolute after:inset-x-2.5 after:-bottom-px after:h-0.5 after:rounded after:bg-[var(--color-primary)]"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
              }`}
            >
              {t.label}
              {t.count !== undefined && (
                <span className="rounded-full bg-[var(--color-text-muted)]/15 px-1.5 text-[11px] font-semibold leading-[1.55] text-[var(--color-text-muted)]">
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`explore-panel-${tab}`}
        aria-labelledby={`explore-tab-${tab}`}
        tabIndex={0}
        className="outline-none"
      >
        {tab === "overview" && <OverviewPanel onSelect={select} />}
        {tab === "strategies" && <StrategiesPanel />}
        {tab === "agents" && <AgentsPanel onSelect={select} />}
        {tab === "news" && <NewsPanel />}
      </div>

      <p className="mt-6 border-t border-[var(--color-border)] pt-3 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">
        Sample data where marked. Agents, venues and race results: Botcamp Agent Builders Cup, Season 1. Strategy names
        and one-liners: Hummingbot docs. Live now, What&apos;s new, Start here and the Hummingbot / Community agents are
        sample. Every video is to be recorded.
      </p>
    </div>
  );
}
