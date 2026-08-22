export type Issue = {
  path: string;
  message: string;
  icon?: string;
  level?: "error" | "warning";
};

export type UpsertResult<T = any> = {
  ok: boolean;
  forced?: boolean;
  issues?: Issue[];
  data?: Record<string, any>;
  entity?: T;
};

/** Ссылка на исходный объект в prep-сценарии (заполняется при клонировании). */
export type WithLineage = {
  source_entity_id?: string | null;
  /** Шаблон, из которого создан инстанс в сессии. */
  copied_from?: string | null;
};

export type EntityType = "location" | "character" | "npc" | "item";

export type EntityData = Record<string, any>;
