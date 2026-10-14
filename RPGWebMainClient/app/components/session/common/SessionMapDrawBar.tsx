'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function SessionMapDrawBar({
  drawing,
  pointCount,
  name,
  saving,
  error,
  onName,
  onStart,
  onUndo,
  onCancel,
  onSave,
}: {
  drawing: boolean;
  pointCount: number;
  name: string;
  saving: boolean;
  error: string | null;
  onName: (value: string) => void;
  onStart: () => void;
  onUndo: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  if (!drawing) {
    return (
      <Button size="sm" variant="secondary" onClick={onStart}>
        Область
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={name}
        onChange={(event) => onName(event.target.value)}
        placeholder="Имя подлокации"
        className="h-8 w-40"
      />
      <span className="text-xs text-gray-400">{pointCount} точек</span>
      <Button size="sm" variant="secondary" onClick={onUndo} disabled={pointCount === 0 || saving}>
        Шаг назад
      </Button>
      <Button size="sm" variant="secondary" onClick={onCancel} disabled={saving}>
        Отмена
      </Button>
      <Button size="sm" onClick={onSave} disabled={saving || pointCount < 3 || !name.trim()}>
        {saving ? 'Сохраняю…' : 'Сохранить'}
      </Button>
      {error ? <span className="text-xs text-red-300">{error}</span> : null}
    </div>
  );
}
