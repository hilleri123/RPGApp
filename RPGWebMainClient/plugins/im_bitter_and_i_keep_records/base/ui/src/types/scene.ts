export type SceneMode = 'travel' | 'rest' | 'combat';
export type CombatPhase = 'turn' | 'melee' | 'ranged' | 'other';

export type SceneData = {
  mode: SceneMode;
  travel?: { pace: 'slow' | 'normal' | 'fast' } | null;
  rest?: { camp: boolean } | null;
  combat?: {
    phase: CombatPhase;
    initiativeOrder: string[];
    activeIndex: number;
    contacts: Array<[string, string]>;
  } | null;
};

export type SceneConfig = {
  sceneModes?: SceneMode[];
  combatPhases?: CombatPhase[];
  initialData: SceneData;
};
