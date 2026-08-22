'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fieldComboboxTrigger } from '@/lib/fieldStyles';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  EntityTagFilterChips,
  collectTagKeysFromItems,
  entityHasAllTags,
} from './EntityTagFilterChips';

export type IdName = { id: string; name: string; tags?: string[] | null };

function norm(s: string) {
  return (s ?? '').toLowerCase().trim();
}

export function EntityComboBox({
  value,
  items,
  placeholder = 'Выбрать...',
  onChange,
  renderItem,
  renderPreview,
  readOnly = false,
  filterItem,
  availableTags,
  enableTagFilter = true,
}: {
  value?: string | null;
  items: IdName[];
  placeholder?: string;
  onChange: (id: string | null) => void;
  renderItem?: (x: IdName, selected: boolean) => React.ReactNode;
  renderPreview?: (id: string) => React.ReactNode;
  readOnly?: boolean;
  filterItem?: (item: IdName, query: string) => boolean;
  /** Extra tag keys (e.g. scenario pool). Merged with tags from items. */
  availableTags?: string[];
  enableTagFilter?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [activeTags, setActiveTags] = React.useState<string[]>([]);

  const current = items.find((x) => x.id === value);

  const tagOptions = React.useMemo(
    () => collectTagKeysFromItems(items, availableTags),
    [items, availableTags],
  );

  // сбрасываем поиск при закрытии
  React.useEffect(() => {
    if (!open) {
      setQ('');
      setActiveTags([]);
    }
  }, [open]);

  const filtered = React.useMemo(() => {
    const nq = norm(q);
    return items.filter((x) => {
      if (!entityHasAllTags(x.tags, activeTags)) return false;
      if (!nq) return true;
      if (filterItem) return filterItem(x, nq);
      return norm(x.name).includes(nq) || norm(x.id).includes(nq);
    });
  }, [items, q, filterItem, activeTags]);

  const showTagFilter = enableTagFilter && tagOptions.length > 0;

  return (
    <TooltipProvider delayDuration={250}>
      <Popover
        open={open}
        onOpenChange={(v) => !readOnly && setOpen(v)}
        modal
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(fieldComboboxTrigger, 'w-full')}
            disabled={readOnly}
          >
            <span className="truncate">{current ? current.name : placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[420px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Поиск..."
              value={q}
              onValueChange={setQ}
            />
            {showTagFilter ? (
              <div className="border-b border-white/10 px-2 py-2">
                <EntityTagFilterChips
                  options={tagOptions}
                  value={activeTags}
                  onChange={setActiveTags}
                />
              </div>
            ) : null}
            <CommandEmpty>Ничего не найдено</CommandEmpty>

            <CommandGroup>
              {filtered.map((x) => {
                const selected = value === x.id;

                const baseRow = (
                  <div className="flex w-full items-center">
                    <Check className={cn('mr-2 h-4 w-4', selected ? 'opacity-100' : 'opacity-0')} />
                    <span className="truncate">{x.name}</span>
                  </div>
                );

                const row = renderItem ? <div className="w-full">{renderItem(x, selected)}</div> : baseRow;

                const content = renderPreview ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="w-full">{row}</div>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="start" className="max-w-[420px]">
                      {renderPreview(x.id)}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  row
                );

                return (
                  <CommandItem
                    key={x.id}
                    value={x.id} // теперь не важно для фильтра, но пусть будет уникальным
                    onSelect={() => {
                      if (readOnly) return;
                      onChange(x.id);
                      setOpen(false);
                    }}
                  >
                    {content}
                  </CommandItem>
                );
              })}

              <CommandItem
                value="__clear__"
                onSelect={() => {
                  if (readOnly) return;
                  onChange(null);
                  setOpen(false);
                }}
              >
                Очистить выбор
              </CommandItem>
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}
