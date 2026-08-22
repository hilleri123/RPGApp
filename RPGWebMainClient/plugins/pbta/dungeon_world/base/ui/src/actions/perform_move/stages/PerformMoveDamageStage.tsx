'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dices, User, Skull, Zap } from 'lucide-react';
import { CanvasSeed } from '@/plugins/common/ui';
import { getSceneBundle } from '@/plugins/common/types/actionSelectors';
import { extractMoveResolution } from '../components/moveResolution';
import { MoveResolutionCard } from '../components/MoveResolutionCard';

type EntityRef = { kind: 'character' | 'npc'; id: string; name: string };
type DieChip = { dieIndex: number; value: number };
type Allocation = { die_index: number; value: number; target_kind: string; target_id: string };
type RollState = {
  roll_seed: string;
  dice: number[];
  allocations: Allocation[];
  flatBonus?: number;
  /** Dice revealed only after explicit «Бросить» — no live preview from seed. */
  committed?: boolean;
};

function targetKey(kind: string, id: string) {
  return `${kind}:${id}`;
}

function buildEntities(scene: any): EntityRef[] {
  return [
    ...(Array.isArray(scene?.characters) ? scene.characters : []).map((x: any) => ({
      kind: 'character' as const,
      id: String(x.id),
      name: String(x.name ?? x.id),
    })),
    ...(Array.isArray(scene?.npcs) ? scene.npcs : []).map((x: any) => ({
      kind: 'npc' as const,
      id: String(x.id),
      name: String(x.name ?? x.id),
    })),
  ];
}

function sumForTarget(allocations: Allocation[], entity: EntityRef) {
  return allocations
    .filter((a) => a.target_kind === entity.kind && String(a.target_id) === entity.id)
    .reduce((sum, a) => sum + Number(a.value || 0), 0);
}

function unallocatedDice(dice: number[], allocations: Allocation[]): DieChip[] {
  const used = new Set(allocations.map((a) => a.die_index));
  return dice
    .map((value, dieIndex) => ({ dieIndex, value }))
    .filter((d) => !used.has(d.dieIndex));
}

