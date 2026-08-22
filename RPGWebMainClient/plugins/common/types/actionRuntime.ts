import type {
  ScenePayload,
  ActionParticipants,
  Workflow,
} from './actionContext';

// Реэкспортируем UUID чтобы можно было импортировать из actionRuntime
export type { UUID } from './actionContext';

export interface ActionIssue {
  path?: string;
  message?: string;
  icon?: string;
}

export interface ActionRuntime {
  id: string;
  actionKey: string;
  can_close?: boolean;           // optional — не у всех объектов есть
  status?: string;               // optional
  tags?: string[];               // optional
  scene_id?: string;             // optional

  participants?: ActionParticipants;
  participantIds?: string[];

  workflow?: Workflow & {
    context?: Record<string, unknown>;
  };

  issues?: ActionIssue[];
  lastError?: string | null;
  sessionPatch?: Record<string, unknown> | null;

  scene?: ScenePayload;          // optional — может не прийти
}