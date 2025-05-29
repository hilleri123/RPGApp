export interface Skill {
    id: string;
    name: string;
    description: string;
}

export interface SkillGroup {
    id: string;
    name: string;
    color: string;
    skills: Skill[];
}


export interface PropertyTemplate {
    id: string;
    name: string;
    description: string;
    type: 'number' | 'text' | 'boolean' | 'select';
    defaultValue: string | number | boolean;
    options?: string[];
    min?: number;
    max?: number;
    required: boolean;
    category: string;
}

export interface ItemTemplate {
    id: string;
    name: string;
    icon: string;
    properties: Array<{
      name: string;
      label: string;
      type: string;
      options?: string[];
    }>;
}
  
export interface CreatureType {
    id: string;
    name: string;
    description: string;
    skillValues: Array<{
        skillId: string;
        baseValue: number;
    }>;
}