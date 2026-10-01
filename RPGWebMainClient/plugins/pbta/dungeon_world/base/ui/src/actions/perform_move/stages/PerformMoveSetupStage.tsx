'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Sword } from 'lucide-react';
import { getSceneBundle } from 'plugins/common/types/actionSelectors';
import { PerformMoveSetupStage as BasePerformMoveSetupStage } from '../../../../../../../base/ui/src/actions/perform_move/stages/PerformMoveSetupStage';
import { ParticipantStrip } from '../../../shared/InitiativeStrip';
import { contextEntities, readInitiative, type SceneEntityRef } from '../../../shared/initiative';
import { normalizeSceneMode } from '../../../shared/sceneModes';
import { npcAttacksById } from '../../../shared/npcAttacks';

type Props = {
  user_id: string;
  action: any;
  value: any;
  patch: (next: Record<string, unknown>) => void;
  onSubmit: (payload: Record<string, unknown>) => void;
  setSubmitEnabled: (e: boolean) => void;
};

function findPlayerCharacterId(action: any, userId: string): string | null {
  const { scene, links } = getSceneBundle(action);
  const map = links?.characterToUserId ?? {};
  for (const ch of scene?.characters ?? []) {
    const owner = map[ch.id];
    if (owner && String(owner) === String(userId)) {
      return String(ch.id);
    }
  }
  return null;
}

function selectionPatch(prefix: 'actor' | 'target', entity: SceneEntityRef | null) {
  return {
    [`${prefix}_character_id`]: entity?.kind === 'character' ? entity.id : null,
    [`${prefix}_npc_id`]: entity?.kind === 'npc' ? entity.id : null,
  };
}

/**
 * Выбор мастера: участники в порядке инициативы, по умолчанию — тот, чей сейчас ход.
 * NPC ход не делает: действует персонаж, а NPC (с выбранной атакой) — «повод» хода
 * (например, заставляет уклоняться). Атака идёт через все фазы до заявок на урон.
 */
