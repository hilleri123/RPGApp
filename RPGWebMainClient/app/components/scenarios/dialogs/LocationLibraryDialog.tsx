'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2, Library, Swords } from 'lucide-react';
import {
  locationLibraryApi,
  type ImportLocationResult,
  type LibraryLocation,
} from '@/app/services/api/locationLibrary';
import { LOCATION_KINDS } from '@/app/lib/locationKinds';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Сценарий или снимок сессии, куда копируем. */
  targetScenarioId: string;
  parentLocationId?: string | null;
  /** Сузить выдачу правилами игры (по умолчанию — все). */
  ruleIdStr?: string | null;
  /** Копирование прошло успешно (для обновления списков). */
  onImported: (result: ImportLocationResult, hit: LibraryLocation) => void;
  /** Доп. кнопка, например «Добавить и начать сцену» в сессии. */
  extraAction?: {
    label: string;
    run: (result: ImportLocationResult, hit: LibraryLocation) => void;
  };
};

const KIND_BY_ID = new Map(LOCATION_KINDS.map((k) => [k.id, k]));

export function LocationLibraryDialog({
  open,
  onClose,
  targetScenarioId,
  parentLocationId,
  ruleIdStr,
  onImported,
  extraAction,
}: Props) {
  const [q, setQ] = useState('');
  const [kinds, setKinds] = useState<string[]>([]);
  const [templatesOnly, setTemplatesOnly] = useState(false);
  const [setId, setSetId] = useState('');
  const [includeChildren, setIncludeChildren] = useState(true);

  const [hits, setHits] = useState<LibraryLocation[]>([]);
  const [sets, setSets] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const rows = await locationLibraryApi.search({
        q,
        kinds,
        scenarioId: setId || undefined,
        templatesOnly,
        ruleIdStr: ruleIdStr || undefined,
        limit: 60,
      });
      if (seq !== requestSeq.current) return; // устаревший ответ
      setHits(rows);
      // «Наборы» берём из выдачи без фильтра по набору, чтобы селект не схлопывался.
      if (!setId) {
        const seen = new Map<string, string>();
        rows.forEach((r) => seen.set(r.scenario_id, r.scenario_name));
        setSets((prev) => {
          const merged = new Map(prev.map((s) => [s.id, s.name]));
          seen.forEach((name, id) => merged.set(id, name));
          return Array.from(merged, ([id, name]) => ({ id, name })).sort((a, b) =>
            a.name.localeCompare(b.name),
          );
        });
      }
    } catch (e: any) {
      if (seq !== requestSeq.current) return;
      setError(e?.message ?? 'Не удалось загрузить библиотеку локаций');
      setHits([]);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [q, kinds, setId, templatesOnly, ruleIdStr]);

  // Поиск «на лету»: небольшая задержка, чтобы не слать запрос на каждую букву.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [open, load]);

  useEffect(() => {
    if (!open) {
      setQ('');
      setKinds([]);
      setTemplatesOnly(false);
      setSetId('');
      setHits([]);
      setError(null);
      setBusyId(null);
    }
  }, [open]);

  const toggleKind = (id: string) =>
    setKinds((prev) => (prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]));

  const runImport = async (hit: LibraryLocation, withExtra: boolean) => {
    setBusyId(hit.id);
    setError(null);
    try {
      const result = await locationLibraryApi.importInto(targetScenarioId, {
        sourceLocationId: hit.id,
        includeChildren,
        parentLocationId: parentLocationId ?? null,
      });
      onImported(result, hit);
      if (withExtra) extraAction?.run(result, hit);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось добавить локацию');
    } finally {
      setBusyId(null);
    }
  };

  const kindChips = useMemo(
    () =>
      LOCATION_KINDS.map((k) => {
        const active = kinds.includes(k.id);
        return (
          <button
            key={k.id}
            type="button"
            onClick={() => toggleKind(k.id)}
            className={[
              'rounded-full border px-2 py-0.5 text-[11px] transition-colors',
              active
                ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-100'
                : 'border-white/15 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80',
            ].join(' ')}
          >
            {k.emoji} {k.label}
          </button>
        );
      }),
    [kinds],
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="w-5 h-5" /> Библиотека локаций
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Ищите по названию, описанию и виду местности среди локаций всех ваших сценариев — выбранная
          локация копируется сюда целиком. Набор локаций — любой сценарий; пометьте нужные локации
          как «шаблон», чтобы они были первыми.
        </p>

        <Input
          autoFocus
          placeholder="Например: квартира, таверна, порт…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <div className="flex flex-wrap gap-1.5">{kindChips}</div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <select
            value={setId}
            onChange={(e) => setSetId(e.target.value)}
            className="rounded-md border border-gray-700 bg-black/40 text-gray-100 text-sm px-2 py-1.5"
          >
            <option value="">Все наборы</option>
            {sets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2">
            <Switch checked={templatesOnly} onCheckedChange={setTemplatesOnly} />
            Только шаблоны
          </label>
          <label className="inline-flex items-center gap-2">
            <Switch checked={includeChildren} onCheckedChange={setIncludeChildren} />
            Вместе с подлокациями
          </label>
        </div>

        {error ? <div className="text-sm text-red-400">{error}</div> : null}

        <div className="max-h-96 overflow-y-auto space-y-1 border border-gray-700 rounded-md p-1">
          {loading && hits.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 p-3">
              <Loader2 className="w-4 h-4 animate-spin" /> Загрузка…
            </div>
          ) : hits.length === 0 ? (
            <div className="text-sm text-gray-400 p-3">Ничего не найдено</div>
          ) : (
            hits.map((hit) => {
              const kind = hit.kind ? KIND_BY_ID.get(hit.kind) : null;
              const busy = busyId === hit.id;
              return (
                <div
                  key={hit.id}
                  className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-white/5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate font-medium">{hit.name}</span>
                      {kind ? (
                        <span className="rounded-md border border-indigo-400/30 bg-indigo-500/15 px-1.5 text-[11px] text-indigo-100">
                          {kind.emoji} {kind.label}
                        </span>
                      ) : null}
                      {hit.is_template ? (
                        <span className="rounded-md border border-amber-400/30 bg-amber-500/15 px-1.5 text-[11px] text-amber-100">
                          шаблон
                        </span>
                      ) : null}
                      {hit.children_count > 0 ? (
                        <span className="text-[11px] text-gray-500">
                          + подлокаций: {hit.children_count}
                        </span>
                      ) : null}
                    </div>
                    <div className="truncate text-[11px] text-gray-500">
                      {hit.scenario_name}
                      {hit.parent_location_name ? ` · ${hit.parent_location_name}` : ''}
                    </div>
                    {hit.snippet ? (
                      <div className="truncate text-xs text-gray-400">{hit.snippet}</div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busyId !== null}
                      onClick={() => void runImport(hit, false)}
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Добавить'}
                    </Button>
                    {extraAction ? (
                      <Button
                        size="sm"
                        disabled={busyId !== null}
                        onClick={() => void runImport(hit, true)}
                      >
                        <Swords className="mr-1 h-4 w-4" /> {extraAction.label}
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
