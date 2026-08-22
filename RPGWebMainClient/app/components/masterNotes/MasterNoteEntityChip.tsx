'use client';

import React, { useMemo } from 'react';
import type { MasterNoteLinkKind } from '@/app/components/masterNotes/constants';
import type { MasterNoteEntityCatalog, MasterNoteLinkedEntity } from '@/app/components/masterNotes/types';
import { resolveLinkTarget } from '@/app/components/masterNotes/linkSyntax';
import { NPCDraggableSquare } from '@/app/components/common/squares/NPCDraggableSquare';
import { ItemDraggableSquare } from '@/app/components/common/squares/ItemDraggableSquare';
import { CharacterDraggableSquare } from '@/app/components/common/squares/CharacterDraggableSquare';
import { ContextActions, type ContextItem } from '@/app/components/common/DraggableSquare';
import { FileText } from 'lucide-react';
import { TYPE_COLORS } from '@/lib/constants';
import { useMasterNotesScope } from '@/app/components/masterNotes/MasterNotesContext';
import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';
import { useMasterUiStore } from '@/app/services/stores/masterUi';

function asLinkedEntity(entity: unknown): MasterNoteLinkedEntity {
  const e = entity as { id?: string; name?: string };
  return { id: String(e?.id ?? ''), name: e?.name };
}

type ScenePresence = 'none' | 'public' | 'private';

function npcItemPresence(scenes: any[], sceneId: string | null, kind: 'npc' | 'item', entityId: string): ScenePresence {
  if (!sceneId) return 'none';
  const sc = (scenes ?? []).find((x: any) => String(x?.id) === String(sceneId));
  if (!sc) return 'none';
  const id = String(entityId);
  const pub =
    kind === 'npc'
      ? (sc?.public?.npcs ?? []).map((x: any) => String(x.id))
      : (sc?.public?.items ?? []).map((x: any) => String(x.id));
  const priv =
    kind === 'npc'
      ? (sc?.private?.npcs ?? []).map((x: any) => String(x.id))
      : (sc?.private?.items ?? []).map((x: any) => String(x.id));
  if (pub.includes(id)) return 'public';
  if (priv.includes(id)) return 'private';
  return 'none';
}

export function MasterNoteEntityChip({
  kind,
  target,
  catalog,
  isMaster = true,
  onNoteClick,
  onEntityInfo,
  onEntityEdit,
}: {
  kind: MasterNoteLinkKind;
  target: string;
  catalog: MasterNoteEntityCatalog;
  isMaster?: boolean;
  onNoteClick?: (noteId: string, noteName: string) => void;
  onEntityInfo?: (kind: Exclude<MasterNoteLinkKind, 'note'>, entity: MasterNoteLinkedEntity) => void;
  onEntityEdit?: (kind: Exclude<MasterNoteLinkKind, 'note'>, entity: unknown) => void;
}) {
  const sessionScope = useMasterNotesScope();
  const sessionId = sessionScope?.sessionId ?? '';
  const {
    scenes,
    isMaster: sessionIsMaster,
    moveToScene,
    moveOutScene,
    makeElementPublic,
    moveCharacterToScene,
  } = useSessionWebSocket(sessionId || '__no_session__') as any;
  const currentSceneId = useMasterUiStore((s) => s.currentSceneId);

  const canSessionAct = Boolean(sessionId && (sessionIsMaster ?? isMaster));

  const resolved = resolveLinkTarget(kind, target, catalog);

  const contextItems = useMemo((): ContextItem[] => {
    if (!resolved?.entity || kind === 'note' || kind === 'location') return [];

    const entity = resolved.entity as any;
    const id = String(entity.id);
    const menu: ContextItem[] = [];

    if (onEntityEdit) {
      menu.push({
        ...ContextActions.edit,
        onClick: () => onEntityEdit(kind, entity),
      });
    }

    if (!canSessionAct || !currentSceneId) return menu;

    if (kind === 'character') {
      menu.push({
        ...ContextActions.addToScene,
        label: 'Переместить в текущую сцену',
        onClick: () => moveCharacterToScene(id, currentSceneId),
      });
      return menu;
    }

    if (kind === 'npc' || kind === 'item') {
      const state = npcItemPresence(scenes ?? [], currentSceneId, kind, id);
      if (state === 'none') {
        menu.push({
          ...ContextActions.addToScene,
          label: 'Добавить в сцену (private)',
          onClick: () =>
            kind === 'npc'
              ? moveToScene(currentSceneId, id, undefined)
              : moveToScene(currentSceneId, undefined, id),
        });
      } else if (state === 'public') {
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
      } else {
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
      }
    }

    return menu;
  }, [
    resolved,
    kind,
    onEntityEdit,
    canSessionAct,
    currentSceneId,
    scenes,
    moveToScene,
    moveOutScene,
    makeElementPublic,
    moveCharacterToScene,
  ]);

  if (kind === 'note') {
    const label = resolved?.name ?? target;
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded border border-violet-500/40 bg-violet-500/10 text-violet-200 text-xs hover:bg-violet-500/20 align-middle"
        onClick={() => {
          if (resolved) onNoteClick?.(resolved.id, resolved.name);
        }}
        title={resolved ? `Заметка: ${resolved.name}` : `Заметка: ${target}`}
      >
        <FileText className="w-3 h-3 shrink-0" />
        <span className="max-w-[120px] truncate">{label}</span>
      </button>
    );
  }

  if (!resolved?.entity) {
    return (
      <span
        className="inline-flex items-center mx-0.5 px-1.5 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-300 text-xs align-middle"
        title="Ссылка не найдена"
      >
        [{kind}:{target}]
      </span>
    );
  }

  const linked = asLinkedEntity(resolved.entity);

  const wrap = (node: React.ReactNode) => (
    <span className="inline-block align-middle mx-0.5 scale-[0.85] origin-left">{node}</span>
  );

  switch (kind) {
    case 'npc':
      return wrap(
        <NPCDraggableSquare
          npc={resolved.entity as any}
          isMaster={isMaster}
          draggable
          contextItems={contextItems}
          onInfo={onEntityInfo ? () => onEntityInfo('npc', linked) : undefined}
        />,
      );
    case 'item':
      return wrap(
        <ItemDraggableSquare
          item={resolved.entity as any}
          isMaster={isMaster}
          draggable
          contextItems={contextItems}
          onInfo={onEntityInfo ? () => onEntityInfo('item', linked) : undefined}
        />,
      );
    case 'character':
      return wrap(
        <CharacterDraggableSquare
          character={resolved.entity as any}
          isMaster={isMaster}
          draggable
          contextItems={contextItems}
          onInfo={onEntityInfo ? () => onEntityInfo('character', linked) : undefined}
        />,
      );
    case 'location': {
      const loc = resolved.entity as any;
      return wrap(
        <span
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs cursor-pointer hover:opacity-90"
          style={{ borderColor: TYPE_COLORS.location, color: TYPE_COLORS.location }}
          onClick={() => onEntityInfo?.('location', linked)}
          title={loc.name}
        >
          📍 {loc.name}
        </span>,
      );
    }
    default:
      return null;
  }
}
