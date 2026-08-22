'use client';

import React, { useMemo } from 'react';
import type { Counter, FrontBadgeInfo } from '@/app/services/types2';
import { TYPE_COLORS, TYPE_ICONS } from '@/lib/constants';
import { ScenarioEntityCardShell } from './common/ScenarioEntityCardShell';
import { frontsForEntityTags } from './common/FrontRibbon';
import { CounterValueControl } from '../dialogs/common/CounterValueControl';
import { useScenario } from '../ScenarioContext';

export function ScenarioCounterCard({
  counter,
  onEdit,
  onDelete,
  onChanged,
  readOnly = false,
  frontBadges,
  onOpenFront,
}: {
  counter: Counter;
  onEdit?: (counter: Counter, readOnly: boolean) => void;
  onDelete?: (counter: Counter) => Promise<void> | void;
  onChanged?: () => void;
  readOnly?: boolean;
  frontBadges?: FrontBadgeInfo[];
  onOpenFront?: (frontId: string) => void;
}) {
  const { scenarioId } = useScenario();
  const iconNode = <TYPE_ICONS.counter color="#ffffff" className="w-8 h-8" />;

  const subtitle = useMemo(() => {
    const parts: string[] = [];
    if (counter.min_value != null) parts.push(`min ${counter.min_value}`);
    if (counter.max_value != null) parts.push(`max ${counter.max_value}`);
    return parts.length ? parts.join(' • ') : undefined;
  }, [counter.min_value, counter.max_value]);

  const badges = useMemo(() => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-[11px] text-gray-400">
        {counter.character_id ? (
          <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">Привязан к персонажу</span>
        ) : (
          <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">Глобальный</span>
        )}
        {counter.description && (
          <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-gray-300">Есть описание</span>
        )}
      </div>
      <CounterValueControl
        scenarioId={scenarioId}
        counter={counter}
        value={counter.value ?? 0}
        readOnly={readOnly}
        compact
        onValueChange={() => onChanged?.()}
      />
    </div>
  ), [counter, scenarioId, readOnly, onChanged]);

  return (
    <ScenarioEntityCardShell
      accentColor={TYPE_COLORS.counter}
      typeLabel="Счётчик"
      title={counter.name}
      subtitle={subtitle}
      iconNode={iconNode}
      badges={badges}
      onView={onEdit ? () => onEdit(counter, true) : undefined}
      onEdit={onEdit ? () => onEdit(counter, false) : undefined}
      onDelete={onDelete ? () => onDelete(counter) : undefined}
      readOnly={readOnly}
      todoProps={{ elementType: 'counter', elementId: counter.id, elementName: counter.name }}
      frontBadges={frontsForEntityTags(counter.tags, frontBadges ?? [])}
      onOpenFront={onOpenFront}
    />
  );
}
