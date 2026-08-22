// app/master/applications/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Filter, RefreshCw, Eye, Edit2,
  CheckCircle, XCircle, Clock, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ApplicationStatusBadge } from '@/app/components/applications/ApplicationStatusBadge';
import { useAccessGate } from '@/app/components/layout/AccessDenied';
import { masterApplicationApiService } from '@/app/services/api/application';
import type { ApplicationListItem, ApplicationStatus } from '@/app/services/types2';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

// ── порядок приоритета статусов ───────────────────────────────────────────────
const STATUS_ORDER: ApplicationStatus[] = [
  'submitted', 'in_review', 'needs_changes', 'draft', 'approved', 'rejected',
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '_all',          label: 'Все статусы' },
  { value: 'submitted',     label: 'Отправлена' },
  { value: 'in_review',     label: 'На проверке' },
  { value: 'needs_changes', label: 'Нужны правки' },
  { value: 'draft',         label: 'Черновик' },
  { value: 'approved',      label: 'Одобрена' },
  { value: 'rejected',      label: 'Отклонена' },
];

function fmtAgo(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ru });
}

// ── строка заявки ─────────────────────────────────────────────────────────────
function AppRow({
  app,
  onClick,
}: {
  app: ApplicationListItem;
  onClick: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className="border-b border-gray-700 hover:bg-gray-800 cursor-pointer transition-colors"
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-700 shrink-0 overflow-hidden flex items-center justify-center">
            {app.icon_url
              ? <img src={app.icon_url} alt="" className="w-full h-full object-cover" />
              : <span className="text-gray-500 text-lg">👤</span>}
          </div>
          <div className="min-w-0">
            <div className="text-white font-medium truncate max-w-[200px]">{app.name}</div>
            <div className="text-gray-500 text-xs">{app.rule_id_str}</div>
          </div>
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="text-gray-300 text-sm">{app.user?.full_name ?? '—'}</div>
      </td>
      <td className="py-3 px-4">
        <ApplicationStatusBadge status={app.status} />
      </td>
      <td className="py-3 px-4 text-gray-400 text-sm whitespace-nowrap">
        {fmtAgo(app.updated_at)}
      </td>
      <td className="py-3 px-4">
        {app.tags?.slice(0, 3).map((t) => (
          <span key={t} className="mr-1 px-1.5 py-0.5 rounded text-xs bg-gray-700 text-gray-400">
            {t}
          </span>
        ))}
      </td>
    </tr>
  );
}

// ── страница ──────────────────────────────────────────────────────────────────
export default function MasterApplicationsPage() {
  const gate = useAccessGate('master');
  if (gate) return gate;
  return <MasterApplications />;
}

function MasterApplications() {
  const router = useRouter();

  const [apps, setApps]           = useState<ApplicationListItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('_all');
  const [ruleFilter, setRule]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await masterApplicationApiService.getList({
        status:      statusFilter !== '_all' ? statusFilter : undefined,
        rule_id_str: ruleFilter || undefined,
        limit:       500,
      });
      // сортируем по приоритету статуса, затем по дате
      data.sort((a, b) => {
        const ai = STATUS_ORDER.indexOf(a.status as ApplicationStatus);
        const bi = STATUS_ORDER.indexOf(b.status as ApplicationStatus);
        if (ai !== bi) return ai - bi;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
      setApps(data);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, ruleFilter]);

  useEffect(() => { void load(); }, [load]);

  // локальная фильтрация по имени / игроку
  const visible = apps.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.rule_id_str.toLowerCase().includes(q) ||
      (a.user?.full_name ?? '').toLowerCase().includes(q)
    );
  });

  // счётчики по статусам для шапки
  const pending = apps.filter(
    (a) => a.status === 'submitted' || a.status === 'in_review',
  ).length;

  // уникальные rule_id_str для фильтра
  const rules = Array.from(new Set(apps.map((a) => a.rule_id_str)));

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* Шапка */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Заявки игроков</h1>
            {pending > 0 && (
              <p className="text-yellow-400 text-sm mt-0.5">
                {pending} заявк{pending === 1 ? 'а требует' : 'и требуют'} внимания
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-gray-600 gap-1.5"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </div>

        {/* Фильтры */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Имя, игрок, система..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-gray-800 border-gray-600 text-white placeholder:text-gray-500"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatus}>
            <SelectTrigger className="w-44 bg-gray-800 border-gray-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {rules.length > 1 && (
            <Select value={ruleFilter || '_all'} onValueChange={(v) => setRule(v === '_all' ? '' : v)}>
              <SelectTrigger className="w-44 bg-gray-800 border-gray-600 text-white">
                <SelectValue placeholder="Система правил" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="_all" className="text-white">Все системы</SelectItem>
                {rules.map((r) => (
                  <SelectItem key={r} value={r} className="text-white">{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Таблица */}
        {loading ? (
          <div className="text-gray-500 py-12 text-center">Загрузка...</div>
        ) : visible.length === 0 ? (
          <div className="text-gray-500 py-12 text-center">Заявок не найдено</div>
        ) : (
          <div className="rounded-lg border border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wide">
                <tr>
                  <th className="py-2 px-4 text-left">Персонаж</th>
                  <th className="py-2 px-4 text-left">Игрок</th>
                  <th className="py-2 px-4 text-left">Статус</th>
                  <th className="py-2 px-4 text-left">Обновлена</th>
                  <th className="py-2 px-4 text-left">Теги</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((app) => (
                  <AppRow
                    key={app.id}
                    app={app}
                    onClick={() => router.push(`/master/applications/${app.id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}