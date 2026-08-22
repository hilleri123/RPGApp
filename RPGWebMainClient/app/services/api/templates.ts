import { BaseApiClient } from './base';
import type {
  // payloads
  CharacterUpsertPayload,
  NPCUpsertPayload,
  ItemUpsertPayload,

  // results
  CharacterUpsertResult,
  NPCUpsertResult,
  ItemUpsertResult,

  // outs/lists (те же, что и для scenario)
  PlayerCharacterList,
  PlayerCharacterOut,
  NPCList,
  NPCOut,
  GameItemOut,
  GameItemWithOwnerShort,
  EntityKind,
  GameItem,
} from '../types2';

type Files2 = { iconFile?: File | null; imgFile?: File | null };

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

export class RuleTemplatesApiService extends BaseApiClient {
  constructor(
    private readonly templateSetId: string,
  ) {
    super();
  }

  private p(path: string) {
    return `/template_sets/${this.templateSetId}${path}`;
  }

  // -------- Plugin editor schema / init / options -----------

  private async fetchEntitySchema(
    entity: EntityKind,
    etag?: string,
  ): Promise<{ schema: any; etag?: string; notModified: boolean }> {
    return this.fetchEntitySchemaGet(this.p(`/${entity}/schema`), etag);
  }

  async getEntitySchema(entity: EntityKind, etag?: string) {
    return this.fetchEntitySchema(entity, etag);
  }

  async getEntityInit(entity: EntityKind, context: Record<string, any> = {}): Promise<any> {
    return this.post<any>(this.p(`/${entity}/init`), context);
  }

  async getEntityOptions(entity: EntityKind, context: Record<string, any> = {}): Promise<any> {
    return this.post<any>(this.p(`/${entity}/options`), context);
  }

  /** @deprecated use getEntitySchema + getEntityInit */
  async getEditorConfig(entity_lind: EntityKind, context: any): Promise<any> {
    return this.post<any>(this.p(`/${entity_lind}/config`), context);
  }

  // -------- Characters (templates) --------

  async getCharacterTemplates(params?: { skip?: number; limit?: number }): Promise<PlayerCharacterList[]> {
    return this.get<PlayerCharacterList[]>(this.p('/characters'), params);
  }

  async getCharacterTemplate(id: string): Promise<PlayerCharacterOut> {
    return this.get<PlayerCharacterOut>(this.p(`/characters/${id}`));
  }

  async validateCharacterTemplate(payload: CharacterUpsertPayload): Promise<CharacterUpsertResult> {
    return this.post<CharacterUpsertResult>(this.p('/characters/validate'), payload);
  }

  async createCharacterTemplate(payload: CharacterUpsertPayload, files?: Files2): Promise<CharacterUpsertResult> {
    const form = buildMultipart(payload, {
      icon_file: files?.iconFile,
      img_file: files?.imgFile,
    });
    return this.request<CharacterUpsertResult>(this.p('/characters'), { method: 'POST', body: form }, false);
  }

  async updateCharacterTemplate(id: string, payload: CharacterUpsertPayload, files?: Files2): Promise<CharacterUpsertResult> {
    const form = buildMultipart(payload, {
      icon_file: files?.iconFile,
      img_file: files?.imgFile,
    });
    return this.request<CharacterUpsertResult>(this.p(`/characters/${id}`), { method: 'PUT', body: form }, false);
  }

  async deleteCharacterTemplate(id: string): Promise<void> {
    await this.delete<void>(this.p(`/characters/${id}`));
  }

  // -------- NPCs (templates) --------

  async getNpcTemplates(params?: { skip?: number; limit?: number }): Promise<NPCList[]> {
    return this.get<NPCList[]>(this.p('/npcs'), params);
  }

  async getNpcTemplate(id: string): Promise<NPCOut> {
    return this.get<NPCOut>(this.p(`/npcs/${id}`));
  }

  async validateNpcTemplate(payload: NPCUpsertPayload): Promise<NPCUpsertResult> {
    return this.post<NPCUpsertResult>(this.p('/npcs/validate'), payload);
  }

  async createNpcTemplate(payload: NPCUpsertPayload, files?: Files2): Promise<NPCUpsertResult> {
    const form = buildMultipart(payload, {
      icon_file: files?.iconFile,
      img_file: files?.imgFile,
    });
    return this.request<NPCUpsertResult>(this.p('/npcs'), { method: 'POST', body: form }, false);
  }

  async updateNpcTemplate(id: string, payload: NPCUpsertPayload, files?: Files2): Promise<NPCUpsertResult> {
    const form = buildMultipart(payload, {
      icon_file: files?.iconFile,
      img_file: files?.imgFile,
    });
    return this.request<NPCUpsertResult>(this.p(`/npcs/${id}`), { method: 'PUT', body: form }, false);
  }

  async deleteNpcTemplate(id: string): Promise<void> {
    await this.delete<void>(this.p(`/npcs/${id}`));
  }

  // -------- Items (templates) --------

  async getItemTemplate(id: string): Promise<GameItem> {
    return this.get<GameItem>(this.p(`/items/${id}`));
  }

  async validateItemTemplate(payload: ItemUpsertPayload): Promise<ItemUpsertResult> {
    return this.post<ItemUpsertResult>(this.p('/items/validate'), payload);
  }

  async createItemTemplate(payload: ItemUpsertPayload, files?: Files2): Promise<ItemUpsertResult> {
    const form = buildMultipart(payload, {
      icon_file: files?.iconFile,
      img_file: files?.imgFile,
    });
    return this.request<ItemUpsertResult>(this.p('/items'), { method: 'POST', body: form }, false);
  }

  async updateItemTemplate(id: string, payload: ItemUpsertPayload, files?: Files2): Promise<ItemUpsertResult> {
    const form = buildMultipart(payload, {
      icon_file: files?.iconFile,
      img_file: files?.imgFile,
    });
    return this.request<ItemUpsertResult>(this.p(`/items/${id}`), { method: 'PUT', body: form }, false);
  }

  async deleteItemTemplate(id: string): Promise<void> {
    await this.delete<void>(this.p(`/items/${id}`));
  }

  // Список для picker'ов: на templates нет "owner", но тип на фронте хочешь одинаковый.
  // Поэтому либо:
  // 1) бэк возвращает GameItemWithOwnerShort[] (owner всегда null),
  // 2) или тут меняем тип на GameItemList[] и адаптируем UI.
  async getItemTemplates(params?: { skip?: number; limit?: number }): Promise<GameItemWithOwnerShort[]> {
    return this.get<GameItemWithOwnerShort[]>(this.p(`/items`), params);
  }
}
