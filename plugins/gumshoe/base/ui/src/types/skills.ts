export type SkillGroup = {
  id: string;
  title: string;
  color: string;
  kind: "investigative" | "general";
};

export type Skill = {
  id: string;
  title: string;
  group: string; // "investigative_*" | "general_*"
};

export type SkillsConfig = {
  skillGroups: SkillGroup[];
  skills: Skill[];
};
