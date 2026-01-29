'use client';

export function DoneStage({ actionKey }: { actionKey: string }) {
  return (
    <div className="rounded border p-3">
      <div className="font-medium">Готово</div>
      <div className="text-sm text-muted-foreground">Действие завершено.</div>
      <div className="text-xs text-muted-foreground mt-1">action: {actionKey}</div>
    </div>
  );
}
