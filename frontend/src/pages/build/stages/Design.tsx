/**
 * Design, stage 1 of 5: the guide form, its live "Your draft" panel, and the
 * design chat that follows once the guide is submitted.
 *
 * The guide is one card of grouped fields with sensible defaults and inline
 * validation; the summary panel sits beside it on desktop and above the action
 * on a phone. Submitting collapses the guide to a chip bar ("Edit guide"
 * reopens it) and opens a chat with the assistant: the first message restates
 * the draft in three bullets and asks one question, typed replies get a canned
 * answer after a short delay, and accepted suggestions grow the Design notes.
 * "I'm done designing" writes `designDone` and moves to Backtest.
 *
 * Showcase only: every value is sample data, the assistant is canned text and
 * nothing here calls the API. State is the draft's (`setDraft`) plus the chat's
 * own local state.
 */

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Check, MessageSquare, Pencil, Send, Sparkles, Upload } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";

import { CATALOG_ITEMS, type CatalogItem } from "../sample/catalog";
import {
  BOT_KINDS,
  cannedReply,
  draftRows,
  EXCHANGES,
  findExchange,
  IMPORT_FILES,
  MARKET_QTY_OPTIONS,
  MAX_POSITIONS_OPTIONS,
  marketOptions,
  missingRequired,
  openingMessage,
  pairsFor,
  REQUIRED_FIELDS,
  STARTING_POINTS,
  STRATEGY_TYPES,
  strategyInfo,
  SUGGESTIONS,
  suggestHowItWorks,
  suggestTitle,
  type ChatMessage,
  type MarketOption,
} from "../sample/designData";
import type { Draft, StageProps, StrategyType } from "../types";

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
  options,
  value,
  onChange,
  hint,
  error,
  ariaLabel,
}: {
  legend: ReactNode;
  options: { value: T; label: string; hint?: string; disabled?: boolean; reason?: string }[];
  value: T | null;
  onChange: (value: T) => void;
  hint?: ReactNode;
  error?: string;
  ariaLabel?: string;
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
        className={`max-w-[86%] rounded-lg border px-3 py-2 text-[13px] leading-relaxed ${
          mine
            ? "border-[var(--color-primary)]/35 bg-[var(--color-primary)]/10"
            : "border-[var(--color-border)] bg-[var(--color-bg)]"
        }`}
      >
        <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
          {mine ? "You" : "Assistant"}
        </p>
        {message.bullets && (
          <ul className="mb-2 list-disc space-y-1 pl-4 text-[var(--color-text)]">
            {message.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        )}
        {message.text && <p className="text-[var(--color-text)]">{message.text}</p>}
      </div>
    </div>
  );
}

