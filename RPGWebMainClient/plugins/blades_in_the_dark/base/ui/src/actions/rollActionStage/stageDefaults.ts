import type { StageKey } from './stageTypes';
import { ACTIONS } from './stageTypes'; // или откуда у тебя ACTIONS

export function getDefaultDraft(stageKey: StageKey, value: any) {
  switch (stageKey) {
    case 'choose_action':
      return {
        action: value?.action ?? ACTIONS[0],
        character_id: value?.character_id ?? null,
        item_id: value?.item_id ?? null,
      };

    case 'gm_set_position_effect':
      return {
        position: value?.position ?? 'risky',
        effect: value?.effect ?? 'standard',
        consequence_hint: value?.consequence_hint ?? '',
      };

    case 'player_add_mods':
      return {
        push: value?.push ?? false,
        help: value?.help ?? false,
        helper_user_id: value?.helper_user_id ?? null,
        devils_bargain: value?.devils_bargain ?? false,
        bonus_dice: value?.bonus_dice ?? 0,
      };

    case 'assist_confirm':
      return { accept_help: value?.accept_help ?? true };

    case 'gm_finalize':
      return {
        allow: value?.allow ?? true,
        action: value?.action ?? null,     // NEW
        item_id: value?.item_id ?? null,   // NEW
        position: value?.position ?? null,
        effect: value?.effect ?? null,
        consequence_hint: value?.consequence_hint ?? null,
      };

    case 'prerollconfirm':
      return { choice: value?.choice ?? 'accept' };

    case 'mitigate':
      return { choice: value?.choice ?? 'accept' };

    case 'resist':
      return { confirm_resist: value?.confirm_resist ?? true };

    case 'wrap_up':
      return { trauma: value?.trauma ?? null, summary: value?.summary ?? null };

    case 'done':
    default:
      return {};
  }
}
