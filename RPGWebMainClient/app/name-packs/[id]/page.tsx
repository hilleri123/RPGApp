'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Header from '@/app/components/layout/Header';
import {
  namePacksApiService,
  type NamePack,
  type NamePackEntry,
  type NamePartKind,
} from '@/app/services/api/namePacks';
import { EntityPackTagBadges } from '@/app/components/entity-packs/EntityPackTagBadges';
import { Loader2, Trash2 } from 'lucide-react';

const PART_OPTIONS: { value: NamePartKind; label: string }[] = [
  { value: 'given', label: 'Имя' },
  { value: 'family', label: 'Фамилия' },
  { value: 'nickname', label: 'Прозвище' },
  { value: 'full', label: 'Целиком' },
];

const DEFAULT_ENTRY_TAGS = 'npc,character';

export default function NamePackDetailPage() {
  const params = useParams();
  const packId = String(params?.id ?? '');

  const [pack, setPack] = useState<NamePack | null>(null);
  const [entries, setEntries] = useState<NamePackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkPart, setBulkPart] = useState<NamePartKind>('given');
  const [bulkTags, setBulkTags] = useState(DEFAULT_ENTRY_TAGS);
  const [bulkLines, setBulkLines] = useState('');
  const [singleText, setSingleText] = useState('');
  const [singlePart, setSinglePart] = useState<NamePartKind>('given');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!packId) return;
    setLoading(true);
    try {
      const [p, e] = await Promise.all([
        namePacksApiService.getPack(packId),
        namePacksApiService.listEntries(packId),
      ]);
      setPack(p);
      setEntries(e);
    } finally {
      setLoading(false);
    }
  }, [packId]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const m: Record<NamePartKind, NamePackEntry[]> = { given: [], family: [], nickname: [], full: [] };
    for (const e of entries) {
      const k = (e.part_kind || 'full') as NamePartKind;
      m[k].push(e);
    }
    return m;
  }, [entries]);

  const parseTags = (raw: string) =>
    raw
      .split(/[,;\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);

  const addSingle = async () => {
    if (!singleText.trim()) return;
    setBusy(true);
    try {
      await namePacksApiService.createEntry(packId, {
        text: singleText.trim(),
        part_kind: singlePart,
        tags: parseTags(bulkTags),
      });
      setSingleText('');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const bulkImport = async () => {
    if (!bulkLines.trim()) return;
    setBusy(true);
    try {
      await namePacksApiService.bulkEntries(packId, {
        lines: bulkLines,
        part_kind: bulkPart,
        tags: parseTags(bulkTags),
      });
      setBulkLines('');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const removeEntry = async (entryId: string) => {
    setBusy(true);
    try {
      await namePacksApiService.deleteEntry(packId, entryId);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const title = pack?.name ?? 'Пак имён';

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header section={title} />
      <main className="container mx-auto px-4 py-6 space-y-6 max-w-3xl">
        <Link href="/name-packs" className="text-sm text-gray-400 hover:text-white">
          ← Все паки имён
        </Link>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Загрузка…
          </div>
        ) : !pack ? (
          <p className="text-red-400">Пак не найден</p>
        ) : (
          <>
            <div>
              <h1 className="text-xl font-semibold">{pack.name}</h1>
              <EntityPackTagBadges tags={pack.tags ?? []} className="mt-2" />
              <p className="text-xs text-gray-600 font-mono mt-2">{pack.id}</p>
            </div>

            <div className="rounded-xl border border-white/10 p-4 space-y-3">
              <h2 className="text-sm font-medium">Добавить одну запись</h2>
              <div className="flex flex-wrap gap-2">
                <Input
                  className="flex-1 min-w-[12rem]"
                  placeholder="Текст"
                  value={singleText}
                  onChange={(e) => setSingleText(e.target.value)}
                />
                <select
                  className="rounded-md border border-white/10 bg-gray-950 px-2 py-2 text-sm"
                  value={singlePart}
                  onChange={(e) => setSinglePart(e.target.value as NamePartKind)}
                >
                  {PART_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <Button disabled={busy || !singleText.trim()} onClick={() => void addSingle()}>
                  Добавить
                </Button>
              </div>
              <Input
                placeholder="Теги через запятую (npc, human, male…)"
                value={bulkTags}
                onChange={(e) => setBulkTags(e.target.value)}
              />
            </div>

            <div className="rounded-xl border border-white/10 p-4 space-y-3">
              <h2 className="text-sm font-medium">Импорт списком</h2>
              <div className="flex gap-2 flex-wrap">
                <select
                  className="rounded-md border border-white/10 bg-gray-950 px-2 py-2 text-sm"
                  value={bulkPart}
                  onChange={(e) => setBulkPart(e.target.value as NamePartKind)}
                >
                  {PART_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <Textarea
                placeholder="По одной строке на запись"
                rows={6}
                value={bulkLines}
                onChange={(e) => setBulkLines(e.target.value)}
              />
              <Button disabled={busy || !bulkLines.trim()} variant="secondary" onClick={() => void bulkImport()}>
                Импортировать
              </Button>
            </div>

            {PART_OPTIONS.map(({ value, label }) => {
              const rows = grouped[value];
              if (!rows.length) return null;
              return (
                <div key={value} className="space-y-2">
                  <h3 className="text-sm text-gray-400">
                    {label} <span className="text-gray-600">({rows.length})</span>
                  </h3>
                  <ul className="rounded-lg border border-white/10 divide-y divide-white/5">
                    {rows.map((row) => (
                      <li key={row.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                        <span className="flex-1">{row.text}</span>
                        <span className="text-[10px] text-gray-500 truncate max-w-[8rem]">
                          {(row.tags ?? []).join(', ')}
                        </span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0 text-red-400"
                          disabled={busy}
                          onClick={() => void removeEntry(row.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </>
        )}
      </main>
    </div>
  );
}
