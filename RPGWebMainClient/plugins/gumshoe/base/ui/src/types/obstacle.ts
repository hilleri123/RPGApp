import { SkillsConfig } from "./skills";

export type ClueSpend = {
  name: string;
  cost: number;
  info: string;
};

export type ObstacleData = {
  investigative_skills: string[];

  base_text: string;

  spends: ClueSpend[];
};


export type ObstacleConfig = SkillsConfig & {
  initialData: ObstacleData;
};