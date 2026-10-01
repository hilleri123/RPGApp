'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ClipboardList, Gift, Heart, Sword, Trash2, X } from 'lucide-react';
import { getSceneBundle } from '@/plugins/common/types/actionSelectors';
import { MoveResolutionCard } from '../components/MoveResolutionCard';
import { extractMoveResolution } from '../components/moveResolution';
import { ParticipantStrip } from '../../../shared/InitiativeStrip';
import {
  contextEntities,
  readInitiative,
  type SceneEntityRef as InitiativeEntityRef,
  type SceneInitiative,
} from '../../../shared/initiative';
import { attackIgnoresArmor, npcAttacksById, type NpcAttackOption } from '../../../shared/npcAttacks';
import {
  buildSceneEntities,
  type SceneEntityKind,
  type SceneEntityRef,
} from '../components/SceneEntityTile';

type ManifestLineKind = 'resource_draft' | 'damage' | 'resource_grant';
type ManifestLineStatus = 'draft' | 'needs_roll' | 'rolled' | 'skipped' | 'applied';
type ManifestMode = 'edit' | 'review';

type ManifestTarget = {
  kind: SceneEntityKind | 'none';
  id: string;
  name: string;
};

type ManifestLine = {
  id: string;
  kind: ManifestLineKind;
  target: ManifestTarget;
  payload: Record<string, unknown>;
  status: ManifestLineStatus;
  label: string;
};

type UiStep = 'hub' | 'pick_type' | 'damage_form' | 'resource_form';

type Factory = {
  id: string;
  spec_id: string;
  amount?: number;
  label?: string;
  description?: string;
  source?: string;
  source_title?: string;
  filter_stats?: string[];
  filter_moves?: string[];
  filter_tags?: string[];
};

const DEFAULT_SPECS = [
  { id: 'forward', title: 'Forward' },
  { id: 'ongoing', title: 'Ongoing' },
];

function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function lineSummary(line: ManifestLine): string {
  if (line.label) return line.label;
  if (line.kind === 'damage') {
    const effect = String(line.payload.hp_effect || 'damage');
    const expr = String(line.payload.damage_expr || '');
    const total = line.payload.total_final;
    if (line.status === 'rolled' && total != null) {
      return `${effect === 'heal' ? 'Лечение' : 'Урон'} ${total}`;
    }
    return `${effect === 'heal' ? 'Лечение' : 'Урон'} ${expr}`;
  }
  const spec = String(line.payload.spec_id || 'ресурс');
  const amount = line.payload.amount != null ? ` ×${line.payload.amount}` : '';
  return `${spec}${amount}`;
}

type DamageQuickOption = {
  kind: string;
  id: string;
  damage_expr: string;
  weapon_id?: string;
  weapon_name?: string;
};

/** Куб урона персонажа (класс/оружие по умолчанию), который сервер кладёт в damageQuickOptions. */
function characterDie(options: DamageQuickOption[], kind: string, id: string): string {
  if (kind !== 'character' || !id) return '';
  return String(options.find((o) => o.kind === 'character' && o.id === id)?.damage_expr ?? '');
}

function characterWeapons(options: DamageQuickOption[], id: string): DamageQuickOption[] {
  return options.filter((o) => o.kind === 'character_weapon' && o.id === id);
}

