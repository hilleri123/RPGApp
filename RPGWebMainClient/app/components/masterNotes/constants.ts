export const MASTER_NOTE_TAG = 'master_wiki';

export type MasterNoteLinkKind = 'npc' | 'item' | 'character' | 'location' | 'note';

export const MASTER_NOTE_LINK_KINDS: MasterNoteLinkKind[] = [
  'npc',
  'item',
  'character',
  'location',
  'note',
];

export const LINK_KIND_LABELS: Record<MasterNoteLinkKind, string> = {
  npc: 'NPC',
  item: 'Предмет',
  character: 'Персонаж',
  location: 'Локация',
  note: 'Заметка',
};

export function isMasterNote(note: { tags?: string[] | null }): boolean {
  const tags = Array.isArray(note.tags) ? note.tags.map(String) : [];
  return tags.includes(MASTER_NOTE_TAG);
}

export function filterMasterNotes<T extends { tags?: string[] | null }>(notes: T[]): T[] {
  return notes.filter(isMasterNote);
}

export function filterSessionNotes<T extends { tags?: string[] | null }>(notes: T[]): T[] {
  return notes.filter((n) => {
    const tags = Array.isArray(n.tags) ? n.tags.map(String) : [];
    return (
      !tags.includes('task') &&
      !tags.includes(MASTER_NOTE_TAG) &&
      !tags.includes('kind:dispatch')
    );
  });
}
