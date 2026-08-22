'use client';

import { useMemo, useState } from 'react';
import BaseCharacterDataView from '../../../../../base/ui/src/views/CharacterDataView';
import type { DWCharacterConfig, CharacterData } from '../types/character';
import { getPlaybookId, getStats } from '../../../../../base/ui/src/types/character';
import { getResourceSpecs } from '../../../../../base/ui/src/types/pbta';
import { computeCharacterStats, modStr, pbtaModifier } from '../../../../../base/ui/src/lib/pbta';
import type { Move } from '../../../../../base/ui/src/types';
import { MoveExpandable, toMoveDisplayData } from '../editors/shared/MoveCard';
import { effectiveMove } from '../../../../../base/ui/src/lib/moves';
import { CharacterResourcesPanel } from '../../../../../base/ui/src/shared/CharacterResourcesPanel';
import { SpellBookPanel } from '../shared/SpellBookPanel';
import { customMoveToMove } from '../../../../../base/ui/src/types/pbta';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardList, Footprints, Sparkles } from 'lucide-react';
import {
  CONTEXT_GROUP_LABEL,
  CONTEXT_GROUP_ORDER,
  moveContextKey,
  type MoveContextTag,
} from '../shared/moveContexts';

type Props = {
  data: CharacterData;
  config?: DWCharacterConfig;
};

