'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RuleTemplatesApiService } from '../../api/templates';


export function useTemplateObjectsList<TList>(opts: {
  // контекст шаблонов
  templateSetId: string;

  enabled?: boolean;

  load: (api: RuleTemplatesApiService) => Promise<TList[]>;
  sort?: (items: TList[]) => TList[];

  remove?: (api: RuleTemplatesApiService, id: string) => Promise<any>;
  getId?: (item: TList) => string;
}) {
  const { templateSetId, enabled = true, load, sort } = opts;
  const api = useMemo(() => new RuleTemplatesApiService(templateSetId), [templateSetId]);

  const [items, setItems] = useState<TList[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getId = useCallback(
    (x: TList) => (opts.getId ? opts.getId(x) : String((x as any)?.id)),
    [opts.getId],
  );

  const refetch = useCallback(async () => {
    if (!enabled) return null;

    setLoading(true);
    setError(null);

    try {
      const res = await load(api);
      const next = sort ? sort(res) : res;
      setItems(next);
      return next;
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load list');
      return null;
    } finally {
      setLoading(false);
    }
  }, [api, enabled, load, sort]);

  // грузим:
  // - при смене ruleIdStr/templateSetId
  // - при enabled=true (первое включение)
  const didLoadRef = useRef<{ key: string | null; enabled: boolean }>({ key: null, enabled: false });

  useEffect(() => {
    const prev = didLoadRef.current;

    if (!enabled) {
      didLoadRef.current = { key: templateSetId, enabled: false };
      return;
    }

    const key = templateSetId;
    const needLoad = prev.key !== key || prev.enabled === false;

    didLoadRef.current = { key, enabled: true };

    if (needLoad) void refetch();
  }, [templateSetId, enabled]); // специально без refetch

  const itemsRef = useRef<TList[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const removeById = useCallback(
    async (id: string, opts2?: { optimistic?: boolean; refetchAfter?: boolean }) => {
      if (!opts.remove) throw new Error('remove() is not provided for this list hook');

      const optimistic = opts2?.optimistic ?? true;
      const refetchAfter = opts2?.refetchAfter ?? false;

      setError(null);

      let prev: TList[] | null = null;
      if (optimistic) {
        prev = itemsRef.current;
        setItems((xs) => xs.filter((x) => getId(x) !== String(id)));
      }

      try {
        await opts.remove(api, String(id));
        if (refetchAfter) await refetch();
        return { ok: true };
      } catch (e: any) {
        if (optimistic && prev) setItems(prev);
        setError(e?.message ?? 'Failed to delete');
        return { ok: false, error: e?.message ?? 'Failed to delete' };
      }
    },
    [api, getId, opts.remove, refetch],
  );

  return { items, loading, error, refetch, setItems, removeById };
}
