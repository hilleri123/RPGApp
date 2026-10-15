'use client';

import { useCallback, useEffect, useState } from 'react';
import { preparedSeedsApi, type PreparedSeed } from '@/app/services/api/preparedSeeds';

const listeners = new Set<() => void>();

export function notifyPreparedSeedsChanged() {
  listeners.forEach((listener) => listener());
}

export function usePreparedSeeds(sessionId: string | undefined) {
  const [items, setItems] = useState<PreparedSeed[]>([]);

  const reload = useCallback(async () => {
    if (!sessionId) {
      setItems([]);
      return;
    }
    try {
      const rows = await preparedSeedsApi.list(sessionId);
      setItems(Array.isArray(rows) ? rows : []);
    } catch {
      setItems([]);
    }
  }, [sessionId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onChange = () => {
      void reload();
    };
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, [reload]);

  const add = useCallback(
    async (image: string) => {
      if (!sessionId) return;
      const row = await preparedSeedsApi.add(sessionId, image);
      setItems((prev) => [...prev, row].sort((a, b) => a.position - b.position));
      notifyPreparedSeedsChanged();
    },
    [sessionId],
  );

  const remove = useCallback(
    async (seedId: string) => {
      if (!sessionId) return;
      await preparedSeedsApi.remove(sessionId, seedId);
      setItems((prev) => prev.filter((item) => item.id !== seedId));
      notifyPreparedSeedsChanged();
    },
    [sessionId],
  );

  const reorder = useCallback(
    async (ids: string[]) => {
      if (!sessionId) return;
      const previous = items;
      const byId = new Map(items.map((item) => [item.id, item]));
      setItems(ids.map((id, position) => ({ ...byId.get(id)!, position })).filter((item) => item.id));
      try {
        const rows = await preparedSeedsApi.reorder(sessionId, ids);
        setItems(rows);
        notifyPreparedSeedsChanged();
      } catch {
        setItems(previous);
      }
    },
    [sessionId, items],
  );

  return { items, count: items.length, reload, add, remove, reorder };
}
