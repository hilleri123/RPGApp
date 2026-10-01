'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScenarioScopedApiService, type ScenarioSearchHit } from '@/app/services/api/scenario_scoped';
import { useScenarioFocusStore } from '@/app/services/stores/scenarioFocus';
import { kindOfTags } from '@/app/lib/locationKinds';

export type SearchTargetTab =
  | 'story'
  | 'locations'
  | 'characters'
  | 'npcs'
  | 'items'
  | 'notes'
  | 'counters'
  | 'fronts';

const TYPE_META: Record<ScenarioSearchHit['type'], { label: string; tab: SearchTargetTab }> = {
  story_beat: { label: 'Сюжет', tab: 'story' },
  location: { label: 'Локация', tab: 'locations' },
  player_character: { label: 'Персонаж', tab: 'characters' },
  npc: { label: 'NPC', tab: 'npcs' },
  game_item: { label: 'Предмет', tab: 'items' },
  note: { label: 'Заметка', tab: 'notes' },
  counter: { label: 'Счётчик', tab: 'counters' },
  front: { label: 'Фронт', tab: 'fronts' },
};

const TYPE_FILTERS = Object.entries(TYPE_META) as [ScenarioSearchHit['type'], { label: string }][];

/** Кнопка + окно поиска по всем сущностям сценария (Ctrl/⌘+K). */
export function ScenarioSearch({
  scenarioId,
  onNavigate,
}: {
  scenarioId: string;
  onNavigate: (tab: SearchTargetTab) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [types, setTypes] = useState<ScenarioSearchHit['type'][]>([]);
  const [hits, setHits] = useState<ScenarioSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const setFocusTarget = useScenarioFocusStore((s) => s.setTarget);

  const api = useMemo(() => new ScenarioScopedApiService(scenarioId), [scenarioId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) {
      setQ('');
      setTypes([]);
      setHits([]);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!q.trim()) {
      setHits([]);
      return;
    }
    const id = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await api.searchEntities({ q, types, limit: 60 });
        if (id === seq.current) setHits(rows);
      } catch (e: any) {
        if (id === seq.current) {
          setError(e?.message ?? 'Поиск не удался');
          setHits([]);
        }
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [open, q, types, api]);

  const pick = useCallback(
    (hit: ScenarioSearchHit) => {
      const meta = TYPE_META[hit.type];
      setOpen(false);
      setFocusTarget({ id: hit.id });
      onNavigate(meta.tab);
      // Цель, которую никто не подхватил (элемент удалён), не должна всплыть позже.
      window.setTimeout(() => {
        if (useScenarioFocusStore.getState().target?.id === hit.id) setFocusTarget(null);
      }, 4000);
    },
    [onNavigate, setFocusTarget],
  );

  const toggleType = (t: ScenarioSearchHit['type']) =>
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} title="Поиск по сценарию (Ctrl+K)">
        <Search className="mr-1.5 h-4 w-4" /> Поиск
        <kbd className="ml-2 hidden rounded border border-gray-600 px-1 text-[10px] text-gray-400 sm:inline">
          Ctrl K
        </kbd>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Поиск по сценарию</DialogTitle>
          </DialogHeader>

          <Input
            autoFocus
            placeholder="Имя, описание, текст заметки…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <div className="flex flex-wrap gap-1.5">
            {TYPE_FILTERS.map(([id, meta]) => {
              const active = types.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleType(id)}
                  className={[
                    'rounded-full border px-2 py-0.5 text-[11px] transition-colors',
                    active
                      ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-100'
                      : 'border-white/15 bg-white/5 text-white/60 hover:bg-white/10',
                  ].join(' ')}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>

          {error ? <div className="text-sm text-red-400">{error}</div> : null}

          <div className="max-h-96 space-y-1 overflow-y-auto rounded-md border border-gray-700 p-1">
            {loading && hits.length === 0 ? (
              <div className="flex items-center gap-2 p-3 text-sm text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Поиск…
              </div>
            ) : !q.trim() ? (
              <div className="p-3 text-sm text-gray-500">Начните вводить запрос</div>
            ) : hits.length === 0 ? (
              <div className="p-3 text-sm text-gray-400">Ничего не найдено</div>
            ) : (
              hits.map((hit) => {
                const kind = hit.type === 'location' ? kindOfTags(hit.kind ? [`loc:${hit.kind}`] : []) : null;
                return (
                  <button
                    key={`${hit.type}:${hit.id}`}
                    type="button"
                    onClick={() => pick(hit)}
                    className="w-full rounded-md px-3 py-2 text-left hover:bg-white/5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded-md border border-white/15 bg-white/5 px-1.5 text-[11px] text-gray-300">
                        {TYPE_META[hit.type].label}
                      </span>
                      <span className="truncate font-medium">{hit.name || 'Без названия'}</span>
                      {kind ? (
                        <span className="text-[11px] text-indigo-200">
                          {kind.emoji} {kind.label}
                        </span>
                      ) : null}
                    </div>
                    {hit.snippet ? (
                      <div className="mt-0.5 truncate text-xs text-gray-400">{hit.snippet}</div>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
