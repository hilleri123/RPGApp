'use client';

import ValidationIssues from '../../../../rules/ValidationIssues';
import { useDialogMode } from '../../common/DialogModeContext';
import type { LocationRulesTabProps } from './types';

export default function LocationRulesTab({ dlg, pluginUI }: LocationRulesTabProps) {
  const { readOnly } = useDialogMode();

  const Editor = pluginUI?.LocationDataEditor;
  const View = pluginUI?.LocationDataView;

  return (
    <div className="space-y-3">
      {readOnly ? (
        View ? <View data={dlg.data} config={dlg.config} /> : <div className="text-gray-400 text-sm">Нет view для правил.</div>
      ) : (
        Editor && dlg.config ? (
          <Editor data={dlg.data} config={dlg.config} issues={dlg.issues} onChange={dlg.setData} />
        ) : (
          <div className="text-gray-400 text-sm">Нет редактора правил или config не загрузился.</div>
        )
      )}
      <ValidationIssues issues={dlg.issues} />
    </div>
  );
}