export type SceneMode = 'travel' | 'camp' | 'action';

export type SceneData = {
  mode?: SceneMode | string;
};

export type SceneConfig = {
  initialData?: { mode?: SceneMode };
  sceneModes?: SceneMode[];
};

const LEGACY_MODE_MAP: Record<string, SceneMode> = {
  rest: 'camp',
  combat: 'action',
  travel: 'travel',
  camp: 'camp',
  action: 'action',
};

export function normalizeSceneMode(mode: unknown): SceneMode {
  const raw = String(mode ?? 'action').trim().toLowerCase();
  return LEGACY_MODE_MAP[raw] ?? (raw === 'travel' || raw === 'camp' ? raw : 'action');
}

export const MODE_LABEL: Record<SceneMode, string> = {
  travel: 'Путешествие',
  camp: 'Лагерь',
  action: 'Действие',
};

export const MODE_HINT: Record<SceneMode, string> = {
  travel: 'Ходы пути: опасное путешествие, воспоминания в дороге.',
  camp: 'Ходы лагеря: привал, дозор, отдых, закупки.',
  action: 'Боевые и ситуационные ходы: атака, защита, разговоры.',
};

export const MODE_MOVE_EXAMPLES: Record<SceneMode, string[]> = {
  travel: ['Отправиться в опасное путешествие', 'Покопаться в памяти', 'Охотиться и выслеживать'],
  camp: [
    'Разбить лагерь',
    'Нести дозор',
    'Восстановить силы',
    'Пополнить припасы',
    'Пирушка',
    'Причастие',
    'Подготовить заклинания',
  ],
  action: [
    'Руби и кромсай',
    'Дать залп',
    'Встать на защиту',
    'Изучить обстановку',
    'Договориться',
    'Сотворить заклинание',
  ],
};

export const MODE_BADGE_CLASS: Record<SceneMode, string> = {
  travel: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  camp: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  action: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
};

export const MODE_ICON_CLASS: Record<SceneMode, string> = {
  travel: 'text-emerald-400',
  camp: 'text-amber-400',
  action: 'text-rose-400',
};
