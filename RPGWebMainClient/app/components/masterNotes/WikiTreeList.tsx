'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FilePlus2, GripVertical } from 'lucide-react';
import type { Note } from '@/app/services/types2';
import {
  buildWikiTree,
  flattenWikiTree,
  wouldCreateCycle,
  type WikiTreeNode,
} from '@/app/components/masterNotes/wikiTree';

const DRAG_MIME = 'application/wiki-note-id';

export function WikiTreeList({
  notes,
  selectedId,
  onSelect,
  onReparent,
  onCreateChild,
  filterIds,
}: {
  notes: Note[];
  selectedId: string | null;
  onSelect: (noteId: string, noteName: string) => void;
  onReparent?: (noteId: string, parentNoteId: string | null, sortOrder: number) => Promise<void> | void;
  onCreateChild?: (parentNoteId: string) => void;
  /** If set, only show these note ids (and keep tree structure among them). */
  filterIds?: Set<string> | null;
}) {
  const canDrag = !!onReparent;
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [dragOverId, setDragOverId] = useState<string | null | 'root'>(null);

  const filteredNotes = useMemo(() => {
    if (!filterIds) return notes;
    return notes.filter((n) => filterIds.has(String(n.id)));
  }, [notes, filterIds]);

  const tree = useMemo(() => buildWikiTree(filteredNotes), [filteredNotes]);
  const flat = useMemo(() => flattenWikiTree(tree), [tree]);

  const visible = useMemo(() => {
    const hidden = new Set<string>();
    for (const node of flat) {
      const pid = node.note.parent_note_id ? String(node.note.parent_note_id) : null;
      if (pid && (collapsed.has(pid) || hidden.has(pid))) {
        hidden.add(String(node.note.id));
      }
    }
    return flat.filter((n) => !hidden.has(String(n.note.id)));
  }, [flat, collapsed]);

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onDropOnto = useCallback(
    async (targetParentId: string | null, beforeNoteId: string | null) => {
      if (!onReparent) return;
      const raw = (window as any).__wikiDragNoteId as string | undefined;
      if (!raw) return;
      const noteId = String(raw);
      if (targetParentId && wouldCreateCycle(notes, noteId, targetParentId)) return;

      const siblings = filteredNotes
        .filter((n) => String(n.parent_note_id ?? '') === String(targetParentId ?? ''))
        .filter((n) => String(n.id) !== noteId)
        .sort(
          (a, b) =>
            (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
            String(a.name).localeCompare(String(b.name), 'ru'),
        );

      let sortOrder = siblings.length;
      if (beforeNoteId) {
        const idx = siblings.findIndex((n) => String(n.id) === String(beforeNoteId));
        sortOrder = idx >= 0 ? idx : siblings.length;
      }

      await onReparent(noteId, targetParentId, sortOrder);

      // Normalize sibling orders
      const remaining = [
        ...siblings.slice(0, sortOrder),
        { id: noteId } as Note,
        ...siblings.slice(sortOrder),
      ];
      for (let i = 0; i < remaining.length; i++) {
        const id = String(remaining[i].id);
        if (id === noteId) continue;
        const cur = notes.find((n) => String(n.id) === id);
        if (cur && (cur.sort_order ?? 0) !== i) {
          void onReparent(id, targetParentId, i);
        }
      }
    },
    [notes, filteredNotes, onReparent],
  );

  const renderRow = (node: WikiTreeNode) => {
    const id = String(node.note.id);
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsed.has(id);
    const isSelected = selectedId === id;
    const isOver = dragOverId === id;

    return (
      <div key={id} className="group">
        <div
          className={[
            'flex items-center gap-0.5 rounded text-xs',
            isSelected ? 'bg-violet-600/30 text-violet-100' : 'text-gray-300 hover:bg-gray-800',
            isOver ? 'ring-1 ring-violet-400/60' : '',
          ].join(' ')}
          style={{ paddingLeft: 4 + node.depth * 12 }}
          draggable={canDrag}
          onDragStart={
            canDrag
              ? (e) => {
                  e.dataTransfer.setData(DRAG_MIME, id);
                  e.dataTransfer.effectAllowed = 'move';
                  (window as any).__wikiDragNoteId = id;
                }
              : undefined
          }
          onDragEnd={
            canDrag
              ? () => {
                  (window as any).__wikiDragNoteId = undefined;
                  setDragOverId(null);
                }
              : undefined
          }
          onDragOver={
            canDrag
              ? (e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDragOverId(id);
                }
              : undefined
          }
          onDragLeave={canDrag ? () => setDragOverId((cur) => (cur === id ? null : cur)) : undefined}
          onDrop={
            canDrag
              ? (e) => {
                  e.preventDefault();
                  setDragOverId(null);
                  void onDropOnto(id, null);
                }
              : undefined
          }
        >
          {canDrag ? (
            <span className="text-gray-600 cursor-grab px-0.5 shrink-0" title="Перетащить">
              <GripVertical className="w-3 h-3" />
            </span>
          ) : null}
          {hasChildren ? (
            <button
              type="button"
              className="p-0.5 shrink-0 text-gray-500 hover:text-gray-300"
              onClick={(e) => {
                e.stopPropagation();
                toggle(id);
              }}
            >
              {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <button
            type="button"
            className="flex-1 min-w-0 text-left px-1 py-1.5 truncate"
            onClick={() => onSelect(id, node.note.name)}
          >
            {node.note.name}
          </button>
          {onCreateChild ? (
            <button
              type="button"
              className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-500 hover:text-violet-300 shrink-0"
              title="Создать дочернюю"
              onClick={(e) => {
                e.stopPropagation();
                onCreateChild(id);
              }}
            >
              <FilePlus2 className="w-3 h-3" />
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="p-1 space-y-0.5">
      {canDrag ? (
        <div
          className={[
            'text-[10px] uppercase tracking-wide px-2 py-1 rounded border border-dashed',
            dragOverId === 'root'
              ? 'border-violet-400/60 text-violet-200 bg-violet-500/10'
              : 'border-transparent text-gray-600',
          ].join(' ')}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverId('root');
          }}
          onDragLeave={() => setDragOverId((cur) => (cur === 'root' ? null : cur))}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverId(null);
            void onDropOnto(null, null);
          }}
        >
          Корень (бросить сюда)
        </div>
      ) : null}

      {visible.map(renderRow)}

      {visible.length === 0 ? (
        <div className="text-[10px] text-gray-600 italic p-2">Нет wiki-заметок</div>
      ) : null}
    </div>
  );
}
