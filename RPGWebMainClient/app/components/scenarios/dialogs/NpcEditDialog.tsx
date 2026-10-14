'use client';

import type React from 'react';
import { useNpcDialog } from '@/app/services/hooks/scenario/dialogs/useNpcDialog';
import { useScenario } from '../ScenarioContext';
import { EntityEditDialogShell, EntityEditDealogProps } from './common/EntityEditDialogShell';
import { useLaunchedLineageExtras } from './common/LaunchedLineageExtras';
import { EntityMasterNoteBacklinksTab } from '@/app/components/masterNotes/EntityMasterNoteBacklinksTab';
import { openMasterWikiNote } from '@/app/services/stores/masterUi';
import { NpcItemsTab, NpcMainTab, NpcRulesTab } from './tabs/npc';
import { EntityJournal } from '@/app/components/chronicle/EntityJournal';

export function NpcEditDialog({
  open,
  onClose,
  editingId,
  onSave,
  onEntitySaved,
  readOnly,
  leading,
}: EntityEditDealogProps & { leading?: React.ReactNode }) {
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
        {
          key: 'main',
          title: 'Основное',
          content: (
            <>
              {leading}
              <NpcMainTab dlg={dlg} />
            </>
          ),
        },
        { key: 'items', title: 'Предметы', content: <NpcItemsTab dlg={dlg} /> },
        ...(editingId
          ? [
              {
                key: 'journal',
                title: 'Журнал',
                content: (
                  <EntityJournal
                    scenarioId={scenarioId}
                    subjectKind="npc"
                    subjectId={editingId}
                    readOnly={readOnly}
                    title="История NPC"
                  />
                ),
              },
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
