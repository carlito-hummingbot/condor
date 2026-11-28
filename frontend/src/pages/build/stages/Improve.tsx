/**
 * Build → Improve: what the live bot did, how healthy it is, what to change,
 * and how to iterate.
 *
 * Sample data only. The two actions that matter are real draft moves: "Test in
 * Backtest" goes back a stage, and "Create v2 draft" writes a new title and
 * resets the three flags so the stepper starts again. Pause is UI only.
 */

import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  ClipboardList,
  Gauge,
  History,
  Lightbulb,
  Pause,
  Play,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

import type { StageProps } from "../types";
import {
  HEALTH_ROWS,
  PERF_ROWS,
  SAMPLE_DRAFT_LINE,
  SAMPLE_NOTE,
  SUGGESTIONS,
  VERSIONS,
  delta,
  deltaIsGood,
  formatDelta,
  formatValue,
  nextVersionTitle,
  perfSummary,
  type HealthStatus,
  type RiskLevel,
  type Suggestion,
} from "../sample/improveData";

const HEALTH_TONE: Record<HealthStatus, "success" | "warning" | "danger"> = {
  ok: "success",
  warn: "warning",
  bad: "danger",
};

const RISK_TONE: Record<RiskLevel, "success" | "warning" | "danger"> = {
  low: "success",
  medium: "warning",
  high: "danger",
};

type Decision = "accepted" | "dismissed";

