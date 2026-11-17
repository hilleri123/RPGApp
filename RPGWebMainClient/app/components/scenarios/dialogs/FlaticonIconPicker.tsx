'use client';

import { useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ApiError } from '@/app/services/api/base';
import { flaticonApi, FlaticonHit } from '@/app/services/api/flaticon';

export function FlaticonIconPicker({ onPicked }: { onPicked: (file: File) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<FlaticonHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    const term = query.trim();
    if (!term) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const result = await flaticonApi.search(term);
      setHits(result.items);
    } catch (err) {
      setHits([]);
      setError(err instanceof ApiError ? err.message : 'Не удалось выполнить поиск');
    } finally {
      setLoading(false);
    }
  };

  const pick = async (hit: FlaticonHit) => {
    setPicking(hit.id);
    setError(null);
    try {
      const file = await flaticonApi.download(hit);
      onPicked(file);
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось скачать иконку');
    } finally {
      setPicking(null);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="sm"
        title="Найти иконку"
        onClick={() => setOpen(true)}
      >
        <Search className="w-4 h-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Найти иконку</DialogTitle>
          </DialogHeader>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void search();
            }}
          >
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Например, дракон"
              className="bg-gray-950 border-gray-700"
            />
            <Button type="submit" disabled={loading || !query.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Найти'}
            </Button>
          </form>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <div className="grid grid-cols-4 gap-2 max-h-72 overflow-y-auto">
            {hits.map((hit) => (
              <button
                key={hit.id}
                type="button"
                title={`designed by ${hit.author_name} from Flaticon`}
                disabled={picking !== null}
                onClick={() => void pick(hit)}
                className="aspect-square rounded border border-gray-700 bg-gray-950 hover:border-blue-500 overflow-hidden disabled:opacity-60"
              >
                {picking === hit.id ? (
                  <span className="flex h-full items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </span>
                ) : (
                  <img src={hit.preview_url} alt="" className="h-full w-full object-contain p-1" />
                )}
              </button>
            ))}
          </div>
          {searched && !loading && !error && hits.length === 0 ? (
            <p className="text-sm text-gray-400">Ничего не нашлось.</p>
          ) : null}
          <p className="text-xs text-gray-500">
            Иконки{' '}
            <a href="https://www.flaticon.com/ru/free-icons/" className="underline" target="_blank" rel="noreferrer">
              Flaticon
            </a>
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
