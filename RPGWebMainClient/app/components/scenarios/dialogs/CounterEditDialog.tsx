'use client';

import { useMemo } from 'react';
import { Input } from '@/components/ui/input';

import { EntityComboBox } from './common/EntityComboBox';
import { CounterValueControl } from './common/CounterValueControl';
import { useCounterDialog } from '@/app/services/hooks/scenario/dialogs/useCounterDialog';
import { useScenario } from '../ScenarioContext';
import { EntityEditDialogShell, EntityEditDealogProps } from './common/EntityEditDialogShell';
import { useDialogMode } from './common/DialogModeContext';
import { useLaunchedLineageExtras } from './common/LaunchedLineageExtras';

export function CounterMainTab({ dlg, editingId }: { dlg: any; editingId?: string | null }) {
  const { readOnly } = useDialogMode();
  const { scenarioId } = useScenario();

  const charOptions = useMemo(
    () =>
      [{ id: '', name: '— (глобальный)', tags: [] as string[] }].concat(
        (dlg.lookups.characters ?? []).map((c: any) => ({
          id: String(c.id),
          name: c.name,
          tags: c.tags ?? [],
        }))
      ),
    [dlg.lookups.characters]
  );

  const counterId = editingId ?? null;

  return (
    <div className="space-y-3">
      <Input
        placeholder="Название"
        value={dlg.form.name ?? ''}
        disabled={readOnly}
        onChange={(e) => dlg.setForm((p: any) => ({ ...p, name: e.target.value }))}
      />

      <Input
        placeholder="Описание"
        value={dlg.form.description ?? ''}
        disabled={readOnly}
        onChange={(e) => {
          const v = e.target.value;
          dlg.setForm((p: any) => ({ ...p, description: v === '' ? null : v }));
        }}
      />

      {counterId ? (
        <div>
          <div className="text-xs text-gray-400 mb-1">Значение (с историей)</div>
          <CounterValueControl
            scenarioId={scenarioId}
            counter={{
              id: counterId,
              min_value: dlg.form.min_value ?? null,
              max_value: dlg.form.max_value ?? null,
            }}
            value={dlg.form.value ?? 0}
            readOnly={readOnly}
            onValueChange={(updated) =>
              dlg.setForm((p: any) => ({ ...p, value: updated.value ?? 0 }))
            }
          />
        </div>
      ) : (
        <Input
          placeholder="Начальное значение"
          type="number"
          value={dlg.form.value ?? 0}
          disabled={readOnly}
          onChange={(e) => dlg.setForm((p: any) => ({ ...p, value: Number(e.target.value) }))}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="min"
          type="number"
          value={dlg.form.min_value ?? ''}
          disabled={readOnly}
          onChange={(e) => {
            const v = e.target.value;
            dlg.setForm((p: any) => ({ ...p, min_value: v === '' ? null : Number(v) }));
          }}
        />
        <Input
          placeholder="max"
          type="number"
          value={dlg.form.max_value ?? ''}
          disabled={readOnly}
          onChange={(e) => {
            const v = e.target.value;
            dlg.setForm((p: any) => ({ ...p, max_value: v === '' ? null : Number(v) }));
          }}
        />
      </div>

      <div>
        <div className="text-xs text-gray-400 mb-1">Привязан к персонажу (опционально)</div>
        <EntityComboBox
          value={(dlg.form.character_id ?? '') as any}
          items={charOptions}
          placeholder="—"
          readOnly={readOnly}
          onChange={(id) => dlg.setForm((p: any) => ({ ...p, character_id: id === '' ? null : id }))}
        />
      </div>
    </div>
  );
}

export function CounterEditDialog({ open, onClose, editingId, onSave, onEntitySaved, readOnly }: EntityEditDealogProps) {
  const { scenarioId } = useScenario();

  const dlg = useCounterDialog({
    open,
    scenarioId,
    counterId: editingId,
    onSaved: async (id) => {
      await onEntitySaved?.(id);
      onSave?.();
      onClose();
    },
  });

  const { footer, lineageDialog } = useLaunchedLineageExtras({
    editingId,
    entityType: 'counter',
    entityLabel: dlg.form?.name,
    readOnly,
  });

  return (
    <>
    <EntityEditDialogShell
      open={open}
      onClose={onClose}
      title={editingId ? 'Счётчик: редактирование' : 'Счётчик: создание'}
      loading={dlg.loading}
      readOnly={readOnly}
      onSave={() => dlg.save(false)}
      footer={footer}
      tabs={[{ key: 'main', title: 'Основное', content: <CounterMainTab dlg={dlg} editingId={editingId} /> }]}
    />
    {lineageDialog}
    </>
  );
}
