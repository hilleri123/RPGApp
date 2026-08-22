/** ===== Skills config (из SkillsCodex.as_config()) ===== */

import { CharacterData as BaseCharacterData } from "@/plugins/gumshoe/base/ui/src/types";


export type TaskBonusDefinition = {
  id?: string;
  description: string
  bonus: number
}

export type TaskBonusRecord = {
  task_id?: string
  description: string
  bonus: number
  confirmed_at?: string
}

export type CharacterData = BaseCharacterData & {
  role: string;
  tasks: TaskBonusDefinition[];
  bonuses: TaskBonusRecord[];
};
