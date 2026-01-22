import { SkillsConfig } from "./skills";

export type NpcData = {
  skills: Record<string, number>;


  health?: number | null;
  stability?: number | null;
  armor?: number | null;
  hitThreshold?: number | null;
};


export type NpcConfig = SkillsConfig & {
  initialData: NpcData;
};