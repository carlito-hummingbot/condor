/**
 * Design, stage 1 of 5: a stepped wizard like onboarding, then the design chat.
 *
 * One card per step, a row of progress dots, Back and Next. The order is
 * Starting point, Trading Style, Markets, Limits, then Review, which starts the
 * chat exactly as the old one-page guide did ("I'm done designing" writes
 * `designDone` and moves to Backtest).
 *
 * The Build page's numbered stage bar is a different thing and stays: these
 * dots count the steps inside Design only.
 *
 * Showcase only: every value is sample data, the assistant is canned text and
 * nothing here calls the API. The draft's own state lives in the draft.
 */

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Check, MessageSquare, Pencil, Send, Sparkles, Upload } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { useUserPreferences } from "@/hooks/useUserPreferences";

import { CATALOG_ITEMS, type CatalogItem } from "../sample/catalog";
import {
  BOT_KINDS,
  cannedReply,
  DESIGN_STEPS,
  draftRows,
  EXCHANGES,
  findExchange,
  IMPORT_FILES,
  marketOptions,
  missingRequired,
  openingMessage,
  pairsReady,
  parsePairs,
  parseSpreads,
  percentError,
  positionsError,
  spreadsShown,
  STARTING_POINTS,
  STRATEGY_TYPES,
  stepProblems,
  strategyInfo,
  SUGGESTIONS,
  suggestHowItWorks,
  suggestTitle,
  type ChatMessage,
  type DesignStepId,
} from "../sample/designData";
import type { Draft, StageProps, StrategyType } from "../types";

import { CommaChips } from "./CommaChips";
import { DesignDots } from "./DesignDots";

const CARD = "rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]";

const CHIP_OFF =
  "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text)]";
const CHIP_ON = "border-[var(--color-primary)]/55 bg-[var(--color-primary)]/10 text-[var(--color-primary)]";

const TEXTAREA =
  "w-full resize-y rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2 text-md " +
  "leading-relaxed text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/70 transition-colors " +
  "hover:border-[var(--color-border-hover)] focus:border-[var(--color-primary)] focus:outline-none " +
  "focus:ring-2 focus:ring-[var(--color-primary)]/20";

/**
 * One-of-a-few, drawn like `components/ui/SegmentedControl` but keeping the
 * empty state (nothing picked yet) and a per-option reason for a disabled one,
 * which the shared control has no slot for.
 */
