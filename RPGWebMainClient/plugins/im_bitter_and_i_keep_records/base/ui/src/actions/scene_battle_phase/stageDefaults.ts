import type { StageKey } from './stageTypes';

export function getDefaultDraft(stageKey: StageKey, _value: Record<string, unknown>) {
  switch (stageKey) {
    case 'switch_phase.confirm':
      return {
        decision: null as 'confirm' | 'cancel' | null,
        force: false,
      };
    case 'done':
    default:
      return {};
  }
}
