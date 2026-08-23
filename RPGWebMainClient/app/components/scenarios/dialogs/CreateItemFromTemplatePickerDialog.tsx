'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { ScenarioScopedApiService } from '@/app/services/api/scenario_scoped';
import type { ScenarioTemplateListItem } from '@/app/services/types2/template_entity';

export type TemplateItemPick = {
  templateId: string;
  packId: string;
  name: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  scenarioId: string;
  /** Fallback pack when list item has no template_pack_id */
  defaultPackId?: string | null;
  onPick: (pick: TemplateItemPick) => void;
};

export function CreateItemFromTemplatePickerDialog({
  open,
  onClose,
  scenarioId,
  defaultPackId,
  onPick,
}: Props) {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<ScenarioTemplateListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const api = useMemo(() => new ScenarioScopedApiService(scenarioId), [scenarioId]);

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setError(null);
    try {
      const rows = (await api.getTemplateItems({ skip: 0, limit: 1000 })) as ScenarioTemplateListItem[];
      setItems(rows);
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось загрузить шаблоны предметов');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [open, api]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setItems([]);
      setError(null);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => String(it.name ?? '').toLowerCase().includes(q));
  }, [items, search]);

  const pick = (item: ScenarioTemplateListItem) => {
    const packId = String(item.template_pack_id ?? defaultPackId ?? '');
    if (!packId) {
      setError('У шаблона не указан пак — нельзя загрузить данные');
      return;
    }
    onPick({
      templateId: String(item.id),
      packId,
      name: String(item.name ?? ''),
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Создать предмет из шаблона</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Выберите шаблонный предмет сценария. Откроется форма создания с заполненными полями.
        </p>

        <Input
          placeholder="Поиск по имени…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {error ? <div className="text-sm text-red-400">{error}</div> : null}

        <div className="max-h-80 overflow-y-auto space-y-1 border border-gray-700 rounded-md p-1">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 p-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              Загрузка…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-gray-400 p-3">Нет доступных шаблонов предметов</div>
          ) : (
            filtered.map((item) => (
              <Button
                key={String(item.id)}
                type="button"
                variant="ghost"
                className="w-full justify-start h-auto py-2 px-3"
                onClick={() => pick(item)}
              >
                <div className="text-left min-w-0">
                  <div className="truncate font-medium">{item.name}</div>
                  {item.template_pack_name ? (
                    <div className="text-[11px] text-gray-500 truncate">{item.template_pack_name}</div>
                  ) : null}
                </div>
              </Button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
