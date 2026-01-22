/** ===== Skills config (из SkillsCodex.as_config()) ===== */

import { SkillsConfig } from "./skills";

export type CharacterPoints = {
  investigativeMax: number; // >= 0
  generalMax: number;       // >= 0
};

export type CharacterData = {
  skills: Record<string, number>; // rating >= 0
  points: CharacterPoints;
  skill_points?: {
    investigativeTotal: number;
    generalTotal: number;
  };
};

export type CharacterConfig = SkillsConfig & {
  constraints?: {
    defaultInvestigativePoints?: number;
    defaultGeneralPoints?: number;
  };
  initialData: CharacterData;
};