import type { UUID } from './common';
import type { WithLineage } from './entities';

// --------- counters ---------

// соответствует CounterBase (бэк)
export interface CounterBase {
  name: string;
  description?: string | null;

  value?: number; // default 0
  min_value?: number | null;
  max_value?: number | null;

  character_id?: UUID | null; // None = глобальный
  tags?: string[] | null;
}

export interface CounterCreate extends CounterBase {}

// соответствует Counter (бэк)
export interface Counter extends CounterBase, WithLineage {
  id: UUID;
  scenario_id: UUID;
}

export interface CounterUpdate extends Counter {}

export interface CounterAdjust {
  delta: number;
  comment?: string | null;
}

export interface CounterChange {
  id: UUID;
  counter_id: UUID;
  delta: number;
  old_value: number;
  new_value: number;
  comment?: string | null;
  user_id?: UUID | null;
  created_at?: string | null;
}
