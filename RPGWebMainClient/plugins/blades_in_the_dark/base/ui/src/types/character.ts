export type AttributeId = 'insight' | 'prowess' | 'resolve';

export type ActionId =
  | 'hunt' | 'study' | 'survey' | 'tinker'
  | 'finesse' | 'prowl' | 'skirmish' | 'wreck'
  | 'attune' | 'command' | 'consort' | 'sway';

export type TraumaId =
  | 'cold' | 'haunted' | 'obsessed' | 'paranoid'
  | 'reckless' | 'soft' | 'unstable' | 'vicious';

export type LoadId = 'light' | 'normal' | 'heavy';

export const ACTION_GROUPS: Array<{
  key: AttributeId;
  name: string;
  color: string;
  actions: ActionId[];
}> = [
  { key: 'insight', name: 'Insight', color: '#60a5fa', actions: ['hunt','study','survey','tinker'] },
  { key: 'prowess', name: 'Prowess', color: '#34d399', actions: ['finesse','prowl','skirmish','wreck'] },
  { key: 'resolve', name: 'Resolve', color: '#f472b6', actions: ['attune','command','consort','sway'] },
];

export type HarmTrack = {
  l3?: string | null;
  l2?: [string | null, string | null];
  l1?: [string | null, string | null];
};

export type PlaybookId =
  | 'cutter'
  | 'hound'
  | 'leech'
  | 'lurk'
  | 'slide'
  | 'spider'
  | 'whisper';

export type PlaybookAbilityId = string;

export type CharacterData = {
  playbookId?: PlaybookId | null;
  abilities?: PlaybookAbilityId[];

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

  playbooks: {
    id: PlaybookId;
    title: string;
    startingActions?: Partial<Record<ActionId, number>>;
    abilities: {
      id: PlaybookAbilityId;
      title: string;
      description?: string; // важно: конфиг реально возвращает description
    }[];
  }[];

  constraints?: {
    stressMax?: number; // 9
    traumaMax?: number; // 4
    abilitiesMaxAtStart?: number; // обычно 1
  };

  initialData: CharacterData;
};
