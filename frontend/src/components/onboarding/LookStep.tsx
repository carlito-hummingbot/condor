import { Eye, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  CURRENCY_OPTIONS,
  useDisplayCurrency,
  type DisplayCurrency,
} from "@/hooks/useDisplayCurrency";
import { useTheme, type Theme } from "@/hooks/useTheme";
import type { PreferencePatch } from "@/lib/onboarding";

import type { WizardAction } from "./MakeItYoursStep";

/**
 * Theme, colour-blind mode and display currency. Changes apply immediately,
 * the same controls as Settings and the top bar, and are saved on Next.
 */
export function LookStep({
  busy,
  onContinue,
  onBind,
}: {
  busy: boolean;
  onContinue: (patch: PreferencePatch) => void;
  onBind: (action: WizardAction | null) => void;
}) {
  const { theme, setTheme, colorblind, setColorblind } = useTheme();
  const { currency, setCurrency } = useDisplayCurrency();
  const [pickedTheme, setPickedTheme] = useState(theme);
  const [pickedBlind, setPickedBlind] = useState(colorblind);
  const [pickedCurrency, setPickedCurrency] = useState(currency);
  const continueRef = useRef(onContinue);
  useEffect(() => {
    continueRef.current = onContinue;
  }, [onContinue]);

  useEffect(() => {
    onBind({
      label: "Next",
      disabled: busy,
      run: () =>
        continueRef.current({
          ui: { theme: pickedTheme, colorblind: pickedBlind, currency: pickedCurrency },
        }),
    });
    return () => onBind(null);
  }, [busy, onBind, pickedTheme, pickedBlind, pickedCurrency]);

  return (
    <div>
      <h2 id="onboarding-title" className="text-xl font-bold text-[var(--color-text)]">
        Look & units
      </h2>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        These apply as you change them. Skip keeps the current device settings.
      </p>
      <div className="mt-4 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-medium text-[var(--color-text)]">Theme</span>
          <SegmentedControl<Theme>
            aria-label="Theme"
            value={pickedTheme}
            onChange={(next) => {
              setPickedTheme(next);
              setTheme(next);
            }}
            options={[
              { value: "light", label: "Light", icon: <Sun /> },
              { value: "dark", label: "Dark", icon: <Moon /> },
            ]}
          />
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-[var(--color-border)] pt-4">
          <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text)]">
            <Eye className="h-4 w-4 text-[var(--color-text-muted)]" />
            Colour-blind mode
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={pickedBlind}
            aria-label="Colour-blind mode"
            onClick={() => {
              const next = !pickedBlind;
              setPickedBlind(next);
              setColorblind(next);
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              pickedBlind ? "bg-[var(--color-primary-fill)]" : "bg-[var(--color-border)]"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                pickedBlind ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
        <div className="border-t border-[var(--color-border)] pt-4">
          <span className="text-sm font-medium text-[var(--color-text)]">Display currency</span>
          <div className="mt-2">
            <SegmentedControl<DisplayCurrency>
              aria-label="Display currency"
              fullWidth
              value={pickedCurrency}
              onChange={(next) => {
                setPickedCurrency(next);
                setCurrency(next);
              }}
              options={CURRENCY_OPTIONS.map((item) => ({ value: item, label: item }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
