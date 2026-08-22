'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Dices, Loader2 } from 'lucide-react';
import Header from '@/app/components/layout/Header';
import { RequireAuth } from '@/app/components/auth/RequireAuth';
import { Button } from '@/components/ui/button';
import { userApiService, type RollListResponse, type RollRecord } from '@/app/services/api/users';

export default function MyRollsPage() {
  return (
    <RequireAuth>
      <MyRollsContent />
    </RequireAuth>
  );
}

function MyRollsContent() {
  const [data, setData] = useState<RollListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RollRecord | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    userApiService
      .getMyRolls({ limit: 100 })
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || 'Не удалось загрузить броски');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Dices className="w-6 h-6 text-amber-300" />
              Мои броски
            </h1>
            <p className="text-sm text-white/50 mt-1">История кубов и seed-рисунков по сессиям</p>
          </div>
          <Link href="/me">
            <Button variant="outline" size="sm">
              Профиль
            </Button>
          </Link>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-white/60">
            <Loader2 className="w-4 h-4 animate-spin" />
            Загрузка…
          </div>
        )}
        {error && <div className="text-red-400 text-sm">{error}</div>}

        {data && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <Stat label="Всего" value={String(data.stats.total_rolls)} />
              <Stat
                label="Средний итог"
                value={data.stats.avg_total != null ? data.stats.avg_total.toFixed(1) : '—'}
              />
              <Stat label="Со seed" value={String(data.stats.with_seed_image)} />
              <Stat
                label="Виды"
                value={Object.keys(data.stats.by_kind || {}).length ? Object.keys(data.stats.by_kind).join(', ') : '—'}
              />
            </div>

            {!data.items.length ? (
              <div className="text-white/40 text-sm">Пока нет сохранённых бросков.</div>
            ) : (
              <ul className="space-y-2">
                {data.items.map((roll) => (
                  <li key={roll.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(roll)}
                      className="w-full text-left rounded border border-white/10 bg-zinc-900/60 hover:bg-zinc-900 px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-sm">{roll.title || 'Бросок'}</div>
                          <div className="text-xs text-white/45 mt-0.5">
                            {roll.expression || roll.roll_kind}
                            {roll.outcome ? ` · ${roll.outcome}` : ''}
                            {roll.action_key ? ` · ${roll.action_key}` : ''}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono text-amber-200">
                            [{(roll.dice || []).join(', ')}]
                            {roll.total != null ? ` = ${roll.total}` : ''}
                          </div>
                          <div className="text-[10px] text-white/35 mt-0.5">
                            {new Date(roll.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {selected && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
            <div
              className="w-full max-w-md rounded border border-white/15 bg-zinc-950 p-4 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="font-medium">{selected.title || 'Бросок'}</div>
              <div className="text-sm text-white/60 font-mono">
                [{(selected.dice || []).join(', ')}]
                {selected.total != null ? ` = ${selected.total}` : ''}
              </div>
              {selected.seed_image_url ? (
                <img
                  src={selected.seed_image_url}
                  alt="seed"
                  className="w-full rounded border border-white/10"
                  style={{ imageRendering: 'pixelated' }}
                />
              ) : (
                <div className="text-xs text-white/40">Seed-рисунок не сохранён для этого броска.</div>
              )}
              {selected.seed_hash && (
                <div className="text-[10px] text-white/30 break-all">hash: {selected.seed_hash}</div>
              )}
              <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
                Закрыть
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 bg-zinc-900/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-white/40">{label}</div>
      <div className="text-sm mt-0.5 truncate" title={value}>
        {value}
      </div>
    </div>
  );
}
