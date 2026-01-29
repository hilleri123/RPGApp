export type AttributeId = 'insight' | 'prowess' | 'resolve';

export type ActionId =
  | 'hunt' | 'study' | 'survey' | 'tinker'
  | 'finesse' | 'prowl' | 'skirmish' | 'wreck'
  | 'attune' | 'command' | 'consort' | 'sway';

export type TraumaId =
  | 'cold' | 'haunted' | 'obsessed' | 'paranoid'
  | 'reckless' | 'soft' | 'unstable' | 'vicious';

export type LoadId = 'light' | 'normal' | 'heavy';

export type HarmTrack = {
  l3?: string | null;
  l2?: [string | null, string | null];
  l1?: [string | null, string | null];
};

export type CharacterData = {
  actions?: Partial<Record<ActionId, number>>;

  stress?: number;
  traumas?: TraumaId[];

  load?: LoadId | null;

  harm?: HarmTrack;

  items?: any[];
};

export type CharacterConfig = {
  attributes: { id: AttributeId; title: string }[];
  actions: { id: ActionId; title: string; attribute: AttributeId }[];

  traumas: { id: TraumaId; title: string }[];
  loads: { id: LoadId; value: number }[];

  constraints?: {
    stressMax?: number; // 9
    traumaMax?: number; // 4
  };

  initialData: CharacterData;
};
