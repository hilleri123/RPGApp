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
import { entityPacksApiService } from '@/app/services/api/entityPacks';
import type { TemplateEntityBrowseItem, TemplateEntityKind } from '@/app/services/types2/template_entity';

const KIND_LABEL: Record<TemplateEntityKind, string> = {
  npc: 'NPC',
  game_item: 'предмет',
  player_character: 'персонаж',
};

type Props = {
  open: boolean;
  onClose: () => void;
  entityKind: TemplateEntityKind;
  onImported: () => void;
  scenarioId?: string;
  packId?: string;
};

export function ImportExistingTemplateDialog({
  open,
  onClose,
  scenarioId,
  packId,
  entityKind,
  onImported,
}: Props) {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<TemplateEntityBrowseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const targetId = packId ?? scenarioId;

  const load = useCallback(async () => {
    if (!open || !targetId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = packId
        ? await entityPacksApiService.browseTemplatesForPack(packId, entityKind, {
            search: search.trim() || undefined,
            limit: 200,
          })
        : await entityPacksApiService.browseTemplatesForScenario(targetId, entityKind, {
            search: search.trim() || undefined,
            limit: 200,
          });
      setItems(rows);
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось загрузить шаблоны');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [open, targetId, packId, entityKind, search]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => void load(), search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [open, load, search]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setItems([]);
      setError(null);
    }
  }, [open]);

  const title = useMemo(() => `Добавить шаблонный ${KIND_LABEL[entityKind]}`, [entityKind]);

  const importOne = async (item: TemplateEntityBrowseItem) => {
    if (!targetId) return;
    setBusyId(item.id);
    setError(null);
    try {
      if (packId) {
        await entityPacksApiService.addPackMember(packId, {
          entity_kind: entityKind,
          entity_id: item.id,
        });
      } else {
        await entityPacksApiService.linkTemplateEntity(targetId, {
          entity_kind: entityKind,
          entity_id: item.id,
        });
      }
      onImported();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось добавить шаблон');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {packId
            ? 'Выберите существующий шаблон из других паков с той же системой правил.'
            : 'Выберите существующий шаблон из других паков или сценариев с той же системой правил.'}
        </p>

        <Input
          placeholder="Поиск по имени…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {error ? <p className="text-sm text-red-500">{error}</p> : null}

        <div className="max-h-80 overflow-y-auto space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Нет доступных шаблонов для добавления
            </p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg border px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{item.name}</div>
                  {item.template_pack_name ? (
                    <div className="text-xs text-muted-foreground truncate">
                      Пак: {item.template_pack_name}
                    </div>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={busyId === item.id}
                  onClick={() => void importOne(item)}
                >
                  {busyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Добавить'}
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
