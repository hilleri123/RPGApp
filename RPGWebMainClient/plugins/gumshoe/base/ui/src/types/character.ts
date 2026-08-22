/** ===== Skills config (из SkillsCodex.as_config()) ===== */

import { SkillsConfig } from "./skills";

export type CharacterPoints = {
  investigativeMax: number; // >= 0
  generalMax: number;       // >= 0
};


export type CharacterInjury = {
  level: number;
  tags: string[];
  text: string;
};

export type CharacterData = {
  hit_difficulty: number;
  skills: Record<string, number>; 
  initial_skills: Record<string, number>; 
  bonus_skills: Record<string, number>; 
  points: CharacterPoints;
  injuries: CharacterInjury[];

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