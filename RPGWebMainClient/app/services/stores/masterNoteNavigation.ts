import { create } from 'zustand';
import type { MasterNoteNavEntry } from '@/app/components/masterNotes/types';

/** Rapid hops within this window replace the last history entry instead of appending. */
const HISTORY_DEBOUNCE_MS = 450;

function sameEntry(a: MasterNoteNavEntry | undefined, b: MasterNoteNavEntry): boolean {
  if (!a || a.kind !== b.kind) return false;
  if (a.kind === 'note' && b.kind === 'note') return a.id === b.id;
  if (a.kind === 'entity' && b.kind === 'entity') {
    return a.id === b.id && a.entityKind === b.entityKind;
  }
  return false;
}

type MasterNoteNavigationState = {
  stack: MasterNoteNavEntry[];
  index: number;
  lastPushAt: number;
  push: (entry: MasterNoteNavEntry) => void;
  goToIndex: (idx: number) => void;
  back: () => MasterNoteNavEntry | null;
  forward: () => MasterNoteNavEntry | null;
  clear: () => void;
  current: () => MasterNoteNavEntry | null;
};

export const useMasterNoteNavigationStore = create<MasterNoteNavigationState>((set, get) => ({
  stack: [],
  index: -1,
  lastPushAt: 0,

  push: (entry) => {
    const now = Date.now();
    const { stack, index, lastPushAt } = get();
    const trimmed = stack.slice(0, index + 1);
    const last = trimmed[trimmed.length - 1];

    if (sameEntry(last, entry)) {
      set({ lastPushAt: now });
      return;
    }

    // Debounce: quick successive navigations overwrite the previous hop.
    if (last && now - lastPushAt < HISTORY_DEBOUNCE_MS) {
      const next = [...trimmed.slice(0, -1), entry];
      set({ stack: next, index: next.length - 1, lastPushAt: now });
      return;
    }

    const next = [...trimmed, entry];
    set({ stack: next, index: next.length - 1, lastPushAt: now });
  },

  goToIndex: (idx) => {
    const { stack } = get();
    if (idx < 0 || idx >= stack.length) return;
    set({ index: idx });
  },

  back: () => {
    const { stack, index } = get();
    if (index <= 0) return null;
    const nextIdx = index - 1;
    set({ index: nextIdx });
    return stack[nextIdx] ?? null;
  },

  forward: () => {
    const { stack, index } = get();
    if (index >= stack.length - 1) return null;
    const nextIdx = index + 1;
    set({ index: nextIdx });
    return stack[nextIdx] ?? null;
  },

  clear: () => set({ stack: [], index: -1, lastPushAt: 0 }),

  current: () => {
    const { stack, index } = get();
    return index >= 0 ? stack[index] ?? null : null;
  },
}));