export function PerformMoveDamageStage({
  action,
  value,
  patch,
  onPatch,
  onSubmit,
  setSubmitEnabled,
  user_id,
  readOnly,
}: any) {
  const { scene } = getSceneBundle(action);
  const entry = action?.workflow?.context?.entry ?? {};
  const allClaims: any[] = Array.isArray(entry?.damage_claims) ? entry.damage_claims : [];
  const gmUserId = String(action?.participants?.gmUserId ?? '');
  const actorUserId = String(entry?.actor_user_id ?? '');
  const myId = String(user_id ?? action?.current_user_id ?? action?.currentUserId ?? '');
  const isOwner = myId && (myId === gmUserId || myId === actorUserId);
  const claims = useMemo(() => {
    if (isOwner || !myId) return allClaims;
    return allClaims.filter((c) => String(c.roller_user_id ?? '') === myId);
  }, [allClaims, isOwner, myId]);
  const isRollerOnly = Boolean(myId && !isOwner);

  const rollsById: Record<string, RollState> = value?.rollsById ?? {};
  const entities = useMemo(() => buildEntities(scene), [scene]);
  const moveInfo = useMemo(() => extractMoveResolution(action), [action]);
  const [dragDie, setDragDie] = useState<DieChip | null>(null);

  const allReady = claims.length > 0 && claims.every((claim) => {
    const roll = rollsById[claim.id];
    if (!roll?.committed || !roll?.roll_seed || !roll.dice?.length) return false;
    return unallocatedDice(roll.dice, roll.allocations ?? []).length === 0;
  });

  useEffect(() => {
    // Roller только патчит; Submit у мастера/актора
    setSubmitEnabled(isOwner && allReady);
  }, [allReady, isOwner, setSubmitEnabled]);

  const canEditClaim = (claim: any) => {
    if (readOnly) return false;
    if (isOwner) return true;
    return String(claim.roller_user_id ?? '') === myId;
  };

  const writeRoll = (claimId: string, next: RollState) => {
    const payload = {
      rollsById: {
        ...rollsById,
        [claimId]: next,
      },
    };
    // syncPatch = local draft + server; send full map so other claims aren't wiped locally
    if (onPatch) onPatch(payload);
    else patch(payload);
  };

  const setSeedOnly = (claimId: string, claim: any, seed: string | null) => {
    if (!canEditClaim(claim)) return;
    const prev = rollsById[claimId];
    if (prev?.committed) return;
    writeRoll(claimId, {
      roll_seed: seed ?? '',
      dice: [],
      allocations: [],
      flatBonus: 0,
      committed: false,
    });
  };

  const commitRoll = (claimId: string, claim: any) => {
    if (!canEditClaim(claim)) return;
    const prev = rollsById[claimId] ?? { roll_seed: '', dice: [], allocations: [] };
    if (prev.committed || !prev.roll_seed) return;
    // Dice are computed on the server from seed — do not preview locally.
    writeRoll(claimId, {
      roll_seed: prev.roll_seed,
      dice: [],
      allocations: [],
      flatBonus: 0,
      committed: true,
    });
  };

  const updateAllocations = (claimId: string, claim: any, allocations: Allocation[]) => {
    if (!canEditClaim(claim)) return;
    const prev = rollsById[claimId];
    if (!prev?.committed) return;
    writeRoll(claimId, { ...prev, allocations });
  };

  const assignDie = (claimId: string, claim: any, die: DieChip, entity: EntityRef) => {
    const roll = rollsById[claimId] ?? { roll_seed: '', dice: [], allocations: [] };
    if (!roll.committed) return;
    const without = (roll.allocations ?? []).filter((a) => a.die_index !== die.dieIndex);
    updateAllocations(claimId, claim, [
      ...without,
      {
        die_index: die.dieIndex,
        value: die.value,
        target_kind: entity.kind,
        target_id: entity.id,
      },
    ]);
    setDragDie(null);
  };

  const returnDieToPool = (claimId: string, claim: any, dieIndex: number) => {
    const roll = rollsById[claimId];
    if (!roll?.committed) return;
    updateAllocations(
      claimId,
      claim,
      (roll.allocations ?? []).filter((a) => a.die_index !== dieIndex),
    );
  };

  if (!claims.length) {
    if (isRollerOnly) {
      return (
        <div className="rounded border p-3 text-sm text-white/60">
          Вам не назначены броски HP на этом шаге. Дождитесь мастера.
        </div>
      );
    }
    return (
      <div className="rounded border p-3 text-sm text-white/60">
        Нет заявок на изменение HP.
        <button
          type="button"
          className="mt-2 rounded border px-3 py-2"
          onClick={() => onSubmit({ rolls: [], skip: true })}
        >
          Продолжить
        </button>
      </div>
    );
  }

  const hasHeal = claims.some((c) => c.hp_effect === 'heal');
  const hasDamage = claims.some((c) => (c.hp_effect ?? 'damage') === 'damage');

  return (
    <div className="rounded border p-3 flex flex-col gap-4">
      <MoveResolutionCard data={moveInfo} />
      <div className="font-medium flex items-center gap-2">
        <Zap className={`w-4 h-4 ${hasHeal && !hasDamage ? 'text-emerald-300' : 'text-red-300'}`} />
        {hasHeal && hasDamage ? 'Броски HP (урон и лечение)' : hasHeal ? 'Броски лечения' : 'Броски урона'}
      </div>
      <div className="text-sm text-white/60">
        Нарисуйте seed и нажмите «Бросить» — кубы появятся только после броска, затем распределите их по целям.
        {isRollerOnly ? ' После броска мастер завершит шаг.' : ''}
      </div>

      {claims.map((claim) => {
        const isHeal = claim.hp_effect === 'heal';
        const editable = canEditClaim(claim);
        const roll = rollsById[claim.id] ?? { roll_seed: '', dice: [], allocations: [], committed: false };
        const committed = Boolean(roll.committed && roll.dice?.length);
        const pool = committed ? unallocatedDice(roll.dice ?? [], roll.allocations ?? []) : [];
        const totalAssigned = (roll.allocations ?? []).reduce((s, a) => s + Number(a.value || 0), 0);
        const seedReady = Boolean(roll.roll_seed) && !committed;

        return (
          <div key={claim.id} className={`rounded border p-3 space-y-3 ${isHeal ? 'border-emerald-400/20' : 'border-white/10'}`}>
            <div className="text-sm">
              <div className="font-medium text-white">
                {claim.source_label} → {claim.target_label}
                {isHeal ? ' · лечение' : ''}
              </div>
              <div className="text-white/60">
                {claim.formula}
                {!isHeal && claim.half_damage ? ' · половина' : ''}
                {claim.counter_move_title ? ` · контр: ${claim.counter_move_title}` : ''}
                {claim.roller_label ? ` · бросает: ${claim.roller_label}` : ''}
              </div>
            </div>

            <CanvasSeed
              disabled={!editable || Boolean(roll.committed)}
              onChange={(s) => setSeedOnly(claim.id, claim, s)}
              hint={`Бросок ${claim.formula}`}
            />

            {editable && !committed && !roll.committed && (
              <button
                type="button"
                disabled={!seedReady}
                onClick={() => commitRoll(claim.id, claim)}
                className={`rounded border px-3 py-2 text-sm font-semibold disabled:opacity-40 ${
                  seedReady
                    ? 'border-amber-400/70 text-amber-100 hover:bg-amber-500/10'
                    : 'border-white/10 text-white/30'
                }`}
              >
                Бросить {claim.formula}
              </button>
            )}

            {roll.committed && !committed && (
              <div className="text-xs text-amber-200/80">Бросаем…</div>
            )}

            {!roll.committed && roll.roll_seed && !editable && (
              <div className="text-xs text-white/40">Seed готов — ожидание броска…</div>
            )}

            {committed && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded border border-white/10 bg-zinc-950/30 p-3">
                  <div className="text-xs uppercase tracking-wide text-white/50 mb-2 flex items-center gap-1">
                    <Dices className="w-3.5 h-3.5" />
                    Кубы
                  </div>
                  <div className="flex flex-wrap gap-2 min-h-[3rem]">
                    {pool.map((die) => (
                      <button
                        key={`${claim.id}-pool-${die.dieIndex}`}
                        type="button"
                        draggable={editable}
                        disabled={!editable}
                        onDragStart={() => editable && setDragDie(die)}
                        onDragEnd={() => setDragDie(null)}
                        className="h-10 w-10 rounded-lg border border-amber-400/50 bg-amber-500/20 text-amber-100 font-bold cursor-grab active:cursor-grabbing disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {die.value}
                      </button>
                    ))}
                    {pool.length === 0 && (
                      <span className="text-xs text-white/40 self-center">Все кубы распределены</span>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-white/50">
                    Сумма: {totalAssigned}
                    {roll.dice.length ? ` / ${roll.dice.reduce((a, b) => a + b, 0)}` : ''}
                  </div>
                </div>

                <div className="rounded border border-white/10 bg-zinc-950/30 p-3 space-y-2">
                  <div className="text-xs uppercase tracking-wide text-white/50 mb-1">Цели</div>
                  {entities.map((entity) => {
                    const assigned = (roll.allocations ?? []).filter(
                      (a) => a.target_kind === entity.kind && String(a.target_id) === entity.id,
                    );
                    const sum = sumForTarget(roll.allocations ?? [], entity);

                    return (
                      <div
                        key={targetKey(entity.kind, entity.id)}
                        onDragOver={(e) => {
                          if (editable) e.preventDefault();
                        }}
                        onDrop={() => {
                          if (editable && dragDie) assignDie(claim.id, claim, dragDie, entity);
                        }}
                        className="rounded border border-dashed border-white/15 px-3 py-2 bg-black/20"
                      >
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <div className="flex items-center gap-2 text-white/90">
                            {entity.kind === 'character' ? (
                              <User className="w-4 h-4 text-cyan-300" />
                            ) : (
                              <Skull className="w-4 h-4 text-red-300" />
                            )}
                            {entity.name}
                          </div>
                          <span className={`font-mono ${isHeal ? 'text-emerald-200' : 'text-red-200'}`}>
                            {sum > 0 ? `${isHeal ? '+' : '−'}${sum}` : '—'}
                          </span>
                        </div>
                        {assigned.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {assigned.map((a) => (
                              <button
                                key={`${claim.id}-${entity.id}-${a.die_index}`}
                                type="button"
                                disabled={!editable}
                                onClick={() => editable && returnDieToPool(claim.id, claim, a.die_index)}
                                className={`h-7 min-w-[1.75rem] px-1 rounded border text-xs disabled:opacity-40 ${
                                  isHeal
                                    ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
                                    : 'border-red-400/40 bg-red-500/15 text-red-100'
                                }`}
                                title="Вернуть в пул"
                              >
                                {a.value}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {isOwner ? (
        <button
          type="button"
          disabled={!allReady}
          onClick={() =>
            onSubmit({
              rolls: allClaims.map((claim) => {
                const roll = rollsById[claim.id];
                const dice = roll?.dice ?? [];
                const flatBonus = Number(roll?.flatBonus ?? 0);
                return {
                  id: claim.id,
                  roll_seed: roll?.roll_seed ?? '',
                  dice,
                  total_raw: dice.reduce((a: number, b: number) => a + b, 0) + flatBonus,
                  flat_bonus: flatBonus,
                  allocations: roll?.allocations ?? [],
                };
              }),
            })
          }
          className={`rounded border px-3 py-2 text-sm font-semibold disabled:opacity-40 ${
            hasHeal && !hasDamage
              ? 'border-emerald-400/70 text-emerald-200'
              : 'border-red-400/70 text-red-200'
          }`}
        >
          {hasHeal && hasDamage ? 'Применить HP' : hasHeal ? 'Применить лечение' : 'Применить урон'}
        </button>
      ) : (
        <div className="text-sm text-white/50">
          {allReady
            ? 'Ваши броски готовы — мастер завершит шаг.'
            : 'Нарисуйте seed, нажмите «Бросить», затем распределите кубы.'}
        </div>
      )}
    </div>
  );
}
