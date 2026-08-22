// -------- Todo --------

export type TodoElementType =
  | 'location' | 'scene' | 'npc' | 'item' | 'story_beat'
  | 'scene_exposure' | 'character' | 'map_polygon' | 'counter' | 'note' 
  | 'audio_track' | 'scenario' | 'other';

export type TodoPriority = 'low' | 'medium' | 'high';

export interface ScenarioTodo {
  id: string;
  scenario_id: string;
  element_type: TodoElementType;
  element_id: string | null;
  element_name: string | null;
  text: string;
  note: string | null;
  priority: TodoPriority;
  is_done: boolean;
  done_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TodoCreate {
  element_type: TodoElementType;
  element_id?: string | null;
  element_name?: string | null;
  text: string;
  note?: string | null;
  priority?: TodoPriority;
}

export interface TodoPatch {
  element_type?: TodoElementType;
  element_id?: string | null;
  element_name?: string | null;
  text?: string;
  note?: string | null;
  priority?: TodoPriority;
  is_done?: boolean;
}