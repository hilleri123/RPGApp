'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ApplicationStatusBadge } from '@/app/components/applications/ApplicationStatusBadge';
import {
  applicationArrivalStamp,
  useMasterApplicationInbox,
} from '@/app/services/hooks/useMasterApplicationInbox';
import type { ApplicationListItem } from '@/app/services/types2';

const SEEN_KEY = 'rpg.masterApplicationEventsSeen';

type SeenMap = Record<string, string>;

function readSeen(): SeenMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed as SeenMap : {};
  } catch {
    return {};
  }
}

function writeSeen(seen: SeenMap) {
  const entries = Object.entries(seen).slice(-200);
  window.localStorage.setItem(SEEN_KEY, JSON.stringify(Object.fromEntries(entries)));
}

function ago(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return formatDistanceToNow(date, { addSuffix: true, locale: ru });
}

function isUnseen(app: ApplicationListItem, seen: SeenMap) {
  return seen[app.id] !== applicationArrivalStamp(app);
}

export function MasterApplicationBell({ enabled }: { enabled: boolean }) {
  const { items, loaded } = useMasterApplicationInbox(enabled);
  const [seen, setSeen] = useState<SeenMap>({});
  const [seenReady, setSeenReady] = useState(false);

  useEffect(() => {
    setSeen(readSeen());
    setSeenReady(true);
  }, []);

  if (!enabled) return null;

  const unread = loaded && seenReady ? items.filter((app) => isUnseen(app, seen)).length : 0;

  const markSeen = () => {
    if (!items.length) return;
    const next = { ...readSeen(), ...seen };
    for (const app of items) next[app.id] = applicationArrivalStamp(app);
    writeSeen(next);
    setSeen(next);
  };

  return (
    <DropdownMenu onOpenChange={(open) => { if (open) markSeen(); }}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={unread ? `Заявки на персонажей, новых ${unread}` : 'Заявки на персонажей'}
          className="relative rounded-md p-2 text-gray-300 hover:bg-gray-700 hover:text-white outline-none"
        >
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-yellow-500 text-black text-[10px] font-bold flex items-center justify-center">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 border-gray-700 bg-gray-800 p-0 text-gray-100"
      >
        <div className="px-3 py-2 border-b border-gray-700 text-sm font-medium text-white">
          Заявки на персонажей
        </div>
        <div className="max-h-80 overflow-y-auto">
          {!loaded ? (
            <div className="px-3 py-4 text-sm text-gray-400">Загрузка…</div>
          ) : items.length === 0 ? (
            <div className="px-3 py-4 text-sm text-gray-400">Новых заявок нет</div>
          ) : (
            items.map((app) => {
              const when = ago(applicationArrivalStamp(app));
              const author = app.user?.full_name || 'Игрок';
              return (
                <DropdownMenuItem
                  key={app.id}
                  asChild
                  className="h-auto items-start whitespace-normal focus:bg-gray-700 focus:text-white"
                >
                  <Link
                    href={`/master/applications/${app.id}`}
                    className="flex cursor-pointer flex-col items-start gap-1 rounded-none border-b border-gray-700/80 px-3 py-2.5"
                  >
                    <span className="text-sm text-white whitespace-normal">
                      {author} прислал заявку «{app.name}»
                    </span>
                    <span className="flex items-center gap-2">
                      <ApplicationStatusBadge status={app.status} className="text-[10px] px-1.5 py-0" />
                      {when && <span className="text-[11px] text-gray-400">{when}</span>}
                    </span>
                  </Link>
                </DropdownMenuItem>
              );
            })
          )}
        </div>
        <DropdownMenuItem asChild className="focus:bg-gray-700 focus:text-amber-200">
          <Link href="/master/applications" className="justify-center text-sm text-amber-300">
            Все заявки
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
