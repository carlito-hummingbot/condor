/**
 * Sample data and pure rules for the Deploy stage.
 *
 * Everything here is sample data (UI-first): there is no API, no key store and
 * no balance read. The only real inputs are the draft flags from `types.ts`,
 * so the pre-flight list can be tested against a draft instead of a server.
 */

/** Shown when the draft has no title yet, so the stage is never blank. */
export const SAMPLE_DRAFT_LINE = "Sample draft: Stable Churn on Binance, USDC-USDT";

/** Sample account balance the capital check is held against. */
export const SAMPLE_BALANCE = 2_500;

/** Sample title used by the v2 reset and the typed confirm example. */
export const SAMPLE_TITLE = "Stable Churn";

export const CAPITAL = { min: 100, max: 10_000, step: 100, initial: 800 } as const;

export const LIMITS = {
  maxLossPerDay: 40,
  maxLossTotal: 160,
  maxOrderSize: 120,
} as const;

/** How often the bot refreshes its quotes, and the hours it is allowed to run. */
export const SCHEDULE = {
  refreshSec: 5,
  hours: [
    { id: "always", label: "24/7" },
    { id: "market", label: "Exchange hours" },
    { id: "custom", label: "Custom window" },
  ] as const,
};

export type ScheduleId = (typeof SCHEDULE.hours)[number]["id"];

export type StartMode = "paused" | "live";

export type CheckStatus = "pass" | "action" | "fail";

export interface PreFlightRow {
  id: "keys" | "balance" | "backtest" | "dry-run" | "limits";
  label: string;
  detail: string;
  status: CheckStatus;
  /** Where the operator fixes it, when there is somewhere to go. */
  fix?: { label: string; to: string };
}

export interface PreFlightInput {
  /** Backtest finished, from the draft. */
  backtestDone: boolean;
  /** Dry run finished, from the draft. */
  dryRunDone: boolean;
  /** Capital about to be allocated; null while the form is untouched. */
  capital: number | null;
}

/**
 * The five checks, in the order an operator reads them: access first, money
 * second, evidence third. `keys` is sample-true (the demo install has a key
 * connected); the balance is compared with the sample balance; the two
 * evidence rows come from the draft flags; the limits row clears once capital
 * and the stop conditions are set.
 */
export function preFlightRows(input: PreFlightInput): PreFlightRow[] {
  const capital = input.capital;
  const tooBig = capital !== null && capital > SAMPLE_BALANCE;
  return [
    {
      id: "keys",
      label: "Exchange keys connected",
      detail: "Binance API key with trade permission (sample).",
      status: "pass",
    },
    {
      id: "balance",
      label: "Balance covers the capital",
      detail:
        capital === null
          ? `Sample balance $${SAMPLE_BALANCE.toLocaleString("en-US")} available.`
          : tooBig
            ? `Capital $${capital.toLocaleString("en-US")} is above the sample balance of $${SAMPLE_BALANCE.toLocaleString("en-US")}.`
            : `$${capital.toLocaleString("en-US")} of $${SAMPLE_BALANCE.toLocaleString("en-US")} available.`,
      status: tooBig ? "fail" : capital === null ? "action" : "pass",
    },
    {
      id: "backtest",
      label: "Backtest done",
      detail: input.backtestDone
        ? "A backtest ran on this draft."
        : "No backtest on this draft yet. Run one to see the expected drawdown.",
      status: input.backtestDone ? "pass" : "action",
      fix: input.backtestDone ? undefined : { label: "Run Backtest", to: "backtest" },
    },
    {
      id: "dry-run",
      label: "Dry run done",
      detail: input.dryRunDone
        ? "A dry run ran on this draft with no orders sent."
        : "No dry run yet. A dry run shows fills and latency before money moves.",
      status: input.dryRunDone ? "pass" : "action",
      fix: input.dryRunDone ? undefined : { label: "Run Dry Run", to: "dry-run" },
    },
    {
      id: "limits",
      label: "Risk limits set",
      detail: capital === null
        ? "Set the capital and the stop conditions below."
        : "Daily and total loss stops set, plus a maximum order size.",
      status: capital === null ? "action" : "pass",
    },
  ];
}

/** True when nothing blocks the deploy; `action` rows only warn. */
export function hasBlockingRow(rows: readonly PreFlightRow[]): boolean {
  return rows.some((row) => row.status === "fail");
}

/** The `action` rows, which the confirm dialog repeats back. */
export function openRows(rows: readonly PreFlightRow[]): PreFlightRow[] {
  return rows.filter((row) => row.status === "action");
}

export interface DeployStep {
  id: "validate" | "start" | "connect";
  label: string;
  detail: string;
}

export const DEPLOY_STEPS: readonly DeployStep[] = [
  { id: "validate", label: "Validating the draft", detail: "Pairs, limits and permissions" },
  { id: "start", label: "Starting the bot", detail: "Loading the strategy into a session" },
  { id: "connect", label: "Connecting to Binance", detail: "Subscribing to the order book" },
];

/** How long each canned step shows. */
export const STEP_MS = 700;

/** The word an operator may type instead of the bot title. */
export const CONFIRM_WORD = "DEPLOY";

/** The typed gate: the bot title or the word DEPLOY, case-insensitive. */
export function confirmMatches(typed: string, title: string): boolean {
  const value = typed.trim();
  if (!value) return false;
  return value === CONFIRM_WORD || value.toLowerCase() === title.trim().toLowerCase();
}

export function formatUsd(value: number): string {
  return `$${value.toLocaleString("en-US")}`;
}
