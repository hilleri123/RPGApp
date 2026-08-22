'use client';

import { useScenarioObjectDialog } from '../useScenarioObjectDialog';
import type { Note, NoteCreate, PlayerCharacterList } from '@/app/services/types2';
import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';

type NoteForm = NoteCreate;
type NoteLookups = { characters: PlayerCharacterList[] };

export function useNoteDialog(opts: {
  open: boolean;
  scenarioId: string;
  noteId: string | null;
  onSaved?: (id: string) => void;
}) {
  return useScenarioObjectDialog<Note, NoteForm, NoteLookups, NoteForm, undefined>({
    open: opts.open,
    scenarioId: opts.scenarioId,
    objectId: opts.noteId,
    onSaved: opts.onSaved,

    loadFull: (api, id) => api.getNote(id),

    loadLookups: async (api) => {
      const characters = await api.getCharacters({ skip: 0, limit: 1000 });
      return { characters };
    },

    init: (full) => ({
      form: {
        ...(full as Note)
      },
      assets: undefined,
    }),
    empty: () => ({
      form: {
        name: '',
        text: null,
        allowed_character_shown_json: null,
        icon_url: null,
        img_url: null,
        tags: null
      },
      assets: undefined,
    }),


    buildPayload: (form) => form,

    create: (api, payload) => api.createNote(payload as any),
    update: (api, id, payload) => api.updateNote(id, payload as any),
  });
}
