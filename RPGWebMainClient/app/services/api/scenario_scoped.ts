import { BaseApiClient } from './base';
import type {
  Location,
  PlayerCharacter,
  NPC,
  GameItem,
  Note,
  Counter,

  // payloads
  LocationUpsertPayload,
  CharacterUpsertPayload,
  NPCUpsertPayload,
  ItemUpsertPayload,
  NoteCreate,
  NoteUpdate,
  CounterCreate,
  CounterUpdate,
  CounterChange,

  // results
  LocationUpsertResult,
  CharacterUpsertResult,
  NPCUpsertResult,
  ItemUpsertResult,
  LocationList,
  LocationOut,
  SubLocationFromMapItem,
  PlayerCharacterList,
  PlayerCharacterOut,
  NPCOut,
  StoryBeatList,
  StoryBeatOut,
  StoryBeatUpsertResult,
  StoryBeatUpsertPayload,
  GameItemOut,
  GameItemList,
  NPCList,
  GameItemWithOwnerShort,
  EntityKind,

  ScenarioTodo, TodoCreate, TodoPatch,
  ScenarioTag, ScenarioTagCreate, ScenarioTagUpdate,
  Front, FrontListItem, FrontCreate, FrontUpdate, FrontMember, FrontEntityType,
} from '../types2';

type Files2 = { iconFile?: File | null; imgFile?: File | null };
type LocationFiles = { iconFile?: File | null; mapFile?: File | null };

function buildMultipart(data: unknown, files?: Record<string, File | null | undefined>): FormData {
  const form = new FormData();
  form.append('data', JSON.stringify(data));
  if (files) {
    for (const [k, f] of Object.entries(files)) {
      if (f) form.append(k, f);
    }
  }
  return form;
}

export class ScenarioScopedApiService extends BaseApiClient {
  constructor(private readonly scenarioId: string) {
    super();
  }

  private p(path: string) {
    return `/scenarios/${this.scenarioId}${path}`;
  }

  // -------- Plugin editor schema / init / options -----------

  private async fetchEntitySchema(
    entity: EntityKind,
    etag?: string,
  ): Promise<{ schema: any; etag?: string; notModified: boolean }> {
    return this.fetchEntitySchemaGet(this.p(`/${entity}/schema`), etag);
  }

  async getEntitySchema(entity: EntityKind, etag?: string) {
    const res = await this.fetchEntitySchema(entity, etag);
    return res;
  }

  async getEntityInit(entity: EntityKind, context: Record<string, any> = {}): Promise<any> {
    return this.post<any>(this.p(`/${entity}/init`), context);
  }

  async getEntityOptions(entity: EntityKind, context: Record<string, any> = {}): Promise<any> {
    return this.post<any>(this.p(`/${entity}/options`), context);
  }

  /** Записи из паков имён, подключённых к сценарию (без кэша schema/etag). */
  async getScenarioNamePackEntries(): Promise<{ entries: Array<Record<string, unknown>> }> {
    return this.get<{ entries: Array<Record<string, unknown>> }>(
      `/scenarios/${this.scenarioId}/name_generators/pack_entries`,
    );
  }

  /** @deprecated use getEntitySchema + getEntityInit */
  async getEditorConfig(entity_lind: EntityKind, context: any): Promise<any> {
    return this.post<any>(this.p(`/${entity_lind}/config`), context);
  }


  // -------- Locations --------

  async validateLocation(payload: LocationUpsertPayload): Promise<LocationUpsertResult> {
    return this.post<LocationUpsertResult>(this.p('/locations/validate'), payload);
  }


  async getLocations(params?: { skip?: number; limit?: number }): Promise<LocationList[]> {
    return this.get<LocationList[]>(this.p('/locations'), params);
  }

  async getLocation(id: string): Promise<LocationOut> {
    return this.get<LocationOut>(this.p(`/locations/${id}`));
  }

  async createLocation(
    data: LocationUpsertPayload,
    files?: { iconFile?: File | null; mapFile?: File | null }
  ): Promise<LocationUpsertResult> {
    const form = buildMultipart(data, {
      icon_file: files?.iconFile,
      map_file: files?.mapFile,
    });
    return this.request<LocationUpsertResult>(this.p('/locations'), { method: 'POST', body: form }, false);
  }

