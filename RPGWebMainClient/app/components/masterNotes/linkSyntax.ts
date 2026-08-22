import type { Note } from '@/app/services/types2';
import type { MasterNoteEntityCatalog } from './types';
import { MASTER_NOTE_LINK_KINDS, type MasterNoteLinkKind } from './constants';

/** Wiki-link: [//npc:Имя] or [//npc:uuid] */
export const MASTER_NOTE_LINK_RE = /\[\/\/(\w+):([^\]]+)\]/g;

export interface ParsedMasterNoteLink {
  kind: MasterNoteLinkKind;
  target: string;
  raw: string;
  start: number;
  end: number;
}

export function parseMasterNoteLinks(text: string): ParsedMasterNoteLink[] {
  const out: ParsedMasterNoteLink[] = [];
  if (!text) return out;

  const re = new RegExp(MASTER_NOTE_LINK_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const kindRaw = m[1]?.toLowerCase();
    if (!MASTER_NOTE_LINK_KINDS.includes(kindRaw as MasterNoteLinkKind)) continue;
    out.push({
      kind: kindRaw as MasterNoteLinkKind,
      target: m[2]?.trim() ?? '',
      raw: m[0],
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return out;
}

export type MasterNoteTextSegment =
  | { type: 'text'; value: string }
  | { type: 'link'; link: ParsedMasterNoteLink };

export function splitMasterNoteText(text: string): MasterNoteTextSegment[] {
  const links = parseMasterNoteLinks(text);
  if (!links.length) return [{ type: 'text', value: text ?? '' }];

  const segments: MasterNoteTextSegment[] = [];
  let cursor = 0;
  for (const link of links) {
    if (link.start > cursor) {
      segments.push({ type: 'text', value: text.slice(cursor, link.start) });
    }
    segments.push({ type: 'link', link });
    cursor = link.end;
  }
  if (cursor < text.length) {
    segments.push({ type: 'text', value: text.slice(cursor) });
  }
  return segments;
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export function resolveLinkTarget(
  kind: MasterNoteLinkKind,
  target: string,
  catalog: MasterNoteEntityCatalog,
): { id: string; name: string; entity: unknown } | null {
  const t = target.trim();
  if (!t) return null;

  const byId = (list: Array<{ id: string; name?: string }>) =>
    list.find((x) => String(x.id) === t) ?? null;

  const byName = (list: Array<{ id: string; name?: string }>) => {
    const q = norm(t);
    return list.find((x) => norm(x.name ?? '') === q) ?? null;
  };

  switch (kind) {
    case 'npc': {
      const hit = byId(catalog.npcs) ?? byName(catalog.npcs);
      return hit ? { id: String(hit.id), name: hit.name ?? t, entity: hit } : null;
    }
    case 'item': {
      const hit = byId(catalog.items) ?? byName(catalog.items);
      return hit ? { id: String(hit.id), name: hit.name ?? t, entity: hit } : null;
    }
    case 'character': {
      const hit = byId(catalog.characters) ?? byName(catalog.characters);
      return hit ? { id: String(hit.id), name: hit.name ?? t, entity: hit } : null;
    }
    case 'location': {
      const hit = byId(catalog.locations) ?? byName(catalog.locations);
      return hit ? { id: String(hit.id), name: hit.name ?? t, entity: hit } : null;
    }
    case 'note': {
      const hit = byId(catalog.notes) ?? byName(catalog.notes);
      return hit ? { id: String(hit.id), name: hit.name ?? t, entity: hit } : null;
    }
    default:
      return null;
  }
}

export function linkMatchesEntity(
  link: ParsedMasterNoteLink,
  entityKind: MasterNoteLinkKind,
  entityId: string,
  entityName: string,
  catalog: MasterNoteEntityCatalog,
): boolean {
  if (link.kind !== entityKind) return false;
  const resolved = resolveLinkTarget(link.kind, link.target, catalog);
  if (resolved) return String(resolved.id) === String(entityId);
  return norm(link.target) === norm(entityName);
}

export function findMasterNotesLinkingToEntity(
  notes: Note[],
  entityKind: MasterNoteLinkKind,
  entityId: string,
  entityName: string,
  catalog: MasterNoteEntityCatalog,
): Note[] {
  return notes.filter((note) => {
    const text = note.text ?? '';
    return parseMasterNoteLinks(text).some((link) =>
      linkMatchesEntity(link, entityKind, entityId, entityName, catalog),
    );
  });
}

export function buildMasterNoteLink(kind: MasterNoteLinkKind, nameOrId: string): string {
  return `[//${kind}:${nameOrId}]`;
}

/** Partial link before cursor: [//npc:partial — may leave a trailing ] after the caret */
export function getActiveLinkQuery(
  text: string,
  cursor: number,
): { kind: MasterNoteLinkKind; query: string; replaceStart: number; replaceEnd: number } | null {
  const before = text.slice(0, cursor);
  const openIdx = before.lastIndexOf('[//');
  if (openIdx < 0) return null;

  const fragment = before.slice(openIdx);
  if (fragment.includes(']')) return null;

  const m = fragment.match(/^\[\/\/(\w+):(.*)$/);
  if (!m) return null;

  const kindRaw = m[1]?.toLowerCase();
  if (!MASTER_NOTE_LINK_KINDS.includes(kindRaw as MasterNoteLinkKind)) return null;

  // If the user already typed the closing bracket after the caret (e.g. template
  // `[//npc:]` with caret before `]`), include it in the replace range so
  // autocomplete does not leave a stray `]`.
  let replaceEnd = cursor;
  if (text[replaceEnd] === ']') {
    replaceEnd += 1;
  }

  return {
    kind: kindRaw as MasterNoteLinkKind,
    query: m[2] ?? '',
    replaceStart: openIdx,
    replaceEnd,
  };
}
