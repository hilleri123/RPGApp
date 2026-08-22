import { BaseApiClient } from './base';

export type NamePartKind = 'given' | 'family' | 'nickname' | 'full';

export type NamePack = {
  id: string;
  name: string;
  tags: string[];
};

export type NamePackEntry = {
  id: string;
  pack_id: string;
  text: string;
  part_kind: NamePartKind;
  tags: string[];
  description?: string | null;
  sort_order: number;
};

export type NamePackUpdate = {
  name?: string;
  tags?: string[];
};

export type NamePackEntryIn = {
  text: string;
  part_kind?: NamePartKind;
  tags?: string[];
  description?: string | null;
  sort_order?: number;
};

export class NamePacksApiService extends BaseApiClient {
  list(): Promise<NamePack[]> {
    return this.get<NamePack[]>('/name_packs');
  }

  createPack(name: string, tags: string[] = []): Promise<NamePack> {
    return this.post<NamePack>('/name_packs', { name, tags });
  }

  getPack(packId: string): Promise<NamePack> {
    return this.get<NamePack>(`/name_packs/${packId}`);
  }

  updatePack(packId: string, body: NamePackUpdate): Promise<NamePack> {
    return this.patch<NamePack>(`/name_packs/${packId}`, body);
  }

  listEntries(packId: string): Promise<NamePackEntry[]> {
    return this.get<NamePackEntry[]>(`/name_packs/${packId}/entries`);
  }

  createEntry(packId: string, body: NamePackEntryIn): Promise<NamePackEntry> {
    return this.post<NamePackEntry>(`/name_packs/${packId}/entries`, body);
  }

  bulkEntries(
    packId: string,
    body: { lines: string; part_kind: NamePartKind; tags?: string[] },
  ): Promise<{ ok: boolean; created: number }> {
    return this.post<{ ok: boolean; created: number }>(`/name_packs/${packId}/entries/bulk`, body);
  }

  deleteEntry(packId: string, entryId: string): Promise<{ ok: boolean }> {
    return this.delete<{ ok: boolean }>(`/name_packs/${packId}/entries/${entryId}`);
  }

  linkToScenario(scenarioId: string, packId: string): Promise<{ ok: boolean }> {
    return this.post<{ ok: boolean }>(`/scenarios/${scenarioId}/name_packs/${packId}`);
  }

  unlinkFromScenario(scenarioId: string, packId: string): Promise<{ ok: boolean }> {
    return this.delete<{ ok: boolean }>(`/scenarios/${scenarioId}/name_packs/${packId}`);
  }
}

export const namePacksApiService = new NamePacksApiService();
