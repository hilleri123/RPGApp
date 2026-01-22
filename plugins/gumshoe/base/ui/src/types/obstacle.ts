import { SkillsConfig } from "./skills";

export type ObstacleClue = {
  type: 'clue';
  name: string;
  description?: string;

  // список investigative skills, которыми можно получить/купить улику
  investigative_skills: string[];
  spend_cost: number; // >= 0; 0 = core clue / бесплатно
  reward?: string;
};

export type ObstacleChallenge = {
  type: 'challenge';
  name: string;
  description?: string;

  general_skill: string; // id general skill
  difficulty: number;    // >= 2 (на бэке PositiveInt, но можно ограничить в UI)
  on_success?: string;
  on_fail?: string;
};

export type ObstacleData = ObstacleClue | ObstacleChallenge;


export type ObstacleConfig = SkillsConfig & {
  initialData: ObstacleData;
};