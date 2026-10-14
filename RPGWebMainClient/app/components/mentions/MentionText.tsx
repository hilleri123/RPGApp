'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { MasterNoteContent } from '@/app/components/masterNotes/MasterNoteContent';
import type { MasterNoteEntityCatalog, MasterNoteLinkedEntity } from '@/app/components/masterNotes/types';
import type { MasterNoteLinkKind } from '@/app/components/masterNotes/constants';
import { parseMasterNoteLinks, resolveLinkTarget } from '@/app/components/masterNotes/linkSyntax';
import { ScenarioScopedApiService, type MentionHit } from '@/app/services/api/scenario_scoped';

const EMPTY_CATALOG: MasterNoteEntityCatalog = {
  npcs: [],
  items: [],
  characters: [],
  locations: [],
  notes: [],
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LIST_KEY: Record<MasterNoteLinkKind, keyof MasterNoteEntityCatalog> = {
  npc: 'npcs',
  item: 'items',
  character: 'characters',
  location: 'locations',
  note: 'notes',
};

/** Текст со ссылками [//kind:id]. Чип открывает карточку объекта. */
export function MentionText({
  text,
  catalog,
  scenarioId,
  className,
  onNoteClick,
  onEntityInfo,
}: {
  text: string;
  catalog?: MasterNoteEntityCatalog;
  scenarioId?: string | null;
  className?: string;
  onNoteClick?: (noteId: string, noteName: string) => void;
  onEntityInfo?: (kind: Exclude<MasterNoteLinkKind, 'note'>, entity: MasterNoteLinkedEntity) => void;
}) {
  const base = catalog ?? EMPTY_CATALOG;
  const [resolved, setResolved] = useState<MentionHit[]>([]);

  const missingKey = useMemo(() => {
    const missing = parseMasterNoteLinks(text).filter(
      (link) => UUID_RE.test(link.target) && !resolveLinkTarget(link.kind, link.target, base),
    );
    return missing.map((link) => `${link.kind}:${link.target}`).join('|');
  }, [text, base]);

  useEffect(() => {
    if (!scenarioId || !missingKey) {
      setResolved([]);
      return;
    }
    const refs = missingKey.split('|').map((part) => {
      const colon = part.indexOf(':');
      return { kind: part.slice(0, colon), id: part.slice(colon + 1) };
    });
    let cancelled = false;
    new ScenarioScopedApiService(scenarioId)
      .resolveMentions(refs)
      .then((hits) => {
        if (!cancelled) setResolved(hits);
      })
      .catch(() => {
        if (!cancelled) setResolved([]);
      });
    return () => {
      cancelled = true;
    };
  }, [scenarioId, missingKey]);

  const merged = useMemo(() => {
    if (!resolved.length) return base;
    const next: MasterNoteEntityCatalog = {
      npcs: [...base.npcs],
      items: [...base.items],
      characters: [...base.characters],
      locations: [...base.locations],
      notes: [...base.notes],
    };
    for (const hit of resolved) {
      const key = LIST_KEY[hit.kind as MasterNoteLinkKind];
      if (!key) continue;
      const list = next[key] as Array<{ id: string; name?: string }>;
      if (!list.some((item) => String(item.id) === String(hit.id))) {
        list.push({ id: hit.id, name: hit.name });
      }
    }
    return next;
  }, [base, resolved]);

  return (
    <MasterNoteContent
      text={text}
      catalog={merged}
      className={className}
      onNoteClick={onNoteClick}
      onEntityInfo={onEntityInfo}
    />
  );
}
