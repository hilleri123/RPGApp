export type SkillGroup = {
  id: string;
  title: string;
  color: string;
  kind: "investigative" | "general" | "both";
};

export type Skill = {
  id: string;
  title: string;
  group: string; // "investigative_*" | "general_*"
  description?: string;
};


export type AttackSkills = {
  melee: string;
  ranged: string;
};

export type SkillsConfig = {
  skillGroups: SkillGroup[];
  skills: Skill[];
  health_skill: string;
  stability_skill: string;
  attack_skills: AttackSkills;
};
