'use client';

import { useMemo } from 'react';
import { EntityEditDialogShell, EntityEditDealogProps } from './common/EntityEditDialogShell';
import { useScenarioOptional } from '../ScenarioContext';
import { useGameItemTemplateDialog } from '@/app/services/hooks/templates/dialogs/useGameItemTemplateDialog';
import { getPluginUI } from '@/app/plugins/uiRegistry';
import { GameItemMainTab, GameItemItemsTab, GameItemRulesTab } from './tabs/item';

export function GameItemTemplateEditDialog({
  open,
  onClose,
  editingId,
  templateSetId,
  ruleIdStr,
  onSave,
  readOnly = false,
}: EntityEditDealogProps) {
  const scenarioCtx = useScenarioOptional();
  const scenario = scenarioCtx?.scenario ?? null;
  const resolvedPackId = templateSetId ?? scenario?.template_set_id ?? '';

  const pluginUI = useMemo(() => {
    const rule = ruleIdStr ?? scenario?.rule_id_str ?? scenarioCtx?.pluginId ?? null;
    return rule ? getPluginUI(rule) : null;
  }, [ruleIdStr, scenario, scenarioCtx?.pluginId]);

  const dlg = useGameItemTemplateDialog({
    open: open && Boolean(resolvedPackId),
    templateSetId: resolvedPackId,
    itemId: editingId,
    onSaved: () => {
      onSave?.();
      onClose();
    },
  });

  if (!resolvedPackId) {
    return null;
  }

  return (
    <EntityEditDialogShell
      open={open}
      onClose={onClose}
      title={editingId ? 'Item template: редактирование' : 'Item template: создание'}
      loading={dlg.loading}
      readOnly={readOnly}
      disableSave={readOnly || !dlg.form?.name?.trim()}
      onSave={() => dlg.save(false)}
      tabs={[
        { key: 'main', title: 'Основное', content: <GameItemMainTab dlg={dlg} /> },
        { key: 'items', title: 'Содержимое', content: <GameItemItemsTab dlg={dlg} /> },
      ]}
      rules={{
        content: <GameItemRulesTab dlg={dlg} pluginUI={pluginUI} />,
        onValidate: () => dlg.validate(),
        onForceSave: () => dlg.save(true),
        forceSaveDisabled: readOnly || (dlg.issues?.length ?? 0) === 0,
        loading: dlg.rulesLoading,
      }}
    />
  );
}
