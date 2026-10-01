'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { GameItemWithOwnerShort, GameItemOut, ItemOwnerType, UUID } from '@/app/services/types2';
import { EntityComboBox, type IdName } from './EntityComboBox';
import { ScenarioItemCard } from '../../cards/ItemCard';

type OwnerRef = { type: ItemOwnerType; id: string };

export function InventoryEditor({
  title = 'Инвентарь',
  items,
  value,
  onChange,
  readOnly = false,
  currentOwner,

  // важно: сюда пробрасываешь setForm, чтобы ставить флаг take_from_other_owner
  onMarkTakeFromOtherOwner,
  onUnmarkTakeFromOtherOwner,
  onEditItem,
}: {
  title?: string;
  items: GameItemWithOwnerShort[];
  value: GameItemOut[];
  onChange: (next: GameItemOut[]) => void;
  readOnly?: boolean;
  currentOwner?: OwnerRef;

  onMarkTakeFromOtherOwner?: (itemId: UUID) => void;
  onUnmarkTakeFromOtherOwner?: (itemId: UUID) => void;
  /** Открыть диалог предмета (редактирование или просмотр); без обработчика кнопок на карточке нет. */
  onEditItem?: (itemId: string, viewOnly: boolean) => void;
}) {
  const [picker, setPicker] = useState<string | null>(null);

  const valueIds = useMemo(() => new Set(value.map((v) => String(v.id))), [value]);
  

  const itemsById = useMemo(() => {
    const m: Record<string, GameItemWithOwnerShort> = {};
    for (const it of items) m[String(it.id)] = it;
    return m;
  }, [items]);

  const available = useMemo(() => items.filter((i) => !valueIds.has(String(i.id))), [items, valueIds]);

  const options: IdName[] = useMemo(
    () => available.map((it) => ({ id: String(it.id), name: it.name, tags: (it as any).tags ?? [] })),
    [available]
  );

  const toOut = (it: GameItemWithOwnerShort): GameItemOut => ({
    id: it.id as any,
    name: it.name,
    description_for_master: (it as any).description_for_master ?? null,
    description_for_players: (it as any).description_for_players ?? null,
    icon_url: (it as any).icon_url ?? null,
    img_url: (it as any).img_url ?? null,
    owned_items: (it as any).owned_items ?? [],
  });

  const isOwnedByOther = (it?: GameItemWithOwnerShort | null) => {
    if (!it?.owner) return false;
    if (!currentOwner) return true; // если не знаем кто текущий владелец — считаем "чужим", чтобы не украсть молча
    return !(it.owner.type === currentOwner.type && String(it.owner.id) === String(currentOwner.id));
  };

  const addPicked = () => {
    if (readOnly) return;
    if (!picker) return;

    const it = itemsById[String(picker)];
    if (!it) return;

    const foreign = isOwnedByOther(it);

    if (foreign) {
      const ownerLabel = it.owner ? `${it.owner.type}: ${it.owner.name}` : 'другой владелец';
      const ok = window.confirm(`Предмет сейчас у другого владельца (${ownerLabel}). Отнять и добавить сюда?`);
      if (!ok) return;

      // ставим флаг ТОЛЬКО после подтверждения
      onMarkTakeFromOtherOwner?.(it.id as any);
    }

    onChange([...value, toOut(it)]);
    setPicker(null);
  };

  const removeItem = (id: string) => {
    if (readOnly) return;
    onChange(value.filter((v) => String(v.id) !== String(id)));

    // если ранее подтверждали "отнять", а потом удалили из инвентаря — сбросим флаг
    onUnmarkTakeFromOtherOwner?.(id as any);
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-white">{title}</div>

      {!readOnly ? (
        <div className="flex gap-2 items-start">
          <div className="flex-1">
            <EntityComboBox
              value={picker}
              items={options}
              placeholder="Добавить предмет..."
              readOnly={readOnly}
              onChange={(id) => setPicker(id)}
              // подсветка "чужих" в выдаче
              renderItem={(x, selected) => {
                const it = itemsById[x.id];
                const danger = isOwnedByOther(it);

                return (
                  <div
                    className={cn(
                      'w-full rounded-md px-2 py-1',
                      selected && 'bg-white/5',
                      danger && 'bg-red-500/15'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className={cn('truncate', danger ? 'text-red-200' : 'text-gray-100')}>{x.name}</div>
                      {danger ? <div className="text-[11px] text-red-300 shrink-0">У другого</div> : null}
                    </div>
                    {danger && it?.owner ? (
                      <div className="text-[11px] text-red-300/90 truncate">
                        {it.owner.type}: {it.owner.name}
                      </div>
                    ) : null}
                  </div>
                );
              }}
              // тултип карточкой
              renderPreview={(id) => {
                const it = itemsById[String(id)];
                if (!it) return <div className="text-sm text-gray-200">Не найдено</div>;

                const danger = isOwnedByOther(it);

                return (
                  <div className="min-w-[320px] max-w-[420px] pointer-events-none select-none">
                    <ScenarioItemCard item={it} />
                    {danger && it.owner ? (
                      <div className="mt-2 text-xs text-red-300">
                        Сейчас у: {it.owner.type} — {it.owner.name}
                      </div>
                    ) : null}
                  </div>
                );
              }}
            />
          </div>

          <Button type="button" onClick={addPicked} disabled={!picker}>
            Добавить
          </Button>
        </div>
      ) : null}

      {value.length === 0 ? (
        <div className="text-xs text-gray-400">Пока нет предметов.</div>
      ) : (
        <div className="space-y-2">
          {value.map((it) => {
            const ref = itemsById[String(it.id)];
            const danger = isOwnedByOther(ref);

            return (
              <div
                key={String(it.id)}
                className={cn('border border-gray-700 rounded-md p-2', danger ? 'bg-red-500/10' : 'bg-gray-950')}
              >
                <ScenarioItemCard
                  item={it}
                  readOnly={readOnly}
                  onEdit={
                    onEditItem
                      ? (item, viewOnly) => onEditItem(String(item.id), viewOnly || readOnly)
                      : undefined
                  }
                  onDelete={readOnly ? undefined : () => removeItem(String(it.id))}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
