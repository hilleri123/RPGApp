'use client';

import { useScenario } from '../ScenarioContext';
import { EntityEditDialogShell, EntityEditDealogProps } from './common/EntityEditDialogShell';
import { useLocationDialog } from '@/app/services/hooks/scenario/dialogs/useLocationDialog';
import { useDialogMode } from './common/DialogModeContext';
import { SceneExposuresTab } from './common/SceneExposuresTab';

import LocationMainTab from './tabs/location/MainTab';
import RasterMapTab from './tabs/location/RasterMapTab';
import ExcalidrawMapTab from './tabs/location/ExcalidrawMapTab';
import SublocationsTab from './tabs/location/SublocationsTab';
import LocationRulesTab from './tabs/location/RulesTab';
import { EntityMasterNoteBacklinksTab } from '@/app/components/masterNotes/EntityMasterNoteBacklinksTab';
import { openMasterWikiNote } from '@/app/services/stores/masterUi';
import { useLaunchedLineageExtras } from './common/LaunchedLineageExtras';

export function LocationEditDialog({
  open,
  onClose,
  editingId,
  onSave,
  readOnly = false,
}: EntityEditDealogProps) {
  const { scenarioId, pluginUI } = useScenario();

  const dlg = useLocationDialog({
    open,
    scenarioId,
    locationId: editingId,
    onSaved: () => {
      onSave?.();
      onClose();
    },
  });

  const { footer, lineageDialog } = useLaunchedLineageExtras({
    editingId,
    entityType: 'location',
    entityLabel: dlg.form?.name,
    readOnly,
  });

  return (
    <>
    <EntityEditDialogShell
      open={open}
      onClose={onClose}
      title={editingId ? 'Локация: редактирование' : 'Локация: создание'}
      loading={dlg.loading}
      readOnly={readOnly}
      disableSave={!dlg.form?.name?.trim()}
      onSave={() => dlg.save(false)}
      footer={footer}
      tabs={[
        {
          key: 'main',
          title: 'Основное',
          content: <LocationMainTab dlg={dlg} editingId={editingId} />,
        },
        {
          key: 'map-raster',
          title: 'Фон (растр)',
          content: <RasterMapTab dlg={dlg} editingId={editingId} />,
        },
        {
          key: 'map-excalidraw',
          title: 'Вектор (Excalidraw)',
          content: <ExcalidrawMapTab dlg={dlg} editingId={editingId} />,
        },
        {
          key: 'sublocations',
          title: 'Подлокации',
          content: (
            <SublocationsTab
              dlg={dlg}
              editingId={editingId}
            />
          ),
        },
        {
          key: 'scene',
          title: 'Сцена',
          content: (
            <SceneExposuresTab
              scenarioId={scenarioId}
              npcOptions={dlg.lookups.npcs}
              itemOptions={dlg.lookups.items}
              templateNpcOptions={dlg.lookups.template_npcs}
              templateItemOptions={dlg.lookups.template_items}
              audioOptions={dlg.lookups.audio_tracks}
              value={(dlg.form.scene_exposures ?? []) as any}
              readOnly={readOnly}
              onChange={(next: any) => {
                if (readOnly) return;
                dlg.setForm((p: any) => ({ ...p, scene_exposures: next as any }));
              }}
              config={dlg.configs["obstacle"]}
            />
          ),
        },
        ...(editingId
          ? [
              {
                key: 'masterRefs',
                title: 'Ссылки',
                content: (
                  <EntityMasterNoteBacklinksTab
                    entityKind="location"
                    entityId={editingId}
                    entityName={dlg.form?.name ?? ''}
                    onOpenMasterNote={openMasterWikiNote}
                  />
                ),
              },
            ]
          : []),
      ]}
      rules={{
        content: <LocationRulesTab dlg={dlg} pluginUI={pluginUI} />,
        onValidate: () => dlg.validate(),
        onForceSave: () => dlg.save(true),
        forceSaveDisabled: (dlg.issues?.length ?? 0) === 0,
        loading: dlg.rulesLoading,
      }}
    />
    {lineageDialog}
    </>
  );
}