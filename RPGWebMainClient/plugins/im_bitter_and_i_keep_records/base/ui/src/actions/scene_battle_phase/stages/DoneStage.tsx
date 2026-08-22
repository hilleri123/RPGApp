'use client';

export function DoneStage({ actionKey }: { actionKey?: string | null }) {
  return (
    <div className="rounded border p-3 bg-zinc-950/30">
      <div className="font-medium">Готово</div>
      <div className="text-sm text-muted-foreground mt-1">
        Действие завершено{actionKey ? `: ${actionKey}` : ''}.
      </div>
      <div className="text-xs text-muted-foreground mt-2">
        Можно закрыть это окно или перейти к следующему действию.
      </div>
    </div>
  );
}

export default DoneStage;
