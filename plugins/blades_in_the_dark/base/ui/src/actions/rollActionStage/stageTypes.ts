export type StageKey =
  | 'choose_action'
  | 'gm_set_position_effect'
  | 'player_add_mods'
  | 'assist_confirm'
  | 'gm_finalize'
  | 'prerollconfirm'
  | 'mitigate'
  | 'resist'
  | 'wrap_up'
  | 'done';


export const ACTIONS = ['hunt', 'study', 'survey', 'tinker', 'finesse', 'prowl', 'skirmish', 'wreck', 'attune', 'command', 'consort', 'sway'] as const;
export const POSITIONS = ['controlled', 'risky', 'desperate'] as const;
export const EFFECTS = ['limited', 'standard', 'great'] as const;
