import { create } from 'zustand';

export type MinimizedDialogEntry = {
  id: string;
  title: string;
  onRestore: () => void;
  onClose: () => void;
};

export const useMinimizedDialogsStore = create<{
  items: MinimizedDialogEntry[];
  push: (entry: MinimizedDialogEntry) => void;
  remove: (id: string) => void;
  clear: () => void;
}>((set) => ({
  items: [],
  push: (entry) =>
    set((s) => ({
      items: [...s.items.filter((x) => x.id !== entry.id), entry],
    })),
  remove: (id) =>
    set((s) => ({
      items: s.items.filter((x) => x.id !== id),
    })),
  clear: () => set({ items: [] }),
}));
