// app/components/application/ApplicationCard.tsx
'use client';

import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { MessageSquare, Package, Clock, BookOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ApplicationStatusBadge } from './ApplicationStatusBadge';
import type { ApplicationListItem } from '@/app/services/types2';

interface Props {
  app: ApplicationListItem;
  onClick?: () => void;
}

export function ApplicationCard({ app, onClick }: Props) {
  const updatedAgo = formatDistanceToNow(new Date(app.updated_at), {
    addSuffix: true,
    locale: ru,
  });

  return (
    <Card
      onClick={onClick}
      className="bg-gray-800 border-gray-700 hover:border-gray-500 transition-colors cursor-pointer"
    >
      <CardContent className="p-4 flex gap-4">
        {/* Аватар */}
        <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gray-700 flex items-center justify-center">
          {app.icon_url ? (
            <img
              src={app.icon_url}
              alt={app.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-2xl text-gray-500">👤</span>
          )}
        </div>

        {/* Основное */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-white font-medium truncate">{app.name}</h3>
              {app.short_desc && (
                <p className="text-gray-400 text-sm truncate">{app.short_desc}</p>
              )}
            </div>
            <ApplicationStatusBadge status={app.status} className="shrink-0" />
          </div>

          {/* Теги */}
          {!!app.tags?.length && (
            <div className="flex flex-wrap gap-1">
              {app.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 rounded text-xs bg-gray-700 text-gray-300"
                >
                  {tag}
                </span>
              ))}
              {app.tags.length > 4 && (
                <span className="px-1.5 py-0.5 rounded text-xs bg-gray-700 text-gray-500">
                  +{app.tags.length - 4}
                </span>
              )}
            </div>
          )}

          {/* Мета */}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              {app.rule_id_str}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {updatedAgo}
            </span>
            {/* показываем автора если мастер смотрит список */}
            {app.user?.full_name && (
              <span className="text-gray-400">{app.user.full_name}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
