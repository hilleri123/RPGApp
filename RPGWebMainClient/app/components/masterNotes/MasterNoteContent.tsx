'use client';

import React from 'react';
import { splitMasterNoteText } from '@/app/components/masterNotes/linkSyntax';
import type { MasterNoteEntityCatalog, MasterNoteLinkedEntity } from '@/app/components/masterNotes/types';
import type { MasterNoteLinkKind } from '@/app/components/masterNotes/constants';
import { MasterNoteEntityChip } from './MasterNoteEntityChip';

export function MasterNoteContent({
  text,
  catalog,
  isMaster = true,
  className = '',
  onNoteClick,
  onEntityInfo,
  onEntityEdit,
}: {
  text: string;
  catalog: MasterNoteEntityCatalog;
  isMaster?: boolean;
  className?: string;
  onNoteClick?: (noteId: string, noteName: string) => void;
  onEntityInfo?: (kind: Exclude<MasterNoteLinkKind, 'note'>, entity: MasterNoteLinkedEntity) => void;
  onEntityEdit?: (kind: Exclude<MasterNoteLinkKind, 'note'>, entity: unknown) => void;
}) {
  const segments = splitMasterNoteText(text ?? '');

  return (
    <div className={`text-sm text-gray-200 whitespace-pre-wrap break-words leading-relaxed ${className}`}>
      {segments.map((seg, i) => {
        if (seg.type === 'text') {
          return <span key={i}>{seg.value}</span>;
        }
        return (
          <MasterNoteEntityChip
            key={`${i}-${seg.link.raw}`}
            kind={seg.link.kind}
            target={seg.link.target}
            catalog={catalog}
            isMaster={isMaster}
            onNoteClick={onNoteClick}
            onEntityInfo={onEntityInfo}
            onEntityEdit={onEntityEdit}
          />
        );
      })}
    </div>
  );
}
