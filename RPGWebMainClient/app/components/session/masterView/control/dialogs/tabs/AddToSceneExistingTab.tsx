'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

import { Input } from '@/components/ui/input';
import { useMasterUiStore } from '@/app/services/stores/masterUi';
import { useSessionScenarioApi } from '@/app/services/hooks/session/useSessionScenarioApi';
import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';

import { ItemDraggableSquare } from '@/app/components/common/squares/ItemDraggableSquare';
import { NPCDraggableSquare } from '@/app/components/common/squares/NPCDraggableSquare';

import { ContextActions, type ContextItem } from '@/app/components/common/DraggableSquare';
import { ConfirmAlertDialog } from '@/app/components/common/ConfirmAlertDialog';
import {
  EntityTagFilterChips,
  collectTagKeysFromItems,
  entityHasAllTags,
} from '@/app/components/scenarios/dialogs/common/EntityTagFilterChips';
import {
  collectItemOwnerOptions,
  itemOwnerFilterKey,
  itemOwnerFilterLabel,
  matchItemOwnerFilter,
  type ItemOwnerFilterValue,
} from '@/app/components/scenarios/lists/common/itemOwnerFilter';
import type { ItemOwnerShort } from '@/app/services/types2';

function norm(s: any) {
  return String(s ?? '').trim().toLowerCase();
}

type CatalogItem = {
  item: any;
  owner: ItemOwnerShort | null;
};

function flattenSessionItems(opts: {
  freeItems: any[];
  characters: any[];
  npcs: any[];
}): CatalogItem[] {
  const out: CatalogItem[] = [];
  const seen = new Set<string>();

  const push = (raw: any, owner: ItemOwnerShort | null) => {
    const id = String(raw?.id ?? '');
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push({ item: raw, owner });
  };

  for (const it of opts.freeItems ?? []) push(it, null);

  for (const ch of opts.characters ?? []) {
    const owner: ItemOwnerShort = {
      type: 'character',
      id: String(ch?.id ?? ''),
      name: String(ch?.name ?? ''),
      icon_url: ch?.icon_url ?? null,
      img_url: ch?.img_url ?? null,
    };
    if (!owner.id) continue;
    for (const it of ch?.owned_items ?? ch?.owneditems ?? []) push(it, owner);
  }

  for (const npc of opts.npcs ?? []) {
    const owner: ItemOwnerShort = {
      type: 'npc',
      id: String(npc?.id ?? ''),
      name: String(npc?.name ?? ''),
      icon_url: npc?.icon_url ?? null,
      img_url: npc?.img_url ?? null,
    };
    if (!owner.id) continue;
    for (const it of npc?.owned_items ?? npc?.owneditems ?? []) push(it, owner);
  }

  return out;
}

type Presence = Map<string, Set<string>>;
type InSceneState = 'none' | 'public' | 'private';

function collectPresence(scenes: any[], kind: 'npc' | 'item'): Presence {
  const where: Presence = new Map();
  for (const sc of scenes ?? []) {
    const sid = String(sc?.id ?? '');
    if (!sid) continue;

    const pubIds =
      kind === 'npc'
        ? ((sc?.public?.npcs ?? []).map((x: any) => x.id) ?? sc?.public?.npc_ids ?? [])
        : ((sc?.public?.items ?? []).map((x: any) => x.id) ?? sc?.public?.item_ids ?? []);

    const privIds =
      kind === 'npc'
        ? ((sc?.private?.npcs ?? []).map((x: any) => x.id) ?? sc?.private?.npc_ids ?? [])
        : ((sc?.private?.items ?? []).map((x: any) => x.id) ?? sc?.private?.item_ids ?? []);

    for (const id of [...pubIds, ...privIds]) {
      const eid = String(id ?? '');
      if (!eid) continue;
      if (!where.has(eid)) where.set(eid, new Set());
      where.get(eid)!.add(sid);
    }
  }
  return where;
}

function alphaClass(entityId: any, currentSceneId: string | null, presence: Presence) {
  if (!currentSceneId) return 'opacity-100';

  const sid = String(currentSceneId);
  const set = presence.get(String(entityId ?? ''));
  const inThis = !!set?.has(sid);
  const inOther = !!set && (set.size > (inThis ? 1 : 0));

  if (inThis) return 'opacity-[.35]';
  if (inOther) return 'opacity-100';
  return 'opacity-60';
}

