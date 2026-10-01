'use client';

import { useEffect, useMemo, useState } from 'react';
import Panel from './Panel';

import type { Scene } from '@/app/services/types/session';
import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import SceneSessionEditDialog from '../control/dialogs/SceneSessionEditDialog';

type Props = {
  scene: Scene;
};

export default function SceneRulesPanel({ scene }: Props) {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  const { scenes, pluginUI, sendRequest, session } = useSessionWebSocket(sessionId);
  

  const SceneDataView = pluginUI?.SceneDataView;
  const SceneDataEditor = pluginUI?.SceneDataEditor;

  // где хранится rules data в твоём Scene — подстрой здесь:
  const sceneData = scene.data;

  const [open, setOpen] = useState(false);

  const [editorConfig, setEditorConfig] = useState<any | null>(null);
  const [editorIssues, setEditorIssues] = useState<any[] | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>({});

  // грузим config только когда диалог открыт
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      const resp = await sendRequest({
        user_role: 'gm',
        msg_type: 'editor_config',
        entity: 'scene',
        scene_id: scene?.id ?? null,
        context: { scene_id: scene?.id ?? null },
      });

      if (cancelled) return;

      // ожидаю что ответ типа { config, ... } либо сам config — подстрой 1 раз под свой протокол
      const cfg = resp?.config ?? resp;
      setEditorConfig(cfg);

      // initial draft: текущие данные сцены, иначе cfg.initialData
      const initial = (sceneData && Object.keys(sceneData).length ? sceneData : (cfg?.initialData ?? {})) as any;
      setDraft(structuredClone(initial));
      setEditorIssues(null);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, scene?.id, sendRequest, sceneData]);

  const canRenderView = typeof SceneDataView === 'function';
  const canRenderEditor = typeof SceneDataEditor === 'function';

  return (
    <Panel
      title="Сцена (правила)"
      right={
        canRenderEditor ? (
          <Button
            onClick={() => setOpen(true)}
          >
            Редактировать
          </Button>
        ) : null
      }
    >
      {canRenderView ? (
        <SceneDataView scene={scene} players={session?.players ?? []} data={sceneData ?? {}} />
      ) : (
        <div className="text-xs text-white/50">SceneDataView не подключен в pluginUI.</div>
      )}
      
      {open ? (
        <SceneSessionEditDialog
          open={open}
          onClose={() => setOpen(false)}
          editingScene={scene}
        />
      ) : null}
    </Panel>
  );
}
