import type { Note } from '@/app/services/types2';

export type WikiTreeNode = {
  note: Note;
  children: WikiTreeNode[];
  depth: number;
};

export function noteParentId(note: Note): string | null {
  const p = note.parent_note_id;
  return p ? String(p) : null;
}

export function buildWikiTree(notes: Note[]): WikiTreeNode[] {
  const byParent = new Map<string | null, Note[]>();
  for (const n of notes) {
    const pid = noteParentId(n);
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid)!.push(n);
  }
  for (const list of byParent.values()) {
    list.sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
        String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ru'),
    );
  }

  const walk = (parentId: string | null, depth: number): WikiTreeNode[] => {
    return (byParent.get(parentId) ?? []).map((note) => ({
      note,
      depth,
      children: walk(String(note.id), depth + 1),
    }));
  };

  // Orphan safety: notes whose parent is missing become roots
  const ids = new Set(notes.map((n) => String(n.id)));
  const orphans = notes.filter((n) => {
    const p = noteParentId(n);
    return p != null && !ids.has(p);
  });
  const roots = walk(null, 0);
  for (const o of orphans) {
    roots.push({ note: o, depth: 0, children: walk(String(o.id), 1) });
  }
  return roots;
}

export function flattenWikiTree(nodes: WikiTreeNode[]): WikiTreeNode[] {
  const out: WikiTreeNode[] = [];
  const walk = (list: WikiTreeNode[]) => {
    for (const n of list) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

export function collectDescendantIds(notes: Note[], rootIds: Iterable<string>): Set<string> {
  const children = new Map<string | null, Note[]>();
  for (const n of notes) {
    const pid = noteParentId(n);
    if (!children.has(pid)) children.set(pid, []);
    children.get(pid)!.push(n);
  }
  const out = new Set<string>([...rootIds].map(String));
  const stack = [...out];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const child of children.get(cur) ?? []) {
      const id = String(child.id);
      if (out.has(id)) continue;
      out.add(id);
      stack.push(id);
    }
  }
  return out;
}

export function wouldCreateCycle(
  notes: Note[],
  noteId: string,
  newParentId: string | null,
): boolean {
  if (!newParentId) return false;
  if (String(newParentId) === String(noteId)) return true;
  const byId = new Map(notes.map((n) => [String(n.id), n]));
  let cursor: string | null = String(newParentId);
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === String(noteId)) return true;
    if (seen.has(cursor)) break;
    seen.add(cursor);
    const n = byId.get(cursor);
    cursor = n ? noteParentId(n) : null;
  }
  return false;
}