  async updateLocation(
    id: string,
    data: LocationUpsertPayload,
    files?: { iconFile?: File | null; mapFile?: File | null }
  ): Promise<LocationUpsertResult> {
    const form = buildMultipart(data, {
      icon_file: files?.iconFile,
      map_file: files?.mapFile,
    });
    return this.request<LocationUpsertResult>(this.p(`/locations/${id}`), { method: 'PUT', body: form }, false);
  }

  async deleteLocation(id: string): Promise<void> {
    await this.delete<void>(this.p(`/locations/${id}`));
  }

  async createSublocationsFromMap(
    locationId: string,
    payload: { items: SubLocationFromMapItem[] }
  ): Promise<{ created: LocationOut[] }> {
    return this.post<{ created: LocationOut[] }>(
      this.p(`/locations/${locationId}/sublocation-from-map`),
      payload,
    );
  }

  // -------- Characters --------

  async getCharacters(params?: { skip?: number; limit?: number }): Promise<PlayerCharacterList[]> {
    return this.get<PlayerCharacterList[]>(this.p('/characters'), params);
  }

  async getCharacter(id: string): Promise<PlayerCharacterOut> {
    return this.get<PlayerCharacterOut>(this.p(`/characters/${id}`));
  }

  async validateCharacter(payload: CharacterUpsertPayload): Promise<CharacterUpsertResult> {
    return this.post<CharacterUpsertResult>(this.p('/characters/validate'), payload);
  }

  async createCharacter(
    payload: CharacterUpsertPayload,
    files?: Files2
  ): Promise<CharacterUpsertResult> {
    const form = buildMultipart(payload, {
      icon_file: files?.iconFile,
      img_file: files?.imgFile,
    });
    return this.request<CharacterUpsertResult>(this.p('/characters'), { method: 'POST', body: form }, false);
  }

  async updateCharacter(
    id: string,
    payload: CharacterUpsertPayload,
    files?: Files2
  ): Promise<CharacterUpsertResult> {
    const form = buildMultipart(payload, {
      icon_file: files?.iconFile,
      img_file: files?.imgFile,
    });
    return this.request<CharacterUpsertResult>(this.p(`/characters/${id}`), { method: 'PUT', body: form }, false);
  }

  async deleteCharacter(id: string): Promise<void> {
    await this.delete<void>(this.p(`/characters/${id}`));
  }

  // -------- NPCs --------

  async getNpcs(params?: { skip?: number; limit?: number }): Promise<NPCList[]> {
    return this.get<NPCList[]>(this.p('/npcs'), params);
  }

  async getTemplateNpcs(params?: { skip?: number; limit?: number }): Promise<NPCList[]> {
    return this.get<NPCList[]>(this.p('/template_npcs'), params);
  }

  async getTemplateItems(params?: { skip?: number; limit?: number }): Promise<GameItemList[]> {
    return this.get<GameItemList[]>(this.p('/template_items'), params);
  }

  async getTemplateCharacters(params?: { skip?: number; limit?: number }): Promise<PlayerCharacterList[]> {
    return this.get<PlayerCharacterList[]>(this.p('/template_characters'), params);
  }

  async getNpc(id: string): Promise<NPCOut> {
    return this.get<NPCOut>(this.p(`/npcs/${id}`));
  }

  async getTemplateItemsWithOwner(params?: { skip?: number; limit?: number }): Promise<NPCList[]> {
    return this.get<NPCList[]>(this.p('/template_items'), params);
  }

  async validateNpc(payload: NPCUpsertPayload): Promise<NPCUpsertResult> {
    return this.post<NPCUpsertResult>(this.p('/npcs/validate'), payload);
  }

  async createNpc(payload: NPCUpsertPayload, files?: Files2): Promise<NPCUpsertResult> {
    const form = buildMultipart(payload, {
      icon_file: files?.iconFile,
      img_file: files?.imgFile,
    });
    return this.request<NPCUpsertResult>(this.p('/npcs'), { method: 'POST', body: form }, false);
  }

  async updateNpc(id: string, payload: NPCUpsertPayload, files?: Files2): Promise<NPCUpsertResult> {
    const form = buildMultipart(payload, {
      icon_file: files?.iconFile,
      img_file: files?.imgFile,
    });
    return this.request<NPCUpsertResult>(this.p(`/npcs/${id}`), { method: 'PUT', body: form }, false);
  }

