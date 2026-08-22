import type { ReactNode } from 'react';
import type { Move, MoveStatScore, PbtaSkill, MovePlaceholder } from '../../types';

export type MoveDisplayData = {
  id: string;
  title: string;
  kind?: string;
  summary?: string;
  trigger?: string;
  effect?: string;
  effect_10_plus?: string;
  effect_7_9?: string;
  effect_6_minus?: string;
  available_stats?: string[];
};

export type MoveOutcomeKind = 'hit_10_plus' | 'hit_7_9' | 'miss_6_minus';

export type MoveBriefProps = {
  move: MoveDisplayData;
  statScores?: MoveStatScore[];
  skills?: PbtaSkill[];
  playbookTitle?: string | null;
  hideModBadge?: boolean;
  checked?: boolean;
  isStarting?: boolean;
  disabled?: boolean;
  disabledHint?: string;
  highlighted?: boolean;
  trailing?: ReactNode;
  /** Подпись уровня/типа (старт, ур. 2+, ур. 6+) */
  tierBadge?: string;
  onHeaderClick?: () => void;
  className?: string;
};

export type MoveExpandableProps = MoveBriefProps & {
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (open: boolean) => void;
  onToggle?: (checked: boolean) => void;
  outcome?: MoveOutcomeKind | null;
  resultText?: string | null;
  showRollOutcomes?: boolean;
  placeholders?: MovePlaceholder[];
  picks?: Record<string, string>;
  displayMode?: 'edit' | 'view';
  movesMap?: Map<string, Move>;
  placeholderEditor?: ReactNode;
  /** Режим листа: текст хода редактируется только при textSheetEditing */
  textSheetEditing?: boolean;
  onTextSheetEdit?: () => void;
};

export type { Move, MoveStatScore, PbtaSkill };
