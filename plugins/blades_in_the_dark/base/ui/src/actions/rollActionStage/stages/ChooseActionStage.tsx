'use client';

import { useEffect, useMemo } from 'react';
import { ACTIONS } from '../stageTypes';
import { ACTION_GROUPS } from '../../../types';
import { ACTION_RU, groupOfAction } from '../../../i18n';
import type { PluginScene, SceneCharacterRef, EntityRef, ActionId } from '../../../types';

function normId(x: any): string {
  return String(x ?? '').trim().toLowerCase();
}

function getActorKind(action: any, actorUserId: string): 'gm' | 'initiator' | 'player' {
  const p = action?.participants ?? {};
  const u = normId(actorUserId);
  if (u && normId(p.gmUserId) === u) return 'gm';
  if (u && normId(p.initiatorUserId) === u) return 'initiator';
  return 'player';
}

type Props = {
  user_id: string;
  action: any;
  value: any;
  patch: (p: any) => void;
};

function itemLabel(it: EntityRef): string {
  const q = (it?.data as any)?.quality;
  const qStr = Number.isFinite(Number(q)) ? `Q${Number(q)}` : 'Q?';
  return `${it?.name ?? it?.id} (${qStr})`;
}

export function ChooseActionStage({ user_id, action, value, patch }: Props) {
  const scene: PluginScene | null = (action?.scene ?? null) as any;
  const actorKind = getActorKind(action, user_id);

  const characters = useMemo(() => {
    const out: Array<{ ownerUserId: string; ch: SceneCharacterRef }> = [];
    const players = scene?.players ?? {};
    for (const [uid, entry] of Object.entries(players)) {
      for (const ch of (entry as any).characters ?? []) out.push({ ownerUserId: uid, ch });
    }
    return out;
  }, [scene]);

  const availableCharacters = useMemo(() => {
    if (actorKind === 'gm') return characters;
    return characters.filter((x) => normId(x.ownerUserId) === normId(user_id));
  }, [characters, actorKind, user_id]);

  const selectedAction: ActionId = (value?.action ?? ACTIONS[0]) as ActionId;
  const selectedCharacterId: string = value?.character_id ?? '';
  const selectedItemId: string = value?.item_id ?? '';

  const selectedCharacter = useMemo(() => {
    const m = new Map(availableCharacters.map((x) => [x.ch.id, x.ch] as const));
    return m.get(selectedCharacterId) ?? null;
  }, [availableCharacters, selectedCharacterId]);

  const items: EntityRef[] = useMemo(() => {
    const raw = (selectedCharacter as any)?.items ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [selectedCharacter]);

  const isValidItem = useMemo(() => {
    if (!selectedItemId) return true;
    return items.some((it) => String(it.id) === String(selectedItemId));
  }, [items, selectedItemId]);

  const ratingOf = (actionId: string) => {
    const v = selectedCharacter?.data?.actions?.[actionId];
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
  };

  const onlyOne = availableCharacters.length === 1;

  // Автозаполнение без “дрожания”:
  // - action ставим только если null/undefined
  // - character_id ставим только если пустой или невалидный для текущего списка
  // - item_id сбрасываем, если для выбранного персонажа он невалиден
  useEffect(() => {
    const firstId = availableCharacters[0]?.ch?.id ?? null;
    if (!firstId) return;

    const cur = value?.character_id ?? '';
    const isValidChar = availableCharacters.some((x) => x.ch.id === cur);

    const next: any = {};

    if (value?.action == null) next.action = ACTIONS[0];
    if (!cur || !isValidChar) next.character_id = firstId;

    // item_id: если предмет выбран, но в items текущего персонажа его нет — сбрасываем
    if (value?.item_id && !isValidItem) next.item_id = null;

    if (Object.keys(next).length > 0) patch(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableCharacters, value?.character_id, value?.action, isValidItem]);

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium">Выбор персонажа и action</div>

      <div>
        <div className="text-sm text-muted-foreground">Персонаж</div>
        <select
          className="w-full border rounded px-3 py-2 text-sm text-black bg-background disabled:opacity-60"
          value={selectedCharacterId || ''}
          onChange={(e) => patch({ character_id: e.target.value })}
          disabled={onlyOne}
        >
          {!onlyOne ? (
            <option value="" disabled>
              Выбери персонажа
            </option>
          ) : null}

          {availableCharacters.map(({ ch }) => {
            const label = (ch.name || ch.id).toString();
            return (
              <option key={ch.id} value={ch.id}>
                {label}
              </option>
            );
          })}
        </select>

        {availableCharacters.length === 0 ? (
          <div className="text-xs text-red-500 mt-1">
            Нет доступных персонажей (проверь scene.players и привязку character_id).
          </div>
        ) : null}
      </div>

      <div>
        <div className="text-sm text-muted-foreground">Предмет (помогает)</div>
        <select
          className="w-full border rounded px-3 py-2 text-sm text-black bg-background disabled:opacity-60"
          value={selectedItemId || ''}
          onChange={(e) => patch({ item_id: e.target.value || null })}
          disabled={!selectedCharacter}
        >
          <option value="">— без предмета —</option>

          {items.map((it) => (
            <option key={String(it.id)} value={String(it.id)}>
              {itemLabel(it)}
            </option>
          ))}
        </select>

        <div className="text-xs text-muted-foreground mt-1">
          Submit отправит item_id (id предмета), либо null.
        </div>
      </div>

      <div>
        <div className="text-sm text-muted-foreground">Action</div>

        <div className="flex gap-2 text-xs text-muted-foreground">
          {ACTION_GROUPS.map((g) => (
            <div key={g.key} className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded" style={{ background: g.color }} />
              {g.name}
            </div>
          ))}
        </div>

        <select
          className="w-full border rounded px-3 py-2 text-sm text-black bg-background"
          value={selectedAction}
          onChange={(e) => patch({ action: e.target.value })}
        >
          {ACTION_GROUPS.map((g) => (
            <optgroup key={g.key} label={g.name}>
              {g.actions.map((a) => (
                <option key={a} value={a} style={{ backgroundColor: g.color }}>
                  {ACTION_RU[a] ?? a} ({ratingOf(a)})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="text-xs text-muted-foreground">
        user_id: {user_id} · gmUserId: {action?.participants?.gmUserId} · kind: {actorKind}
      </div>

      <div className="text-xs text-muted-foreground">
        Submit отправит: {'{ character_id, action, item_id }'}.
      </div>
    </div>
  );
}
