import type { ActionId, AttributeId } from './types';
import { ACTION_GROUPS } from './types';

export const ATTR_RU: Record<AttributeId, string> = {
  insight: 'Интуиция',
  prowess: 'Проворство',
  resolve: 'Решимость',
};

export const ACTION_RU: Record<ActionId, string> = {
  hunt: 'Охота',
  study: 'Изучение',
  survey: 'Наблюдение',
  tinker: 'Мастерение',
  finesse: 'Ловкость',
  prowl: 'Скрытность',
  skirmish: 'Схватка',
  wreck: 'Разрушение',
  attune: 'Настройка',
  command: 'Приказ',
  consort: 'Общение',
  sway: 'Убеждение',
};

export const POSITION_RU: Record<string, string> = {
  controlled: 'Под контролем',
  risky: 'Рискованно',
  desperate: 'Отчаянно',
};

export const EFFECT_RU: Record<string, string> = {
  limited: 'Ограниченный',
  standard: 'Обычный',
  great: 'Отличный',
};

export function groupOfAction(actionId: string) {
  return ACTION_GROUPS.find((g) => (g.actions as readonly string[]).includes(actionId));
}