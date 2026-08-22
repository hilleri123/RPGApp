'use client';

import { Input } from "@/components/ui/input";
import HtmlEditor from "@/app/components/common/HtmlEditor";
import { EntityEditDialogShell } from "@/app/components/scenarios/dialogs/common/EntityEditDialogShell";
import ValidationIssues from "@/app/components/rules/ValidationIssues";
import { useObstacleDialogSession } from "@/app/services/hooks/session/useObstacleDialogSession";

export default function ObstacleSessionEditDialog({
  open,
  onClose,
  editingObstacle,
  readOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  editingObstacle?: any | null;
  readOnly?: boolean;
}) {
  const dlg = useObstacleDialogSession({
    open,
    editingObstacle,
    onSaved: onClose,
  });

  const loading = dlg.initialLoading || dlg.loading;
  const ObstacleEditor = dlg.pluginUI?.ObstacleDataEditor;
  const ObstacleView = dlg.pluginUI?.ObstacleDataView;

  return (
    <EntityEditDialogShell
      open={open}
      onClose={onClose}
      title={
        editingObstacle?.id
          ? "Препятствие: редактирование (сессия)"
          : "Препятствие: создание (сессия)"
      }
      loading={loading}
      readOnly={readOnly}
      disableSave={readOnly || dlg.disableSave}
      onSave={() => dlg.save(false)}
      tabs={[
        {
          key: "main",
          title: "Нарратив",
          content: (
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-400 mb-1">Название</div>
                <Input
                  value={dlg.form.name ?? ""}
                  onChange={(e) =>
                    dlg.setForm((p: any) => ({ ...p, name: e.target.value }))
                  }
                  disabled={readOnly}
                />
              </div>

              <div>
                <div className="text-xs text-gray-400 mb-1">Описание (игроки)</div>
                <HtmlEditor
                  value={dlg.form.description_for_players ?? ""}
                  onChange={(html: string) =>
                    dlg.setForm((p: any) => ({
                      ...p,
                      description_for_players: html === "" ? null : html,
                    }))
                  }
                />
              </div>

              <div>
                <div className="text-xs text-gray-400 mb-1">Описание (мастер)</div>
                <HtmlEditor
                  value={dlg.form.description_for_master ?? ""}
                  onChange={(html: string) =>
                    dlg.setForm((p: any) => ({
                      ...p,
                      description_for_master: html === "" ? null : html,
                    }))
                  }
                />
              </div>
            </div>
          ),
        },
      ]}
      rules={{
        content: (
          <div className="space-y-2">
            {ObstacleEditor ? (
              <ObstacleEditor
                data={dlg.data ?? {}}
                config={dlg.config}
                issues={dlg.issues ?? []}
                onChange={(next: any) => dlg.setData(next)}
              />
            ) : (
              <div className="text-sm text-gray-400">
                Плагин не дал ObstacleDataEditor.
              </div>
            )}

            {ObstacleView ? null : null}

            <ValidationIssues issues={dlg.issues ?? []} />
          </div>
        ),
        onValidate: () => dlg.validate(),
        onForceSave: () => dlg.save(true),
        forceSaveDisabled: readOnly || (dlg.issues?.length ?? 0) === 0,
        loading: dlg.rulesLoading || dlg.configLoading,
      }}
    />
  );
}