function ChoiceGroup<T extends string | number>({
  legend,
  ariaLabel,
  value,
  onChange,
  options,
  hint,
  error,
  first,
}: {
  legend: string;
  ariaLabel?: string;
  value: T | null;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string; disabled?: boolean; reason?: string; hint?: string }[];
  hint?: ReactNode;
  error?: string;
  /** Marks the step's first control, so focus can land on it. */
  first?: boolean;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-xs font-medium text-[var(--color-text)]">{legend}</legend>
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        className="mt-1.5 flex w-full flex-wrap items-center gap-0.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-0.5"
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={option.disabled}
              data-step-first={first ? "true" : undefined}
              title={option.disabled ? option.reason : option.hint}
              onClick={() => onChange(option.value)}
              className={`h-7 min-w-[3.25rem] flex-1 whitespace-nowrap rounded-[5px] px-2.5 text-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                active
                  ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm ring-1 ring-[var(--color-border)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-[var(--color-red)]">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs leading-snug text-[var(--color-text-muted)]">{hint}</p>
      ) : null}
    </fieldset>
  );
}

function Message({ message }: { message: ChatMessage }) {
  const mine = message.role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-xl border px-3 py-2 text-[13.5px] leading-relaxed ${
          mine
            ? "border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 text-[var(--color-text)]"
            : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]"
        }`}
      >
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
          {mine ? "You" : "Assistant"}
        </p>
        {message.bullets ? (
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {message.bullets.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        {message.text && <p className={message.bullets ? "mt-1.5" : "mt-1"}>{message.text}</p>}
      </div>
    </div>
  );
}

/** The heading's name: the profile name onboarding stored, else "algo trader". */
function useDesignerName(): string {
  const { data } = useUserPreferences();
  const saved = data?.profile?.display_name?.trim();
  return saved || "algo trader";
}

export default function Design({ draft, setDraft, goTo }: StageProps) {
  const name = useDesignerName();
  // The guide is open until it is submitted (a returning, finished draft opens
  // straight into its chat). A saved draft of the old shape starts at step 1.
  const [submitted, setSubmitted] = useState(draft.designDone);
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [importPanel, setImportPanel] = useState<"explore" | "paste" | "file">("explore");
  const [pasteText, setPasteText] = useState("");
  // The title follows the choices until the user names it themselves.
  const [titleTouched, setTitleTouched] = useState(Boolean(draft.title.trim()));
  // A suggested description keeps up with the guide until the user edits it.
  const [howSuggested, setHowSuggested] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    draft.designDone ? [openingMessage(draft)] : [],
  );
  const [notes, setNotes] = useState<string[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const chatHeading = useRef<HTMLHeadingElement>(null);
  const chatLog = useRef<HTMLDivElement>(null);
  const guideHeading = useRef<HTMLHeadingElement>(null);
  const stepCard = useRef<HTMLDivElement>(null);
  const wantsChatFocus = useRef(false);
  const wantsGuideFocus = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turn = useRef(0);
  const seq = useRef(0);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Keep the newest message in view: the log is a fixed-height pane, and a
  // reply that scrolls itself out of sight reads as no reply at all.
  useEffect(() => {
    const log = chatLog.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, busy]);

  // Focus management: the chat's heading takes focus when it appears (the
  // guide's when "Edit guide" brings it back), and each step focuses its first
  // field, so a keyboard user lands in the right place.
  useEffect(() => {
    if (submitted && wantsChatFocus.current) {
      wantsChatFocus.current = false;
      chatHeading.current?.focus();
    }
    if (!submitted && wantsGuideFocus.current) {
      wantsGuideFocus.current = false;
      guideHeading.current?.focus();
    }
  }, [submitted]);

  useEffect(() => {
    if (submitted) return;
    const first = stepCard.current?.querySelector<HTMLElement>("[data-step-first]");
    first?.focus();
  }, [step, submitted]);

  /**
   * Write the draft. While the user has not named it, the title follows the
   * type, pair and bot kind — "BTC-USDT Market Making Bot" — and stops the
   * moment they type one, or accept a suggestion with "Use it".
   */
  const apply = (patch: Partial<Draft>) => {
    let next = patch;
    const merged = { ...draft, ...patch };
    if (patch.title === undefined && !titleTouched) {
      const suggested = suggestTitle(merged);
      if (suggested && suggested !== merged.title) next = { ...patch, title: suggested };
    }
    if (patch.howItWorks === undefined && howSuggested) {
      const suggested = suggestHowItWorks({ ...merged, ...next });
      if (suggested) next = { ...next, howItWorks: suggested };
    }
    setDraft(next);
  };

  /** Pairs are stored normalised, and the first one is what the later stages read. */
  const setPairsText = (text: string) => {
    const { valid } = parsePairs(text);
    apply({ pairsText: text, pairs: valid, pair: valid[0] ?? null });
  };

  const onExchange = (id: string) => {
    const exchange = id || null;
    const marketType = marketOptions(exchange, draft.strategyType).find(
      (option) => option.value === draft.marketType,
    )?.enabled
      ? draft.marketType
      : null;
    apply({ exchange, marketType });
  };

  const onStrategyType = (value: StrategyType) => {
    const marketType = marketOptions(draft.exchange, value).find(
      (option) => option.value === draft.marketType,
    )?.enabled
      ? draft.marketType
      : null;
    apply({ strategyType: value, marketType });
  };

  const applyCatalogItem = (item: CatalogItem) => {
    setTitleTouched(true);
    setHowSuggested(false);
    const fields = item.fields;
    const pairs = fields.pair ? [fields.pair] : [];
    apply({ ...fields, pairs, pairsText: pairs.join(", "), pair: pairs[0] ?? null, startingPoint: "import" });
    setImportPanel("explore");
  };

  const stepId: DesignStepId = DESIGN_STEPS[step].id;
  const problems = stepProblems(draft, stepId);
  const canAdvance = problems.length === 0;
  const lastStep = step === DESIGN_STEPS.length - 1;

  const goStep = (index: number) => {
    setStep(index);
    setFurthest((reached) => Math.max(reached, index));
  };

  const next = (event?: FormEvent) => {
    event?.preventDefault();
    if (!canAdvance) return;
    if (!lastStep) {
      goStep(step + 1);
      return;
    }
    startDesigning();
  };

  const startDesigning = () => {
    if (missingRequired(draft).length > 0) return;
    const nextDraft: Draft = { ...draft, title: draft.title.trim() };
    if (nextDraft.title !== draft.title) setDraft({ title: nextDraft.title });
    setMessages([openingMessage(nextDraft)]);
    turn.current = 0;
    setBusy(false);
    if (timer.current) clearTimeout(timer.current);
    wantsChatFocus.current = true;
    setSubmitted(true);
  };

  const editGuide = () => {
    wantsGuideFocus.current = true;
    setSubmitted(false);
  };

  const pushReply = (text: string) => {
    setBusy(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setMessages((list) => [...list, { id: `a${seq.current++}`, role: "assistant", text }]);
      setBusy(false);
      timer.current = null;
    }, 600);
  };

  const sendTyped = (event?: FormEvent) => {
    event?.preventDefault();
    const value = reply.trim();
    if (!value || busy) return;
    setMessages((list) => [...list, { id: `u${seq.current++}`, role: "user", text: value }]);
    setReply("");
    pushReply(cannedReply(turn.current++));
  };

  const sendSuggestion = (suggestion: (typeof SUGGESTIONS)[number]) => {
    if (busy) return;
    setMessages((list) => [...list, { id: `u${seq.current++}`, role: "user", text: suggestion.label }]);
    setNotes((list) => (list.includes(suggestion.note) ? list : [...list, suggestion.note]));
    pushReply(suggestion.reply);
    turn.current += 1;
  };

  const finish = () => {
    setDraft({ designDone: true });
    goTo("backtest");
  };

  /* ── The chat, once the guide is in ─────────────────────────────────── */

  if (submitted) {
    const chips = draftRows(draft).filter((row) => row.value !== "—");
    return (
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="eyebrow mr-1">Your draft</span>
          {chips.map((chip) => (
            <span
              key={chip.label}
              className="rounded-full border border-[var(--color-border)] px-2.5 py-0.5 text-[11.5px] text-[var(--color-text)]"
            >
              <span className="text-[var(--color-text-muted)]">{chip.label}: </span>
              <span className="font-medium">{chip.value}</span>
            </span>
          ))}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={editGuide}>
            <Pencil aria-hidden="true" />
            Edit guide
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="flex min-w-0 flex-col gap-3">
            <Card padded={false} className="min-w-0 overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-4 py-2.5">
                <MessageSquare aria-hidden="true" className="h-4 w-4 text-[var(--color-primary)]" />
                <h2
                  ref={chatHeading}
                  tabIndex={-1}
                  className="rounded text-md font-semibold text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/60"
                >
                  Design with the assistant
                </h2>
                <Badge tone="primary">Sample replies</Badge>
                {draft.designDone && (
                  <Badge tone="success" icon={<Check aria-hidden="true" />}>
                    Design done
                  </Badge>
                )}
              </div>

              <div
                ref={chatLog}
                role="log"
                aria-live="polite"
                aria-label="Design conversation"
                className="max-h-[26rem] min-h-[15rem] space-y-3 overflow-y-auto p-4"
              >
                {messages.map((message) => (
                  <Message key={message.id} message={message} />
                ))}
                {busy && (
                  <p role="status" className="text-xs text-[var(--color-text-muted)]">
                    Assistant is writing…
                  </p>
                )}
              </div>

              <div className="border-t border-[var(--color-border)] p-3">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Suggested replies">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      disabled={busy}
                      onClick={() => sendSuggestion(suggestion)}
                      className={`rounded-full border px-2.5 py-1 text-[12.5px] transition-colors disabled:opacity-40 ${CHIP_OFF}`}
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
                <form onSubmit={sendTyped} className="mt-2 flex items-center gap-2">
                  <Input
                    aria-label="Reply to the assistant"
                    placeholder="Type a reply, e.g. a 2% stop-loss on each position"
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="icon"
                    aria-label="Send reply"
                    disabled={!reply.trim() || busy}
                  >
                    <Send aria-hidden="true" />
                  </Button>
                </form>
                <p className="mt-1.5 text-[11px] leading-snug text-[var(--color-text-muted)]">
                  No network in this demo: the assistant's replies are canned sample text.
                </p>
              </div>
            </Card>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" size="lg" onClick={finish}>
                <Check aria-hidden="true" />
                I&apos;m done designing
              </Button>
              <Button variant="secondary" size="lg" onClick={editGuide}>
                <Pencil aria-hidden="true" />
                Back to guide
              </Button>
              <span className="text-xs text-[var(--color-text-muted)]">Next: Backtest, on sample data.</span>
            </div>
          </div>

          <Card className="h-fit min-w-0">
            <h3 className="text-md font-semibold text-[var(--color-text)]">Design notes</h3>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Accepted suggestions land here.</p>
            {notes.length === 0 ? (
              <p className="mt-3 rounded-md border border-dashed border-[var(--color-border)] p-2.5 text-xs leading-snug text-[var(--color-text-muted)]">
                Nothing yet. Accept a suggestion under the chat and it is written down here.
              </p>
            ) : (
              <ol className="mt-3 list-none space-y-2 p-0">
                {notes.map((note) => (
                  <li
                    key={note}
                    className="flex gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 text-[12px] leading-snug"
                  >
                    <Check aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-green)]" />
                    <span>{note}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    );
  }

  /* ── The wizard ─────────────────────────────────────────────────────── */

  const markets = marketOptions(draft.exchange, draft.strategyType);
  const selectedMarket = markets.find((option) => option.value === draft.marketType);
  const lpMarket = markets.find((option) => option.value === "LP");
  const suggestionTitle = suggestTitle(draft);
  const canSuggest = Boolean(draft.botKind && draft.strategyType && draft.exchange && draft.pair);
  const pairs = parsePairs(draft.pairsText);
  const spreads = parseSpreads(draft.spreads);

  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl">
      <div className="mb-3">
        <p className="eyebrow">Design guide</p>
        <h2
          ref={guideHeading}
          tabIndex={-1}
          className="mt-1 rounded text-lg font-semibold tracking-tight text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/60"
        >
          What are we building, {name}?
        </h2>
      </div>

      <DesignDots steps={DESIGN_STEPS} index={step} furthest={furthest} onJump={goStep} />

      <form onSubmit={next} noValidate>
        <div ref={stepCard}>
        <Card className="min-w-0">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Step {step + 1} of {DESIGN_STEPS.length}
              </p>
              <h3 className="mt-0.5 text-md font-semibold text-[var(--color-text)]">{DESIGN_STEPS[step].title}</h3>
            </div>
            <Badge tone="primary">Sample data</Badge>
          </div>

          {stepId === "starting" && (
            <div className="space-y-5">
              <ChoiceGroup
                legend="Bot type"
                ariaLabel="Bot type"
                first
                value={draft.botKind}
                onChange={(botKind) => apply({ botKind })}
                options={BOT_KINDS.map((kind) => ({
                  value: kind.value,
                  label: kind.label,
                  hint: kind.hint,
                }))}
              />
              <div className="grid gap-1.5 sm:grid-cols-2">
                {BOT_KINDS.map((kind) => (
                  <p
                    key={kind.value}
                    className={`text-[12px] leading-snug ${
                      draft.botKind === kind.value ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]"
                    }`}
                  >
                    <span className="font-semibold">{kind.label}:</span> {kind.hint}
                  </p>
                ))}
              </div>

              <fieldset className="min-w-0">
                <legend className="text-xs font-medium text-[var(--color-text)]">Starting point</legend>
                <div role="radiogroup" aria-label="Starting point" className="mt-1.5 grid gap-2 sm:grid-cols-2">
                  {STARTING_POINTS.map((point) => {
                    const active = draft.startingPoint === point.value;
                    return (
                      <button
                        key={point.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => {
                          apply({ startingPoint: point.value });
                          if (point.value === "import") setImportPanel("explore");
                        }}
                        className={`flex min-w-0 items-start gap-2 rounded-lg border p-3 text-left transition-colors ${
                          active
                            ? "border-[var(--color-primary)]/55 bg-[var(--color-primary)]/8"
                            : "border-[var(--color-border)] hover:border-[var(--color-border-hover)]"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                            active
                              ? "border-[var(--color-primary)]/55 text-[var(--color-primary)]"
                              : "border-[var(--color-border)] text-[var(--color-text-muted)]"
                          }`}
                        >
                          {point.value === "import" ? (
                            <Upload className="h-3.5 w-3.5" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span
                            className={`block text-md font-semibold ${
                              active ? "text-[var(--color-primary)]" : "text-[var(--color-text)]"
                            }`}
                          >
                            {point.label}
                          </span>
                          <span className="mt-0.5 block text-[12px] leading-snug text-[var(--color-text-muted)]">
                            {point.hint}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {draft.startingPoint === "import" && (
                  <div className={`mt-2 min-w-0 p-3 ${CARD}`}>
                    <div role="group" aria-label="Import from" className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { id: "explore", label: "From Learn" },
                          { id: "paste", label: "Paste" },
                          { id: "file", label: "File" },
                        ] as const
                      ).map((source) => (
                        <button
                          key={source.id}
                          type="button"
                          aria-pressed={importPanel === source.id}
                          onClick={() => setImportPanel(source.id)}
                          className={`rounded-full border px-2.5 py-1 text-[12.5px] transition-colors ${
                            importPanel === source.id ? CHIP_ON : CHIP_OFF
                          }`}
                        >
                          {source.label}
                        </button>
                      ))}
                    </div>

                    {importPanel === "explore" && (
                      <>
                        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                          The 14 Botcamp agents of Learn (sample): pick one to fill the guide.
                        </p>
                        <ul className="mt-1.5 max-h-44 list-none overflow-y-auto p-0">
                          {CATALOG_ITEMS.map((item) => (
                            <li key={item.id}>
                              <button
                                type="button"
                                onClick={() => applyCatalogItem(item)}
                                className="w-full min-w-0 rounded px-2 py-1.5 text-left text-[12.5px] hover:bg-[var(--color-surface-hover)]"
                              >
                                <span className="font-medium text-[var(--color-text)]">{item.name}</span>
                                <span className="ml-1.5 text-[var(--color-text-muted)]">
                                  {item.fields.strategyType} · {item.fields.exchange}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}

                    {importPanel === "paste" && (
                      <>
                        <textarea
                          aria-label="Paste a bot description"
                          rows={3}
                          value={pasteText}
                          onChange={(event) => setPasteText(event.target.value)}
                          placeholder="Paste a description, a config snippet or notes from a chat…"
                          className={`mt-2 ${TEXTAREA}`}
                        />
                        <div className="mt-2 flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="soft"
                            disabled={!pasteText.trim()}
                            onClick={() => {
                              setHowSuggested(false);
                              apply({ howItWorks: pasteText.trim(), startingPoint: "import" });
                              setPasteText("");
                            }}
                          >
                            Use this text
                          </Button>
                          <span className="text-[11.5px] text-[var(--color-text-muted)]">
                            It fills “How it works”; nothing is sent anywhere.
                          </span>
                        </div>
                      </>
                    )}

                    {importPanel === "file" && (
                      <>
                        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                          Sample files only: nothing is uploaded in this demo.
                        </p>
                        <ul className="mt-1.5 list-none space-y-1.5 p-0">
                          {IMPORT_FILES.map((file) => (
                            <li
                              key={file.id}
                              className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-[var(--color-border)] px-2.5 py-2"
                            >
                              <span className="min-w-0">
                                <span className="block truncate font-mono text-[12px] text-[var(--color-text)]">
                                  {file.name}
                                </span>
                                <span className="block text-[11.5px] text-[var(--color-text-muted)]">
                                  {file.detail}
                                </span>
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="ml-auto"
                                onClick={() => {
                                  setHowSuggested(false);
                                  apply({ howItWorks: file.howItWorks, startingPoint: "import" });
                                }}
                              >
                                Import sample
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </fieldset>
            </div>
          )}

          {stepId === "style" && (
            <fieldset className="min-w-0">
              <legend className="sr-only">Trading Style</legend>
              <div role="radiogroup" aria-label="Trading Style" className="flex flex-wrap gap-1.5">
                {STRATEGY_TYPES.map((type, i) => {
                  const active = draft.strategyType === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      title={type.hint}
                      data-step-first={i === 0 ? "true" : undefined}
                      onClick={() => onStrategyType(type.value)}
                      className={`rounded-full border px-3 py-1 text-[13px] transition-colors ${active ? CHIP_ON : CHIP_OFF}`}
                    >
                      {type.value}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs leading-snug text-[var(--color-text-muted)]">
                {strategyInfo(draft.strategyType)?.hint ??
                  "Pick one: hover a chip for what it does, and its line appears here."}
              </p>
            </fieldset>
          )}

          {stepId === "markets" && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Target exchange"
                  htmlFor="design-exchange"
                  hint={findExchange(draft.exchange)?.note ?? "Where the bot trades. Sample venues."}
                >
                  <Select
                    id="design-exchange"
                    data-step-first="true"
                    value={draft.exchange ?? ""}
                    onChange={(event) => onExchange(event.target.value)}
                  >
                    <option value="">Choose an exchange</option>
                    {EXCHANGES.map((exchange) => (
                      <option key={exchange.id} value={exchange.id}>
                        {exchange.label} {exchange.kind === "DEX" ? "· DEX" : ""}
                      </option>
                    ))}
                  </Select>
                </Field>

                <ChoiceGroup
                  legend="Market type"
                  ariaLabel="Market type"
                  value={draft.marketType}
                  onChange={(marketType) => apply({ marketType })}
                  hint={selectedMarket?.reason ?? lpMarket?.reason}
                  options={markets.map((market) => ({
                    value: market.value,
                    label: market.label,
                    disabled: !market.enabled,
                    reason: market.reason,
                    hint: market.reason,
                  }))}
                />
              </div>

              <CommaChips
                id="design-pairs"
                label="Market pair(s)"
                placeholder="ex: BTC-USDT, ETH-USDT"
                value={draft.pairsText}
                entries={pairs.valid}
                invalid={draft.pairsDynamic ? [] : pairs.invalid}
                disabled={draft.pairsDynamic}
                onChange={setPairsText}
                hint={
                  draft.pairsDynamic
                    ? "The agent picks the pairs, so this field is off."
                    : "Separate several pairs with commas. Each is BASE-QUOTE, e.g. BTC-USDT."
                }
              />

              <label className="flex items-start gap-2.5 rounded-lg border border-[var(--color-border)] p-3">
                <input
                  type="checkbox"
                  checked={draft.pairsDynamic}
                  onChange={(event) => apply({ pairsDynamic: event.target.checked })}
                  className="mt-0.5 h-3.5 w-3.5 accent-[var(--color-primary)]"
                />
                <span className="min-w-0">
                  <span className="block text-md font-semibold text-[var(--color-text)]">Dynamic</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-[var(--color-text-muted)]">
                    The agent picks pairs from market conditions, price levels or indicators.
                  </span>
                </span>
              </label>

              {!draft.pairsDynamic && !pairsReady(draft) && (
                <p className="text-xs text-[var(--color-red)]">Add at least one pair, or check Dynamic.</p>
              )}
            </div>
          )}

          {stepId === "limits" && (
            <div className="space-y-4">
              {spreadsShown(draft) && (
                <CommaChips
                  id="design-spreads"
                  label="Spreads (%)"
                  placeholder="ex: 0.1, 0.3, 0.5"
                  value={draft.spreads}
                  entries={spreads.valid.map((value) => String(value))}
                  invalid={spreads.invalid}
                  onChange={(text) => apply({ spreads: text })}
                  format={(entry) => `${entry}%`}
                  hint="Market making only: one or more spreads, each a positive percentage."
                />
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Target Profit (%)"
                  htmlFor="design-target-profit"
                  error={percentError(draft.targetProfit, "Target Profit") ?? undefined}
                  hint="Take profit when the position is this far ahead. Empty by default."
                >
                  <div className="relative">
                    <Input
                      id="design-target-profit"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.1"
                      placeholder="ex: 2"
                      value={draft.targetProfit ?? ""}
                      onChange={(event) =>
                        apply({ targetProfit: event.target.value === "" ? null : Number(event.target.value) })
                      }
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-[var(--color-text-muted)]">
                      %
                    </span>
                  </div>
                </Field>

                <Field
                  label="Stop Loss (%)"
                  htmlFor="design-stop-loss"
                  error={percentError(draft.stopLoss, "Stop Loss") ?? undefined}
                  hint="Close a position when it is this far against you. Empty by default."
                >
                  <div className="relative">
                    <Input
                      id="design-stop-loss"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.1"
                      placeholder="ex: 1.5"
                      value={draft.stopLoss ?? ""}
                      onChange={(event) =>
                        apply({ stopLoss: event.target.value === "" ? null : Number(event.target.value) })
                      }
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-[var(--color-text-muted)]">
                      %
                    </span>
                  </div>
                </Field>
              </div>

              <div className="min-w-0">
                <ChoiceGroup
                  legend="Max Positions"
                  ariaLabel="Max positions mode"
                  value={draft.maxPositionsMode}
                  onChange={(mode) =>
                    apply({
                      maxPositionsMode: mode,
                      maxPositions: mode === "dynamic" ? null : draft.maxPositions,
                    })
                  }
                  options={[
                    { value: "fixed" as const, label: "Fixed" },
                    { value: "dynamic" as const, label: "Dynamic" },
                  ]}
                  hint="Fixed: you set how many positions it may hold. Dynamic: the agent sizes it from your budget."
                />
                {draft.maxPositionsMode === "fixed" && (
                  <div className="mt-2 max-w-[12rem]">
                    <Field
                      label="Number of positions"
                      htmlFor="design-max-positions"
                      error={positionsError(draft.maxPositions) ?? undefined}
                    >
                      <Input
                        id="design-max-positions"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        step="1"
                        placeholder="ex: 4"
                        value={draft.maxPositions ?? ""}
                        onChange={(event) =>
                          apply({ maxPositions: event.target.value === "" ? null : Number(event.target.value) })
                        }
                      />
                    </Field>
                  </div>
                )}
                {draft.maxPositionsMode === "dynamic" && (
                  <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">Depends on your budget</p>
                )}
              </div>
            </div>
          )}

          {stepId === "review" && (
            <div className="space-y-4">
              <dl className="m-0 space-y-1.5">
                {draftRows(draft)
                  .filter((row) => row.label !== "Title")
                  .map((row) => (
                    <div key={row.label} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                      <dt className="shrink-0 text-[var(--color-text-muted)]">{row.label}</dt>
                      <dd
                        className={`m-0 min-w-0 text-right font-medium ${
                          row.value === "—" ? "text-[var(--color-text-muted)]" : "text-[var(--color-text)]"
                        }`}
                      >
                        {row.value}
                      </dd>
                    </div>
                  ))}
              </dl>

              <div className="border-t border-[var(--color-border)] pt-4">
                <Field
                  label="How the strategy or agent works"
                  htmlFor="design-how"
                  hint={`${draft.howItWorks.length}/400 characters. Optional, but the assistant asks better questions with it.`}
                >
                  <textarea
                    id="design-how"
                    rows={4}
                    maxLength={400}
                    value={draft.howItWorks}
                    onChange={(event) => {
                      setHowSuggested(false);
                      apply({ howItWorks: event.target.value });
                    }}
                    placeholder="e.g. Quote both sides of BTC-USDT on Binance spot with a 0.12% band, size each quote from 1% of the book, and stop out a position at 2% against entry."
                    className={TEXTAREA}
                  />
                </Field>
                <button
                  type="button"
                  disabled={!canSuggest}
                  title={canSuggest ? "Write a sentence from your choices" : "Pick a style, exchange and pair first"}
                  onClick={() => {
                    setHowSuggested(true);
                    apply({ howItWorks: suggestHowItWorks(draft) });
                  }}
                  className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${CHIP_OFF}`}
                >
                  <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                  Suggest from my choices
                </button>
              </div>

              <Field
                label="Desired title"
                htmlFor="design-title"
                hint={
                  suggestionTitle && suggestionTitle !== draft.title ? (
                    <>
                      Suggested: <span className="font-medium text-[var(--color-text)]">{suggestionTitle}</span>{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setTitleTouched(true);
                          apply({ title: suggestionTitle });
                        }}
                        className="underline underline-offset-2 hover:text-[var(--color-text)]"
                      >
                        Use it
                      </button>
                    </>
                  ) : (
                    "The name this bot will carry through Backtest, Dry Run and Deploy."
                  )
                }
              >
                <Input
                  id="design-title"
                  data-step-first="true"
                  value={draft.title}
                  placeholder={suggestionTitle || "e.g. BTC-USDT Market Making Bot"}
                  onChange={(event) => {
                    setTitleTouched(true);
                    apply({ title: event.target.value });
                  }}
                />
              </Field>
            </div>
          )}
        </Card>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => goStep(Math.max(step - 1, 0))}
            disabled={step === 0}
          >
            Back
          </Button>
          <Button type="submit" variant="primary" disabled={!canAdvance}>
            {lastStep ? "Start designing" : "Next"}
          </Button>
          <p role="status" className="text-[12px] leading-snug text-[var(--color-text-muted)]">
            {canAdvance
              ? lastStep
                ? "Ready: the assistant will take it from here."
                : "Answers are kept as you go."
              : `Still needed: ${problems.join(", ")}.`}
          </p>
        </div>
      </form>
    </div>
  );
}
