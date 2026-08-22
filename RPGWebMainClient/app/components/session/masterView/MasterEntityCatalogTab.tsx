'use client';

import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AddToSceneExistingTab } from '@/app/components/session/masterView/control/dialogs/tabs/AddToSceneExistingTab';
import { AddFromFactoryTab } from '@/app/components/session/masterView/control/dialogs/tabs/AddFromFactoryTab';
import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';
import { useMasterUiStore } from '@/app/services/stores/masterUi';
import type { FactoryPickKind } from '@/app/components/session/masterView/control/dialogs/AddToSceneDialog';
import { CharacterDraggableSquare } from '@/app/components/common/squares/CharacterDraggableSquare';
import { ContextActions } from '@/app/components/common/DraggableSquare';
import { ConfirmAlertDialog } from '@/app/components/common/ConfirmAlertDialog';
import { useSessionScenarioApi } from '@/app/services/hooks/session/useSessionScenarioApi';
import {
  EntityTagFilterChips,
  collectTagKeysFromItems,
  entityHasAllTags,
} from '@/app/components/scenarios/dialogs/common/EntityTagFilterChips';

function norm(s: unknown) {
  return String(s ?? '').trim().toLowerCase();
}

function CharacterCatalogPanel({
  sessionId,
  onCreate,
  onEditCharacter,
  onViewCharacter,
  requiredTags = [],
}: {
  sessionId: string;
  onCreate?: () => void;
  onEditCharacter?: (character: any) => void;
  onViewCharacter?: (character: any) => void;
  requiredTags?: string[];
}) {
  const [q, setQ] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const sceneId = useMasterUiStore((s) => s.currentSceneId);
  const { factories, createFactoryObject, characters, isMaster, session, moveCharacterToScene } =
    useSessionWebSocket(sessionId) as any;
  const { api, reloadSessionFields } = useSessionScenarioApi();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name?: string } | null>(null);

  const qq = norm(q);
  const tagOptions = useMemo(
    () => collectTagKeysFromItems(Array.isArray(characters) ? characters : []),
    [characters],
  );
  const list = useMemo(() => {
    const rows = Array.isArray(characters) ? characters : [];
    return rows.filter((c: any) => {
      if (!entityHasAllTags(c?.tags, requiredTags)) return false;
      if (!entityHasAllTags(c?.tags, activeTags)) return false;
      if (!qq) return true;
      return norm(c?.name).includes(qq);
    });
  }, [characters, qq, activeTags, requiredTags]);

  const players = session?.players ?? [];

  const askDelete = useCallback((entity: any) => {
    setPendingDelete({ id: String(entity?.id ?? ''), name: String(entity?.name ?? '') });
    setConfirmOpen(true);
  }, []);

  const doDelete = useCallback(async () => {
    if (!pendingDelete || !isMaster) return;
    setConfirmLoading(true);
    try {
      await api?.deleteCharacter(pendingDelete.id);
      reloadSessionFields(['characters', 'scenes']);
      setConfirmOpen(false);
      setPendingDelete(null);
    } finally {
      setConfirmLoading(false);
    }
  }, [pendingDelete, isMaster, api, reloadSessionFields]);

  const onPickFromFactory = (payload: { kind: FactoryPickKind; entityId: string }) => {
    createFactoryObject(sceneId ?? null, payload.kind, payload.entityId);
  };

  return (
    <div className="space-y-3 min-h-0 flex flex-col">
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        {onCreate ? (
          <Button size="sm" variant="outline" onClick={onCreate}>
            + Персонаж
          </Button>
        ) : null}
      </div>

      <div>
        <div className="text-xs text-gray-400 mb-1">Поиск по имени</div>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Начни вводить..." />
      </div>

      {tagOptions.length > 0 ? (
        <div>
          <div className="text-xs text-gray-400 mb-1">Фильтр по тэгам</div>
          <EntityTagFilterChips options={tagOptions} value={activeTags} onChange={setActiveTags} />
        </div>
      ) : null}

      <div className="rounded border border-gray-800 bg-gray-900 p-2">
        <div className="flex flex-wrap gap-2">
          {list.map((character: any) => {
            const player = players.find(
              (p: any) => String(p?.character_id ?? p?.characterid ?? '') === String(character.id),
            );
            return (
              <CharacterDraggableSquare
                key={String(character.id)}
                character={character}
                player={player}
                isMaster={isMaster}
                onInfo={onViewCharacter ? () => onViewCharacter(character) : undefined}
                contextItems={[
                  ...(onEditCharacter
                    ? [{ ...ContextActions.edit, onClick: () => onEditCharacter(character) }]
                    : []),
                  ...(isMaster
                    ? [
                        {
                          ...ContextActions.delete,
                          onClick: () => askDelete(character),
                        },
                        ...(sceneId
                          ? [
                              {
                                ...ContextActions.addToScene,
                                label: 'Переместить в текущую сцену',
                                onClick: () => moveCharacterToScene(character.id, sceneId),
                              },
                            ]
                          : []),
                      ]
                    : []),
                ]}
              />
            );
          })}
        </div>
        {list.length === 0 ? (
          <div className="text-xs text-muted-foreground mt-2">Нет персонажей в сессии.</div>
        ) : null}
      </div>

      {(factories?.length ?? 0) > 0 ? (
        <div className="border-t border-gray-800 pt-3 mt-1">
          <div className="text-xs text-gray-400 mb-2">Из фабрик сценария</div>
          <AddFromFactoryTab onPick={onPickFromFactory} fixedKind="character" />
        </div>
      ) : null}

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
            ? `Удалить персонажа “${pendingDelete.name || pendingDelete.id}” из сессии полностью?`
            : 'Удалить объект?'
        }
        loading={confirmLoading}
        confirmText="Удалить"
        cancelText="Отмена"
        onConfirm={doDelete}
      />
    </div>
  );
}

