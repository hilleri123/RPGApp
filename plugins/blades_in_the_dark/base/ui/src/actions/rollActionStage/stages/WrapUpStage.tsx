'use client';

export function WrapUpStage({ wf, value, patch }: { wf: any; value: any; patch: (p: any) => void }) {
  const ctx = wf?.context ?? {};
  const roll = ctx.roll ?? {};
  const resist = ctx.resist ?? null;

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium">Итог (мастер)</div>

      <div className="text-sm text-muted-foreground">
        {roll.character_name ? `${roll.character_name}: ` : ''}{roll.action ?? '—'} · outcome: {roll.outcome ?? '—'}
      </div>

      {resist ? (
        <div className="text-xs text-muted-foreground">
          resist: {resist.attribute} · rolls: {Array.isArray(resist.rolls) ? resist.rolls.join(', ') : '—'} · stressCost:{' '}
          {resist.stressCost}
        </div>
      ) : null}

      <input
        className="border rounded px-2 py-1 text-black bg-background"
        placeholder="trauma (optional)"
        value={value?.trauma ?? ''}
        onChange={(e) => patch({ trauma: e.target.value || null })}
      />

      <textarea
        className="border rounded px-2 py-1 text-black bg-background"
        placeholder="summary (optional)"
        value={value?.summary ?? ''}
        onChange={(e) => patch({ summary: e.target.value || null })}
      />

      <div className="text-xs text-muted-foreground">Submit отправит: {'{ trauma?, summary? }'}.</div>
    </div>
  );
}
