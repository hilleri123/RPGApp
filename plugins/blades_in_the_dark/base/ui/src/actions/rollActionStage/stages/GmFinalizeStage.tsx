'use client';

import { ActionPositionEffectLine } from './_ui/BladesBadges';

export function GmFinalizeStage({ wf, value, patch }: { wf: any; value: any; patch: (p: any) => void }) {
  const ctx = wf?.context ?? {};
  const mods = ctx.mods ?? {};

  const allow = value?.allow !== false;

  return (
    <div className="rounded border p-3 flex flex-col gap-3">
      <div className="font-medium">Финализация мастером</div>

      <ActionPositionEffectLine ctx={ctx} />

      <div className="rounded border border-zinc-700 bg-zinc-950/40 p-2 text-xs text-muted-foreground">
        Моды: push={String(!!mods.push)} · help={String(!!mods.help)} · bargain={String(!!mods.devils_bargain)} · bonus=
        {String(mods.bonus_dice ?? 0)}
        {mods.help && mods.helper_user_id ? ` · helper=${String(mods.helper_user_id)}` : ''}
        {mods.help ? ` · confirmed=${String(!!mods.help_confirmed)}` : ''}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={allow} onChange={(e) => patch({ allow: e.target.checked })} />
        Разрешить действие
      </label>

      <div className="text-xs text-muted-foreground">
        Оверрайды ниже опциональны. Если оставить пустым — останется то, что мастер выставил ранее.
      </div>

      <div className="flex gap-2 flex-wrap">
        <select
          className="border rounded px-2 py-1 text-sm text-black bg-background"
          value={value?.position ?? ''}
          onChange={(e) => patch({ position: e.target.value || null })}
          disabled={!allow}
        >
          <option value="">(не менять риск)</option>
          <option value="controlled">Под контролем</option>
          <option value="risky">Рискованно</option>
          <option value="desperate">Отчаянно</option>
        </select>

        <select
          className="border rounded px-2 py-1 text-sm text-black bg-background"
          value={value?.effect ?? ''}
          onChange={(e) => patch({ effect: e.target.value || null })}
          disabled={!allow}
        >
          <option value="">(не менять эффект)</option>
          <option value="limited">Ограниченный</option>
          <option value="standard">Обычный</option>
          <option value="great">Отличный</option>
        </select>
      </div>

      <textarea
        className="border rounded px-3 py-2 text-sm text-black bg-background disabled:opacity-60"
        placeholder="Подсказка по последствиям (опционально)"
        value={value?.consequence_hint ?? ''}
        onChange={(e) => patch({ consequence_hint: e.target.value || null })}
        disabled={!allow}
      />

      <div className="text-xs text-muted-foreground">
        Submit отправит: {'{ allow, position?, effect?, consequence_hint? }'}.
      </div>
    </div>
  );
}
