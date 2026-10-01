import { create } from 'zustand';

/**
 * «Открой эту сущность»: поиск по сценарию переключает вкладку и кладёт сюда цель.
 * Список нужной вкладки после загрузки находит элемент по id, открывает диалог и
 * сбрасывает цель (см. ScenarioEntityListShell / FrontsList).
 */
export type ScenarioFocusTarget = { id: string; readOnly?: boolean };

export const useScenarioFocusStore = create<{
  target: ScenarioFocusTarget | null;
  setTarget: (t: ScenarioFocusTarget | null) => void;
}>((set) => ({
  target: null,
  setTarget: (target) => set({ target }),
}));