export function MasterEntityCatalogTab({
  sessionId,
  kind,
  onCreate,
  onEditNpc,
  onViewNpc,
  onEditItem,
  onViewItem,
  onEditCharacter,
  onViewCharacter,
  onCreateObstacle,
  requiredTags = [],
}: {
  sessionId: string;
  kind: 'npc' | 'item' | 'obstacle' | 'character';
  onCreate?: () => void;
  onEditNpc?: (npc: any) => void;
  onViewNpc?: (npc: any) => void;
  onEditItem?: (item: any) => void;
  onViewItem?: (item: any) => void;
  onEditCharacter?: (character: any) => void;
  onViewCharacter?: (character: any) => void;
  onCreateObstacle?: () => void;
  requiredTags?: string[];
}) {
  const [q, setQ] = useState('');
  const [existingKind, setExistingKind] = useState<'npc' | 'item'>(kind === 'item' ? 'item' : 'npc');
  const sceneId = useMasterUiStore((s) => s.currentSceneId);
  const { factories, createFactoryObject } = useSessionWebSocket(sessionId);

  const onPickFromFactory = (payload: { kind: FactoryPickKind; entityId: string }) => {
    if (!sceneId && payload.kind !== 'character') return;
    createFactoryObject(sceneId, payload.kind, payload.entityId);
  };

  if (kind === 'obstacle') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-gray-400">Препятствия на текущей сцене редактируются в рабочей области сцены.</p>
          {onCreateObstacle ? (
            <Button size="sm" variant="outline" onClick={onCreateObstacle}>
              + Препятствие
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (kind === 'character') {
    return (
      <CharacterCatalogPanel
        sessionId={sessionId}
        onCreate={onCreate}
        onEditCharacter={onEditCharacter}
        onViewCharacter={onViewCharacter}
        requiredTags={requiredTags}
      />
    );
  }

  const createLabel = kind === 'npc' ? '+ NPC' : '+ Предмет';

  return (
    <div className="space-y-3 min-h-0 flex flex-col">
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        {onCreate ? (
          <Button size="sm" variant="outline" onClick={onCreate}>
            {createLabel}
          </Button>
        ) : null}
        {!sceneId ? (
          <span className="text-xs text-amber-400">Выберите сцену для добавления на сцену</span>
        ) : null}
      </div>

      <AddToSceneExistingTab
        existingKind={existingKind}
        setExistingKind={setExistingKind}
        fixedKind={kind === 'item' ? 'item' : 'npc'}
        q={q}
        setQ={setQ}
        onEditNpc={onEditNpc}
        onViewNpc={onViewNpc}
        onEditItem={onEditItem}
        onViewItem={onViewItem}
        requiredTags={requiredTags}
      />

      {(factories?.length ?? 0) > 0 ? (
        <div className="border-t border-gray-800 pt-3 mt-1">
          <div className="text-xs text-gray-400 mb-2">Из фабрик сценария</div>
          <AddFromFactoryTab
            onPick={onPickFromFactory}
            fixedKind={kind === 'item' ? 'item' : 'npc'}
          />
        </div>
      ) : null}
    </div>
  );
}