function DamageLineForm({
  entity,
  entities,
  strip,
  initiative,
  scene,
  entry,
  quickOptions,
  initial,
  onSave,
  onCancel,
}: {
  entity: SceneEntityRef;
  entities: SceneEntityRef[];
  strip: InitiativeEntityRef[];
  initiative: SceneInitiative;
  scene: any;
  entry: any;
  quickOptions: DamageQuickOption[];
  initial?: ManifestLine | null;
  onSave: (line: ManifestLine) => void;
  onCancel: () => void;
}) {
  // NPC-«повод» хода, выбранный мастером при старте, — источник урона по умолчанию
  // (если он не сам получатель урона); иначе тот, кто делает ход.
  const entryNpcId = String(entry?.source_npc_id || '');
  const useEntryNpc = !!entryNpcId && entryNpcId !== entity.id;
  const defaultSourceKind: SceneEntityKind = useEntryNpc
    ? 'npc'
    : entry?.actor_character_id
      ? 'character'
      : 'npc';
  const defaultSourceId = useEntryNpc
    ? entryNpcId
    : String(entry?.actor_character_id ?? entry?.actor_npc_id ?? '');

  /** Атака NPC по умолчанию: выбранная мастером в начале хода, иначе первая. */
  const defaultAttack = (npcId: string): NpcAttackOption | null => {
    const list = npcAttacksById(scene, npcId);
    const preferred = npcId === entryNpcId ? String(entry?.npc_attack?.id || '') : '';
    return list.find((a) => a.id === preferred) ?? list[0] ?? null;
  };

  const initialSourceKind = (initial?.payload?.source_kind as SceneEntityKind) || defaultSourceKind;
  const initialSourceId = String(initial?.payload?.source_id || defaultSourceId);
  const initialAttack = initial ? null : initialSourceKind === 'npc' ? defaultAttack(initialSourceId) : null;

  const [hpEffect, setHpEffect] = useState<'damage' | 'heal'>(
    (initial?.payload?.hp_effect as 'damage' | 'heal') || 'damage',
  );
  const [sourceKind, setSourceKind] = useState<SceneEntityKind>(initialSourceKind);
  const [sourceId, setSourceId] = useState(initialSourceId);
  const [sourceLabel, setSourceLabel] = useState(String(initial?.payload?.source_label || ''));
  const [attackId, setAttackId] = useState(
    initial ? String(initial.payload?.attack_id || '') : initialAttack?.id ?? '',
  );
  const [attackName, setAttackName] = useState(
    initial ? String(initial.payload?.attack_name || '') : initialAttack?.name ?? '',
  );
  const [damageExpr, setDamageExpr] = useState(
    String(
      initial?.payload?.damage_expr ||
        initialAttack?.damage ||
        characterDie(quickOptions, initialSourceKind, initialSourceId) ||
        'd6',
    ),
  );
  const [ignoreArmor, setIgnoreArmor] = useState(
    Boolean(initial?.payload?.ignore_armor) || attackIgnoresArmor(initialAttack),
  );
  const [halfDamage, setHalfDamage] = useState(Boolean(initial?.payload?.half_damage));
  const [piercing, setPiercing] = useState(Number(initial?.payload?.piercing || 0));

  const npcAttacks = sourceKind === 'npc' && sourceId ? npcAttacksById(scene, sourceId) : [];
  const sourceDie = characterDie(quickOptions, sourceKind, sourceId);
  const weapons = sourceKind === 'character' && sourceId ? characterWeapons(quickOptions, sourceId) : [];

  /** Выбор источника всегда подставляет его куб: у NPC — куб атаки, у персонажа — куб класса. */
  const pickSource = (kind: SceneEntityKind, id: string) => {
    setSourceKind(kind);
    setSourceId(id);
    setSourceLabel(kind === 'world' ? 'Окружение' : '');
    setAttackId(kind === 'world' ? 'world' : '');
    setAttackName('');
    if (kind === 'npc') {
      const atk = defaultAttack(id);
      if (atk) {
        setAttackId(atk.id);
        setAttackName(atk.name);
        if (hpEffect === 'damage') setDamageExpr(atk.damage);
        setIgnoreArmor(attackIgnoresArmor(atk));
      }
    } else if (kind === 'character' && hpEffect === 'damage') {
      const die = characterDie(quickOptions, kind, id);
      if (die) setDamageExpr(die);
      setIgnoreArmor(false);
    }
  };

  const pickNpcAttack = (atk: NpcAttackOption) => {
    setAttackId(atk.id);
    setAttackName(atk.name);
    if (hpEffect === 'damage') setDamageExpr(atk.damage);
    setIgnoreArmor(attackIgnoresArmor(atk));
  };

  const valid =
    !!damageExpr.trim() &&
    (sourceKind === 'world' || !!sourceId);

  return (
    <div className="rounded border border-white/10 p-3 space-y-3">
      <div className="font-medium flex items-center gap-2">
        {hpEffect === 'heal' ? (
          <Heart className="w-4 h-4 text-emerald-300" />
        ) : (
          <Sword className="w-4 h-4 text-red-300" />
        )}
        Урон / лечение → {entity.name}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className={`rounded border px-3 py-1.5 text-sm ${hpEffect === 'damage' ? 'border-red-400/60 text-red-200' : 'border-white/10 text-white/50'}`}
          onClick={() => setHpEffect('damage')}
        >
          Урон
        </button>
        <button
          type="button"
          className={`rounded border px-3 py-1.5 text-sm ${hpEffect === 'heal' ? 'border-emerald-400/60 text-emerald-200' : 'border-white/10 text-white/50'}`}
          onClick={() => setHpEffect('heal')}
        >
          Лечение
        </button>
      </div>

      <div className="space-y-1">
        <div className="text-sm text-white/70">Источник (участники по порядку инициативы)</div>
        <ParticipantStrip
          initiative={initiative}
          entities={strip}
          markedId={sourceKind === 'world' ? null : sourceId || null}
          onSelect={(e) => pickSource(e.kind as SceneEntityKind, e.id)}
        />
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            className={`rounded border px-3 py-1.5 text-sm ${
              sourceKind === 'world'
                ? 'border-cyan-400/60 text-cyan-100'
                : 'border-white/10 text-white/60 hover:border-cyan-400/40'
            }`}
            onClick={() => pickSource('world', 'world')}
          >
            Окружение
          </button>
          {sourceKind === 'world' ? (
            <input
              className="min-w-0 flex-1 rounded border bg-zinc-950/30 px-2 py-1.5 text-sm"
              value={sourceLabel}
              onChange={(e) => setSourceLabel(e.target.value)}
              placeholder="Название источника (обвал, яд, падение…)"
            />
          ) : null}
        </div>
      </div>

      {sourceKind === 'npc' && sourceId ? (
        <div className="space-y-1">
          <div className="text-sm text-white/70">Атака NPC</div>
          {npcAttacks.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {npcAttacks.map((atk) => (
                <button
                  key={atk.id}
                  type="button"
                  onClick={() => pickNpcAttack(atk)}
                  className={`rounded border px-2 py-1 text-xs text-left ${
                    atk.id === attackId
                      ? 'border-rose-400/70 bg-rose-500/15 text-rose-100'
                      : 'border-white/10 text-white/70 hover:bg-white/5'
                  }`}
                >
                  {atk.description}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-xs text-white/40">У этого NPC нет атак с уроном — укажите кубы вручную.</div>
          )}
        </div>
      ) : null}

      {sourceKind === 'character' && sourceId && (sourceDie || weapons.length > 0) ? (
        <div className="space-y-1">
          <div className="text-sm text-white/70">Куб персонажа</div>
          <div className="flex flex-wrap gap-1.5">
            {sourceDie ? (
              <button
                type="button"
                className={`rounded border px-2 py-1 text-xs ${
                  !attackId && damageExpr.trim() === sourceDie
                    ? 'border-cyan-400/60 text-cyan-100'
                    : 'border-white/15 text-white/70 hover:border-cyan-400/40'
                }`}
                onClick={() => {
                  setAttackId('');
                  setAttackName('');
                  setDamageExpr(sourceDie);
                }}
              >
                Куб персонажа ({sourceDie})
              </button>
            ) : null}
            {weapons.map((w) => (
              <button
                key={w.weapon_id}
                type="button"
                className={`rounded border px-2 py-1 text-xs ${
                  attackId === w.weapon_id
                    ? 'border-cyan-400/60 text-cyan-100'
                    : 'border-white/15 text-white/70 hover:border-cyan-400/40'
                }`}
                onClick={() => {
                  setAttackId(String(w.weapon_id || ''));
                  setAttackName(String(w.weapon_name || ''));
                  setDamageExpr(w.damage_expr);
                }}
              >
                {w.weapon_name} ({w.damage_expr})
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <input
        className="w-full rounded border bg-zinc-950/30 px-2 py-2 text-sm"
        value={damageExpr}
        onChange={(e) => setDamageExpr(e.target.value)}
        placeholder={hpEffect === 'heal' ? 'Кубы лечения (1d8)' : 'Кубы урона (2d6+1)'}
      />

      <div className="flex flex-wrap gap-3 text-sm text-white/70">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={ignoreArmor} onChange={(e) => setIgnoreArmor(e.target.checked)} />
          Игнор брони
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={halfDamage} onChange={(e) => setHalfDamage(e.target.checked)} />
          Половина
        </label>
        <label className="flex items-center gap-2">
          Пронзание
          <input
            type="number"
            className="w-16 rounded border bg-zinc-950/30 px-2 py-1"
            value={piercing}
            onChange={(e) => setPiercing(Number(e.target.value || 0))}
          />
        </label>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!valid}
          className={`rounded border px-3 py-2 text-sm ${valid ? 'border-cyan-400/60 text-cyan-100' : 'border-white/10 text-white/30'}`}
          onClick={() => {
            const id = initial?.id || newId('dmg');
            const srcName =
              sourceKind === 'world'
                ? sourceLabel || 'Окружение'
                : entities.find((e) => e.kind === sourceKind && e.id === sourceId)?.name || '';
            onSave({
              id,
              kind: 'damage',
              target: { kind: entity.kind, id: entity.id, name: entity.name },
              status: 'needs_roll',
              label: `${srcName ? `${srcName}${sourceKind === 'npc' && attackName ? ` (${attackName})` : ''}: ` : ''}${hpEffect === 'heal' ? 'Лечение' : 'Урон'} ${damageExpr} → ${entity.name}`,
              payload: {
                id,
                source_kind: sourceKind,
                source_id: sourceKind === 'world' ? 'world' : sourceId,
                source_label: srcName,
                target_kind: entity.kind,
                target_id: entity.id,
                hp_effect: hpEffect,
                damage_expr: damageExpr.trim(),
                preset_formula: damageExpr.trim(),
                attack_id: sourceKind === 'world' ? 'world' : attackId,
                attack_name: attackName || srcName || (hpEffect === 'heal' ? 'Лечение' : 'Урон'),
                ignore_armor: ignoreArmor,
                half_damage: halfDamage,
                piercing,
                damage_seed: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              },
            });
          }}
        >
          Сохранить
        </button>
        <button type="button" className="rounded border px-3 py-2 text-sm text-white/60" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </div>
  );
}

function ResourceLineForm({
  entity,
  factories,
  initial,
  onSave,
  onCancel,
}: {
  entity: SceneEntityRef;
  factories: Factory[];
  initial?: ManifestLine | null;
  onSave: (line: ManifestLine) => void;
  onCancel: () => void;
}) {
  const [specId, setSpecId] = useState(String(initial?.payload?.spec_id || 'forward'));
  const [amount, setAmount] = useState(Number(initial?.payload?.amount ?? 1));
  const [description, setDescription] = useState(String(initial?.payload?.description || ''));
  const [factoryId, setFactoryId] = useState(String(initial?.payload?.factory_id || ''));

  const applyFactory = (f: Factory) => {
    setFactoryId(f.id);
    setSpecId(f.spec_id);
    setAmount(f.amount ?? 1);
    setDescription(f.label || f.description || '');
  };

  return (
    <div className="rounded border border-white/10 p-3 space-y-3">
      <div className="font-medium flex items-center gap-2">
        <Gift className="w-4 h-4 text-violet-300" />
        Ресурс → {entity.name}
      </div>

      {factories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {factories.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => applyFactory(f)}
              className={`rounded border px-2 py-1 text-xs ${
                factoryId === f.id
                  ? 'border-violet-400/70 bg-violet-500/15 text-violet-100'
                  : 'border-white/10 text-white/70 hover:bg-white/5'
              }`}
            >
              {f.label || f.spec_id}
              {f.amount ? ` ×${f.amount}` : ''}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <select
          className="rounded border bg-zinc-950/30 px-2 py-2 text-sm"
          value={specId}
          onChange={(e) => setSpecId(e.target.value)}
        >
          {DEFAULT_SPECS.map((s) => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
          {specId && !DEFAULT_SPECS.some((s) => s.id === specId) && (
            <option value={specId}>{specId}</option>
          )}
        </select>
        <input
          type="number"
          className="rounded border bg-zinc-950/30 px-2 py-2 text-sm"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value || 0))}
        />
        <input
          className="rounded border bg-zinc-950/30 px-2 py-2 text-sm"
          placeholder="Описание"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!specId || amount === 0}
          className={`rounded border px-3 py-2 text-sm ${
            specId && amount !== 0 ? 'border-violet-400/60 text-violet-100' : 'border-white/10 text-white/30'
          }`}
          onClick={() => {
            const id = initial?.id || newId('grant');
            const kind: ManifestLineKind =
              initial?.kind === 'resource_draft' ? 'resource_draft' : 'resource_grant';
            onSave({
              id,
              kind,
              target: { kind: entity.kind, id: entity.id, name: entity.name },
              status: 'draft',
              label: `${specId} ×${amount} → ${entity.name}`,
              payload: {
                ...(initial?.payload || {}),
                draft_id: initial?.payload?.draft_id || (kind === 'resource_draft' ? id : undefined),
                spec_id: specId,
                amount,
                description,
                target_kind: entity.kind,
                target_id: entity.id,
                factory_id: factoryId,
                skipped: false,
                confirmed: true,
              },
            });
          }}
        >
          Сохранить
        </button>
        <button type="button" className="rounded border px-3 py-2 text-sm text-white/60" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </div>
  );
}

export function PerformMoveChangeManifestStage({
  user_id,
  action,
  value,
  patch,
  onPatch,
  onSubmit,
  setSubmitEnabled,
  readOnly,
}: any) {
  const { scene, players } = getSceneBundle(action);
  const moveInfo = useMemo(() => extractMoveResolution(action), [action]);
  const stageData = action?.workflow?.stageData ?? {};
  const entry = action?.workflow?.context?.entry ?? {};

  const entities = useMemo(() => buildSceneEntities(scene), [scene]);
  const strip = useMemo(() => contextEntities(scene, players), [scene, players]);
  const initiative = useMemo(() => readInitiative((scene as any)?.data), [scene]);
  const actorKind = String(entry?.actor_kind || '');
  const actorId = String(
    actorKind === 'npc' ? entry?.actor_npc_id || '' : entry?.actor_character_id || '',
  );
  const castSpellEntryId = String(entry?.cast_spell_entry_id || '');
  const castSpellTitle = String(entry?.cast_spell_title || 'заклинание');
  const rollOutcome = String(entry?.roll?.outcome || '');
  const defaultUnprepare =
    typeof entry?.unprepare_cast_spell === 'boolean'
      ? entry.unprepare_cast_spell
      : rollOutcome !== 'hit_10_plus';
  const [unprepareLocal, setUnprepareLocal] = useState<boolean | null>(null);
  const unprepareCastSpell = unprepareLocal ?? defaultUnprepare;

  useEffect(() => {
    setUnprepareLocal(null);
  }, [entry?.cast_spell_entry_id, entry?.unprepare_cast_spell, rollOutcome]);

  const quickOptions: DamageQuickOption[] = Array.isArray(stageData.damageQuickOptions)
    ? stageData.damageQuickOptions
    : [];

  const factories: Factory[] = Array.isArray(stageData.resourceFactories)
    ? stageData.resourceFactories
    : Array.isArray(stageData.grantTemplates)
      ? stageData.grantTemplates
      : [];

  const serverLines: ManifestLine[] = Array.isArray(value?.lines)
    ? value.lines
    : Array.isArray(stageData?.stages?.['perform_move.change_manifest']?.lines)
      ? stageData.stages['perform_move.change_manifest'].lines
      : [];

  const mode: ManifestMode =
    (value?.mode as ManifestMode) ||
    stageData?.stages?.['perform_move.change_manifest']?.mode ||
    stageData?.manifestMode ||
    'edit';

  const isGm = String(action?.participants?.gmUserId ?? '') === String(user_id ?? '');
  const sentToGm = Boolean(
    stageData?.stages?.['perform_move.change_manifest']?.sent_to_gm ?? value?.sent_to_gm,
  );
  const isPartial = rollOutcome === 'hit_7_9';
  const serverComplication = String(entry?.gm_complication ?? '');
  const [complication, setComplication] = useState(serverComplication);
  useEffect(() => {
    setComplication(serverComplication);
  }, [serverComplication]);

  const saveComplication = () => {
    if (readOnly || !isGm || complication === serverComplication) return;
    onPatch?.({ gm_complication: complication });
  };

  const [lines, setLines] = useState<ManifestLine[]>(serverLines);
  const [uiStep, setUiStep] = useState<UiStep>('hub');
  const [selectedEntity, setSelectedEntity] = useState<SceneEntityRef | null>(null);
  const [editingLine, setEditingLine] = useState<ManifestLine | null>(null);

  useEffect(() => {
    setLines(serverLines);
  }, [JSON.stringify(serverLines)]); // eslint-disable-line react-hooks/exhaustive-deps

  // Игрок в режиме проверки только ждёт мастера; заявку, уже отправленную мастеру, повторно не шлём.
  useEffect(() => {
    setSubmitEnabled(isGm || (mode === 'edit' && !sentToGm));
  }, [setSubmitEnabled, isGm, mode, sentToGm]);

  const syncLines = (next: ManifestLine[], nextMode: ManifestMode = mode) => {
    setLines(next);
    const payload = { lines: next, mode: nextMode };
    patch(payload);
    onPatch?.(payload);
  };

  const setUnprepareCastSpell = (next: boolean) => {
    if (readOnly) return;
    setUnprepareLocal(next);
    const payload = { unprepare_cast_spell: next };
    patch(payload);
    onPatch?.(payload);
  };

  const upsertLine = (line: ManifestLine) => {
    const idx = lines.findIndex((l) => l.id === line.id);
    const next = idx >= 0 ? lines.map((l, i) => (i === idx ? line : l)) : [...lines, line];
    syncLines(next);
    setUiStep('hub');
    setSelectedEntity(null);
    setEditingLine(null);
  };

  const removeLine = (id: string) => {
    if (readOnly) return;
    syncLines(lines.filter((l) => l.id !== id));
  };

  const toggleSkip = (id: string) => {
    if (readOnly) return;
    syncLines(
      lines.map((l) => {
        if (l.id !== id) return l;
        const skipped = l.status !== 'skipped';
        return {
          ...l,
          status: skipped
            ? 'skipped'
            : l.kind === 'damage'
              ? l.payload.rolled
                ? 'rolled'
                : 'needs_roll'
              : 'draft',
          payload: { ...l.payload, skipped, confirmed: !skipped },
        };
      }),
    );
  };

  const openEntity = (entity: SceneEntityRef) => {
    if (readOnly || mode === 'review') return;
    setSelectedEntity(entity);
    setEditingLine(null);
    setUiStep('pick_type');
  };

  const activeLines = lines.filter((l) => l.status !== 'skipped');
  const lineBadges = useMemo(() => {
    const out: Record<string, string> = {};
    for (const l of lines) {
      if (l.status === 'skipped' || !l.target.id) continue;
      out[l.target.id] = String(Number(out[l.target.id] ?? 0) + 1);
    }
    return out;
  }, [lines]);
  const damageCount = activeLines.filter((l) => l.kind === 'damage').length;

  if (uiStep === 'pick_type' && selectedEntity) {
    return (
      <div className="rounded border p-3 flex flex-col gap-4">
        <button
          type="button"
          className="text-sm text-white/50 hover:text-white/80 flex items-center gap-1 w-fit"
          onClick={() => {
            setUiStep('hub');
            setSelectedEntity(null);
          }}
        >
          <ArrowLeft className="w-4 h-4" /> Назад к заявке
        </button>
        <div className="font-medium">Что сделать с {selectedEntity.name}?</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            className="rounded border border-red-400/40 px-3 py-3 text-left hover:bg-red-500/10"
            onClick={() => setUiStep('damage_form')}
          >
            <Sword className="w-4 h-4 text-red-300 inline mr-2" />
            Урон / лечение
          </button>
          <button
            type="button"
            className="rounded border border-violet-400/40 px-3 py-3 text-left hover:bg-violet-500/10"
            onClick={() => setUiStep('resource_form')}
          >
            <Gift className="w-4 h-4 text-violet-300 inline mr-2" />
            Ресурс (forward / ongoing)
          </button>
        </div>
      </div>
    );
  }

  if (uiStep === 'damage_form' && selectedEntity) {
    return (
      <div className="rounded border p-3 flex flex-col gap-3">
        <DamageLineForm
          entity={selectedEntity}
          entities={entities}
          strip={strip}
          initiative={initiative}
          scene={scene}
          entry={entry}
          quickOptions={quickOptions}
          initial={editingLine}
          onSave={upsertLine}
          onCancel={() => {
            setUiStep('hub');
            setSelectedEntity(null);
            setEditingLine(null);
          }}
        />
      </div>
    );
  }

  if (uiStep === 'resource_form' && selectedEntity) {
    return (
      <div className="rounded border p-3 flex flex-col gap-3">
        <ResourceLineForm
          entity={selectedEntity}
          factories={factories.filter((f) => !f.spec_id || f.spec_id === 'forward' || f.spec_id === 'ongoing')}
          initial={editingLine}
          onSave={upsertLine}
          onCancel={() => {
            setUiStep('hub');
            setSelectedEntity(null);
            setEditingLine(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="rounded border p-3 flex flex-col gap-4">
      <MoveResolutionCard data={moveInfo} />
      <div className="font-medium flex items-center gap-2">
        <ClipboardList className="w-4 h-4 text-cyan-300" />
        {mode === 'review' ? 'Проверка заявки' : 'Заявка на изменения'}
      </div>
      <p className="text-xs text-white/45 -mt-2">
        {mode === 'review'
          ? 'После бросков: проверьте итоги урона и ресурсы, затем примените.'
          : 'Выберите участника, добавьте урон или ресурс. Потом продолжите.'}
      </p>

      {mode === 'edit' && isGm && sentToGm ? (
        <div className="rounded border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          Игрок отправил заявку. Проверьте строки урона и ресурсов, поправьте или уберите лишнее и подтвердите.
        </div>
      ) : null}
      {mode === 'edit' && !isGm && sentToGm ? (
        <div className="rounded border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
          Заявка отправлена мастеру. Ждём подтверждения (правка заявки вернёт её в черновик).
        </div>
      ) : null}

      {isPartial && (isGm || serverComplication) ? (
        <div className="rounded border border-amber-400/30 bg-amber-500/5 px-3 py-2 space-y-1.5">
          <div className="text-xs uppercase tracking-wide text-amber-300/80">Косяк (7–9)</div>
          {isGm && !readOnly ? (
            <>
              <textarea
                className="w-full rounded border bg-zinc-950/30 px-2 py-1.5 text-sm"
                rows={2}
                maxLength={500}
                placeholder="Что пошло не так? Любая цена, осложнение или сложный выбор"
                value={complication}
                onChange={(e) => setComplication(e.target.value)}
                onBlur={saveComplication}
              />
              <div className="text-[11px] text-white/35">
                Попадёт в итог хода и журнал. Пусто — без косяка.
              </div>
            </>
          ) : (
            <div className="text-sm text-amber-100 whitespace-pre-wrap">{serverComplication}</div>
          )}
        </div>
      ) : null}

      {castSpellEntryId ? (
        <label className="flex items-start gap-2 rounded border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-100">
          <input
            type="checkbox"
            className="mt-1"
            checked={Boolean(unprepareCastSpell)}
            disabled={readOnly}
            onChange={(e) => setUnprepareCastSpell(e.target.checked)}
          />
          <span>
            Снять подготовку «{castSpellTitle}» у кастера
            <span className="block text-[11px] text-violet-200/60">
              {rollOutcome === 'hit_10_plus'
                ? 'На 10+ по умолчанию не снимаем — можно включить вручную.'
                : rollOutcome === 'hit_7_9' || rollOutcome === 'miss_6_minus' || rollOutcome === 'miss'
                  ? 'На 9− по умолчанию снимаем подготовку — можно снять галочку.'
                  : 'При применении заклинание перестанет быть подготовленным у кастера.'}
            </span>
          </span>
        </label>
      ) : null}

      {(mode === 'edit' || mode === 'review') && (
        <div className="space-y-2">
          <div className="text-xs text-white/30 uppercase tracking-wide">
            {initiative.order.length ? 'Участники сцены · по порядку инициативы' : 'Участники сцены'}
          </div>
          <ParticipantStrip
            initiative={initiative}
            entities={strip}
            disabled={readOnly || mode === 'review'}
            markedId={actorId || null}
            badges={lineBadges}
            onSelect={(e) => {
              const entity = entities.find((x) => x.id === e.id && x.kind === e.kind);
              if (entity) openEntity(entity);
            }}
          />
        </div>
      )}

      <div className="space-y-2">
        <div className="text-xs text-white/30 uppercase tracking-wide">
          Строки заявки ({activeLines.length})
        </div>
        {lines.length === 0 ? (
          <div className="text-sm text-white/40 italic">Пока пусто — кликните участника</div>
        ) : (
          <div className="space-y-1.5">
            {lines.map((line) => {
              const skipped = line.status === 'skipped';
              return (
                <div
                  key={line.id}
                  className={`rounded border px-3 py-2 flex items-center gap-2 text-sm ${
                    skipped ? 'border-white/5 opacity-40' : 'border-white/10 bg-zinc-950/20'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-white/85">{lineSummary(line)}</div>
                    <div className="text-[10px] text-white/35">
                      {line.kind === 'damage'
                        ? line.status === 'rolled'
                          ? 'бросок готов'
                          : 'нужен бросок'
                        : line.kind === 'resource_draft'
                          ? 'из хода'
                          : 'выдача'}
                      {line.target.name ? ` · ${line.target.name}` : ''}
                      {line.status === 'rolled' && line.payload.dice
                        ? ` · [${(line.payload.dice as number[]).join(', ')}]`
                        : ''}
                    </div>
                  </div>
                  {!readOnly && mode === 'edit' && (
                    <>
                      <button
                        type="button"
                        title="Пропустить"
                        className="text-white/40 hover:text-white/80"
                        onClick={() => toggleSkip(line.id)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Удалить"
                        className="text-red-300/60 hover:text-red-300"
                        onClick={() => removeLine(line.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  {!readOnly && mode === 'review' && isGm && (
                    <button
                      type="button"
                      className="text-xs text-white/40 hover:text-white/80"
                      onClick={() => toggleSkip(line.id)}
                    >
                      {skipped ? 'Вернуть' : line.kind === 'damage' ? 'Отклонить' : 'Пропустить'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        {mode === 'edit' ? (
          <button
            type="button"
            disabled={readOnly || (!isGm && sentToGm)}
            onClick={() =>
              onSubmit({
                action: 'continue',
                mode: 'edit',
                lines,
                unprepare_cast_spell: Boolean(unprepareCastSpell),
                ...(isGm && isPartial ? { gm_complication: complication } : {}),
              })
            }
            className="rounded border border-cyan-400/60 px-3 py-2 text-sm text-cyan-100 disabled:opacity-40"
          >
            {!isGm
              ? sentToGm
                ? 'Отправлено мастеру'
                : 'Отправить заявку мастеру'
              : damageCount > 0
                ? `Подтвердить заявку и перейти к броскам (${damageCount})`
                : 'Подтвердить и перейти к проверке'}
          </button>
        ) : isGm ? (
          <button
            type="button"
            disabled={readOnly}
            onClick={() =>
              onSubmit({
                action: 'apply',
                mode: 'review',
                lines,
                unprepare_cast_spell: Boolean(unprepareCastSpell),
                ...(isPartial ? { gm_complication: complication } : {}),
              })
            }
            className="rounded border border-emerald-400/60 px-3 py-2 text-sm text-emerald-100 disabled:opacity-40"
          >
            Принять и применить
          </button>
        ) : (
          <div className="text-sm text-white/50">Ждём, пока мастер проверит итоги и примет ход.</div>
        )}
      </div>
    </div>
  );
}
