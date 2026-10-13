export const DW_DEBILITIES = [
  { id: 'weak', stat: 'str', title: 'Слабость', statTitle: 'СИЛ' },
  { id: 'shaky', stat: 'dex', title: 'Дрожь', statTitle: 'ЛОВ' },
  { id: 'sick', stat: 'con', title: 'Болезнь', statTitle: 'ТЕЛ' },
  { id: 'stunned', stat: 'int', title: 'Оглушение', statTitle: 'ИНТ' },
  { id: 'confused', stat: 'wis', title: 'Замешательство', statTitle: 'МДР' },
  { id: 'scarred', stat: 'cha', title: 'Шрам', statTitle: 'ХАР' },
] as const;

export type DebilityId = (typeof DW_DEBILITIES)[number]['id'];

export function debilityPenalty(statId: string, debilities: readonly string[] | undefined): number {
  if (!debilities?.length) return 0;
  return DW_DEBILITIES.some((d) => d.stat === statId && debilities.includes(d.id)) ? 1 : 0;
}

export function debilityTitle(id: string): string {
  return DW_DEBILITIES.find((d) => d.id === id)?.title ?? id;
}
