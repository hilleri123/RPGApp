'use client';

import React from 'react';
import type { Note } from '@/app/services/types2';
import { TYPE_COLORS, TYPE_ICONS } from '@/lib/constants';
import { ScenarioEntityCardShell } from './common/ScenarioEntityCardShell';

export function ScenarioNoteCard({
  note,
  onEdit,
  onDelete,
  readOnly = false,
}: {
  note: Note;
  onEdit?: (note: Note, readOnly: boolean) => void;
  onDelete?: (note: Note) => Promise<void> | void;
  readOnly?: boolean;
}) {
  const iconNode = <TYPE_ICONS.note color="#ffffff" className="w-8 h-8" />;

  return (
    <ScenarioEntityCardShell
      accentColor={TYPE_COLORS.note}
      typeLabel="Заметка"
      title={note.name}
      subtitleHtml={note.text}
      iconNode={iconNode}
      onView={onEdit ? () => onEdit(note, true) : undefined}
      onEdit={onEdit ? () => onEdit(note, false) : undefined}
      onDelete={onDelete ? () => onDelete(note) : undefined}
      readOnly={readOnly}
      todoProps={{ elementType: 'note', elementId: note.id, elementName: note.name }}
    />
  );
}