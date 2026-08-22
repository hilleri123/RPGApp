'use client';

import { useParams } from 'next/navigation';
import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';
import { useSessionEntityDialog } from './useSessionEntityDialog';

export function useSceneSessionDialog(opts: {
  open: boolean;
  editingScene?: any | null; // объект сцены из scenes[]
  onSaved?: () => void;
}) {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  // важно: тут нам нужен метод обновления сцены
  // добавь его в useSessionWebSocket (как updateNPC/updateItem)
  const { updateScene } = useSessionWebSocket(sessionId);

  return useSessionEntityDialog({
    open: opts.open,
    entity: 'scene',

    // сцена всегда “редактирование”, но на всякий:
    entityId: (opts.editingScene?.id ?? null) as string | null,

    initialForm: {
      id: null as any,
      name: '',

      // при необходимости можно расширить полями public/private сцены
      // но для rules нам важен data
      data: {},

      // любые прочие поля, чтобы merge не терял форму
    } as any,

    editorConfigContext: (sceneId) => ({
      scene_id: sceneId,
    }),

    rulesContext: (sceneId, form) => ({
      scene_id: sceneId,
      scene_entity_id: (form as any)?.id ?? null,
      // можно прокинуть mode/phase если захочешь:
      // mode: (form as any)?.data?.mode ?? null,
    }),

    loadImpl: async (_sceneId, entityId) => {
      const sc = opts.editingScene;
      if (!sc) return null;
      if (String(sc.id ?? '') !== String(entityId)) return null;

      // что именно грузить в форму:
      // form.data должно быть сценовыми rules-данными
      const data = (sc as any)?.data ?? (sc as any)?.rules?.data ?? (sc as any)?.scene ?? {};
      return {
        id: sc.id,
        name: (sc as any)?.name ?? '',
        data,
      } as any;
    },

    saveImpl: (sceneId, payload) => {
      // payload = вся форма, включая data
      // updateScene должен обновлять сцену в текущем sceneId (master ui)
      return updateScene(sceneId, payload.data);
    },

    disableSave: (form, sceneId) => !sceneId || !String((form as any)?.id ?? '').trim(),

    onSaved: opts.onSaved,
  });
}
