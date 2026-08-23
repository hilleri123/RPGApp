'use client';

import { useGameItemDialog, type GameItemTemplateSeed } from '@/app/services/hooks/scenario/dialogs/useGameItemDialog';
import { useScenario } from '../ScenarioContext';
import { EntityEditDialogShell, EntityEditDealogProps } from './common/EntityEditDialogShell';
import { GameItemItemsTab, GameItemMainTab, GameItemRulesTab } from './tabs/item';
import { EntityMasterNoteBacklinksTab } from '@/app/components/masterNotes/EntityMasterNoteBacklinksTab';
import { openMasterWikiNote } from '@/app/services/stores/masterUi';
import { useLaunchedLineageExtras } from './common/LaunchedLineageExtras';

export function GameItemEditDialog({
  open,
  onClose,
  editingId,
  onSave,
  onEntitySaved,
  readOnly = false,
  seedFromTemplate = null,
}: EntityEditDealogProps & { seedFromTemplate?: GameItemTemplateSeed | null }) {
  const { scenarioId, pluginUI } = useScenario();

  const dlg = useGameItemDialog({
    open,
    scenarioId,
    itemId: editingId,
    seedFromTemplate: editingId ? null : seedFromTemplate,
    onSaved: async (id) => {
      await onEntitySaved?.(id);
      onSave?.();
      onClose();
    },
  });

  // если у тебя используется initialLoading — пробрасываем в shell
  const loading = dlg.initialLoading || dlg.loading;

  const { footer, lineageDialog } = useLaunchedLineageExtras({
    editingId,
    entityType: 'game_item',
    entityLabel: dlg.form?.name,
    readOnly,
  });

  const title = editingId
    ? 'Предмет: редактирование'
    : seedFromTemplate
      ? 'Предмет: создание из шаблона'
      : 'Предмет: создание';

  return (
    <>
    <EntityEditDialogShell
      open={open}
      onClose={onClose}
      title={title}
      loading={loading}
      readOnly={readOnly}
      disableSave={readOnly || !dlg.form?.name?.trim()}
      onSave={() => dlg.save(false)}
      footer={footer}
      tabs={[
        { key: 'main', title: 'Основное', content: <GameItemMainTab dlg={dlg} /> },
        { key: 'items', title: 'Содержимое', content: <GameItemItemsTab dlg={dlg} /> },
        ...(editingId
          ? [
              {
                key: 'masterRefs',
                title: 'Ссылки',
                content: (
                  <EntityMasterNoteBacklinksTab
                    entityKind="item"
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
        content: <GameItemRulesTab dlg={dlg} pluginUI={pluginUI} />,
        onValidate: () => dlg.validate(),
        onForceSave: () => dlg.save(true),
        forceSaveDisabled: readOnly || (dlg.issues?.length ?? 0) === 0,
        loading: dlg.rulesLoading,
      }}
    />
    {lineageDialog}
    </>
  );
}
