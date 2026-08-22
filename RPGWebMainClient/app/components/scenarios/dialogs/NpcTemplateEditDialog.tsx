'use client';

import { useMemo } from 'react';
import { useNpcTemplateDialog } from '@/app/services/hooks/templates/dialogs/useNpcTemplateDialog';
import { NpcItemsTab, NpcMainTab, NpcRulesTab } from './tabs/npc';
import { useScenarioOptional } from '../ScenarioContext';
import { getPluginUI } from '@/app/plugins/uiRegistry';
import { EntityEditDialogShell, EntityEditDealogProps } from './common/EntityEditDialogShell';

export function NpcTemplateEditDialog({
  open,
  onClose,
  editingId,
  templateSetId,
  ruleIdStr,
  onSave,
  readOnly,
}: EntityEditDealogProps) {
  const scenarioCtx = useScenarioOptional();
  const scenario = scenarioCtx?.scenario ?? null;
  const resolvedPackId = templateSetId ?? scenario?.template_set_id ?? '';

  const pluginUI = useMemo(() => {
    const rule = ruleIdStr ?? scenario?.rule_id_str ?? scenarioCtx?.pluginId ?? null;
    return rule ? getPluginUI(rule) : null;
  }, [ruleIdStr, scenario, scenarioCtx?.pluginId]);

  const dlg = useNpcTemplateDialog({
    open: open && Boolean(resolvedPackId),
    templateSetId: resolvedPackId,
    npcId: editingId,
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
      title={editingId ? 'NPC template: редактирование' : 'NPC template: создание'}
      loading={dlg.loading}
      readOnly={readOnly}
      disableSave={!dlg.form?.name?.trim()}
      onSave={() => dlg.save(false)}
      tabs={[
        { key: 'main', title: 'Основное', content: <NpcMainTab dlg={dlg} /> },
        { key: 'items', title: 'Предметы', content: <NpcItemsTab dlg={dlg} /> },
      ]}
      rules={{
        content: <NpcRulesTab dlg={dlg} pluginUI={pluginUI} />,
        onValidate: () => dlg.validate(),
        onForceSave: () => dlg.save(true),
        forceSaveDisabled: (dlg.issues?.length ?? 0) === 0,
        loading: dlg.rulesLoading,
      }}
    />
  );
}
