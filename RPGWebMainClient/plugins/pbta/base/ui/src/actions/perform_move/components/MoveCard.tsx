// ─── perform_move/components/MoveCard.tsx ───────────────────────────────────
'use client';

import type { OutcomeKind, MoveLite } from '../types';
import { MoveExpandable, toMoveDisplayData, type MoveOutcomeKind } from '../../../shared/moves';

export function MoveCard({
  move,
  outcome,
  resultText,
  className,
  statScores,
  skills,
  playbookTitle,
  defaultExpanded,
}: {
  move: MoveLite | null | undefined;
  outcome?: OutcomeKind | null;
  resultText?: string | null;
  className?: string;
  statScores?: Array<{ sid: string; score: number; mod: number }>;
  skills?: Array<{ id: string; title: string; color: string }>;
  playbookTitle?: string | null;
  defaultExpanded?: boolean;
}) {
  if (!move) return null;

  return (
    <MoveExpandable
      move={toMoveDisplayData(move)}
      statScores={statScores}
      skills={skills}
      playbookTitle={playbookTitle}
      outcome={outcome as MoveOutcomeKind | null}
      resultText={resultText}
      defaultExpanded={defaultExpanded}
      highlighted
      className={className}
    />
  );
}

export { MoveBrief, MoveExpandable, toMoveDisplayData } from '../../../shared/moves';
