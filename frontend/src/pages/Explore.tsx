import { useEffect, useState, type ReactNode } from "react";
import { MiniPriceChart } from "@/pages/dashboard/charts";

import {
  ExternalLink,
  Lock,
  MessagesSquare,
  Play,
  Radio,
  Video,
  X,
} from "lucide-react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { PageNav } from "@/components/nav/PageNav";
import { readBotcampSignedIn, writeBotcampSignedIn } from "@/lib/botcampSignIn";

import {
  AVAILABLE_AGENTS,
  BOTCAMP_URL,
  CHANNELS,
  HACKATHON_AGENTS,
  LESSONS,
  LIVE_NOW,
  LIVESTREAM,
  NEWS,
  PRICE_DAYS,
  STRATEGIES,
  type Lesson,
  type LiveNowCard,
  type NewsItem,
  type Strategy,
} from "./explore/sampleData";

/**
 * Explore: the second rail door in the showcase.
 *
 * A catalogue of things to run, split into five tabs (Get Started, Live Bots,
 * Strategies, Agents, What's new) with the tab in `?tab=`. Everything is sample data from
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

type TabId = "overview" | "live-bots" | "bots" | "news";

/**
 * The two tabs the Bots tab replaced. `?tab=strategies` and `?tab=agents` are in
 * old links, in the Design stage's "Looking for…" note and in bookmarks, so a
 * read maps them to Bots and the address is rewritten to `?tab=bots`.
 */
const LEGACY_TABS: Record<string, TabId> = { strategies: "bots", agents: "bots" };
type NewsFilter = "all" | NewsItem["kind"];

const TABS: readonly { id: TabId; label: string; count?: number }[] = [
  { id: "overview", label: "Get Started" },
  { id: "live-bots", label: "Live Bots", count: LIVE_NOW.length },
  { id: "bots", label: "Bots", count: STRATEGIES.length + AVAILABLE_AGENTS.length + HACKATHON_AGENTS.length },
  { id: "news", label: "What's new", count: NEWS.length },
];

const RISK_STYLE: Record<Strategy["risk"], string> = {
  low: "text-[var(--color-green)]",
  medium: "text-[var(--color-primary)]",
  high: "text-[var(--color-red)]",
};

const CARD = "min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function newsDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return `${String(date.getUTCDate()).padStart(2, "0")} ${MONTHS[date.getUTCMonth()].toUpperCase()}`;
}

