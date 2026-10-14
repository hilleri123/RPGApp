'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScenarioScopedApiService, type ChronicleLine } from '@/app/services/api/scenario_scoped';
import { MentionField } from '@/app/components/mentions/MentionField';
import { MentionText } from '@/app/components/mentions/MentionText';
import { useWikiNotesScope } from '@/app/components/masterNotes/useWikiNotesScope';
import { useMasterNoteActions } from '@/app/components/masterNotes/useMasterNoteActions';
import { SessionEntityDialogs } from '@/app/components/session/common/SessionEntityDialogs';
import { openMasterWikiNote } from '@/app/services/stores/masterUi';

const XP_KIND = 'plugin:dw:xp';

export function EntityJournal({
  scenarioId,
  subjectKind,
  subjectId,
  kinds,
  allowAll = false,
  readOnly = false,
  title = 'Журнал',
  onXpDelta,
}: {
  scenarioId: string;
  subjectKind?: string;
  subjectId?: string | null;
  kinds?: string[];
  allowAll?: boolean;
  readOnly?: boolean;
  title?: string;
  onXpDelta?: (delta: number) => void;
}) {
  const catalog = useWikiNotesScope()?.catalog;
  const { entityDialogs, followNoteLink, followEntityLink } = useMasterNoteActions({
    onOpenNote: (noteId) => openMasterWikiNote(noteId),
  });
  const api = useMemo(() => new ScenarioScopedApiService(scenarioId), [scenarioId]);
  const [lines, setLines] = useState<ChronicleLine[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { text: string; amount: string }>>({});
  const [adding, setAdding] = useState('');
  const [error, setError] = useState<string | null>(null);
  const kindKey = (kinds ?? []).join(',');

  const load = useCallback(async () => {
    if (!allowAll && !subjectId && !kindKey) {
      setLines([]);
      return;
    }
    try {
      const rows = await api.listChronicle({
        subjectId: subjectId || undefined,
        kinds: kinds?.length ? kinds : undefined,
        all: allowAll && !subjectId,
      });
      setLines(rows);
      setDrafts(Object.fromEntries(rows.map((row) => [row.id, {
        text: row.text,
        amount: String((row.payload as { amount?: number } | null)?.amount ?? ''),
      }])));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить журнал');
    }
  }, [api, allowAll, subjectId, kindKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveLine = async (line: ChronicleLine) => {
    const draft = drafts[line.id];
    if (!draft) return;
    const payload = { ...(line.payload ?? {}) };
    const prevAmount = Number((line.payload as { amount?: number } | null)?.amount ?? 0);
    if (line.kind === XP_KIND && draft.amount !== '') {
      payload.amount = Number(draft.amount);
    }
    await api.updateChronicleLine(line.id, { text: draft.text, payload });
    if (line.kind === XP_KIND && draft.amount !== '' && Number(draft.amount) !== prevAmount) {
      onXpDelta?.(Number(draft.amount) - prevAmount);
    }
    await load();
  };

  const addLine = async () => {
    if (!subjectKind || !subjectId || !adding.trim()) return;
    await api.createChronicleLine({
      kind: kinds?.[0] && kinds.length === 1 ? kinds[0] : 'core:journal',
      text: adding.trim(),
      subject_kind: subjectKind,
      subject_id: subjectId,
      render: false,
    });
    setAdding('');
    await load();
  };

  return (
    <div className="space-y-3">
      <SessionEntityDialogs {...entityDialogs} />
      <div className="text-xs uppercase tracking-wide text-gray-500">{title}</div>
      {error ? <div className="text-xs text-red-300">{error}</div> : null}
      {lines.length === 0 ? <div className="text-sm text-gray-500">Пока пусто.</div> : null}
      {lines.map((line) => {
        const draft = drafts[line.id] ?? { text: line.text, amount: '' };
        return (
          <div key={line.id} className="rounded border border-gray-700 p-2 space-y-2">
            <div className="text-[10px] text-gray-500">{line.kind}</div>
            {readOnly ? (
              <MentionText
                text={line.text}
                catalog={catalog}
                scenarioId={scenarioId}
                onNoteClick={followNoteLink}
                onEntityInfo={followEntityLink}
              />
            ) : (
              <>
                <MentionField
                  value={draft.text}
                  onChange={(text) => setDrafts((prev) => ({ ...prev, [line.id]: { ...draft, text } }))}
                  catalog={catalog}
                  scenarioId={scenarioId}
                  rows={2}
                />
                {line.kind === XP_KIND ? (
                  <Input
                    type="number"
                    className="h-8 w-24"
                    value={draft.amount}
                    onChange={(event) => setDrafts((prev) => ({
                      ...prev,
                      [line.id]: { ...draft, amount: event.target.value },
                    }))}
                  />
                ) : null}
                <Button size="sm" variant="secondary" onClick={() => void saveLine(line)}>
                  Сохранить строку
                </Button>
              </>
            )}
          </div>
        );
      })}
      {!readOnly && subjectId && subjectKind ? (
        <div className="space-y-2">
          <MentionField
            value={adding}
            onChange={setAdding}
            catalog={catalog}
            scenarioId={scenarioId}
            rows={2}
            placeholder="Новая строка"
          />
          <Button size="sm" variant="secondary" disabled={!adding.trim()} onClick={() => void addLine()}>
            Добавить строку
          </Button>
        </div>
      ) : null}
    </div>
  );
}