function currentSceneStateFor(opts: {
  scenes: any[];
  currentSceneId: string | null;
  kind: 'npc' | 'item';
  entityId: any;
}): InSceneState {
  const { scenes, currentSceneId, kind, entityId } = opts;
  if (!currentSceneId) return 'none';

  const sid = String(currentSceneId);
  const id = String(entityId ?? '');
  const sc = (scenes ?? []).find((x: any) => String(x?.id ?? '') === sid);
  if (!sc) return 'none';

  const pubIds =
    kind === 'npc'
      ? ((sc?.public?.npcs ?? []).map((x: any) => x.id) ?? sc?.public?.npc_ids ?? [])
      : ((sc?.public?.items ?? []).map((x: any) => x.id) ?? sc?.public?.item_ids ?? []);

  const privIds =
    kind === 'npc'
      ? ((sc?.private?.npcs ?? []).map((x: any) => x.id) ?? sc?.private?.npc_ids ?? [])
      : ((sc?.private?.items ?? []).map((x: any) => x.id) ?? sc?.private?.item_ids ?? []);

  if (pubIds.some((x: any) => String(x) === id)) return 'public';
  if (privIds.some((x: any) => String(x) === id)) return 'private';
  return 'none';
}

function KindSwitch({
  existingKind,
  setExistingKind,
}: {
  existingKind: 'npc' | 'item';
  setExistingKind: (k: 'npc' | 'item') => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        className={[
          'px-3 py-2 rounded border text-sm',
          existingKind === 'npc' ? 'bg-gray-800 border-gray-600' : 'bg-gray-900 border-gray-800 hover:bg-gray-800',
        ].join(' ')}
        onClick={() => setExistingKind('npc')}
      >
        NPC
      </button>
      <button
        type="button"
        className={[
          'px-3 py-2 rounded border text-sm',
          existingKind === 'item' ? 'bg-gray-800 border-gray-600' : 'bg-gray-900 border-gray-800 hover:bg-gray-800',
        ].join(' ')}
        onClick={() => setExistingKind('item')}
      >
        Item
      </button>
    </div>
  );
}

