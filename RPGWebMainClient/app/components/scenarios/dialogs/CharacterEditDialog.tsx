'use client';

import { useScenario } from '../ScenarioContext';
import { useCharacterDialog } from '@/app/services/hooks/scenario/dialogs/useCharacterDialog';
import { EntityEditDealogProps, EntityEditDialogShell } from './common/EntityEditDialogShell';

import { CharacterMainTab, CharacterItemsTab, CharacterRulesTab, CharacterCountersTab } from './tabs/character';
import { EntityMasterNoteBacklinksTab } from '@/app/components/masterNotes/EntityMasterNoteBacklinksTab';
import { openMasterWikiNote } from '@/app/services/stores/masterUi';
import { useLaunchedLineageExtras } from './common/LaunchedLineageExtras';

export function CharacterEditDialog({ open, onClose, editingId, onSave, readOnly }: EntityEditDealogProps) {
  const { scenarioId, pluginUI } = useScenario();

  const dlg = useCharacterDialog({
    open,
    scenarioId,
    characterId: editingId,
    onSaved: () => {
      onSave?.();
      onClose();
    },
  });

  const { footer, lineageDialog } = useLaunchedLineageExtras({
    editingId,
    entityType: 'character',
    entityLabel: dlg.form?.name,
    readOnly,
  });

  return (
    <>
    <EntityEditDialogShell
      open={open}
      onClose={onClose}
      title={editingId ? 'Персонаж: редактирование' : 'Персонаж: создание'}
      loading={dlg.loading}
      readOnly={readOnly}
      disableSave={!dlg.form?.name?.trim()}
      onSave={() => dlg.save(false)}
      footer={footer}
      tabs={[
        { key: 'main', title: 'Досье', content: <CharacterMainTab dlg={dlg} /> },
        {
          key: 'items',
          title: 'Предметы',
          content: <CharacterItemsTab dlg={dlg} />,
        },
        ...(editingId && !readOnly
          ? [
              {
                key: 'counters',
                title: 'Счётчики',
                content: <CharacterCountersTab characterId={editingId} />,
              },
            ]
          : []),
        ...(editingId
          ? [
              {
                key: 'masterRefs',
                title: 'Ссылки',
                content: (
                  <EntityMasterNoteBacklinksTab
                    entityKind="character"
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
        content: (
          <CharacterRulesTab
            dlg={dlg}
            pluginUI={pluginUI}
            rulesMode={readOnly ? 'view' : 'edit'}
          />
        ),
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
