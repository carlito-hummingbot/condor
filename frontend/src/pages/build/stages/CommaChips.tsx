/**
 * A comma field: type "BTC-USDT, ETH-USDT", get chips under the box.
 *
 * The one control the Markets and Limits steps share. It keeps the raw text (so
 * going Back, or checking Dynamic and unchecking it, never loses what was
 * typed) and reports the parsed entries back through `onChange`. Each entry is
 * normalised — trimmed, uppercased where the caller asks, de-duplicated — and a
 * bad one is flagged inline without blocking the good ones, which is why the
 * parse returns two lists.
 *
 * A chip's × removes that entry from the text. Everything is sample data; the
 * values go into the draft and nowhere else.
 */

import { X } from "lucide-react";

import { Input } from "@/components/ui/Field";

export function CommaChips({
  id,
  label,
  hint,
  placeholder,
  value,
  entries,
  invalid,
  disabled,
  error,
  onChange,
  format = (entry) => entry,
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  placeholder: string;
  /** The raw text, exactly as typed. */
  value: string;
  /** The good entries, already normalised by the caller's parser. */
  entries: readonly string[];
  /** The entries that did not parse, shown in the error colour. */
  invalid: readonly string[];
  disabled?: boolean;
  error?: string | null;
  onChange: (next: string) => void;
  /** How an entry is shown on its chip (pairs add nothing, spreads add "%"). */
  format?: (entry: string) => string;
}) {
  const remove = (entry: string) => {
    // Drop the entry from the typed text, leaving the rest as they were.
    const kept = value
      .split(",")
      .filter((part) => part.trim().toUpperCase() !== entry.toUpperCase());
    onChange(kept.join(", ").replace(/^[,\s]+|[,\s]+$/g, ""));
  };

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <label htmlFor={id} className="text-xs font-medium text-[var(--color-text)]">
          {label}
        </label>
      </div>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        aria-invalid={invalid.length > 0 || Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
        className={disabled ? "opacity-50" : undefined}
      />
      {entries.length > 0 && (
        <ul aria-label={`${label} entries`} className="m-0 mt-1.5 flex list-none flex-wrap gap-1.5 p-0">
          {entries.map((entry) => (
            <li key={entry}>
              <span
                className={`inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-0.5 text-[12px] text-[var(--color-text)] ${
                  disabled ? "opacity-50" : ""
                }`}
              >
                {format(entry)}
                <button
                  type="button"
                  aria-label={`Remove ${format(entry)}`}
                  disabled={disabled}
                  onClick={() => remove(entry)}
                  className="rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:cursor-not-allowed"
                >
                  <X aria-hidden="true" className="h-3 w-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {invalid.length > 0 && (
        <p role="alert" className="mt-1.5 text-xs text-[var(--color-red)]">
          Not reading as a valid entry: {invalid.join(", ")}.
        </p>
      )}
      {error && !invalid.length && <p className="mt-1.5 text-xs text-[var(--color-red)]">{error}</p>}
      {hint && <p className="mt-1.5 text-xs leading-snug text-[var(--color-text-muted)]">{hint}</p>}
    </div>
  );
}