  async deleteNpc(id: string): Promise<void> {
    await this.delete<void>(this.p(`/npcs/${id}`));
  }

  // -------- Items --------

  // async getItems(params?: { skip?: number; limit?: number }): Promise<GameItemList[]> {
  //   return this.get<GameItemList[]>(this.p('/items'), params);
  // }

  async getItem(id: string): Promise<GameItem> {
    return this.get<GameItem>(this.p(`/items/${id}`));
  }

  async validateItem(payload: ItemUpsertPayload): Promise<ItemUpsertResult> {
    return this.post<ItemUpsertResult>(this.p('/items/validate'), payload);
  }

  async createItem(payload: ItemUpsertPayload, files?: Files2): Promise<ItemUpsertResult> {
    const form = buildMultipart(payload, {
      icon_file: files?.iconFile,
      img_file: files?.imgFile,
    });
    return this.request<ItemUpsertResult>(this.p('/items'), { method: 'POST', body: form }, false);
  }

  async updateItem(id: string, payload: ItemUpsertPayload, files?: Files2): Promise<ItemUpsertResult> {
    const form = buildMultipart(payload, {
      icon_file: files?.iconFile,
      img_file: files?.imgFile,
    });
    return this.request<ItemUpsertResult>(this.p(`/items/${id}`), { method: 'PUT', body: form }, false);
  }

  async deleteItem(id: string): Promise<void> {
    await this.delete<void>(this.p(`/items/${id}`));
  }

  async getItemsWithOwner(params?: { skip?: number; limit?: number }): Promise<GameItemWithOwnerShort[]> {
    return this.get<GameItemWithOwnerShort[]>(
      this.p(`/items`),
      params
    );
  }

  async resetItemOwner(itemId: string): Promise<{ ok: boolean }> {
    return this.post<{ ok: boolean }>(
      this.p(`/items/${itemId}/reset-owner`),
      {}
    );
  }
  // -------- Story beats --------

  async validateStoryBeat(payload: StoryBeatUpsertPayload): Promise<StoryBeatUpsertResult> {
    return this.post<StoryBeatUpsertResult>(this.p('/story_beats/validate'), payload);
  }


  async getStoryBeats(params?: { skip?: number; limit?: number }): Promise<StoryBeatList[]> {
    return this.get<StoryBeatList[]>(this.p('/story_beats'), params);
  }

  async getStoryBeat(id: string): Promise<StoryBeatOut> {
    return this.get<StoryBeatOut>(this.p(`/story_beats/${id}`));
  }

  async createStoryBeat(payload: StoryBeatUpsertPayload, files?: Files2): Promise<StoryBeatUpsertResult> {
    const form = buildMultipart(payload, {
      icon_file: files?.iconFile,
      img_file: files?.imgFile,
    });
    return this.request<StoryBeatUpsertResult>(this.p(`/story_beats`), { method: 'POST', body: form }, false);
  }

  async updateStoryBeat(id: string, payload: StoryBeatUpsertPayload, files?: Files2): Promise<StoryBeatUpsertResult> {
    const form = buildMultipart(payload, {
      icon_file: files?.iconFile,
      img_file: files?.imgFile,
    });
    return this.request<StoryBeatUpsertResult>(this.p(`/story_beats/${id}`), { method: 'PUT', body: form }, false);
  }

  async deleteStoryBeat(id: string): Promise<void> {
    await this.delete<void>(this.p(`/story_beats/${id}`));
  }

  // -------- Notes --------

  async getNotes(): Promise<Note[]> {
    return this.get<Note[]>(this.p('/notes'));
  }

  async getNote(id: string): Promise<Note> {
    return this.get<Note>(this.p(`/notes/${id}`));
  }

  async createNote(data: NoteCreate): Promise<Note> {
    return this.post<Note>(this.p('/notes'), data);
  }

  async updateNote(id: string, data: NoteUpdate): Promise<Note> {
    return this.put<Note>(this.p(`/notes/${id}`), data);
  }

  async deleteNote(id: string): Promise<void> {
    await this.delete<void>(this.p(`/notes/${id}`));
  }

  // -------- Counters --------

  async getCounters(): Promise<Counter[]> {
    return this.get<Counter[]>(this.p('/counters'));
  }

