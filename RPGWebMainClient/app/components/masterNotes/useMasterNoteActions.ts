'use client';

import { useCallback } from 'react';
import { useMasterNoteNavigationStore } from '@/app/services/stores/masterNoteNavigation';
import type { MasterNoteNavEntry } from '@/app/components/masterNotes/types';
import type { MasterNoteLinkKind } from '@/app/components/masterNotes/constants';
import { useSessionEntityDialogs } from '@/app/services/hooks/session/useSessionEntityDialogs';
import type { MasterNoteLinkedEntity } from '@/app/components/masterNotes/types';

export function useMasterNoteActions(opts: {
  onOpenNote: (noteId: string) => void;
}) {
  const pushNav = useMasterNoteNavigationStore((s) => s.push);
  const entityDialogs = useSessionEntityDialogs();

  const navigateToEntry = useCallback(
    (entry: MasterNoteNavEntry) => {
      if (entry.kind === 'note') {
        opts.onOpenNote(entry.id);
        return;
      }
      const { entityKind, id } = entry;
      if (entityKind === 'npc') entityDialogs.viewNpc({ id });
      else if (entityKind === 'item') entityDialogs.viewItem({ id });
      else if (entityKind === 'character') entityDialogs.viewCharacter({ id });
      // location: no session dialog yet — skip
    },
    [entityDialogs, opts],
  );

  const followNoteLink = useCallback(
    (noteId: string, noteName: string) => {
      pushNav({ kind: 'note', id: noteId, name: noteName });
      opts.onOpenNote(noteId);
    },
    [pushNav, opts],
  );

  const followEntityLink = useCallback(
    (kind: Exclude<MasterNoteLinkKind, 'note'>, entity: MasterNoteLinkedEntity) => {
      const name = entity.name ?? String(entity.id);
      pushNav({ kind: 'entity', entityKind: kind, id: String(entity.id), name });
      if (kind === 'npc') entityDialogs.viewNpc(entity);
      else if (kind === 'item') entityDialogs.viewItem(entity);
      else if (kind === 'character') entityDialogs.viewCharacter(entity);
    },
    [pushNav, entityDialogs],
  );

  const editEntityLink = useCallback(
    (kind: Exclude<MasterNoteLinkKind, 'note'>, entity: unknown) => {
      if (kind === 'npc') entityDialogs.editNpc(entity);
      else if (kind === 'item') entityDialogs.editItem(entity);
      else if (kind === 'character') entityDialogs.editCharacter(entity);
    },
    [entityDialogs],
  );

  const openNoteInHistory = useCallback(
    (noteId: string, noteName: string) => {
      pushNav({ kind: 'note', id: noteId, name: noteName });
    },
    [pushNav],
  );

  return {
    entityDialogs,
    navigateToEntry,
    followNoteLink,
    followEntityLink,
    editEntityLink,
    openNoteInHistory,
  };
}
