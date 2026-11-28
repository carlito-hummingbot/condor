/**
 * What a stage shows before its own component has landed.
 *
 * The page always works: the tab row, the stepper, the draft and the guards are
 * the shell's, so a stage that is still being written is a heading and one line
 * rather than a blank panel. `Build` swaps in the real component the moment it
 * exists; the placeholder is never imported by a stage patch.
 */

import { STAGE_HINT, STAGE_LABEL } from "../draftStore";
import type { StageId, StageProps } from "../types";

export default function Placeholder({ stage }: StageProps & { stage: StageId }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-border)] p-5">
      <h2 className="text-[17px] font-bold text-[var(--color-text)]">{STAGE_LABEL[stage]}</h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--color-text-muted)]">
        {STAGE_HINT[stage]}. This stage is still being built: the tabs, the stepper and your draft
        already work, so you can move on and come back.
      </p>
    </div>
  );
}
