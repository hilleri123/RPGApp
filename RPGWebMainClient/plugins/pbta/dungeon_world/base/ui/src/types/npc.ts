// ── Tag meta (приходит с бэка в config.*_tags) ────────────────────────────────

export type TagMeta = { id: string; label: string; hint?: string };

// ── Литеральные типы тегов ────────────────────────────────────────────────────

export type NpcRangeTag    = 'hand' | 'close' | 'reach' | 'near' | 'far';
export type NpcAttackTag   = 'messy' | 'forceful' | 'ignores-armor' | 'precise' | 'slow' | 'reach';
export type NpcGroupTag    = 'solitary' | 'group' | 'horde';
export type NpcNatureTag   = 'intelligent' | 'devious' | 'magical' | 'divine' | 'planar'
                           | 'undead' | 'construct' | 'amorphous';
export type NpcSizeTag     = 'tiny' | 'small' | 'large' | 'huge';
export type NpcBehaviorTag = 'stealthy' | 'organized' | 'terrifying' | 'cautious';

// Все «природные» теги в одной корзине (nature + size + behavior)
export type NpcCharacterTag = NpcNatureTag | NpcSizeTag | NpcBehaviorTag;

// ── Sub-types ─────────────────────────────────────────────────────────────────

export type NpcAttack = {
  name:        string;
  damage:      string;        // e.g. "d8+1"
  range_tags:  NpcRangeTag[];
  attack_tags: NpcAttackTag[];
};

export type NpcMove = {
  id:          string;
  title:       string;
  description: string;
  is_hard?:    boolean;
};

// ── NpcData — хранится в БД ───────────────────────────────────────────────────

export type NpcData = {
  hp:                number;
  hp_current:        number;
  armor:             number;

  instinct:          string;
  group_tags:        NpcGroupTag[];
  nature_tags:       NpcCharacterTag[];   // nature + size + behavior в одном поле
  special_qualities: string[];            // presets (id) + произвольный текст

  attacks:           NpcAttack[];
  moves:             NpcMove[];
};

// ── NpcConfig — приходит с бэка ───────────────────────────────────────────────

export type NpcTagsConfig = {
  group_tags:              TagMeta[];   // solitary / group / horde
  nature_tags:             TagMeta[];   // intelligent, undead…
  size_tags:               TagMeta[];   // tiny, large…
  behavior_tags:           TagMeta[];   // stealthy, terrifying…
  special_quality_presets: TagMeta[];   // burrowing, flying…
  attack_tags:             TagMeta[];   // messy, forceful…
  range_tags:              TagMeta[];   // hand, close…
  damage_dice:             string[];    // ['d4','d6','d8'…]
};

export type NpcConfig = {
  initialData: NpcData;
} & NpcTagsConfig;