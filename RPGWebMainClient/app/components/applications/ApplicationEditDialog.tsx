// app/components/applications/ApplicationEditDialog.tsx
'use client';

import { ApplicationCommentTab } from './tabs/ApplicationCommentTab';
import { useApplicationDialog } from '@/app/services/hooks/applications/useApplicationDialog';
import { EntityEditDialogShell } from '../scenarios/dialogs/common/EntityEditDialogShell';
import { CharacterMainTab, CharacterRulesTab } from '../scenarios/dialogs/tabs/character';

export interface ApplicationEditDialogProps {
  open: boolean;
  onClose: () => void;
  applicationId?: string | null;
  ruleIdStr?: string;
  readOnly?: boolean;
  onSaved?: (id: string) => void;
}

export function ApplicationEditDialog({
  open,
  onClose,
  applicationId = null,
  ruleIdStr = '',
  readOnly = false,
  onSaved,
}: ApplicationEditDialogProps) {
  const hook = useApplicationDialog({
    open,
    applicationId,
    ruleIdStr,
    onSaved: (id) => { onSaved?.(id); onClose(); },
  });

  return (
    <EntityEditDialogShell
      open={open}
      onClose={onClose}
      title={applicationId ? 'Заявка: редактирование' : 'Новый персонаж'}
      loading={hook.loading || hook.saving}
      readOnly={readOnly}
      disableSave={!hook.dlg.form?.name?.trim()}
      onSave={() => { hook.save(); }}
      tabs={[
        {
          key: 'main',
          title: 'Персонаж',
          content: <CharacterMainTab dlg={hook.dlg as any} />,
        },
        {
          key: 'comment',
          title: 'Комментарий',
          content: (
            <ApplicationCommentTab
              value={hook.dlg.form.player_comment ?? ''}
              readOnly={readOnly}
              onChange={(v) =>
                hook.setForm((p) => ({ ...p, player_comment: v || null }))
              }
            />
          ),
        },
      ]}
      rules={{
        content: (
          <CharacterRulesTab
            dlg={hook.dlg as any}
            pluginUI={hook.pluginUI}
            rulesMode={readOnly ? 'view' : 'edit'}
          />
        ),
        onValidate:        () => hook.validate(),
        onForceSave:       () => hook.save(true),
        forceSaveDisabled: (hook.dlg.issues?.length ?? 0) === 0,
        loading:           hook.dlg.rulesLoading,
      }}
    />
  );
}