function GmSetup({ action, value, patch, onSubmit, setSubmitEnabled }: Omit<Props, 'user_id'>) {
  const { scene, players } = getSceneBundle(action);
  const entities = useMemo(() => contextEntities(scene, players), [scene, players]);
  const characters = useMemo(() => entities.filter((e) => e.kind === 'character'), [entities]);
  const npcs = useMemo(() => entities.filter((e) => e.kind === 'npc'), [entities]);
  const byId = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities]);
  const initiative = useMemo(() => readInitiative((scene as any)?.data), [scene]);

  // Очередь ходов ведётся только в бою; в лагере и в пути «текущего по инициативе» нет.
  const inAction = normalizeSceneMode((scene as any)?.data?.mode) === 'action';
  const strip = inAction ? initiative : { ...initiative, order: [] };
  const currentId = inAction ? initiative.order[initiative.active_index] : undefined;
  const current = currentId ? byId.get(currentId) ?? null : null;

  const actorId = String(value?.actor_character_id || '');
  const sourceNpcId = String(value?.source_npc_id || '');
  const attackId = String(value?.source_attack_id || '');
  const targetId = String(value?.target_character_id || value?.target_npc_id || '');

  const attacks = useMemo(() => (sourceNpcId ? npcAttacksById(scene, sourceNpcId) : []), [scene, sourceNpcId]);

  // Ход текущего по инициативе подставляется один раз: персонаж — актором,
  // NPC — источником (с его первой атакой); ручной выбор мастера не перетирается.
  const defaultedRef = useRef(false);
  useEffect(() => {
    if (defaultedRef.current || !current) return;
    defaultedRef.current = true;
    if (current.kind === 'character') {
      if (!actorId) patch({ actor_character_id: current.id, actor_npc_id: null });
    } else if (!sourceNpcId) {
      const first = npcAttacksById(scene, current.id)[0];
      patch({ source_npc_id: current.id, source_attack_id: first?.id ?? null, actor_npc_id: null });
    }
  }, [current, actorId, sourceNpcId, scene, patch]);

  const actor = byId.get(actorId) ?? null;
  const sourceNpc = byId.get(sourceNpcId) ?? null;
  const valid = Boolean(actor);
  useEffect(() => {
    setSubmitEnabled(valid);
  }, [valid, setSubmitEnabled]);

  const pickActor = (e: SceneEntityRef) => patch({ actor_character_id: e.id, actor_npc_id: null });
  const pickSource = (e: SceneEntityRef) => {
    if (e.id === sourceNpcId) {
      patch({ source_npc_id: null, source_attack_id: null });
      return;
    }
    const first = npcAttacksById(scene, e.id)[0];
    patch({ source_npc_id: e.id, source_attack_id: first?.id ?? null });
  };
  const pickAttack = (id: string) => patch({ source_attack_id: id === attackId ? null : id });
  const pickTarget = (e: SceneEntityRef) =>
    patch(selectionPatch('target', e.id === targetId ? null : e));

  const submit = () => {
    if (!actor) return;
    const target = byId.get(targetId) ?? null;
    onSubmit({
      actor_character_id: actor.id,
      actor_npc_id: null,
      source_npc_id: sourceNpc?.id ?? null,
      source_attack_id: sourceNpc ? attackId || null : null,
      ...selectionPatch('target', target),
    });
  };

  return (
    <div className="rounded border p-3 flex flex-col gap-4">
      <div className="font-medium flex items-center gap-2">
        <Sword className="w-4 h-4 text-indigo-300" />
        Выбор персонажа, NPC и цели
      </div>

      <div className="space-y-1">
        <div className="text-sm text-white/70">Кто делает ход (персонаж)</div>
        {current && !actor ? (
          <div className="text-xs text-rose-300">
            Сейчас ход: {current.name}.
            {current.kind === 'npc' ? ' NPC ход не делает — выберите персонажа, на которого он действует.' : ''}
          </div>
        ) : null}
        <ParticipantStrip initiative={strip} entities={characters} onSelect={pickActor} markedId={actorId || null} />
        {characters.length === 0 ? <div className="text-xs text-amber-300/70">В сцене нет персонажей</div> : null}
      </div>

      {npcs.length > 0 ? (
        <div className="space-y-1">
          <div className="text-sm text-white/70">NPC-источник (необязательно)</div>
          <ParticipantStrip initiative={strip} entities={npcs} onSelect={pickSource} markedId={sourceNpcId || null} />
          {sourceNpc ? (
            attacks.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {attacks.map((atk) => (
                  <button
                    key={atk.id}
                    type="button"
                    onClick={() => pickAttack(atk.id)}
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
              <div className="text-xs text-white/40">У {sourceNpc.name} нет атак с уроном.</div>
            )
          ) : (
            <div className="text-xs text-white/40">
              NPC не ходит сам, но может заставить персонажа действовать (например, уклониться).
            </div>
          )}
        </div>
      ) : null}

      <div className="space-y-1">
        <div className="text-sm text-white/70">Цель (необязательно)</div>
        <ParticipantStrip initiative={strip} entities={entities} onSelect={pickTarget} markedId={targetId || null} />
        <div className="text-xs text-white/40">
          Нажмите на выбранную цель ещё раз, чтобы снять выбор. Для нарративных ходов цель не нужна.
        </div>
      </div>

      <button
        type="button"
        disabled={!valid}
        onClick={submit}
        className={`rounded border px-3 py-2 text-sm font-semibold ${
          valid
            ? 'border-indigo-400/70 text-indigo-200 hover:bg-indigo-500/10'
            : 'border-white/10 text-white/30 cursor-not-allowed'
        }`}
      >
        Далее{actor ? ` — ходит ${actor.name}` : ''}
      </button>
    </div>
  );
}

export function PerformMoveSetupStage(props: Props) {
  const { user_id, action, onSubmit } = props;
  const autoSubmittedRef = useRef(false);

  const isGm = String(action?.participants?.gmUserId ?? '') === String(user_id ?? '');
  const playerCharacterId = !isGm ? findPlayerCharacterId(action, user_id) : null;

  useEffect(() => {
    if (isGm || !playerCharacterId || autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    onSubmit({
      actor_character_id: playerCharacterId,
      actor_npc_id: null,
      target_character_id: null,
      target_npc_id: null,
    });
  }, [isGm, onSubmit, playerCharacterId]);

  if (!isGm && playerCharacterId) {
    return (
      <div className="rounded border p-3 text-sm text-gray-300">
        Подставляем вашего персонажа и переходим к выбору хода…
      </div>
    );
  }

  if (isGm) return <GmSetup {...props} />;

  return <BasePerformMoveSetupStage {...props} />;
}