export default function DWCharacterDataView({ data, config }: Props) {
  const playbooks = config?.pbta?.playbooks ?? [];
  const moves: Move[] = config?.pbta?.moves ?? [];
  const pbtaSkills = config?.pbta?.skills ?? [];
  const stats = getStats(data);
  const playbookId = getPlaybookId(data);
  const currentMoves = data?.moves ?? [];
  const moveOverridesRoot = data.move_overrides ?? {};
  const playbookObj = playbooks.find((p) => p.id === playbookId) ?? null;
  const resourceSpecs = getResourceSpecs(config?.pbta);

  const { maxHp, conScore } = computeCharacterStats(playbookObj, stats);

  const hp = Number(data?.hp ?? 0);
  const armorCache = Number(data?.armor_cache ?? 0);
  const level = Number(data?.level ?? 1);
  const xp = Number(data?.xp ?? 0);

  const movesMap = useMemo(() => new Map(moves.map((m) => [m.id, m])), [moves]);

  const classMoveIds = playbookObj
    ? [
        ...playbookObj.starting_moves,
        ...(playbookObj.starting_move_choices ?? []).flat(),
        ...playbookObj.advanced_moves,
        ...(playbookObj.advanced_moves_6_10 ?? []),
      ]
    : [];

  const basicMovesByContext = useMemo(() => {
    const byKey = new Map<MoveContextTag, Move[]>();
    for (const m of moves) {
      if (m.kind !== 'basic') continue;
      const key = moveContextKey((m as any).condition?.requires_context);
      const list = byKey.get(key) ?? [];
      list.push(m);
      byKey.set(key, list);
    }
    return byKey;
  }, [moves]);

  const customMoveItems = useMemo(
    () => (data.custom_moves ?? []).filter((cm) => currentMoves.includes(cm.id)),
    [data.custom_moves, currentMoves],
  );

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    class: true,
    basic: false,
    custom: true,
  });

  const toggleSection = (key: string) => {
    setOpenSections((s) => ({ ...s, [key]: !s[key] }));
  };

  const statScoresForMove = (move: Move) =>
    (move.available_stats ?? []).map((sid) => {
      const score = Number(stats[sid] ?? 10);
      return { sid, score, mod: pbtaModifier(score) };
    });

  return (
    <Tabs defaultValue="sheet" className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="sheet" className="flex items-center gap-1.5">
          <ClipboardList className="w-3.5 h-3.5" /> Лист
        </TabsTrigger>
        <TabsTrigger value="moves" className="flex items-center gap-1.5">
          <Footprints className="w-3.5 h-3.5" /> Ходы
        </TabsTrigger>
        <TabsTrigger value="spells" className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> Заклинания
        </TabsTrigger>
      </TabsList>

      <TabsContent value="sheet" className="mt-4 space-y-4">
        <section className="space-y-1">
          <div className="text-xs text-gray-500 uppercase">Состояние</div>
          <div className="flex flex-wrap gap-2">
            <ViewChip
              label="ОЗ"
              value={`${hp} / ${maxHp}`}
              hint={playbookObj ? `${playbookObj.base_hp} + CON ${conScore}` : undefined}
            />
            <ViewChip label="Броня" value={armorCache} />
            <ViewChip label="Уровень" value={level} />
            <ViewChip label="Опыт" value={xp} />
          </div>
        </section>

        <BaseCharacterDataView data={data} config={config} hideMoves hideResources />

        <CharacterResourcesPanel data={data} resourceSpecs={resourceSpecs} />
      </TabsContent>

      <TabsContent value="moves" className="mt-4 space-y-4">
        {customMoveItems.length > 0 && (
          <section className="space-y-2">
            <button
              type="button"
              onClick={() => toggleSection('custom')}
              className="flex items-center gap-2 text-sm text-gray-300 hover:text-white"
            >
              <span>{openSections.custom ? '▾' : '▸'}</span>
              <span>Кастомные ходы</span>
              <span className="text-[10px] text-gray-500">({customMoveItems.length})</span>
            </button>
            {openSections.custom && (
              <div className="space-y-2">
                {customMoveItems.map((cm) => {
                  const m = customMoveToMove(cm);
                  return (
                    <MoveExpandable
                      key={cm.id}
                      move={toMoveDisplayData(m)}
                      checked
                      isStarting={false}
                      statScores={statScoresForMove(m)}
                      skills={pbtaSkills}
                    />
                  );
                })}
              </div>
            )}
          </section>
        )}

        {classMoveIds.length > 0 && (
          <section className="space-y-2">
            <button
              type="button"
              onClick={() => toggleSection('class')}
              className="flex items-center gap-2 text-sm text-gray-300 hover:text-white"
            >
              <span>{openSections.class ? '▾' : '▸'}</span>
              <span>Ходы класса</span>
              <span className="text-[10px] text-gray-500">({classMoveIds.length})</span>
            </button>
            {openSections.class && (
              <div className="space-y-2">
                {classMoveIds.map((mid) => {
                  const codex = movesMap.get(mid);
                  if (!codex) return null;
                  const isStarting = playbookObj?.starting_moves.includes(mid) ?? false;
                  const displayMove = effectiveMove(codex, moveOverridesRoot, mid) ?? codex;
                  return (
                    <MoveExpandable
                      key={mid}
                      move={toMoveDisplayData(displayMove)}
                      checked={currentMoves.includes(mid)}
                      isStarting={isStarting}
                      statScores={statScoresForMove(codex)}
                      skills={pbtaSkills}
                      playbookTitle={playbookObj?.title ?? null}
                      displayMode="view"
                    />
                  );
                })}
              </div>
            )}
          </section>
        )}

        {basicMovesByContext.size > 0 && (
          <section className="space-y-2">
            <button
              type="button"
              onClick={() => toggleSection('basic')}
              className="flex items-center gap-2 text-sm text-gray-300 hover:text-white"
            >
              <span>{openSections.basic ? '▾' : '▸'}</span>
              <span>Базовые ходы</span>
            </button>
            {openSections.basic && (
              <div className="space-y-4">
                {CONTEXT_GROUP_ORDER.map((key) => {
                  const group = basicMovesByContext.get(key);
                  if (!group?.length) return null;
                  return (
                    <div key={key} className="space-y-2">
                      <div className="text-xs text-gray-500 uppercase tracking-wide">
                        {CONTEXT_GROUP_LABEL[key]}
                      </div>
                      <div className="space-y-2">
                        {group.map((m) => (
                          <MoveExpandable
                            key={m.id}
                            move={toMoveDisplayData(m)}
                            checked
                            isStarting={false}
                            statScores={statScoresForMove(m)}
                            skills={pbtaSkills}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {!customMoveItems.length && !classMoveIds.length && basicMovesByContext.size === 0 && (
          <div className="text-sm text-white/40">Нет ходов для отображения.</div>
        )}
      </TabsContent>

      <TabsContent value="spells" className="mt-4">
        <SpellBookPanel playbookId={playbookId} pbtaConfig={config?.pbta} data={data} />
      </TabsContent>
    </Tabs>
  );
}

function ViewChip({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded border border-gray-700 bg-black/30 px-2 py-1 flex items-center gap-1.5 text-xs">
      <span className="text-gray-500 uppercase text-[10px]">{label}</span>
      <span className="font-semibold text-gray-100">{value}</span>
      {hint && <span className="text-gray-500">{hint}</span>}
    </div>
  );
}
