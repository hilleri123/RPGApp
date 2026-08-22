'use client';

import React, { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { MasterNoteLinkKind } from '@/app/components/masterNotes/constants';
import { findMasterNotesLinkingToEntity } from '@/app/components/masterNotes/linkSyntax';
import { MasterNoteContent } from '@/app/components/masterNotes/MasterNoteContent';
import { useMasterNotesList, useMasterNotesContext } from '@/app/components/masterNotes/MasterNotesContext';
import { useMasterNoteActions } from '@/app/components/masterNotes/useMasterNoteActions';
import { SessionEntityDialogs } from '@/app/components/session/common/SessionEntityDialogs';

export function EntityMasterNoteBacklinksTab({
  entityKind,
  entityId,
  entityName,
  onOpenMasterNote,
}: {
  entityKind: MasterNoteLinkKind;
  entityId: string;
  entityName: string;
  onOpenMasterNote?: (noteId: string) => void;
}) {
  const masterNotes = useMasterNotesList();
  const catalog = useMasterNotesContext();

  const backlinks = useMemo(
    () =>
      findMasterNotesLinkingToEntity(
        masterNotes,
        entityKind,
        entityId,
        entityName,
        catalog,
      ),
    [masterNotes, entityKind, entityId, entityName, catalog],
  );

  const { entityDialogs, followNoteLink, followEntityLink, editEntityLink } = useMasterNoteActions({
    onOpenNote: (id) => onOpenMasterNote?.(id),
  });

  if (entityKind === 'note') {
    return (
      <div className="text-xs text-gray-500">
        Обратные ссылки для заметок смотрите в Wiki мастера.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-400">
        Wiki-заметки мастера со ссылкой на этот объект ({backlinks.length})
      </div>

      <ScrollArea className="max-h-[360px] pr-2">
        {backlinks.length === 0 ? (
          <div className="text-xs text-gray-600 italic">Пока нет ссылок</div>
        ) : (
          <div className="space-y-3">
            {backlinks.map((note) => (
              <button
                key={note.id}
                type="button"
                className="w-full text-left rounded-lg border border-gray-700 bg-gray-900/60 p-3 hover:border-violet-500/40"
                onClick={() => followNoteLink(note.id, note.name)}
              >
                <div className="text-sm font-medium text-violet-200 mb-1">{note.name}</div>
                <MasterNoteContent
                  text={(note.text ?? '').slice(0, 280)}
                  catalog={catalog}
                  onNoteClick={followNoteLink}
                  onEntityInfo={followEntityLink}
                  onEntityEdit={editEntityLink}
                />
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      <SessionEntityDialogs {...entityDialogs} />
    </div>
  );
}
