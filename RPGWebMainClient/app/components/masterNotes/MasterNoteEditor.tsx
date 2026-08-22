'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import {
  LINK_KIND_LABELS,
  MASTER_NOTE_LINK_KINDS,
  type MasterNoteLinkKind,
} from '@/app/components/masterNotes/constants';
import {
  buildMasterNoteLink,
  getActiveLinkQuery,
  resolveLinkTarget,
} from '@/app/components/masterNotes/linkSyntax';
import type { MasterNoteEntityCatalog, MasterNoteLinkedEntity } from '@/app/components/masterNotes/types';
import { MasterNoteContent } from './MasterNoteContent';

function suggestionsForKind(
  kind: MasterNoteLinkKind,
  query: string,
  catalog: MasterNoteEntityCatalog,
): Array<{ label: string; insert: string }> {
  const q = query.trim().toLowerCase();
  const filter = (list: Array<{ id: string; name?: string }>) =>
    list
      .filter((x) => !q || (x.name ?? '').toLowerCase().includes(q))
      .slice(0, 12)
      .map((x) => ({ label: x.name ?? String(x.id), insert: x.name ?? String(x.id) }));

  switch (kind) {
    case 'npc':
      return filter(catalog.npcs);
    case 'item':
      return filter(catalog.items);
    case 'character':
      return filter(catalog.characters);
    case 'location':
      return filter(catalog.locations);
    case 'note':
      return filter(catalog.notes);
    default:
      return [];
  }
}

export function MasterNoteEditor({
  value,
  onChange,
  catalog,
  readOnly = false,
  preview = true,
  onNoteClick,
  onEntityInfo,
  onEntityEdit,
}: {
  value: string;
  onChange: (v: string) => void;
  catalog: MasterNoteEntityCatalog;
  readOnly?: boolean;
  preview?: boolean;
  onNoteClick?: (noteId: string, noteName: string) => void;
  onEntityInfo?: (kind: Exclude<MasterNoteLinkKind, 'note'>, entity: MasterNoteLinkedEntity) => void;
  onEntityEdit?: (kind: Exclude<MasterNoteLinkKind, 'note'>, entity: unknown) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursor, setCursor] = useState(0);

  const active = useMemo(
    () => (readOnly ? null : getActiveLinkQuery(value, cursor)),
    [value, cursor, readOnly],
  );

  const suggestions = useMemo(() => {
    if (!active) return [];
    return suggestionsForKind(active.kind, active.query, catalog);
  }, [active, catalog]);

  const applySuggestion = useCallback(
    (insert: string) => {
      if (!active) return;
      const link = buildMasterNoteLink(active.kind, insert);
      const next = value.slice(0, active.replaceStart) + link + value.slice(active.replaceEnd);
      onChange(next);
      const pos = active.replaceStart + link.length;
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(pos, pos);
          setCursor(pos);
        }
      });
    },
    [active, onChange, value],
  );

  const insertLinkTemplate = (kind: MasterNoteLinkKind) => {
    const link = `[//${kind}:]`;
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? start;
    const next = value.slice(0, start) + link + value.slice(end);
    onChange(next);
    const pos = start + `[//${kind}:`.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos, pos);
      setCursor(pos);
    });
  };

  if (readOnly) {
    return (
      <MasterNoteContent
        text={value}
        catalog={catalog}
        onNoteClick={onNoteClick}
        onEntityInfo={onEntityInfo}
        onEntityEdit={onEntityEdit}
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {MASTER_NOTE_LINK_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            className="text-[10px] px-1.5 py-0.5 rounded border border-gray-600 text-gray-300 hover:bg-gray-800"
            onClick={() => insertLinkTemplate(kind)}
          >
            + {LINK_KIND_LABELS[kind]}
          </button>
        ))}
      </div>

      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={value}
          rows={12}
          className="font-mono text-sm min-h-[200px]"
          placeholder="Текст заметки. Ссылки: [//npc:Имя], [//item:uuid], [//note:Название]…"
          onChange={(e) => {
            onChange(e.target.value);
            setCursor(e.target.selectionStart ?? 0);
          }}
          onClick={(e) => setCursor((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
          onKeyUp={(e) => setCursor((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
        />

        {active && suggestions.length > 0 ? (
          <div className="absolute z-20 left-2 right-2 top-full mt-1 max-h-40 overflow-auto rounded border border-gray-600 bg-gray-900 shadow-lg">
            {suggestions.map((s) => (
              <button
                key={`${active.kind}-${s.insert}`}
                type="button"
                className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-800 truncate"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applySuggestion(s.insert);
                }}
              >
                <span className="text-gray-500 text-xs mr-2">{LINK_KIND_LABELS[active.kind]}</span>
                {s.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {preview ? (
        <div className="rounded border border-gray-700 bg-gray-900/50 p-3">
          <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-2">Предпросмотр</div>
          <MasterNoteContent
            text={value}
            catalog={catalog}
            onNoteClick={onNoteClick}
            onEntityInfo={onEntityInfo}
            onEntityEdit={onEntityEdit}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Resolve suggestion label for display in chip when entity exists */
export function formatLinkPreview(
  kind: MasterNoteLinkKind,
  target: string,
  catalog: MasterNoteEntityCatalog,
): string {
  const r = resolveLinkTarget(kind, target, catalog);
  return r?.name ?? target;
}