function SampleBadge() {
  return (
    <span className="rounded-full border border-[var(--color-primary)]/55 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">
      Sample data
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
  onPlay,
  plain = false,
}: {
  badge?: ReactNode;
  sample?: boolean;
  label?: string;
  className?: string;
  /** A locked row: the play glyph is drawn but is not a control. */
  plain?: boolean;
  /** Set where the box has a video to play: it becomes a button, and the
   *  corner stops saying "Video coming". Unset (Strategies) keeps the dead
   *  button and the label exactly as they were. */
  onPlay?: () => void;
}) {
  // A row box is 150px wide: the play button in the middle and the sample
  // badge bottom-right are enough, and the old corner pill overlapped the
  // badge there. Card-sized boxes (no `onPlay`) keep their "Video coming".
  const corner = onPlay ? null : (
    <span className="absolute bottom-2 left-2 rounded-[5px] bg-black/55 px-1.5 py-0.5 text-[11.5px] font-semibold text-white">
      Video coming
    </span>
  );
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
      {/* On a short row box the top-right corner collides with the play button,
          so the sample badge sits bottom-right there; card-sized boxes keep it
          top-right exactly as before. */}
      {sample && (
        <span className={`absolute ${onPlay ? "bottom-2 right-2" : "top-2 right-2"}`}>
          <SampleBadge />
        </span>
      )}
      <span className="absolute inset-0 flex items-center justify-center">
        {plain ? (
          <span
            aria-hidden="true"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-[0_8px_22px_rgba(0,0,0,0.5)]"
          >
            <Play aria-hidden="true" className="ml-0.5 h-4 w-4 fill-[#111]" />
          </span>
        ) : (
          <button
            type="button"
            title={onPlay ? "Play the video" : "Video coming"}
            aria-label={onPlay ? `Play the ${label} video` : `${label} video, coming soon`}
            onClick={onPlay}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-[0_8px_22px_rgba(0,0,0,0.5)]"
          >
            <Play aria-hidden="true" className="ml-0.5 h-4 w-4 fill-[#111]" />
          </button>
        )}
      </span>
      {corner}
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

function OverviewPanel() {
  const [playing, setPlaying] = useState<Lesson | null>(null);
  const when = LIVESTREAM.when.replace("Sample date: ", "");
  const [date, time] = when.split(", ");

  return (
    <div className="pt-1">
      <SectionHead title="Get started" hint="Four short lessons. Play the video on a row." />
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.55fr_1fr]">
        <ul className={`${CARD} m-0 list-none p-0`}>
          {LESSONS.map((lesson) => (
            <li
              key={lesson.id}
              className="flex flex-col gap-3 border-t border-[var(--color-border)] p-3 first:border-t-0 sm:flex-row sm:items-start"
            >
              <VideoThumb
                label={lesson.title}
                sample
                onPlay={() => setPlaying(lesson)}
                className="w-full shrink-0 sm:w-[150px]"
              />
              <div className="min-w-0 flex-1">
                {/* A plain title: the row reads like a Strategy row, and only
                    the video box does anything. */}
                <h3 className="text-[16px] font-bold leading-snug tracking-tight">{lesson.title}</h3>
                <p className="mt-1 text-[13.5px] leading-snug text-[var(--color-text-muted)]">
                  {lesson.description}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <article className="flex min-w-0 flex-col rounded-xl border border-[var(--color-primary)]/45 bg-[linear-gradient(160deg,color-mix(in_srgb,var(--color-primary)_9%,transparent),transparent)] px-4 py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
              Next livestream
            </span>
            <SampleBadge />
          </div>
          <p className="mt-2 text-[24px] font-bold leading-tight tracking-tight">{date}</p>
          <p className="text-[14px] text-[var(--color-text-muted)]">{time}</p>
          <p className="mt-2 text-[13px] leading-snug text-[var(--color-text-muted)]">{LIVESTREAM.why}</p>
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
      </div>

      {playing && <VideoDialog lesson={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}

/**
 * One lesson's video, in a plain dialog: centred, 16:9, the lesson title and a
 * Sample data badge. The iframe exists only while the dialog does, and closes
 * on the close control, Escape, or a click on the backdrop. The embed address
 * is youtube-nocookie with the video id alone — no extra query, so there is no
 * related-video trail at the end.
 */
function VideoDialog({ lesson, onClose }: { lesson: Lesson; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      data-testid="lesson-video-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={lesson.title}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-3xl overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
      >
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Sample video
            </p>
            <h2 className="mt-0.5 text-[15.5px] font-bold leading-snug">{lesson.title}</h2>
          </div>
          <span className="ml-auto flex shrink-0 items-center gap-2">
            <SampleBadge />
            <button
              type="button"
              aria-label="Close the video"
              onClick={onClose}
              className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </span>
        </div>
        <div className="aspect-video w-full bg-black">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${lesson.youtube}`}
            title={lesson.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      </div>
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

function LiveBotsPanel() {
  return (
    <div className="pt-1">
      <SectionHead
        title="Live bots"
        hint="Six sample bots running now: three agents and three strategies."
        aside={<SampleBadge />}
      />
      <section aria-label="Live bots" className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {LIVE_NOW.map((item) => (
          <LiveAgentCard key={item.id} item={item} />
        ))}
      </section>
    </div>
  );
}

/** A muted green/red pair for the sample money strings. */
const moneyTone = (value: string) =>
  value.trim().startsWith("-") ? "text-[var(--color-red)]" : "text-[var(--color-green)]";

/** One sample bot: the Dashboard card's layout, with its own 7-day price line. */
function LiveAgentCard({ item }: { item: LiveNowCard }) {
  const rows: [string, string][] = [
    ["Exchange", item.venue],
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
        <span className="absolute right-0 top-0 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-[var(--color-green)]">
          <i
            aria-hidden="true"
            className="h-2 w-2 rounded-full bg-[var(--color-green)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-green)_28%,transparent)]"
          />
          Live
        </span>
      </div>
      <h3 className="text-center text-[19px] font-bold tracking-tight">{item.name}</h3>
      <div className="mt-2.5 flex flex-wrap items-end justify-between gap-x-3 gap-y-2 pb-3 tabular-nums">
        <div>
          <span className="mb-0.5 block text-[12.5px] text-[var(--color-text-muted)]">P&amp;L</span>
          <b className={`whitespace-nowrap text-[15px] ${moneyTone(item.pnl)}`}>{item.pnl}</b>
        </div>
        <div className="ml-auto text-right">
          <span className="mb-0.5 block text-[12.5px] text-[var(--color-text-muted)]">Realized / Unrealized</span>
          <b className="whitespace-nowrap text-[15px]">
            <span className={moneyTone(item.realized)}>{item.realized}</span> /{" "}
            <span className={moneyTone(item.unrealized)}>{item.unrealized}</span>
          </b>
        </div>
      </div>
      <div className="border-t border-[var(--color-border)] pt-2">
        <MiniPriceChart values={item.pnlSeries} labels={PRICE_DAYS} pair={item.pair} />
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

/**
 * Bots: the two things a user can run, side by side.
 *
 * Agents on the left, Strategies on the right, both in the Strategy row's
 * shape. Strategies keep their rows exactly as they were — Risk line and the
 * "Video coming" box — only their column moves. The Agents column offers the
 * four ready-made agents, then the pack's 14 hackathon agents under a lock
 * until Botcamp is signed in: greyed, not focusable, no actions.
 *
 * Signing in is not built: `lib/botcampSignIn` reads one demo flag that the
 * panel's switch flips, and the real check replaces that helper later. Sample
 * data only; nothing here calls the network.
 */
function BotsPanel() {
  const [signedIn, setSignedIn] = useState(readBotcampSignedIn);

  const flip = (next: boolean) => {
    writeBotcampSignedIn(next);
    setSignedIn(next);
  };

  return (
    <div className="pt-1">
      <div className="grid grid-cols-1 gap-x-6 gap-y-6 lg:grid-cols-2">
        {/* Agents, left. */}
        <section aria-label="Agents" className="min-w-0">
          <ColumnHead
            title="Agents"
            count={AVAILABLE_AGENTS.length + HACKATHON_AGENTS.length}
            hint="AI-driven: a model decides, inside the limits you set."
          />
          <ul aria-label="Agents, ready to use" className={`${CARD} m-0 list-none p-0`}>
            {AVAILABLE_AGENTS.map((agent) => (
              <BotRow
                key={agent.id}
                row={{
                  id: agent.id,
                  name: agent.name,
                  by: "Ready to use · sample text",
                  oneLine: agent.oneLine,
                  tags: [agent.kind, agent.category],
                  sample: agent.sample,
                }}
              />
            ))}
          </ul>

          <h3 className="mb-1 mt-5 flex flex-wrap items-baseline gap-x-2 text-[15px] font-bold">
            14 Hackathon Agents
            <span className="rounded-full bg-[var(--color-text-muted)]/15 px-1.5 text-[11px] font-semibold leading-[1.6] text-[var(--color-text-muted)]">
              {HACKATHON_AGENTS.length}
            </span>
            {!signedIn && (
              <span className="inline-flex items-center gap-1 rounded-[5px] border border-[var(--color-border)] px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                <Lock aria-hidden="true" className="h-3 w-3" />
                Locked
              </span>
            )}
          </h3>
          <p className="mb-2.5 text-[12.5px] leading-snug text-[var(--color-text-muted)]">
            The Botcamp Agent Builders Cup entries. A Botcamp account unlocks them here.
          </p>

          <BotcampPanel signedIn={signedIn} onFlip={flip} />

          <ul aria-label="Hackathon agents" className={`${CARD} m-0 mt-3 list-none p-0`}>
            {HACKATHON_AGENTS.map((agent) => (
              <BotRow
                key={agent.id}
                locked={!signedIn}
                row={{
                  id: agent.id,
                  name: agent.name,
                  by: `by ${agent.builder} · ${agent.team}`,
                  oneLine: agent.oneLine,
                  tags: [agent.kind, agent.category],
                  sample: !agent.real,
                }}
              />
            ))}
          </ul>
        </section>

        {/* Strategies, right: the same rows, in their new place. */}
        <section aria-label="Strategies" className="min-w-0">
          <ColumnHead
            title="Strategies"
            count={STRATEGIES.length}
            hint="Rule-based: fixed rules decide when to quote, enter and exit."
          />
          <ul aria-label="Strategies, video first" className={`${CARD} m-0 list-none p-0`}>
            {STRATEGIES.map((strategy) => (
              <StrategyRow key={strategy.id} strategy={strategy} />
            ))}
          </ul>
          <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--color-text-muted)]">
            Names and one-liners checked against the Hummingbot docs · hummingbot.org/strategies. Risk and
            difficulty are sample judgements, not ratings from Hummingbot.
          </p>
        </section>
      </div>
    </div>
  );
}

/** One column's heading: the name, its count, and one line saying what it is. */
function ColumnHead({ title, count, hint }: { title: string; count: number; hint: string }) {
  return (
    <div className="mb-2.5">
      <h2 className="flex flex-wrap items-baseline gap-x-2 text-[18px] font-bold tracking-tight">
        {title}
        <span className="rounded-full bg-[var(--color-text-muted)]/15 px-1.5 text-[11px] font-semibold leading-[1.6] text-[var(--color-text-muted)]">
          {count}
        </span>
      </h2>
      <p className="mt-0.5 text-[13px] leading-snug text-[var(--color-text-muted)]">{hint}</p>
    </div>
  );
}

/** The plain shape both agent lists draw: a name, one line and its tags. */
interface BotRowData {
  id: string;
  name: string;
  by: string;
  oneLine: string;
  tags: readonly string[];
  sample?: boolean;
}

/**
 * One agent, in the Strategy row's shell: video box left, text right.
 *
 * `locked` is the signed-out hackathon row: greyed, no hover, `aria-disabled`,
 * no buttons inside (so nothing to tab to). Unlocked rows carry the Agents
 * tab's own action — "Use as starting point" / "Improve this".
 */
function BotRow({ row, locked = false }: { row: BotRowData; locked?: boolean }) {
  return (
    <li
      aria-disabled={locked || undefined}
      className={`flex flex-col gap-3 border-t border-[var(--color-border)] p-3 first:border-t-0 sm:flex-row sm:items-start ${
        locked ? "select-none opacity-50 grayscale" : ""
      }`}
    >
      <VideoThumb label={row.name} plain={locked} className="w-full shrink-0 sm:w-[150px]" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h3 className="text-[16px] font-bold leading-snug tracking-tight">{row.name}</h3>
          {locked && (
            <span className="inline-flex items-center gap-1 rounded-[5px] border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
              <Lock aria-hidden="true" className="h-2.5 w-2.5" />
              Locked
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{row.by}</p>
        <p className="mt-1 line-clamp-3 text-[13.5px] leading-snug text-[var(--color-text-muted)]">
          {row.oneLine}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px]">
          {row.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-[5px] bg-[var(--color-text-muted)]/10 px-1.5 py-0.5 capitalize text-[var(--color-text-muted)]"
            >
              {tag}
            </span>
          ))}
          {row.sample && <SampleBadge />}
        </div>
        {!locked && (
          <div className="mt-2">
            <BuildFromItem id={row.id} name={row.name} />
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * The sign-in panel between the sub-heading and the 14: one line, two links to
 * Botcamp, and the demo switch that stands in for a Botcamp session.
 */
function BotcampPanel({ signedIn, onFlip }: { signedIn: boolean; onFlip: (next: boolean) => void }) {
  return (
    <div className="rounded-xl border border-[var(--color-primary)]/45 bg-[linear-gradient(160deg,color-mix(in_srgb,var(--color-primary)_8%,transparent),transparent)] px-4 py-3">
      <p className="text-[13px] leading-snug text-[var(--color-text)]">
        {signedIn
          ? "Signed in to Botcamp (sample): the 14 hackathon agents are ready to use."
          : "Sign in to Botcamp to unlock the 14 hackathon agents."}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <a
          href={BOTCAMP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 items-center justify-center rounded-md bg-[var(--color-primary)] px-3 text-[13px] font-semibold text-[var(--on-primary)]"
        >
          Log in
        </a>
        <a
          href={BOTCAMP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-[var(--color-border)] px-3 text-[13px] font-semibold text-[var(--color-text)]"
        >
          Create account <ExternalLink aria-hidden="true" className="h-3 w-3" />
        </a>
        <span className="text-[11.5px] text-[var(--color-text-muted)]">botcamp.xyz</span>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-2.5">
        <label className="inline-flex items-center gap-2 text-[12px] text-[var(--color-text-muted)]">
          <input
            type="checkbox"
            checked={signedIn}
            onChange={(event) => onFlip(event.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--color-primary)]"
          />
          Demo: show signed-in view
        </label>
        <SampleBadge />
      </div>
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
  const wanted = (raw && LEGACY_TABS[raw]) || raw;
  const tab: TabId = TABS.some((t) => t.id === wanted) ? (wanted as TabId) : "overview";
  useEffect(() => {
    if (raw && LEGACY_TABS[raw]) {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", "bots");
        return next;
      }, { replace: true });
    }
  }, [raw, setParams]);
  const select = (id: TabId) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", id);
      return next;
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] text-[var(--color-text)]">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight">Learn</h1>
          <p className="mt-1 max-w-[75ch] text-[15px] text-[var(--color-text-muted)]">
            Learn is where you find something to run: watch a 30-second video, read one line, then try it in Build or
            import it.
          </p>
        </div>
        <div className="hidden whitespace-nowrap text-[13px] text-[var(--color-text-muted)] sm:block">
          14 hackathon agents · 10 strategies
        </div>
      </header>

      <div className="mt-4">
        <PageNav
          label="Learn sections"
          idPrefix="explore"
          current={tab}
          onSelect={(id) => select(id as TabId)}
          items={TABS.map((t) => ({
            id: t.id,
            label: t.label,
            badge:
              t.count === undefined ? undefined : (
                <span className="rounded-full bg-[var(--color-text-muted)]/15 px-1.5 text-[11px] font-semibold leading-[1.55] text-[var(--color-text-muted)]">
                  {t.count}
                </span>
              ),
          }))}
        />
      </div>

      <div
        role="tabpanel"
        id={`explore-panel-${tab}`}
        aria-labelledby={`explore-tab-${tab}`}
        tabIndex={0}
        className="outline-none"
      >
        {tab === "overview" && <OverviewPanel />}
        {tab === "live-bots" && <LiveBotsPanel />}
        {tab === "bots" && <BotsPanel />}
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
