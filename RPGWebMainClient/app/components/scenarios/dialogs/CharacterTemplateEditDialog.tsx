'use client';

import { useMemo } from 'react';
import { EntityEditDialogShell, EntityEditDealogProps } from './common/EntityEditDialogShell';
import { useScenarioOptional } from '../ScenarioContext';
import { useCharacterTemplateDialog } from '@/app/services/hooks/templates/dialogs/useCharacterTemplateDialog';
import { getPluginUI } from '@/app/plugins/uiRegistry';
import { CharacterMainTab, CharacterItemsTab, CharacterRulesTab } from './tabs/character';

export function CharacterTemplateEditDialog({
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

  const dlg = useCharacterTemplateDialog({
    open: open && Boolean(resolvedPackId),
    templateSetId: resolvedPackId,
    characterId: editingId,
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
      title={editingId ? 'Персонаж: редактирование' : 'Персонаж: создание'}
      loading={dlg.loading}
      readOnly={readOnly}
      disableSave={!dlg.form?.name?.trim()}
      onSave={() => dlg.save(false)}
      tabs={[
        { key: 'main', title: 'Досье', content: <CharacterMainTab dlg={dlg} /> },
        { key: 'items', title: 'Предметы', content: <CharacterItemsTab dlg={dlg} /> },
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
  );
}
