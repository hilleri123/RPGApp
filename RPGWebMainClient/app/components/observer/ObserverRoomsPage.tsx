'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, Loader2, RefreshCw, Search, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { observerApiService } from '@/app/services/api/observer';
import type {
  ObserverRoomPreview,
  ObserverRoomSort,
  ObserverRoomSortOrder,
} from '@/app/services/types/observer';
import { cn } from '@/lib/utils';

const SORT_LABELS: Record<ObserverRoomSort, string> = {
  created: 'По дате',
  name: 'По сессии',
  scenario: 'По сценарию',
  master: 'По мастеру',
  players: 'По игрокам',
};

function formatCreatedAt(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function ObserverRoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<ObserverRoomPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<ObserverRoomSort>('created');
  const [order, setOrder] = useState<ObserverRoomSortOrder>('desc');
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await observerApiService.listRooms({ search: search || undefined, sort, order });
      setRooms(data);
    } catch {
      setError('Не удалось загрузить список комнат для наблюдения');
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, [search, sort, order]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCode = (raw: string) => {
    const code = raw.trim().toUpperCase().replace(/[\s-]/g, '');
    if (!code) return;
    router.push(`/session-obs/${encodeURIComponent(code)}`);
  };

  const emptyHint = useMemo(() => {
    if (search) return 'Ничего не найдено — попробуйте другой запрос или введите код вручную.';
    return 'Сейчас нет открытых комнат с кодами наблюдателя. Мастер создаёт код в настройках сессии.';
  }, [search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Eye className="w-7 h-7 text-violet-400" />
            Наблюдение за играми
          </h1>
          <p className="text-gray-400 text-sm mt-1 max-w-2xl">
            Выберите активную сессию или введите код от мастера — вход без аккаунта.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-gray-600 text-gray-200 shrink-0"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
          Обновить
        </Button>
      </div>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">Код наблюдателя</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-2">
          <Input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
            placeholder="Например AB12CD"
            className="bg-gray-900 border-gray-600 text-white font-mono tracking-wider max-w-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter') openCode(manualCode);
            }}
          />
          <Button type="button" className="bg-violet-600 hover:bg-violet-500" onClick={() => openCode(manualCode)}>
            Открыть
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Поиск: сессия, сценарий, мастер, код…"
            className="pl-9 bg-gray-800 border-gray-600 text-white"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center text-sm">
          <label className="text-gray-400 flex items-center gap-2">
            Сортировка
            <select
              className="bg-gray-800 border border-gray-600 rounded-md px-2 py-1.5 text-gray-100"
              value={sort}
              onChange={(e) => setSort(e.target.value as ObserverRoomSort)}
            >
              {(Object.keys(SORT_LABELS) as ObserverRoomSort[]).map((k) => (
                <option key={k} value={k}>
                  {SORT_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <select
            className="bg-gray-800 border border-gray-600 rounded-md px-2 py-1.5 text-gray-100"
            value={order}
            onChange={(e) => setOrder(e.target.value as ObserverRoomSortOrder)}
          >
            <option value="desc">По убыванию</option>
            <option value="asc">По возрастанию</option>
          </select>
        </div>
      </div>

      {error ? (
        <div className="text-sm text-red-300 bg-red-950/40 border border-red-800 rounded-lg px-3 py-2">{error}</div>
      ) : null}

      {loading && rooms.length === 0 ? (
        <div className="flex items-center gap-2 text-gray-400 py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          Загрузка комнат…
        </div>
      ) : rooms.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">{emptyHint}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rooms.map((room) => (
            <Card
              key={`${room.session_id}-${room.code}`}
              className="bg-gray-800 border-gray-700 hover:border-violet-500/40 transition-colors"
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-white leading-snug">{room.session_name}</CardTitle>
                <p className="text-sm text-gray-400">{room.scenario_name || 'Сценарий не указан'}</p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between text-gray-400">
                  <span>Мастер</span>
                  <span className="text-gray-200 truncate ml-2 max-w-[60%] text-right">{room.master_name || '—'}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Игроков</span>
                  <span className="text-gray-200">{room.player_count}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Код</span>
                  <span className="font-mono text-violet-300 tracking-wide">{room.code}</span>
                </div>
                <div className="flex justify-between text-gray-400 text-xs">
                  <span>Начало</span>
                  <span className="text-gray-500">{formatCreatedAt(room.created_at)}</span>
                </div>
                <Link href={`/session-obs/${encodeURIComponent(room.code)}`} className="block pt-1">
                  <Button type="button" className="w-full bg-violet-600 hover:bg-violet-500">
                    <Eye className="w-4 h-4 mr-2" />
                    Смотреть
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