export default function Improve({ draft, setDraft, goTo }: StageProps) {
  const [paused, setPaused] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});

  const title = draft.title.trim();
  const draftLine = title ? `Draft: ${title}` : SAMPLE_DRAFT_LINE;
  const decide = (id: string, decision: Decision) =>
    setDecisions((current) => ({ ...current, [id]: current[id] === decision ? undefined as unknown as Decision : decision }));

  const createV2 = () => {
    setDraft({
      title: nextVersionTitle(title),
      designDone: false,
      backtestDone: false,
      dryRunDone: false,
      deployed: false,
    });
    goTo("design");
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-[var(--color-text)]">
            <Sparkles className="h-5 w-5 text-[var(--color-primary)]" aria-hidden="true" />
            Improve
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {draftLine}. What the live bot did, how to make it better, and how to start the next version.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={paused ? "warning" : "success"} dot>
            {paused ? "Paused" : "Live"}
          </Badge>
          <Button variant="secondary" onClick={() => setPaused((p) => !p)}>
            {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
            {paused ? "Resume bot" : "Pause bot"}
          </Button>
        </div>
      </header>

      {/* 1. Performance review */}
      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
            <Gauge className="h-4 w-4 text-[var(--color-primary)]" aria-hidden="true" />
            Live against the predictions
          </h2>
          <Badge tone="neutral">Sample data</Badge>
        </div>

        <PerfChart />

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Live results against the backtest and the dry run, with the difference from the backtest
            </caption>
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                <th scope="col" className="py-2 pr-3 font-medium">Metric</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Live</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Backtest</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">vs backtest</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Dry run</th>
                <th scope="col" className="py-2 text-right font-medium">vs dry run</th>
              </tr>
            </thead>
            <tbody>
              {PERF_ROWS.map((row) => (
                <tr key={row.id} className="border-b border-[var(--color-border)]/60 last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-normal text-[var(--color-text)]">{row.label}</th>
                  <td className="py-2 pr-3 text-right font-medium tabular-nums text-[var(--color-text)]">
                    {formatValue(row.live, row.unit)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[var(--color-text-muted)]">
                    {formatValue(row.backtest, row.unit)}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <DeltaCell row={row} against="backtest" />
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[var(--color-text-muted)]">
                    {formatValue(row.dryRun, row.unit)}
                  </td>
                  <td className="py-2 text-right">
                    <DeltaCell row={row} against="dryRun" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">{SAMPLE_NOTE}</p>
      </Card>

      {/* 2. Health */}
      <Card>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
          <Bot className="h-4 w-4 text-[var(--color-primary)]" aria-hidden="true" />
          Health, last 24 hours
        </h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {HEALTH_ROWS.map((row) => (
            <li key={row.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <p className="text-xs text-[var(--color-text-muted)]">{row.label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--color-text)]">{row.value}</p>
              <Badge tone={HEALTH_TONE[row.status]} className="mt-2">
                {row.status === "ok" ? "Good" : row.status === "warn" ? "Watch" : "Bad"}
              </Badge>
              <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-muted)]">{row.detail}</p>
            </li>
          ))}
        </ul>
      </Card>

      {/* 3. Suggestions */}
      <Card>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
          <Lightbulb className="h-4 w-4 text-[var(--color-yellow)]" aria-hidden="true" />
          Suggestions
        </h2>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">Sample AI suggestions. Accept one, dismiss it, or test it before you keep it.</p>
        <ul className="mt-3 space-y-3">
          {SUGGESTIONS.map((s) => (
            <SuggestionRow
              key={s.id}
              suggestion={s}
              decision={decisions[s.id]}
              onAccept={() => decide(s.id, "accepted")}
              onDismiss={() => decide(s.id, "dismissed")}
              onTest={() => goTo("backtest")}
            />
          ))}
        </ul>
      </Card>

      {/* 4. Versions */}
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
            <History className="h-4 w-4 text-[var(--color-primary)]" aria-hidden="true" />
            Versions
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setPaused((p) => !p)}>
              {paused ? "Resume bot" : "Pause bot"}
            </Button>
            <Button variant="primary" onClick={createV2}>
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
              Create v2 draft
            </Button>
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Versions of this bot, newest first</caption>
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                <th scope="col" className="py-2 pr-3 font-medium">Version</th>
                <th scope="col" className="py-2 pr-3 font-medium">State</th>
                <th scope="col" className="py-2 pr-3 font-medium">What changed</th>
                <th scope="col" className="py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {VERSIONS.map((v) => (
                <tr key={v.id} className="border-b border-[var(--color-border)]/60 last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-medium text-[var(--color-text)]">{v.version}</th>
                  <td className="py-2 pr-3">
                    <Badge tone={v.status === "live" ? "success" : v.status === "draft" ? "primary" : "neutral"}>
                      {v.status === "live" ? "Live" : v.status === "draft" ? "Draft" : "Archived"}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3 text-[var(--color-text-muted)]">{v.changed}</td>
                  <td className="py-2 text-[var(--color-text-muted)]">{v.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">
          Creating v2 keeps v1 as it is and opens Design with the title suffixed. Backtest, Dry Run and Deploy start again.
        </p>
      </Card>
    </div>
  );
}

function DeltaCell({ row, against }: { row: (typeof PERF_ROWS)[number]; against: "backtest" | "dryRun" }) {
  const value = delta(row, against);
  const good = deltaIsGood(row, against);
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight;
  const tone =
    good === null ? "text-[var(--color-text-muted)]" : good ? "text-[var(--color-green)]" : "text-[var(--color-red)]";
  return (
    <span className={`inline-flex items-center justify-end gap-0.5 tabular-nums ${tone}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {formatDelta(value, row.unit)}
    </span>
  );
}

/**
 * Two bars per metric (live and backtest), scaled to the larger of the two, so
 * the table has a glance-readable shape. The whole chart is one image with a
 * sentence for a text alternative: the numbers themselves are in the table.
 */
function PerfChart() {
  const rows = PERF_ROWS;
  return (
    <figure className="mt-3">
      <div role="img" aria-label={perfSummary(rows)} className="space-y-2">
        {rows.map((row) => {
          const max = Math.max(Math.abs(row.live), Math.abs(row.backtest), 1);
          return (
            <div key={row.id} className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-2">
              <span className="truncate text-xs text-[var(--color-text-muted)]">{row.label}</span>
              <span className="flex flex-col gap-1">
                <span
                  className="h-2 rounded-full bg-[var(--color-primary-fill)] transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${Math.max(4, (Math.abs(row.live) / max) * 100)}%` }}
                />
                <span
                  className="h-2 rounded-full bg-[var(--color-border)] transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${Math.max(4, (Math.abs(row.backtest) / max) * 100)}%` }}
                />
              </span>
            </div>
          );
        })}
      </div>
      <figcaption className="mt-2 flex gap-4 text-xs text-[var(--color-text-muted)]">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[var(--color-primary-fill)]" aria-hidden="true" /> Live
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[var(--color-border)]" aria-hidden="true" /> Backtest
        </span>
      </figcaption>
    </figure>
  );
}

function SuggestionRow({
  suggestion,
  decision,
  onAccept,
  onDismiss,
  onTest,
}: {
  suggestion: Suggestion;
  decision?: Decision;
  onAccept: () => void;
  onDismiss: () => void;
  onTest: () => void;
}) {
  return (
    <li className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium text-[var(--color-text)]">{suggestion.title}</p>
        <div className="flex items-center gap-1.5">
          <Badge tone={RISK_TONE[suggestion.risk]}>{suggestion.risk} risk</Badge>
          {decision === "accepted" && <Badge tone="success">Accepted</Badge>}
          {decision === "dismissed" && <Badge tone="neutral">Dismissed</Badge>}
        </div>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-text-muted)]">{suggestion.reason}</p>
      <p className="mt-1 text-xs text-[var(--color-text)]">
        Expected: <span className="font-medium">{suggestion.impact}</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="primary" onClick={onAccept}>Accept</Button>
        <Button size="sm" variant="secondary" onClick={onTest}>Test in Backtest</Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>Dismiss</Button>
      </div>
    </li>
  );
}
