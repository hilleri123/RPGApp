import type { UUID } from './common';
import type { EntityData } from './entities';

// соответствует ObstacleBase/ObstacleCreate (бэк)
export interface ObstacleUpsertInline {
  id?: UUID | null; // если в будущем захочешь ссылаться/обновлять существующий
  name: string;
  description_for_master?: string | null;
  description_for_players?: string | null;
  data?: EntityData;   // default {}
  // force оставь, если LocationUpsertPayload/ObstacleUpsertInline на бэке его реально принимает
  force?: boolean;     // default false
  tags?: string[];
}

export interface ObstacleOutInline extends Required<Omit<ObstacleUpsertInline, 'id'>> {
  id: UUID;
}
