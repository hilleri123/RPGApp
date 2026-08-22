'use client';

import React, { createContext, useContext, useMemo, useReducer } from 'react';
import type {
  ObstacleUpsertInline,
  SceneExposureOut,
  NPCList,
  GameItemWithOwnerShort,
} from '@/app/services/types2';
import type { AudioTrack, ExposureAudioLink } from '@/app/services/types/audio';

export type IdName = { id: string; name: string } & Record<string, any>;

export type RightTab =
  | 'all'
  | 'npc'
  | 'template_npcs'
  | 'items'
  | 'template_items'
  | 'obstacles'
  | 'audio';

// ---------------------------------------------------------------------------

function makeTmpId(prefix: string) {
  return `tmp_${prefix}_${crypto.randomUUID()}`;
}

export function isTmpId(id: unknown) {
  return typeof id === 'string' && id.startsWith('tmp_');
}

function uniqById<T extends { id?: unknown }>(xs: T[]) {
  const m = new Map<string, T>();
  for (const x of xs) m.set(String(x.id), x);
  return Array.from(m.values());
}

function removeById<T extends { id?: unknown }>(xs: T[], id: string) {
  return xs.filter((x) => String(x.id) !== String(id));
}

function uniqAudioLinks(xs: ExposureAudioLink[]): ExposureAudioLink[] {
  const seen = new Set<string>();
  return xs.filter((x) => {
    const k = String(x.audio_track_id);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ---------------------------------------------------------------------------

type State = {
  selectedId: string | null;
  rightTab: RightTab;
  editingObstacleIdx: number | null;
};

type Action =
  | { type: 'select'; id: string | null }
  | { type: 'setRightTab'; tab: RightTab }
  | { type: 'setEditingObstacleIdx'; idx: number | null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'select':
      return { ...state, selectedId: action.id, editingObstacleIdx: null };
    case 'setRightTab':
      return { ...state, rightTab: action.tab };
    case 'setEditingObstacleIdx':
      return { ...state, editingObstacleIdx: action.idx };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------

export type SceneExposuresCtx = {
  readOnly: boolean;

  exposures: SceneExposureOut[];
  selected: SceneExposureOut | null;

  rightTab: RightTab;
  setRightTab: (t: RightTab) => void;

  editingObstacleIdx: number | null;
  currentObstacle: ObstacleUpsertInline | null;

  selectExposure: (id: string | null) => void;

  addExposure: () => void;
  removeSelected: () => void;
  patchSelected: (patch: Partial<SceneExposureOut>) => void;

  addNpc: (npc: NPCList | null) => void;
  removeNpc: (id: string) => void;

  addItem: (item: GameItemWithOwnerShort | null) => void;
  removeItem: (id: string) => void;

  addTemplateNpc: (npc: NPCList | null, qty?: number) => void;
  removeTemplateNpc: (id: string) => void;
  setTemplateNpcQty: (id: string, qty: number) => void;

  addTemplateItem: (item: GameItemWithOwnerShort | null, qty?: number) => void;
  removeTemplateItem: (id: string) => void;
  setTemplateItemQty: (id: string, qty: number) => void;

  // audio
  addAudio: (track: AudioTrack | null) => void;
  removeAudio: (trackId: string) => void;
  patchAudioLink: (trackId: string, patch: Partial<ExposureAudioLink>) => void;

  openObstacleEditor: (idx: number) => void;
  closeObstacleEditor: () => void;
  addNewObstacleInline: () => void;
  removeObstacleAt: (idx: number) => void;
  patchObstacleAt: (idx: number, patch: Partial<ObstacleUpsertInline>) => void;
};

// ---------------------------------------------------------------------------

const Ctx = createContext<SceneExposuresCtx | null>(null);

export function SceneExposuresProvider(props: {
  readOnly?: boolean;
  value: SceneExposureOut[];
  onChange: (next: SceneExposureOut[]) => void;
  children: React.ReactNode;
}) {
  const readOnly = !!props.readOnly;
  const exposures = props.value ?? [];

  const [state, dispatch] = useReducer(reducer, {
    selectedId: null,
    rightTab: 'all',
    editingObstacleIdx: null,
  });

  const selected = useMemo(
    () => exposures.find((e) => String(e.id) === String(state.selectedId)) ?? null,
    [exposures, state.selectedId],
  );

  const patchSelected = (patch: Partial<SceneExposureOut>) => {
    if (!selected) return;
    props.onChange(
      exposures.map((e) =>
        String(e.id) === String(selected.id) ? { ...e, ...patch } : e,
      ),
    );
  };

  // --- Exposures CRUD ---

  const addExposure = () => {
    if (readOnly) return;
    const tmpId = makeTmpId('exposure');
    const next: SceneExposureOut = {
      id: tmpId as any,
      name: '',
      order_num: exposures.length,
      npcs: [],
      items: [],
      template_npc_links: [],   // было template_npcs
      template_item_links: [],  // было template_items
      audio_tracks: [],
      obstacles: [],
    };
    props.onChange([...exposures, next]);
    dispatch({ type: 'select', id: tmpId });
    dispatch({ type: 'setRightTab', tab: 'all' });
  };

  const removeSelected = () => {
    if (readOnly || !selected) return;
    props.onChange(exposures.filter((e) => String(e.id) !== String(selected.id)));
    dispatch({ type: 'select', id: null });
  };

  // --- NPC ---

  const addNpc = (npc: NPCList | null) => {
    if (readOnly || !selected || !npc) return;
    patchSelected({ npcs: uniqById([...(selected.npcs ?? []), npc]) });
  };
  const removeNpc = (id: string) => {
    if (readOnly || !selected) return;
    patchSelected({ npcs: removeById(selected.npcs ?? [], id) });
  };

  // --- Items ---

  const addItem = (item: GameItemWithOwnerShort | null) => {
    if (readOnly || !selected || !item) return;
    patchSelected({ items: uniqById([...(selected.items ?? []), item]) });
  };
  const removeItem = (id: string) => {
    if (readOnly || !selected) return;
    patchSelected({ items: removeById(selected.items ?? [], id) });
  };

  // --- Template NPC ---

  const addTemplateNpc = (npc: NPCList | null, qty: number = 1) => {
    if (readOnly || !selected || !npc) return;
    const already = (selected.template_npc_links ?? []).some(
      (l) => l.template_npc.id === npc.id
    );
    if (already) return;
    patchSelected({
      template_npc_links: [
        ...(selected.template_npc_links ?? []),
        { template_npc: npc, qty: qty },
      ],
    });
  };

  const removeTemplateNpc = (id: string) => {
    if (readOnly || !selected) return;
    patchSelected({
      template_npc_links: (selected.template_npc_links ?? []).filter(
        (l) => l.template_npc.id !== id
      ),
    });
  };

  const setTemplateNpcQty = (id: string, qty: number) => {
    if (readOnly || !selected) return;
    patchSelected({
      template_npc_links: (selected.template_npc_links ?? []).map((l) =>
        l.template_npc.id === id ? { ...l, qty: Math.max(1, qty) } : l
      ),
    });
  };

  // --- Template Items ---

  const addTemplateItem = (item: GameItemWithOwnerShort | null, qty: number = 1) => {
    if (readOnly || !selected || !item) return;
    const already = (selected.template_item_links ?? []).some(
      (l) => l.template_item.id === item.id
    );
    if (already) return;
    patchSelected({
      template_item_links: [
        ...(selected.template_item_links ?? []),
        { template_item: item, qty: qty },
      ],
    });
  };

  const removeTemplateItem = (id: string) => {
    if (readOnly || !selected) return;
    patchSelected({
      template_item_links: (selected.template_item_links ?? []).filter(
        (l) => l.template_item.id !== id
      ),
    });
  };

  const setTemplateItemQty = (id: string, qty: number) => {
    if (readOnly || !selected) return;
    patchSelected({
      template_item_links: (selected.template_item_links ?? []).map((l) =>
        l.template_item.id === id ? { ...l, qty: Math.max(1, qty) } : l
      ),
    });
  };


  // --- Audio ---

  const addAudio = (track: AudioTrack | null) => {
    if (readOnly || !selected || !track) return;
    const newLink: ExposureAudioLink = {
      audio_track_id: String(track.id),
      volume: 1.0,
      loop: false,
      fade_in: 0,
      fade_out: 0,
      order_num: (selected.audio_tracks ?? []).length,
      audio_track: track,
    };
    patchSelected({
      audio_tracks: uniqAudioLinks([...(selected.audio_tracks ?? []), newLink]),
    });
  };

  const removeAudio = (trackId: string) => {
    if (readOnly || !selected) return;
    patchSelected({
      audio_tracks: (selected.audio_tracks ?? []).filter(
        (a) => String(a.audio_track_id) !== String(trackId),
      ),
    });
  };

  const patchAudioLink = (trackId: string, patch: Partial<ExposureAudioLink>) => {
    if (readOnly || !selected) return;
    patchSelected({
      audio_tracks: (selected.audio_tracks ?? []).map((a) =>
        String(a.audio_track_id) === String(trackId) ? { ...a, ...patch } : a,
      ),
    });
  };

  // --- Obstacles ---

  const openObstacleEditor = (idx: number) =>
    dispatch({ type: 'setEditingObstacleIdx', idx });
  const closeObstacleEditor = () =>
    dispatch({ type: 'setEditingObstacleIdx', idx: null });

  const addNewObstacleInline = () => {
    if (readOnly || !selected) return;
    const nextOb: ObstacleUpsertInline = {
      id: makeTmpId('obstacle') as any,
      name: '',
      description_for_master: null,
      description_for_players: null,
      data: {},
    };
    const next = [...(selected.obstacles ?? []), nextOb];
    patchSelected({ obstacles: next as any });
    dispatch({ type: 'setRightTab', tab: 'obstacles' });
    dispatch({ type: 'setEditingObstacleIdx', idx: next.length - 1 });
  };

  const removeObstacleAt = (idx: number) => {
    if (readOnly || !selected) return;
    patchSelected({
      obstacles: (selected.obstacles ?? []).filter((_, i) => i !== idx) as any,
    });
    closeObstacleEditor();
  };

  const patchObstacleAt = (idx: number, patch: Partial<ObstacleUpsertInline>) => {
    if (!selected) return;
    patchSelected({
      obstacles: (selected.obstacles ?? []).map((o: any, i: number) =>
        i === idx ? { ...o, ...patch } : o,
      ) as any,
    });
  };

  const currentObstacle =
    state.editingObstacleIdx == null
      ? null
      : ((selected?.obstacles ?? []) as any)[state.editingObstacleIdx] ?? null;

  // ---------------------------------------------------------------------------

  const ctx: SceneExposuresCtx = {
    readOnly,
    exposures,
    selected,

    rightTab: state.rightTab,
    setRightTab: (t) => dispatch({ type: 'setRightTab', tab: t }),

    editingObstacleIdx: state.editingObstacleIdx,
    currentObstacle,

    selectExposure: (id) => dispatch({ type: 'select', id }),

    addExposure,
    removeSelected,
    patchSelected,

    addNpc,
    removeNpc,
    addItem,
    removeItem,
    addTemplateNpc,
    removeTemplateNpc,
    setTemplateNpcQty,
    addTemplateItem,
    removeTemplateItem,
    setTemplateItemQty,

    addAudio,
    removeAudio,
    patchAudioLink,

    openObstacleEditor,
    closeObstacleEditor,
    addNewObstacleInline,
    removeObstacleAt,
    patchObstacleAt,
  };

  return <Ctx.Provider value={ctx}>{props.children}</Ctx.Provider>;
}

export function useSceneExposures() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSceneExposures must be used within SceneExposuresProvider');
  return v;
}