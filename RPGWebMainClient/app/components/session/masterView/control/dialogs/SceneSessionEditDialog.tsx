'use client';

import React from 'react';
import { EntityEditDialogShell } from '@/app/components/scenarios/dialogs/common/EntityEditDialogShell';
import { useSceneSessionDialog } from '@/app/services/hooks/session/useSceneSessionDialog';

export default function SceneSessionEditDialog({
  open,
  onClose,
  editingScene,
  readOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  editingScene?: any | null;
  readOnly?: boolean;
}) {
  const dlg = useSceneSessionDialog({ open, editingScene, onSaved: onClose });
  const loading = dlg.initialLoading || dlg.loading;

  const SceneDataEditor = (dlg.pluginUI as any)?.SceneDataEditor;
  const SceneDataView = (dlg.pluginUI as any)?.SceneDataView;
  const sceneData = (dlg.form as any)?.data ?? {};

  const rulesContent = readOnly && SceneDataView ? (
    <SceneDataView scene={editingScene} data={sceneData} />
  ) : SceneDataEditor ? (
    <SceneDataEditor
      data={sceneData}
      scene={editingScene ?? undefined}
      config={dlg.config ?? undefined}
      issues={dlg.issues ?? undefined}
      onChange={(next: any) => dlg.setData(next)}
    />
  ) : (
    <div className="text-xs text-gray-400">SceneDataEditor не подключен в pluginUI.</div>
  );

  return (
    <EntityEditDialogShell
      open={open}
      onClose={onClose}
      title={editingScene?.id ? 'Сцена: редактирование (сессия)' : 'Сцена: создание (сессия)'}
      loading={loading}
      readOnly={readOnly}
      disableSave={readOnly || dlg.disableSave}
      onSave={() => dlg.save(false)}
      tabs={[]}
      rules={{
        content: rulesContent,

        onValidate: () => dlg.validate(),
        onForceSave: () => dlg.save(true),
        forceSaveDisabled: readOnly || (dlg.issues?.length ?? 0) === 0,
        loading: dlg.rulesLoading,
      }}
    />
  );
}
