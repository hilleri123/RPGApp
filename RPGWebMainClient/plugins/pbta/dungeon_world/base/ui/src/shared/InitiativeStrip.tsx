'use client';

import { TurnOrderStrip, type TurnOrderItem } from '@/plugins/common/ui';
import { orderParticipants, type SceneEntityRef, type SceneInitiative } from './initiative';

/** Тонкий адаптер DW: SceneData.initiative → общая полоса очереди ходов. */
export function InitiativeStrip({
  initiative,
  entities,
}: {
  initiative: SceneInitiative;
  entities: Record<string, SceneEntityRef>;
}) {
  const items: TurnOrderItem[] = initiative.order.map((id, idx) => {
    const e = entities[id];
    return {
      id,
      name: e?.name ?? 'Нет в сцене',
      kind: e?.kind ?? 'npc',
      iconUrl: e?.iconUrl,
      color: e?.color,
      isEnemy: e?.isEnemy,
      isDead: e?.isDead,
      value: initiative.values[id] ?? null,
      position: idx + 1,
      active: idx === initiative.active_index,
      missing: !e,
    };
  });
  return <TurnOrderStrip items={items} />;
}

/**
 * Участники сцены квадратами в порядке инициативы (без инициативы — персонажи, затем NPC).
 * Клик выбирает участника; `marks` — метки поверх квадрата (число заявок и т.п.).
 */
export function ParticipantStrip({
  initiative,
  entities,
  onSelect,
  disabled = false,
  markedId,
  badges,
}: {
  initiative: SceneInitiative;
  entities: SceneEntityRef[];
  onSelect?: (entity: SceneEntityRef) => void;
  disabled?: boolean;
  /** Кого выделить рамкой (например, того, кто делает ход). */
  markedId?: string | null;
  badges?: Record<string, string | undefined>;
}) {
  const ordered = orderParticipants(entities, initiative);
  const items: TurnOrderItem[] = ordered.map(({ entity, position, active }) => ({
    id: entity.id,
    name: entity.name,
    kind: entity.kind,
    iconUrl: entity.iconUrl,
    color: entity.color,
    isEnemy: entity.isEnemy,
    isDead: entity.isDead,
    value: position != null ? (initiative.values[entity.id] ?? null) : null,
    position,
    active,
    marked: markedId != null && entity.id === markedId,
    badge: badges?.[entity.id] ?? null,
    disabled,
  }));
  const byId = new Map(entities.map((e) => [e.id, e]));
  return (
    <TurnOrderStrip
      items={items}
      wrap
      onSelect={
        onSelect
          ? (id) => {
              const e = byId.get(id);
              if (e) onSelect(e);
            }
          : undefined
      }
    />
  );
}
