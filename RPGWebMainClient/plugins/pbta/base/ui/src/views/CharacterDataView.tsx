'use client';

import type { PbtaSkill, Playbook, Move, CharacterConfig } from '../types';
import type { CharacterData } from '../types/character';
import { getPlaybookId, getStats } from '../types/character';
import { getResourceSpecs } from '../types/pbta';
import { pbtaModifier, modStr, computeCharacterStats } from '../lib/pbta';
import { CharacterResourcesPanel } from '../shared/CharacterResourcesPanel';

type Props = {
  data:    CharacterData;
  config?: CharacterConfig;
  hideMoves?: boolean;
  hideResources?: boolean;
};

export default function CharacterDataView({ data, config, hideMoves = false, hideResources = false }: Props) {
  const pbtaSkills: PbtaSkill[] = config?.pbta?.skills    ?? [];
  const playbooks: Playbook[]   = config?.pbta?.playbooks  ?? [];
  const moves: Move[]           = config?.pbta?.moves      ?? [];
  const resourceSpecs = getResourceSpecs(config?.pbta);

  const stats        = getStats(data);
  const playbookId   = getPlaybookId(data);
  const currentMoves = data?.moves ?? [];
  const playbookObj  = playbooks.find((p) => p.id === playbookId) ?? null;

  const { maxHp, maxLoad, damageDie, conScore, strMod } =
    computeCharacterStats(playbookObj, stats);

  const movesMap  = new Map(moves.map((m) => [m.id, m]));
  const allMoveIds = playbookObj
    ? [
        ...playbookObj.starting_moves,
        ...(playbookObj.starting_move_choices ?? []).flat(),
        ...playbookObj.advanced_moves,
        ...(playbookObj.advanced_moves_6_10 ?? []),
      ]
    : [];

  return (
    <div className="space-y-4 text-sm">

      {playbookObj && (
        <section className="space-y-1">
          <div className="text-gray-300 font-medium">{playbookObj.title}</div>
          {playbookObj.summary && (
            <div className="text-xs text-gray-500">{playbookObj.summary}</div>
          )}
          {(data.race_id || data.alignment_id || data.alignment_notes) && (
            <div className="text-xs text-gray-500 space-y-1 mt-2">
              {data.race_id && playbookObj.races?.length ? (
                <div>
                  Раса:{' '}
                  {playbookObj.races.find((r) => r.id === data.race_id)?.title ?? data.race_id}
                </div>
              ) : null}
              {data.alignment_id && playbookObj.alignments?.length ? (
                <div>
                  Мировоззрение:{' '}
                  {playbookObj.alignments.find((a) => a.id === data.alignment_id)?.title
                    ?? data.alignment_id}
                </div>
              ) : null}
              {data.alignment_notes?.trim() ? (
                <div className="italic">{data.alignment_notes}</div>
              ) : null}
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-1">
            <ViewChip label="Макс. ОЗ" value={maxHp}     hint={`${playbookObj.base_hp} + CON ${conScore}`} />
            <ViewChip label="Урон"      value={damageDie} />
            <ViewChip label="Нагрузка"  value={maxLoad}   hint={`${playbookObj.base_load} + STR ${modStr(strMod)}`} />
          </div>
        </section>
      )}

      <section className="space-y-1">
        <div className="text-gray-300">Характеристики</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {pbtaSkills.map((s) => {
            const score = Number(stats[s.id] ?? 10);
            const mod   = pbtaModifier(score);
            return (
              <div key={s.id} className="rounded border border-gray-700 bg-black/20 px-3 py-2 flex items-center justify-between">
                <span className="text-gray-300">{s.title}</span>
                <div className="text-right">
                  <span className="text-xs text-gray-500 mr-1">{score}</span>
                  <span className={`font-mono font-bold ${mod > 0 ? 'text-emerald-400' : mod < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                    {modStr(mod)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {!hideResources && (
        <CharacterResourcesPanel data={data} resourceSpecs={resourceSpecs} />
      )}

      {allMoveIds.length > 0 && !hideMoves && (
        <section className="space-y-1">
          <div className="text-gray-300">Ходы</div>
          <div className="space-y-0.5">
            {allMoveIds.map((mid) => {
              const m      = movesMap.get(mid);
              const active = currentMoves.includes(mid);
              if (!m) return null;
              return (
                <div
                  key={mid}
                  className={`text-xs px-2 py-1 rounded ${active ? 'text-gray-200 bg-indigo-950/30' : 'text-gray-600'}`}
                >
                  {m.title}
                  {!active && <span className="ml-1 text-gray-700">(не выбран)</span>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {!pbtaSkills.length && (
        <pre className="text-xs bg-black/30 border border-gray-700 rounded p-2 overflow-x-auto">
          {JSON.stringify(data ?? {}, null, 2)}
        </pre>
      )}
    </div>
  );
}

function ViewChip({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded border border-gray-700 bg-black/30 px-2 py-1 flex items-center gap-1.5 text-xs">
      <span className="text-gray-500 uppercase text-[10px]">{label}</span>
      <span className="font-semibold text-gray-100">{value}</span>
      {hint && <span className="text-gray-500">{hint}</span>}
    </div>
  );
}