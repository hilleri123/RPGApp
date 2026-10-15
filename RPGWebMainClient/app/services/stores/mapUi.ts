'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Shared map UI prefs (map tab + scene mini-map). */
export const useMapUiStore = create<{
  showParentMapIfNoImage: boolean;
  setShowParentMapIfNoImage: (v: boolean) => void;
  showParentSceneMap: boolean;
  setShowParentSceneMap: (v: boolean) => void;
}>()(
  persist(
    (set) => ({
      showParentMapIfNoImage: true,
      setShowParentMapIfNoImage: (v) => set({ showParentMapIfNoImage: v }),
      showParentSceneMap: false,
      setShowParentSceneMap: (v) => set({ showParentSceneMap: v }),
    }),
    { name: 'nri-map-ui' },
  ),
);
