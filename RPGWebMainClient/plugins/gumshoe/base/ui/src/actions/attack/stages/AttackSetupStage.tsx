'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { Crosshair, Sword, Rocket, User, Bot } from 'lucide-react';
import { Input } from '@/components/ui/input';

function asStr(x: any, fb = '') { return String(x ?? '').trim() || fb; }

function attackSkillId(mode: string): string {
  if (mode === 'melee')  return 'scuffling';
  if (mode === 'ranged') return 'shooting';
  return 'scuffling';
}

export function AttackSetupStage({ user_id, action, value, patch, onSubmit, setSubmitEnabled }: any) {
  const wf    = action?.workflow ?? {};
  const ctx   = wf?.context ?? {};
  const entry = ctx?.entry ?? {};
  const scene = action?.scene?.scene ?? {};
  const links = action?.scene?.links ?? {};

  const isGm: boolean = action?.participants?.gmUserId === user_id;

  const aliveNpcs: any[] = useMemo(() =>
    (scene?.npcs ?? []).filter((n: any) =>
      !n.tags?.includes('dead') && (n.data?.skills?.health ?? 0) > 0
    ), [scene]);

  const chars: any[] = scene?.characters ?? [];

  // ── Атакующий ──────────────────────────────────────────────────────────────
  // GM выбирает; игрок — фиксированный персонаж
  const [attackerCharId, setAttackerCharId] = useState<string>(
    isGm ? (value?.attacker_character_id ?? '') : (entry.attackerCharacterId ?? '')
  );
  const [attackerNpcId, setAttackerNpcId] = useState<string>(
    value?.attacker_npc_id ?? ''
  );

  // При переключении атакующего сбрасываем оружие/атаку
  const selectAttackerChar = (id: string) => {
    setAttackerCharId(id);
    setAttackerNpcId('');
    setWeaponItemId('');
    setAttackName('');
  };
  const selectAttackerNpc = (id: string) => {
    setAttackerNpcId(id);
    setAttackerCharId('');
    setWeaponItemId('');
    setAttackName('');
  };

  const attackerChar = useMemo(
    () => chars.find((c: any) => c.id === attackerCharId) ?? null,
    [chars, attackerCharId]
  );
  const attackerNpc = useMemo(
    () => aliveNpcs.find((n: any) => n.id === attackerNpcId) ?? null,
    [aliveNpcs, attackerNpcId]
  );

  // ── Цель ───────────────────────────────────────────────────────────────────
  const [targetNpcId,  setTargetNpcId]  = useState<string>(value?.target_npc_id ?? '');
  const [targetCharId, setTargetCharId] = useState<string>(value?.target_character_id ?? '');

  const selectTargetNpc  = (id: string) => { setTargetNpcId(id);  setTargetCharId(''); };
  const selectTargetChar = (id: string) => { setTargetCharId(id); setTargetNpcId('');  };

  // ── Оружие / атака ─────────────────────────────────────────────────────────
  const weapons: any[] = useMemo(() =>
    (attackerChar?.items ?? []).filter((it: any) => it?.data?.weapon),
    [attackerChar]
  );

  const npcAttacks: any[] = useMemo(() => {
    if (!attackerNpc) return [];
    return attackerNpc?.data?.attacks ?? [];
  }, [attackerNpc]);

  const [weaponItemId, setWeaponItemId] = useState<string>(value?.weapon_item_id ?? '');
  const [attackName,   setAttackName]   = useState<string>(value?.attack_name    ?? '');
  const [skillPoints,  setSkillPoints]  = useState<number>(value?.skill_points   ?? 0);

  const selectedWeapon = useMemo(
    () => weapons.find((it: any) => it.id === weaponItemId) ?? null,
    [weapons, weaponItemId]
  );
  const weaponForcedMode: string | null = selectedWeapon?.data?.weapon?.type ?? null;
  const [manualWeaponMode, setManualWeaponMode] = useState<string>(value?.weapon_mode ?? '');
  const weaponMode = weaponForcedMode ?? manualWeaponMode;

  const availableSkillPoints: number | null = useMemo(() => {
    if (!attackerChar || !weaponMode) return null;
    const skills: Record<string, number> = attackerChar?.data?.skills ?? {};
    return skills[attackSkillId(weaponMode)] ?? 0;
  }, [attackerChar, weaponMode]);

  // ── Валидация ──────────────────────────────────────────────────────────────
  const hasAttacker = !!(attackerCharId || attackerNpcId);
  const hasTarget   = !!(targetNpcId || targetCharId);
  const hasWeapon   = attackerNpcId ? !!attackName : !!weaponItemId;
  const isReady     = hasAttacker && hasTarget && hasWeapon && !!weaponMode;

  useEffect(() => { setSubmitEnabled(isReady); }, [isReady]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!isReady) return;
    onSubmit({
      attacker_character_id: attackerCharId   || undefined,
      attacker_npc_id:       attackerNpcId    || undefined,
      target_npc_id:         targetNpcId      || undefined,
      target_character_id:   targetCharId     || undefined,
      weapon_item_id:        weaponItemId     || undefined,
      attack_name:           attackName       || undefined,
      weapon_mode:           weaponMode,
      skill_points:          skillPoints,
    });
  };

  // ── Стили ──────────────────────────────────────────────────────────────────
  const btnBase = 'text-left rounded border px-3 py-2 text-sm transition-colors';
  const btnIdle = 'border-white/20 hover:border-white/40 text-white/80';

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium flex items-center gap-2">
        <Crosshair className="w-4 h-4 text-red-400" />
        Подготовка атаки
      </div>

      {/* ── Атакующий (только GM) ── */}
      {isGm && (
        <div className="flex flex-col gap-1.5 rounded border px-2 py-1.5">
          <div className="text-xs text-white/50 uppercase tracking-wide">Атакующий</div>

          {/* Персонажи */}
          {chars.length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="text-xs text-white/30 flex items-center gap-1">
                <User className="w-3 h-3" /> Персонажи
              </div>
              {chars.map((ch: any) => (
                <button key={ch.id} type="button"
                  onClick={() => selectAttackerChar(ch.id)}
                  className={`${btnBase} ${attackerCharId === ch.id
                    ? 'border-blue-400 bg-blue-500/10 text-blue-200'
                    : btnIdle}`}
                >
                  <div className="font-semibold">{asStr(ch.name, 'Персонаж')}</div>
                </button>
              ))}
            </div>
          )}

          {/* NPC как атакующий */}
          {aliveNpcs.length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="text-xs text-white/30 flex items-center gap-1">
                <Bot className="w-3 h-3" /> NPC
              </div>
              {aliveNpcs.map((npc: any) => {
                const isEnemy = npc.tags?.includes('enemy');
                return (
                  <button key={npc.id} type="button"
                    onClick={() => selectAttackerNpc(npc.id)}
                    className={`${btnBase}
                      ${isEnemy ? 'bg-red-500/10' : 'bg-green-500/10'}
                      ${attackerNpcId === npc.id
                        ? 'border-blue-400 text-blue-200'
                        : 'border-white/20 hover:border-white/40 text-white/80'}`}
                  >
                    <div className="font-semibold">{asStr(npc.name, 'NPC')}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Цель ── */}
      <div className="flex flex-col gap-1.5 rounded border px-2 py-1.5">
        <div className="text-xs text-white/50 uppercase tracking-wide">Цель</div>

        {/* NPC — для всех */}
        {aliveNpcs.length === 0 ? (
          <div className="text-sm text-white/40">В сцене нет живых NPC</div>
        ) : (
          <div className="flex flex-col gap-1">
            {isGm && (
              <div className="text-xs text-white/30 flex items-center gap-1">
                <Bot className="w-3 h-3" /> NPC
              </div>
            )}
            {aliveNpcs.map((npc: any) => {
              const isEnemy = npc.tags?.includes('enemy');
              return (
                <button key={npc.id} type="button"
                  onClick={() => selectTargetNpc(npc.id)}
                  className={`${btnBase}
                    ${isEnemy ? 'bg-red-500/10' : 'bg-green-500/10'}
                    ${targetNpcId === npc.id
                      ? 'border-red-400 text-red-200'
                      : 'border-white/20 hover:border-white/40 text-white/80'}`}
                >
                  <div className="font-semibold">{asStr(npc.name, 'NPC')}</div>
                  {npc?.data?.hitThreshold && (
                    <div className="text-xs text-white/40 mt-0.5">
                      Hit Threshold: {npc.data.hitThreshold}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Персонажи как цель — только GM */}
        {isGm && chars.length > 0 && (
          <div className="flex flex-col gap-1 mt-1">
            <div className="text-xs text-white/30 flex items-center gap-1">
              <User className="w-3 h-3" /> Персонажи
            </div>
            {chars.map((ch: any) => (
              <button key={ch.id} type="button"
                onClick={() => selectTargetChar(ch.id)}
                className={`${btnBase} ${targetCharId === ch.id
                  ? 'border-red-400 bg-red-500/10 text-red-200'
                  : btnIdle}`}
              >
                <div className="font-semibold">{asStr(ch.name, 'Персонаж')}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Оружие (атакующий — персонаж) ── */}
      {attackerCharId && (
        <div className="flex flex-col gap-1.5">
          <div className="text-xs text-white/50 uppercase tracking-wide">Оружие</div>
          {weapons.length === 0 ? (
            <div className="text-sm text-white/40">
              У {asStr(attackerChar?.name)} нет оружия
            </div>
          ) : (
            weapons.map((it: any) => {
              const w = it.data.weapon;
              return (
                <button key={it.id} type="button"
                  onClick={() => setWeaponItemId(it.id)}
                  className={`${btnBase} ${weaponItemId === it.id
                    ? 'border-blue-400 bg-blue-500/10 text-blue-200'
                    : btnIdle}`}
                >
                  <div className="flex items-center gap-2">
                    {w.type === 'melee'
                      ? <Sword className="w-4 h-4 text-white/60" />
                      : <Rocket className="w-4 h-4 text-white/60" />}
                    <div>
                      <div className="font-semibold">{asStr(it.name, 'Оружие')}</div>
                      <div className="text-xs text-white/40">
                        Тип: {w.type}, урон: {w.damage}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* ── Атаки NPC (атакующий — NPC) ── */}
      {attackerNpcId && (
        <div className="flex flex-col gap-1.5">
          <div className="text-xs text-white/50 uppercase tracking-wide">Атака NPC</div>
          {npcAttacks.length === 0 ? (
            <div className="text-sm text-white/40">У NPC нет атак</div>
          ) : (
            npcAttacks.map((atk: any) => (
              <button key={atk.name} type="button"
                onClick={() => setAttackName(atk.name)}
                className={`${btnBase} ${attackName === atk.name
                  ? 'border-orange-400 bg-orange-500/10 text-orange-200'
                  : btnIdle}`}
              >
                <div className="font-semibold">{atk.name}</div>
                <div className="text-xs text-white/40">
                  Урон: {atk.attack_dmg}, навык: {atk.attack_skill}
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* ── Режим атаки ── */}
      <div className="flex flex-col gap-1.5">
        <div className="text-xs text-white/50 uppercase tracking-wide flex items-center gap-2">
          Тип атаки
          {weaponForcedMode && (
            <span className="text-white/30 normal-case tracking-normal font-normal">
              (из оружия)
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['melee', 'ranged'] as const).map((mode) => {
            const isActive   = weaponMode === mode;
            const isDisabled = !!weaponForcedMode;
            return (
              <button key={mode} type="button"
                disabled={isDisabled}
                onClick={() => !isDisabled && setManualWeaponMode(mode)}
                className={`
                  flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm transition-colors
                  ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                  ${isActive && mode === 'melee'
                    ? 'border-orange-400 bg-orange-500/10 text-orange-200'
                    : isActive && mode === 'ranged'
                    ? 'border-sky-400 bg-sky-500/10 text-sky-200'
                    : 'border-white/20 hover:border-white/40 text-white/70'}
                `}
              >
                {mode === 'melee'
                  ? <><Sword className="w-4 h-4" /> Ближний бой</>
                  : <><Rocket className="w-4 h-4" /> Дальний бой</>}
              </button>
            );
          })}
        </div>

        {/* Трата поинтов */}
        {weaponMode && (attackerCharId || attackerNpcId) && (() => {
          // Если атакует NPC — skill_id берём из выбранной атаки автоматически
          const skillId: string = attackerNpcId
            ? (npcAttacks.find((a: any) => a.name === attackName)?.attack_skill ?? '')
            : attackSkillId(weaponMode);

          // Доступные поинты
          const availablePts: number = (() => {
            if (attackerCharId && attackerChar) {
              return (attackerChar.data?.skills?.[skillId] ?? 0) as number;
            }
            if (attackerNpcId && attackerNpc) {
              return (attackerNpc.data?.skills?.[skillId] ?? 0) as number;
            }
            return 0;
          })();

          if (!skillId) return null;

          return (
            <div className="text-xs text-white/40 mt-0.5 flex items-center gap-2 flex-wrap">
              Навык: <span className="text-white/60">{skillId}</span>
              <span>— {availablePts} pts</span>
              <Input
                type="number"
                min={0}
                max={availablePts}
                value={skillPoints}
                onChange={(e) => setSkillPoints(Math.min(Number(e.target.value), availablePts))}
                className="w-20 h-6 text-xs"
              />
            </div>
          );
        })()}
      </div>

      <button type="button" onClick={handleSubmit} disabled={!isReady}
        className={`rounded border px-3 py-2 text-sm font-semibold mt-1
          ${isReady
            ? 'border-red-400/70 text-red-200 hover:bg-red-500/10'
            : 'border-white/10 text-white/30 cursor-not-allowed'}`}
      >
        Начать атаку
      </button>
    </div>
  );
}