  async getCounter(id: string): Promise<Counter> {
    return this.get<Counter>(this.p(`/counters/${id}`));
  }

  async createCounter(data: CounterCreate): Promise<Counter> {
    return this.post<Counter>(this.p('/counters'), data);
  }

  async updateCounter(id: string, data: CounterUpdate): Promise<Counter> {
    return this.put<Counter>(this.p(`/counters/${id}`), data);
  }

  async adjustCounter(id: string, data: { delta: number; comment?: string | null }): Promise<Counter> {
    return this.post<Counter>(this.p(`/counters/${id}/adjust`), data);
  }

  async getCounterHistory(id: string, limit = 50): Promise<CounterChange[]> {
    return this.get<CounterChange[]>(this.p(`/counters/${id}/history`), { limit });
  }

  async deleteCounter(id: string): Promise<void> {
    await this.delete<void>(this.p(`/counters/${id}`));
  }

  // -------- Scenario tags / Fronts --------

  async getScenarioTags(): Promise<ScenarioTag[]> {
    return this.get<ScenarioTag[]>(this.p('/tags'));
  }

  async createScenarioTag(data: ScenarioTagCreate): Promise<ScenarioTag> {
    return this.post<ScenarioTag>(this.p('/tags'), data);
  }

  async updateScenarioTag(id: string, data: ScenarioTagUpdate): Promise<ScenarioTag> {
    return this.patch<ScenarioTag>(this.p(`/tags/${id}`), data);
  }

  async deleteScenarioTag(id: string): Promise<void> {
    await this.delete<void>(this.p(`/tags/${id}`));
  }

  async importScenarioTagsFromEntities(): Promise<ScenarioTag[]> {
    return this.post<ScenarioTag[]>(this.p('/tags/import-from-entities'), {});
  }

  async getFronts(): Promise<FrontListItem[]> {
    return this.get<FrontListItem[]>(this.p('/fronts'));
  }

  async getFront(id: string): Promise<Front> {
    return this.get<Front>(this.p(`/fronts/${id}`));
  }

  async createFront(data: FrontCreate): Promise<Front> {
    return this.post<Front>(this.p('/fronts'), data);
  }

  async updateFront(id: string, data: FrontUpdate): Promise<Front> {
    return this.patch<Front>(this.p(`/fronts/${id}`), data);
  }

  async deleteFront(id: string): Promise<void> {
    await this.delete<void>(this.p(`/fronts/${id}`));
  }

  async addFrontMember(frontId: string, entity_type: FrontEntityType, entity_id: string): Promise<Front> {
    return this.post<Front>(this.p(`/fronts/${frontId}/members`), { entity_type, entity_id });
  }

  async removeFrontMember(frontId: string, memberId: string): Promise<Front> {
    return this.delete<Front>(this.p(`/fronts/${frontId}/members/${memberId}`));
  }

  async linkFrontWikiNote(frontId: string, note_id: string, sort_order = 0): Promise<Front> {
    return this.post<Front>(this.p(`/fronts/${frontId}/wiki-notes`), { note_id, sort_order });
  }

  async unlinkFrontWikiNote(frontId: string, linkId: string): Promise<Front> {
    return this.delete<Front>(this.p(`/fronts/${frontId}/wiki-notes/${linkId}`));
  }


  // -------- Todos --------

  async getTodos(params?: {
    element_type?: string;
    element_id?: string;
    is_done?: boolean;
    priority?: string;
    skip?: number;
    limit?: number;
  }): Promise<ScenarioTodo[]> {
    return this.get<ScenarioTodo[]>(this.p('/todos'), params);
  }

  async createTodo(data: TodoCreate): Promise<ScenarioTodo> {
    return this.post<ScenarioTodo>(this.p('/todos'), data);
  }

  async patchTodo(id: string, data: TodoPatch): Promise<ScenarioTodo> {
    return this.patch<ScenarioTodo>(this.p(`/todos/${id}`), data);
  }

  async toggleTodoDone(id: string): Promise<ScenarioTodo> {
    return this.post<ScenarioTodo>(this.p(`/todos/${id}/done`), {});
  }

  async deleteTodo(id: string): Promise<void> {
    await this.delete<void>(this.p(`/todos/${id}`));
  }
}

