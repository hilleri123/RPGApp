import { SkillsConfig } from "./skills";


export type NPCAttack = {
  name: string;
  attack_dmg: string;
  attack_skill: string;
}


export type NpcData = {
  skills: Record<string, number>;

  armor?: number | null;
  hitThreshold?: number | null;

  attacks: NPCAttack[];
};


export type NpcConfig = SkillsConfig & {
  initialData: NpcData;
};