'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Minus, Plus } from 'lucide-react';
import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';
import type { Counter, CounterChange } from '@/app/services/types2';

function formatChangeTime(iso?: string | null) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

/** Accepts "+3", "-2", "3", " +3 ". Returns null if invalid / zero. */
export function parseSignedDelta(raw: string): number | null {
  const s = (raw ?? '').trim().replace(/\s+/g, '');
  if (!s || s === '+' || s === '-') return null;
  if (!/^[+-]?\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n === 0) return null;
  return n;
}

export function CounterHistoryTooltipBody({
  history,
  loading,
}: {
  history: CounterChange[];
  loading?: boolean;
}) {
  if (loading) return <div className="text-xs text-gray-300">Загрузка истории…</div>;
  if (!history.length) return <div className="text-xs text-gray-400">Истории пока нет</div>;
  return (
    <ul className="space-y-1.5 max-h-56 overflow-y-auto text-xs w-[280px]">
      {history.map((h) => (
        <li key={String(h.id)} className="border-b border-white/10 pb-1 last:border-0">
          <div className="flex justify-between gap-2">
            <span className={h.delta >= 0 ? 'text-emerald-300' : 'text-red-300'}>
              {h.delta >= 0 ? '+' : ''}
              {h.delta}
            </span>
            <span className="text-gray-200">
              {h.old_value} → {h.new_value}
            </span>
          </div>
          {h.comment ? <div className="text-gray-300 mt-0.5">{h.comment}</div> : null}
          <div className="text-[10px] text-gray-500 mt-0.5">{formatChangeTime(h.created_at)}</div>
        </li>
      ))}
    </ul>
  );
}

export function CounterValueControl({
  scenarioId,
  counter,
  value,
  onValueChange,
  readOnly = false,
  compact = false,
}: {
  scenarioId: string;
  counter: Pick<Counter, 'id' | 'min_value' | 'max_value'>;
  value: number;
  onValueChange?: (next: Counter) => void;
  readOnly?: boolean;
  compact?: boolean;
}) {
  const api = useMemo(() => new ScenarioScopedApiService(scenarioId), [scenarioId]);
  const [history, setHistory] = useState<CounterChange[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histLoaded, setHistLoaded] = useState(false);
  const [comment, setComment] = useState('');
  const [deltaInput, setDeltaInput] = useState('+1');
  const [busy, setBusy] = useState(false);

  const canDecrement = counter.min_value == null || value > counter.min_value;
  const canIncrement = counter.max_value == null || value < counter.max_value;
  const parsedDelta = parseSignedDelta(deltaInput);
  const deltaOk = parsedDelta != null;

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const rows = await api.getCounterHistory(String(counter.id));
      setHistory(rows);
      setHistLoaded(true);
    } catch {
      setHistory([]);
    } finally {
      setHistLoading(false);
    }
  }, [api, counter.id]);

  useEffect(() => {
    setHistLoaded(false);
    setHistory([]);
  }, [counter.id, value]);

  const adjust = async (delta: number, clearDelta = false) => {
    if (readOnly || !delta || busy) return;
    setBusy(true);
    try {
      const updated = await api.adjustCounter(String(counter.id), {
        delta,
        comment: comment.trim() || null,
      });
      setComment('');
      if (clearDelta) setDeltaInput('+1');
      setHistLoaded(false);
      onValueChange?.(updated);
    } finally {
      setBusy(false);
    }
  };

  const submitDelta = () => {
    if (parsedDelta == null) return;
    void adjust(parsedDelta, true);
  };

  const inputH = compact ? 'h-7 text-xs' : 'h-8';

  return (
    <TooltipProvider delayDuration={200}>
      <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
        <div className="flex items-center gap-1">
          {!readOnly ? (
            <Button
              size="icon"
              variant="outline"
              className={compact ? 'h-7 w-7' : undefined}
              disabled={!canDecrement || busy}
              title="−1"
              onClick={() => void adjust(-1)}
            >
              <Minus className="w-4 h-4" />
            </Button>
          ) : null}

          <Tooltip
            onOpenChange={(open) => {
              if (open && !histLoaded) void loadHistory();
            }}
          >
            <TooltipTrigger asChild>
              <button
                type="button"
                className="min-w-[3rem] px-2 py-1 rounded border border-zinc-700 bg-zinc-900 text-center font-semibold tabular-nums hover:border-zinc-500"
                title="История изменений"
              >
                {value}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-zinc-950 border border-zinc-700 p-2">
              <CounterHistoryTooltipBody history={history} loading={histLoading} />
            </TooltipContent>
          </Tooltip>

          {!readOnly ? (
            <Button
              size="icon"
              variant="outline"
              className={compact ? 'h-7 w-7' : undefined}
              disabled={!canIncrement || busy}
              title="+1"
              onClick={() => void adjust(1)}
            >
              <Plus className="w-4 h-4" />
            </Button>
          ) : null}
        </div>

        {!readOnly ? (
          <div className="flex flex-wrap gap-2 items-center">
            <Input
              type="text"
              inputMode="text"
              className={`w-[4.5rem] ${inputH} font-mono tabular-nums`}
              value={deltaInput}
              placeholder="+3"
              title="Изменение, например +3 или -2"
              aria-label="Изменение"
              onChange={(e) => setDeltaInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitDelta();
                }
              }}
            />
            <Input
              className={`flex-1 min-w-[8rem] ${inputH}`}
              placeholder="Комментарий (необяз.)"
              value={comment}
              aria-label="Комментарий"
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitDelta();
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              className={compact ? 'h-7 text-xs' : undefined}
              disabled={!deltaOk || busy}
              onClick={submitDelta}
            >
              Применить
            </Button>
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
