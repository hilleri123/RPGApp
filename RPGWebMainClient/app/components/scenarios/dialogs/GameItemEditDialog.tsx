'use client';

import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { PackageIcon } from 'lucide-react';

import HtmlEditor from '@/app/components/common/HtmlEditor';
import ImagePicker from '../../common/MapGallery';
import { InventoryEditor } from './common/InventoryEditor';
import ValidationIssues from '../../rules/ValidationIssues';

import { useGameItemDialog } from '@/app/services/hooks/scenario/dialogs/useGameItemDialog';
import { useScenario } from '../ScenarioContext';
import { EntityEditDialogShell, EntityEditDealogProps } from './common/EntityEditDialogShell';
import { useDialogMode } from './common/DialogModeContext';
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
}: EntityEditDealogProps) {
  const { scenarioId, pluginUI } = useScenario();

  const dlg = useGameItemDialog({
    open,
    scenarioId,
    itemId: editingId,
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

  return (
    <>
    <EntityEditDialogShell
      open={open}
      onClose={onClose}
      title={editingId ? 'Предмет: редактирование' : 'Предмет: создание'}
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
