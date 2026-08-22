'use client';

import { useNpcDialog } from '@/app/services/hooks/scenario/dialogs/useNpcDialog';
import { useScenario } from '../ScenarioContext';
import { EntityEditDialogShell, EntityEditDealogProps } from './common/EntityEditDialogShell';
import { useLaunchedLineageExtras } from './common/LaunchedLineageExtras';
import { EntityMasterNoteBacklinksTab } from '@/app/components/masterNotes/EntityMasterNoteBacklinksTab';
import { openMasterWikiNote } from '@/app/services/stores/masterUi';
import { NpcItemsTab, NpcMainTab, NpcRulesTab } from './tabs/npc';

export function NpcEditDialog({
  open,
  onClose,
  editingId,
  onSave,
  onEntitySaved,
  readOnly,
}: EntityEditDealogProps) {
  const { scenarioId, pluginUI } = useScenario();

  const dlg = useNpcDialog({
    open,
    scenarioId,
    npcId: editingId,
    onSaved: async (id) => {
      await onEntitySaved?.(id);
      onSave?.();
      onClose();
    },
  });

  const { footer, lineageDialog } = useLaunchedLineageExtras({
    editingId,
    entityType: 'npc',
    entityLabel: dlg.form?.name,
    readOnly,
  });

  return (
    <>
    <EntityEditDialogShell
      open={open}
      onClose={onClose}
      title={editingId ? 'NPC: редактирование' : 'NPC: создание'}
      loading={dlg.loading}
      readOnly={readOnly}
      disableSave={!dlg.form?.name?.trim()}
      onSave={() => dlg.save(false)}
      footer={footer}
      tabs={[
        { key: 'main', title: 'Основное', content: <NpcMainTab dlg={dlg} /> },
        { key: 'items', title: 'Предметы', content: <NpcItemsTab dlg={dlg} /> },
        ...(editingId
          ? [
              {
                key: 'masterRefs',
                title: 'Ссылки',
                content: (
                  <EntityMasterNoteBacklinksTab
                    entityKind="npc"
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
        content: <NpcRulesTab dlg={dlg} pluginUI={pluginUI} />,
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