export function AddToSceneExistingTab({
  existingKind,
  setExistingKind,
  q,
  setQ,
  fixedKind,
  onEditNpc,
  onViewNpc,
  onEditItem,
  onViewItem,
  requiredTags: requiredTagsProp = [],
}: {
  existingKind: 'npc' | 'item';
  setExistingKind: (k: 'npc' | 'item') => void;
  q: string;
  setQ: (v: string) => void;
  fixedKind?: 'npc' | 'item';

  onEditNpc?: (npc: any) => void;
  onViewNpc?: (npc: any) => void;
  onEditItem?: (item: any) => void;
  onViewItem?: (item: any) => void;
  /** Extra tags that must match (front filter). */
  requiredTags?: string[];
}) {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  const currentSceneId = useMasterUiStore((s) => s.currentSceneId);

  const { api, reloadSessionFields } = useSessionScenarioApi();

  const {
    isMaster,
    scenes,
    npcs,
    items,
    characters,
    moveToScene,
    moveOutScene,
    makeElementPublic,
  } = useSessionWebSocket(sessionId) as any;

  // confirm-delete state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ kind: 'npc' | 'item'; id: string; name?: string } | null>(null);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [ownerFilter, setOwnerFilter] = useState<ItemOwnerFilterValue>('');

  const npcPresence = useMemo(() => collectPresence(scenes ?? [], 'npc'), [scenes]);
  const itemPresence = useMemo(() => collectPresence(scenes ?? [], 'item'), [scenes]);

  const kind = fixedKind ?? existingKind;
  const qq = norm(q);
  const requiredTags = requiredTagsProp ?? [];

  const catalogItems = useMemo(
    () =>
      flattenSessionItems({
        freeItems: Array.isArray(items) ? items : [],
        characters: Array.isArray(characters) ? characters : [],
        npcs: Array.isArray(npcs) ? npcs : [],
      }),
    [items, characters, npcs],
  );

  const ownerOptions = useMemo(
    () => collectItemOwnerOptions(catalogItems.map((row) => ({ owner: row.owner }))),
    [catalogItems],
  );

  const tagOptions = useMemo(() => {
    const list =
      kind === 'npc'
        ? (Array.isArray(npcs) ? npcs : [])
        : catalogItems.map((row) => row.item);
    return collectTagKeysFromItems(list);
  }, [kind, npcs, catalogItems]);

  const filteredNpcs = useMemo(() => {
    const list = Array.isArray(npcs) ? npcs : [];
    return list.filter((x: any) => {
      if (!entityHasAllTags(x?.tags, requiredTags)) return false;
      if (!entityHasAllTags(x?.tags, activeTags)) return false;
      if (!qq) return true;
      return norm(x?.name).includes(qq);
    });
  }, [npcs, qq, activeTags, requiredTags]);

  const filteredItems = useMemo(() => {
    return catalogItems.filter(({ item, owner }) => {
      if (!matchItemOwnerFilter(owner, ownerFilter)) return false;
      if (!entityHasAllTags(item?.tags, requiredTags)) return false;
      if (!entityHasAllTags(item?.tags, activeTags)) return false;
      if (!qq) return true;
      return norm(item?.name).includes(qq);
    });
  }, [catalogItems, qq, activeTags, requiredTags, ownerFilter]);

  const canUse = !!isMaster && !!currentSceneId;

  const askDelete = useCallback((kind: 'npc' | 'item', entity: any) => {
    setPendingDelete({ kind, id: String(entity?.id ?? ''), name: String(entity?.name ?? '') });
    setConfirmOpen(true);
  }, []);

  const doDelete = useCallback(async () => {
    if (!pendingDelete) return;
    if (!isMaster) return;

    setConfirmLoading(true);
    try {
      if (pendingDelete.kind === 'npc') {
        await api?.deleteNpc(pendingDelete.id);
        reloadSessionFields(['npcs', 'scenes']);
      } else {
        await api?.deleteItem(pendingDelete.id);
        reloadSessionFields(['items', 'scenes']);
      }
      setConfirmOpen(false);
      setPendingDelete(null);
    } finally {
      setConfirmLoading(false);
    }
  }, [pendingDelete, isMaster, api, reloadSessionFields]);

  function buildMenu(args: {
    entity: any;
    kind: 'npc' | 'item';
    state: InSceneState;
    canUse: boolean;
    currentSceneId: string | null;
    onEdit?: (x: any) => void;
  }): ContextItem[] {
    const { entity, kind, state, canUse, currentSceneId, onEdit } = args;
    const id = entity?.id;

    const menu: ContextItem[] = [];

    // 1) edit first
    if (onEdit) menu.push({ ...ContextActions.edit, onClick: () => onEdit(entity) });

    // 2) permanent delete (master only)
    if (isMaster) {
      menu.push({
        ...ContextActions.delete,
        onClick: () => askDelete(kind, entity),
      });
    }

    if (!canUse || !currentSceneId) return menu;

    // not in current scene → only add
    if (state === 'none') {
      menu.push({
        ...ContextActions.addToScene,
        label: 'Добавить в сцену (private)',
        onClick: () =>
          kind === 'npc'
            ? moveToScene(currentSceneId, id, undefined)
            : moveToScene(currentSceneId, undefined, id),
      });
      return menu;
    }

    // in current scene
    if (state === 'public') {
      menu.push({
        ...ContextActions.makePrivate,
        onClick: () =>
          kind === 'npc'
            ? makeElementPublic(currentSceneId, false, id, undefined)
            : makeElementPublic(currentSceneId, false, undefined, id),
      });
      menu.push({
        ...ContextActions.removeFromScene,
        onClick: () =>
          kind === 'npc'
            ? moveOutScene(currentSceneId, id, undefined)
            : moveOutScene(currentSceneId, undefined, id),
      });
      return menu;
    }

    // private
    menu.push({
      ...ContextActions.makePublic,
      onClick: () =>
        kind === 'npc'
          ? makeElementPublic(currentSceneId, true, id, undefined)
          : makeElementPublic(currentSceneId, true, undefined, id),
    });
    menu.push({
      ...ContextActions.removeFromScene,
      onClick: () =>
        kind === 'npc'
          ? moveOutScene(currentSceneId, id, undefined)
          : moveOutScene(currentSceneId, undefined, id),
    });
    return menu;
  }

  return (
    <>
      <div className="space-y-3">
        {!currentSceneId ? <div className="text-xs text-red-400">Сначала выбери текущую сцену.</div> : null}

        {!fixedKind ? (
          <KindSwitch
            existingKind={existingKind}
            setExistingKind={(k) => {
              setExistingKind(k);
              setActiveTags([]);
              setOwnerFilter('');
            }}
          />
        ) : null}

        <div>
          <div className="text-xs text-gray-400 mb-1">Поиск по имени</div>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Начни вводить..." />
        </div>

        {kind === 'item' ? (
          <div>
            <div className="text-xs text-gray-400 mb-1">У кого находятся</div>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                className="rounded-md border border-gray-700 bg-gray-950 text-gray-100 text-sm px-2 py-1.5 max-w-full"
              >
                <option value="">Все владельцы</option>
                {ownerOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {ownerFilter ? (
                <button
                  type="button"
                  onClick={() => setOwnerFilter('')}
                  className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded border border-gray-700"
                >
                  сбросить
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {tagOptions.length > 0 ? (
          <div>
            <div className="text-xs text-gray-400 mb-1">Фильтр по тэгам</div>
            <EntityTagFilterChips options={tagOptions} value={activeTags} onChange={setActiveTags} />
          </div>
        ) : null}

        <div className="rounded border border-gray-800 bg-gray-900 p-2">
          <div className="text-xs text-muted-foreground mb-2">
            Серые — уже в текущей сцене; белые — на других сценах.
          </div>

          <div className="flex flex-wrap gap-2">
            {kind === 'npc'
              ? filteredNpcs.map((npc: any) => {
                  const id = npc?.id;
                  const opacity = alphaClass(id, currentSceneId, npcPresence);
                  const state = currentSceneStateFor({ scenes: scenes ?? [], currentSceneId, kind: 'npc', entityId: id });

                  const title = (() => {
                    const set = npcPresence.get(String(id ?? ''));
                    if (!currentSceneId) return undefined;
                    if (set?.has(String(currentSceneId))) return 'Уже в текущей сцене';
                    if (set && set.size > 0) return 'Есть на других сценах';
                    return 'Не в сценах';
                  })();

                  return (
                    <div key={String(id)} className={opacity} title={title}>
                      <NPCDraggableSquare
                        npc={npc}
                        isMaster={isMaster}
                        onInfo={onViewNpc ? () => onViewNpc(npc) : undefined}
                        contextItems={buildMenu({
                          entity: npc,
                          kind: 'npc',
                          state,
                          canUse,
                          currentSceneId,
                          onEdit: onEditNpc,
                        })}
                      />
                    </div>
                  );
                })
              : filteredItems.map(({ item, owner }) => {
                  const id = item?.id;
                  const opacity = alphaClass(id, currentSceneId, itemPresence);
                  const state = currentSceneStateFor({ scenes: scenes ?? [], currentSceneId, kind: 'item', entityId: id });
                  const ownerLabel = itemOwnerFilterLabel(owner);

                  const title = (() => {
                    const parts: string[] = [`У: ${ownerLabel}`];
                    const set = itemPresence.get(String(id ?? ''));
                    if (currentSceneId) {
                      if (set?.has(String(currentSceneId))) parts.push('Уже в текущей сцене');
                      else if (set && set.size > 0) parts.push('Есть на других сценах');
                      else parts.push('Не в сценах');
                    }
                    return parts.join(' · ');
                  })();

                  return (
                    <div key={`${itemOwnerFilterKey(owner)}:${String(id)}`} className={opacity} title={title}>
                      <ItemDraggableSquare
                        item={item}
                        isMaster={isMaster}
                        ownerLabel={ownerLabel}
                        onInfo={onViewItem ? () => onViewItem(item) : undefined}
                        contextItems={buildMenu({
                          entity: item,
                          kind: 'item',
                          state,
                          canUse: canUse && !owner,
                          currentSceneId,
                          onEdit: onEditItem,
                        })}
                      />
                    </div>
                  );
                })}
          </div>

          {(kind === 'npc' ? filteredNpcs.length : filteredItems.length) === 0 ? (
            <div className="text-xs text-muted-foreground mt-2">Ничего не найдено.</div>
          ) : null}
        </div>
      </div>

      <ConfirmAlertDialog
        open={confirmOpen}
        onOpenChange={(v) => {
          if (confirmLoading) return;
          setConfirmOpen(v);
          if (!v) setPendingDelete(null);
        }}
        title="Удалить навсегда?"
        description={
          pendingDelete
            ? `Удалить ${pendingDelete.kind === 'npc' ? 'NPC' : 'предмет'} “${pendingDelete.name || pendingDelete.id}” из сессии полностью? Это уберёт его из сцен и инвентарей.`
            : 'Удалить объект?'
        }
        loading={confirmLoading}
        confirmText="Удалить"
        cancelText="Отмена"
        onConfirm={doDelete}
      />
    </>
  );
}
