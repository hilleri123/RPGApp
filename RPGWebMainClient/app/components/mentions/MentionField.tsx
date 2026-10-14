'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import {
  LINK_KIND_LABELS,
  MASTER_NOTE_LINK_KINDS,
  type MasterNoteLinkKind,
} from '@/app/components/masterNotes/constants';
import { buildMasterNoteLink, getActiveLinkQuery } from '@/app/components/masterNotes/linkSyntax';
import type { MasterNoteEntityCatalog } from '@/app/components/masterNotes/types';
import { ScenarioScopedApiService, type MentionHit } from '@/app/services/api/scenario_scoped';
import { MentionText } from './MentionText';

function fromCatalog(
  kind: MasterNoteLinkKind,
  query: string,
  catalog: MasterNoteEntityCatalog,
): MentionHit[] {
  const q = query.trim().toLowerCase();
  const lists: Record<MasterNoteLinkKind, Array<{ id: string; name?: string }>> = {
    npc: catalog.npcs,
    item: catalog.items,
    character: catalog.characters,
    location: catalog.locations,
    note: catalog.notes,
  };
  return (lists[kind] ?? [])
    .filter((item) => !q || (item.name ?? '').toLowerCase().includes(q))
    .slice(0, 12)
    .map((item) => ({ kind, id: String(item.id), name: item.name ?? String(item.id) }));
}

export function MentionField({
  value,
  onChange,
  catalog,
  scenarioId,
  readOnly = false,
  rows = 3,
  preview = false,
  placeholder = 'Текст. Ссылка: [//npc: и имя',
}: {
  value: string;
  onChange: (value: string) => void;
  catalog?: MasterNoteEntityCatalog;
  scenarioId?: string | null;
  readOnly?: boolean;
  rows?: number;
  preview?: boolean;
  placeholder?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursor, setCursor] = useState(0);
  const [remote, setRemote] = useState<MentionHit[]>([]);

  const active = useMemo(
    () => (readOnly ? null : getActiveLinkQuery(value, cursor)),
    [value, cursor, readOnly],
  );

  const local = useMemo(() => {
    if (!active || !catalog) return [];
    return fromCatalog(active.kind, active.query, catalog);
  }, [active, catalog]);

  useEffect(() => {
    if (!active || !scenarioId || local.length > 0) {
      setRemote([]);
      return;
    }
    const api = new ScenarioScopedApiService(scenarioId);
    let cancelled = false;
    api.suggestMentions(active.query, [active.kind])
      .then((hits) => {
        if (!cancelled) setRemote(hits);
      })
      .catch(() => {
        if (!cancelled) setRemote([]);
      });
    return () => {
      cancelled = true;
    };
  }, [active, scenarioId, local.length]);

  const suggestions = local.length > 0 ? local : remote;

  const apply = (hit: MentionHit) => {
    if (!active) return;
    const link = buildMasterNoteLink(active.kind, hit.id);
    const next = value.slice(0, active.replaceStart) + link + value.slice(active.replaceEnd);
    onChange(next);
    const pos = active.replaceStart + link.length;
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(pos, pos);
      setCursor(pos);
    });
  };

  const insertTemplate = (kind: MasterNoteLinkKind) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? start;
    const token = `[//${kind}:]`;
    onChange(value.slice(0, start) + token + value.slice(end));
    const pos = start + `[//${kind}:`.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos, pos);
      setCursor(pos);
    });
  };

  if (readOnly) {
    return <MentionText text={value} catalog={catalog} scenarioId={scenarioId} />;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {MASTER_NOTE_LINK_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            className="text-[10px] px-1.5 py-0.5 rounded border border-gray-600 text-gray-300 hover:bg-gray-800"
            onClick={() => insertTemplate(kind)}
          >
            + {LINK_KIND_LABELS[kind]}
          </button>
        ))}
      </div>
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={value}
          rows={rows}
          className="text-sm"
          placeholder={placeholder}
          onChange={(event) => {
            onChange(event.target.value);
            setCursor(event.target.selectionStart ?? 0);
          }}
          onClick={(event) => setCursor((event.target as HTMLTextAreaElement).selectionStart ?? 0)}
          onKeyUp={(event) => setCursor((event.target as HTMLTextAreaElement).selectionStart ?? 0)}
        />
        {active && suggestions.length > 0 ? (
          <div className="absolute z-20 left-0 right-0 top-full mt-1 max-h-40 overflow-auto rounded border border-gray-600 bg-gray-900 shadow-lg">
            {suggestions.map((hit) => (
              <button
                key={`${hit.kind}-${hit.id}`}
                type="button"
                className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-800 truncate"
                onMouseDown={(event) => {
                  event.preventDefault();
                  apply(hit);
                }}
              >
                <span className="text-gray-500 text-xs mr-2">{LINK_KIND_LABELS[hit.kind as MasterNoteLinkKind]}</span>
                {hit.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {preview ? (
        <div className="rounded border border-gray-700 bg-gray-900/50 p-3">
          <MentionText text={value} catalog={catalog} scenarioId={scenarioId} />
        </div>
      ) : null}
    </div>
  );
}
