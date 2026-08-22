import { create } from 'zustand';

export type AddKind = 'npc' | 'item' | 'obstacle' | 'note' | 'counter';
export type MapTab = 'location' | 'scene' | 'timeline';
export type LeftColumnTab = 'map' | 'content' | 'journal';
export type MasterContentTab =
  | 'storyBeats'
  | 'counters'
  | 'messages'
  | 'wiki'
  | 'fronts'
  | 'npcs'
  | 'items'
  | 'obstacles'
  | 'characters';


export const useMasterUiStore = create<{
  currentSceneId: string | null;
  setCurrentSceneId: (id: string | null) => void;

  leftColumnTab: LeftColumnTab;
  setLeftColumnTab: (t: LeftColumnTab) => void;

  mapTab: MapTab;
  setMapTab: (t: MapTab) => void;

  currentLocationId: string | null;
  setCurrentLocationId: (id: string | null) => void;

  sceneLocationId: string | null;
  setSceneLocationId: (id: string | null) => void;

  addDialogOpen: boolean;
  setAddDialogOpen: (v: boolean) => void;

  addKind: AddKind;
  setAddKind: (k: AddKind) => void;

  hiddenActiveActionIds: string[];
  setHiddenActiveActionIds: (ids: string[]) => void;
  addHiddenActiveActionId: (id: string) => void;
  removeHiddenActiveActionId: (id: string) => void;

  /** When set, ActiveActionCenter opens this active action (after restore from dock / feed). */
  focusActiveActionId: string | null;
  requestFocusActiveActionId: (id: string) => void;
  clearFocusActiveActionId: () => void;

  openCompletedActionIds: string[];
  setOpenCompletedActionIds: (ids: string[]) => void;
  addOpenCompletedActionId: (id: string) => void;
  removeOpenCompletedActionId: (id: string) => void;

  /** Wiki master: open note from entity dialog / backlink */
  wikiOpenNoteId: string | null;
  setWikiOpenNoteId: (id: string | null) => void;
  wikiTabRequest: number;
  requestWikiTab: () => void;
  wikiCreateRequest: number;
  requestWikiCreate: () => void;

  /** Session content: filter all tabs by selected front (null = all). */
  contentFrontId: string | null;
  setContentFrontId: (id: string | null) => void;
  /** Collapse content front filter to free vertical space. */
  contentFrontFilterCollapsed: boolean;
  setContentFrontFilterCollapsed: (v: boolean) => void;
}>(set => ({
  currentSceneId: null,
  setCurrentSceneId: (id) => set({ currentSceneId: id }),

  leftColumnTab: 'map',
  setLeftColumnTab: (t) => set({ leftColumnTab: t }),

  mapTab: 'location',
  setMapTab: (t) => set({ mapTab: t }),

  currentLocationId: null,
  setCurrentLocationId: (id) => set({ currentLocationId: id }),

  sceneLocationId: null,
  setSceneLocationId: (id) => set({ sceneLocationId: id }),

  addDialogOpen: false,
  setAddDialogOpen: (v) => set({ addDialogOpen: v }),

  addKind: 'npc',
  setAddKind: (k) => set({ addKind: k }),

  hiddenActiveActionIds: [],
  setHiddenActiveActionIds: (ids) => set({ hiddenActiveActionIds: ids }),

  addHiddenActiveActionId: (id) =>
    set((s) => (s.hiddenActiveActionIds.includes(id) ? s : { hiddenActiveActionIds: [id, ...s.hiddenActiveActionIds] })),

  removeHiddenActiveActionId: (id) =>
    set((s) => ({ hiddenActiveActionIds: s.hiddenActiveActionIds.filter((x) => x !== id) })),

  focusActiveActionId: null,
  requestFocusActiveActionId: (id) => set({ focusActiveActionId: id }),
  clearFocusActiveActionId: () => set({ focusActiveActionId: null }),

  openCompletedActionIds: [],
  setOpenCompletedActionIds: (ids) => set({ openCompletedActionIds: ids }),

  addOpenCompletedActionId: (id) =>
    set((s) => (s.openCompletedActionIds.includes(id) ? s : { openCompletedActionIds: [id, ...s.openCompletedActionIds] })),

  removeOpenCompletedActionId: (id) =>
    set((s) => ({ openCompletedActionIds: s.openCompletedActionIds.filter((x) => x !== id) })),

  wikiOpenNoteId: null,
  setWikiOpenNoteId: (id) => set({ wikiOpenNoteId: id }),
  wikiTabRequest: 0,
  requestWikiTab: () =>
    set((s) => ({
      wikiTabRequest: s.wikiTabRequest + 1,
    })),
  wikiCreateRequest: 0,
  requestWikiCreate: () =>
    set((s) => ({
      wikiCreateRequest: s.wikiCreateRequest + 1,
    })),

  contentFrontId: null,
  setContentFrontId: (id) => set({ contentFrontId: id }),
  contentFrontFilterCollapsed: false,
  setContentFrontFilterCollapsed: (v) => set({ contentFrontFilterCollapsed: v }),

}));

export function openMasterWikiNote(noteId: string) {
  const { setWikiOpenNoteId, requestWikiTab } = useMasterUiStore.getState();
  setWikiOpenNoteId(noteId);
  requestWikiTab();
}
