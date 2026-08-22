// npc.ts
import type { TagDef, Economy } from './common';

export type NpcTracks = {
  hp?: number;
  eq?: number;
};

export type NpcTrackMax = NpcTracks;


export type NpcData = {
  id?: string;
  name?: string;
  kind?: 'npc';
  description?: string;

  tags?: string[];

  tracks?: NpcTracks;
  trackMax?: NpcTrackMax;

  economy?: Economy;

  items?: string[];

  meta?: Record<string, any>;
};

export type NpcConfig = {
  tagsCatalog?: TagDef[];
  constraints?: {
    economyDefaults?: Economy;
  };
  initialData: NpcData;
};
