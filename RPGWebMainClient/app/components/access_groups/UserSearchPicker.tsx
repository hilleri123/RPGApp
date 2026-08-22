'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { User } from '@/app/services/types/auth';
import { UserRoleBadges, userDisplayName } from './UserRoleBadges';

function norm(s: string) {
  return (s ?? '').toLowerCase().trim();
}

function matchesQuery(user: User, q: string): boolean {
  if (!q) return true;
  const haystack = [
    user.full_name,
    user.email,
    user.telegram_id != null ? String(user.telegram_id) : '',
    user.id,
  ]
    .map(norm)
    .join(' ');
  return haystack.includes(q);
}

export function UserSearchPicker({
  users,
  value,
  onChange,
  placeholder = 'Найти пользователя по имени…',
  disabled = false,
}: {
  users: User[];
  value: string;
  onChange: (userId: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');

  const current = users.find((u) => u.id === value);

  React.useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  const filtered = React.useMemo(() => {
    const nq = norm(q);
    return users.filter((u) => matchesQuery(u, nq));
  }, [users, q]);

  return (
    <Popover open={open} onOpenChange={(v) => !disabled && setOpen(v)} modal>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full min-w-[240px] justify-between bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
          disabled={disabled || users.length === 0}
        >
          <span className="truncate text-left">
            {current ? (
              <span className="inline-flex items-center flex-wrap gap-1">
                {userDisplayName(current)}
                <UserRoleBadges user={current} />
              </span>
            ) : (
              placeholder
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[420px] p-0 bg-gray-900 border-gray-700" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Поиск по имени, email, telegram…"
            value={q}
            onValueChange={setQ}
            className="text-white"
          />
          <CommandEmpty>Пользователи не найдены</CommandEmpty>
          <CommandGroup className="max-h-64 overflow-auto">
            {filtered.map((user) => {
              const selected = user.id === value;
              return (
                <CommandItem
                  key={user.id}
                  value={user.id}
                  onSelect={() => {
                    onChange(user.id);
                    setOpen(false);
                  }}
                  className="text-white"
                >
                  <Check className={cn('mr-2 h-4 w-4', selected ? 'opacity-100' : 'opacity-0')} />
                  <span className="flex flex-col min-w-0">
                    <span className="inline-flex items-center flex-wrap gap-1">
                      <span className="truncate text-gray-100">{userDisplayName(user)}</span>
                      <UserRoleBadges user={user} />
                    </span>
                    {user.email ? (
                      <span className="text-xs text-gray-400 truncate">{user.email}</span>
                    ) : null}
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