export default function Design({ draft, setDraft, goTo }: StageProps) {
  // The guide is open until it is submitted (a returning, finished draft opens
  // straight into its chat).
  const [submitted, setSubmitted] = useState(draft.designDone);
  const [tried, setTried] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<string, boolean>>>({});
  const [importPanel, setImportPanel] = useState<"explore" | "paste" | "file">("explore");
  const [pasteText, setPasteText] = useState("");
  const [pairQuery, setPairQuery] = useState(draft.pair ?? "");
  const [pairOpen, setPairOpen] = useState(false);
  const [pairIndex, setPairIndex] = useState(0);
  const [pairKeyboard, setPairKeyboard] = useState(false);
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
  // guide's does when "Edit guide" brings it back), so a keyboard user lands in
  // the right place instead of at the top of the page.
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

  const mark = (key: string) => setTouched((list) => ({ ...list, [key]: true }));

  const errorFor = (key: (typeof REQUIRED_FIELDS)[number]["key"]) => {
    const field = REQUIRED_FIELDS.find((row) => row.key === key);
    if (!field || (!touched[key] && !tried) || field.filled(draft)) return undefined;
    return `${field.label} is required.`;
  };

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

  const onExchange = (id: string) => {
    const exchange = id || null;
    const pairs = pairsFor(exchange);
    const pair = draft.pair && pairs.includes(draft.pair) ? draft.pair : null;
    const marketType =
      marketOptions(exchange, draft.strategyType).find((option) => option.value === draft.marketType)?.enabled
        ? draft.marketType
        : null;
    setPairQuery(pair ?? "");
    apply({ exchange, pair, marketType });
  };

  const onStrategyType = (value: StrategyType) => {
    const marketType = marketOptions(draft.exchange, value).find(
      (option) => option.value === draft.marketType,
    )?.enabled
      ? draft.marketType
      : null;
    apply({ strategyType: value, marketType });
  };

  const choosePair = (pair: string) => {
    setPairQuery(pair);
    setPairOpen(false);
    setPairKeyboard(false);
    apply({ pair });
  };

  const onPairText = (value: string) => {
    setPairQuery(value);
    setPairOpen(true);
    setPairIndex(0);
    setPairKeyboard(false);
    apply({ pair: value.trim() ? value.trim().toUpperCase() : null });
  };

  const filteredPairs = pairsFor(draft.exchange).filter((pair) =>
    pair.toLowerCase().includes(pairQuery.trim().toLowerCase()),
  );

  const onPairKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      // Closing the list is the only thing Escape does here: nothing is lost.
      setPairOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setPairOpen(true);
      setPairKeyboard(true);
      setPairIndex((index) => {
        const step = event.key === "ArrowDown" ? 1 : -1;
        if (filteredPairs.length === 0) return 0;
        return (index + step + filteredPairs.length) % filteredPairs.length;
      });
      return;
    }
    if (event.key === "Enter" && pairOpen && filteredPairs[pairIndex]) {
      event.preventDefault();
      choosePair(filteredPairs[pairIndex]);
    }
  };

  const applyCatalogItem = (item: CatalogItem) => {
    setTitleTouched(true);
    setHowSuggested(false);
    apply({ ...item.fields, startingPoint: "import" });
    setPairQuery(item.fields.pair ?? "");
    setImportPanel("explore");
  };

  const startDesigning = (event?: FormEvent) => {
    event?.preventDefault();
    setTried(true);
    if (missingRequired(draft).length > 0) return;
    const next: Draft = {
      ...draft,
      marketQty: draft.marketQty ?? 1,
      maxPositions: draft.maxPositions ?? 3,
      startingPoint: draft.startingPoint ?? "scratch",
      title: draft.title.trim(),
    };
    if (
      draft.marketQty === null ||
      draft.maxPositions === null ||
      draft.startingPoint === null ||
      next.title !== draft.title
    ) {
      setDraft({
        marketQty: next.marketQty,
        maxPositions: next.maxPositions,
        startingPoint: next.startingPoint,
        title: next.title,
      });
    }
    setMessages([openingMessage(next)]);
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

  /* ── The guide ──────────────────────────────────────────────────────── */

  const missing = missingRequired(draft);
  const canStart = missing.length === 0;
  const markets = marketOptions(draft.exchange, draft.strategyType);
  const selectedMarket: MarketOption | undefined = markets.find((option) => option.value === draft.marketType);
  const lpMarket = markets.find((option) => option.value === "LP");
  const suggestionTitle = suggestTitle(draft);
  const canSuggest = Boolean(draft.botKind && draft.strategyType && draft.exchange && draft.pair);

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card className="min-w-0">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">Design guide</p>
            <h2
              ref={guideHeading}
              tabIndex={-1}
              className="mt-1 rounded text-lg font-semibold tracking-tight text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/60"
            >
              What are we building?
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Nine answers, then the assistant takes it from there.
            </p>
          </div>
          <Badge tone="primary">Sample data</Badge>
        </div>

        <form id="design-guide" onSubmit={startDesigning} className="space-y-5" noValidate>
          <div>
            <ChoiceGroup
              legend="Bot type"
              ariaLabel="Bot type"
              value={draft.botKind}
              onChange={(botKind) => apply({ botKind })}
              error={errorFor("botKind")}
              options={BOT_KINDS.map((kind) => ({ value: kind.value, label: kind.label, hint: kind.hint }))}
            />
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {BOT_KINDS.map((kind) => (
                <p
                  key={kind.value}
                  className={`text-[12px] leading-snug ${
                    draft.botKind === kind.value
                      ? "text-[var(--color-text)]"
                      : "text-[var(--color-text-muted)]"
                  }`}
                >
                  <span className="font-semibold">{kind.label}:</span> {kind.hint}
                </p>
              ))}
            </div>
          </div>

          <fieldset className="min-w-0">
            <legend className="text-xs font-medium text-[var(--color-text)]">Strategy or agent type</legend>
            <div role="radiogroup" aria-label="Strategy or agent type" className="mt-1.5 flex flex-wrap gap-1.5">
              {STRATEGY_TYPES.map((type) => {
                const active = draft.strategyType === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    title={type.hint}
                    onClick={() => onStrategyType(type.value)}
                    className={`rounded-full border px-3 py-1 text-[13px] transition-colors ${active ? CHIP_ON : CHIP_OFF}`}
                  >
                    {type.value}
                  </button>
                );
              })}
            </div>
            {errorFor("strategyType") ? (
              <p className="mt-1.5 text-xs text-[var(--color-red)]">{errorFor("strategyType")}</p>
            ) : (
              <p className="mt-1.5 text-xs leading-snug text-[var(--color-text-muted)]">
                {strategyInfo(draft.strategyType)?.hint ??
                  "Pick one: hover a chip for what it does, and its line appears here."}
              </p>
            )}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Target exchange"
              htmlFor="design-exchange"
              error={errorFor("exchange")}
              hint={findExchange(draft.exchange)?.note ?? "Where the bot trades. Sample venues and pairs."}
            >
              <Select
                id="design-exchange"
                value={draft.exchange ?? ""}
                onChange={(event) => onExchange(event.target.value)}
                onBlur={() => mark("exchange")}
              >
                <option value="">Choose an exchange</option>
                {EXCHANGES.map((exchange) => (
                  <option key={exchange.id} value={exchange.id}>
                    {exchange.label} {exchange.kind === "DEX" ? "· DEX" : ""}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Market pair"
              htmlFor="design-pair"
              error={errorFor("pair")}
              hint={
                draft.exchange
                  ? "Search the venue's sample pairs, or type your own."
                  : "Pick an exchange first: the list follows the venue."
              }
            >
              <div className="relative">
                <Input
                  id="design-pair"
                  role="combobox"
                  aria-expanded={pairOpen && Boolean(draft.exchange)}
                  aria-controls="design-pair-list"
                  aria-autocomplete="list"
                  autoComplete="off"
                  disabled={!draft.exchange}
                  placeholder={draft.exchange ? "Search pairs, e.g. BTC-USDT" : "Pick an exchange first"}
                  value={pairQuery}
                  onChange={(event) => onPairText(event.target.value)}
                  onFocus={() => setPairOpen(true)}
                  onBlur={() => {
                    setPairOpen(false);
                    mark("pair");
                  }}
                  onKeyDown={onPairKeyDown}
                />
                {pairOpen && draft.exchange && (
                  <ul
                    id="design-pair-list"
                    role="listbox"
                    aria-label="Market pairs"
                    className={`absolute z-20 mt-1 max-h-56 w-full list-none overflow-y-auto rounded-md p-1 shadow-xl ${CARD}`}
                  >
                    {filteredPairs.length === 0 && (
                      <li className="px-2 py-1.5 text-xs text-[var(--color-text-muted)]">
                        No sample pair matches. You can still type it.
                      </li>
                    )}
                    {filteredPairs.map((pair, index) => (
                      <li key={pair}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={pair === draft.pair}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => choosePair(pair)}
                          className={`w-full rounded px-2 py-1.5 text-left text-[12.5px] tabular-nums ${
                            pair === draft.pair
                              ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                              : pairKeyboard && index === pairIndex
                                ? "bg-[var(--color-surface-hover)] text-[var(--color-text)]"
                                : "text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
                          }`}
                        >
                          {pair}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Field>
          </div>

          <ChoiceGroup
            legend="Market type"
            ariaLabel="Market type"
            value={draft.marketType}
            onChange={(marketType) => apply({ marketType })}
            error={errorFor("marketType")}
            hint={selectedMarket?.reason ?? lpMarket?.reason}
            options={markets.map((market) => ({
              value: market.value,
              label: market.label,
              disabled: !market.enabled,
              reason: market.reason,
              hint: market.reason,
            }))}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <ChoiceGroup
              legend="Markets"
              ariaLabel="How many markets"
              value={draft.marketQty ?? 1}
              onChange={(marketQty) => apply({ marketQty })}
              hint="How many pairs the bot watches at once."
              options={MARKET_QTY_OPTIONS.map((count) => ({ value: count, label: String(count) }))}
            />
            <ChoiceGroup
              legend="Max positions"
              ariaLabel="Maximum open positions"
              value={draft.maxPositions ?? 3}
              onChange={(maxPositions) => apply({ maxPositions })}
              hint="Open positions it may hold at the same time."
              options={MAX_POSITIONS_OPTIONS.map((count) => ({ value: count, label: String(count) }))}
            />
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
                      <span className={`block text-md font-semibold ${active ? "text-[var(--color-primary)]" : "text-[var(--color-text)]"}`}>
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
                      { id: "explore", label: "From Explore" },
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
                      The 14 Botcamp agents of Explore (sample): pick one to fill the guide.
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
                            <span className="block text-[11.5px] text-[var(--color-text-muted)]">{file.detail}</span>
                          </span>
                          <Button
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

          <div className="min-w-0">
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
              title={canSuggest ? "Write a sentence from your choices" : "Pick a type, exchange and pair first"}
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
            error={errorFor("title")}
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
              value={draft.title}
              placeholder={suggestionTitle || "e.g. BTC-USDT Market Making Bot"}
              onChange={(event) => {
                setTitleTouched(true);
                apply({ title: event.target.value });
              }}
              onBlur={() => mark("title")}
            />
          </Field>
        </form>
      </Card>

      <aside className="flex min-w-0 flex-col gap-3">
        <Card className="min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-md font-semibold text-[var(--color-text)]">Your draft</h3>
            <Badge tone="neutral">Live</Badge>
          </div>
          <dl className="mt-3 space-y-1.5">
            {draftRows(draft).map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                <dt className="shrink-0 text-[var(--color-text-muted)]">{row.label}</dt>
                <dd
                  className={`m-0 min-w-0 truncate text-right font-medium ${
                    row.value === "—" ? "text-[var(--color-text-muted)]" : "text-[var(--color-text)]"
                  }`}
                  title={row.value}
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
          {draft.howItWorks.trim() && (
            <p className="mt-3 line-clamp-4 border-t border-[var(--color-border)] pt-2 text-[11.5px] leading-snug text-[var(--color-text-muted)]">
              {draft.howItWorks}
            </p>
          )}
        </Card>

        <div>
          <Button type="submit" form="design-guide" variant="primary" size="lg" className="w-full" disabled={!canStart}>
            Start designing
          </Button>
          <p role="status" className="mt-2 text-[12px] leading-snug text-[var(--color-text-muted)]">
            {canStart ? "Ready: the assistant will take it from here." : `Still needed: ${missing.join(", ")}.`}
          </p>
        </div>
      </aside>
    </div>
  );
}
