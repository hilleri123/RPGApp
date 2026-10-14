'use client';

import { useEffect, useState } from 'react';
import type { ActionHandlerProps } from '@/app/plugins/pluginTypes';
import { Input } from '@/components/ui/input';
import { MentionField } from '@/app/components/mentions/MentionField';
import { useSessionScenarioApi } from '@/app/services/hooks/session/useSessionScenarioApi';

type CharacterOption = { id: string; name: string };

export default function GrantXpStage({
  action,
  value,
  onChange,
  onSubmit,
  setSubmitEnabled,
  readOnly,
  stageKey,
}: ActionHandlerProps) {
  const { scenarioId } = useSessionScenarioApi();
  const data = (action.workflow?.stageData ?? {}) as { characters?: CharacterOption[]; amount?: number };
  const characters = data.characters ?? [];
  const draft = (value ?? {}) as { character_ids?: string[]; amount?: number; comment?: string };
  const selected = new Set(draft.character_ids ?? []);
  const amount = draft.amount ?? data.amount ?? 1;
  const comment = draft.comment ?? '';
  const done = stageKey === 'grant_xp.done' || action.workflow?.status === 'completed';
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSubmitEnabled(!readOnly && !done && selected.size > 0 && amount !== 0);
  }, [readOnly, done, selected.size, amount, setSubmitEnabled]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ ...draft, character_ids: [...next], amount, comment });
  };

  if (done) {
    return <div className="text-sm text-gray-300">Опыт записан.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-300">Кому</div>
      <div className="flex flex-col gap-1">
        {characters.length === 0 ? <div className="text-xs text-gray-500">В сцене нет персонажей.</div> : null}
        {characters.map((character) => (
          <label key={character.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.has(character.id)}
              disabled={readOnly}
              onChange={() => toggle(character.id)}
            />
            {character.name || character.id}
          </label>
        ))}
      </div>
      <label className="block text-sm text-gray-300">
        Сколько
        <Input
          type="number"
          className="mt-1 h-8 w-24"
          value={amount}
          disabled={readOnly}
          onChange={(event) => onChange({ ...draft, character_ids: [...selected], amount: Number(event.target.value), comment })}
        />
      </label>
      <MentionField
        value={comment}
        onChange={(next) => onChange({ ...draft, character_ids: [...selected], amount, comment: next })}
        scenarioId={scenarioId}
        readOnly={readOnly}
        rows={3}
        placeholder="За что. Можно вставить [//character: или [//npc:"
      />
      {!readOnly ? (
        <button
          type="button"
          className="text-sm underline text-gray-300"
          disabled={busy || selected.size === 0 || amount === 0}
          onClick={() => {
            setBusy(true);
            onSubmit({ character_ids: [...selected], amount, comment });
          }}
        >
          Выдать
        </button>
      ) : null}
    </div>
  );
}
