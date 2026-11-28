/**
 * The Build page's nav: one row of five stages, and nothing above it.
 *
 * Design · Backtest · Dry Run · Deploy · Improve, numbered so the lifecycle is
 * legible at a glance ("1 Design" … "5 Improve"). It is the same `PageNav` as
 * Dashboard's and Explore's, so all three pages share one yellow pill look; the
 * old extra stepper is gone, because two bars for one set of stages read as an
 * accident.
 *
 * The stages stay freely clickable — the draft's flags colour nothing here and
 * never lock a jump; `Build` shows the gentle notice when a predecessor is
 * unfinished.
 */

import { PageNav } from "@/components/nav/PageNav";

import { STAGE_LABEL, STAGES } from "./draftStore";
import type { StageId } from "./types";

export function BuildNav({ stage, onStage }: { stage: StageId; onStage: (stage: StageId) => void }) {
  return (
    <PageNav
      label="Build stages"
      idPrefix="build"
      current={stage}
      onSelect={(id) => onStage(id as StageId)}
      items={STAGES.map((id, i) => ({ id, label: `${i + 1} ${STAGE_LABEL[id]}` }))}
    />
  );
}
