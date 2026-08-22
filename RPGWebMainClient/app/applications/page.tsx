'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Loader2, ScrollText, User, ChevronRight,
  Trash2, Clock, CheckCircle2, XCircle, AlertCircle,
  Eye, FileEdit, Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import Header from '@/app/components/layout/Header';
import { RequireAuth } from '@/app/components/auth/RequireAuth';
import { useAuth } from '@/app/services/hooks/useAuth';
import { applicationApiService } from '@/app/services/api/application';
import { ApplicationListItem, ApplicationStatus } from '@/app/services/types2';
import { ApplicationCreateFlow } from '@/app/components/applications/ApplicationCreateFlow';

// ── Конфиг статусов ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; badgeCls: string; icon: React.ReactNode; rowCls: string }
> = {
  draft: {
    label: 'Черновик',
    badgeCls: 'bg-gray-600 text-gray-200 border-gray-500',
    icon: <FileEdit className="w-3.5 h-3.5" />,
    rowCls: 'border-l-gray-600',
  },
  submitted: {
    label: 'На проверке',
    badgeCls: 'bg-blue-700 text-blue-100 border-blue-600',
    icon: <Send className="w-3.5 h-3.5" />,
    rowCls: 'border-l-blue-600',
  },
  in_review: {
    label: 'Просматривают',
    badgeCls: 'bg-yellow-700 text-yellow-100 border-yellow-600',
    icon: <Eye className="w-3.5 h-3.5" />,
    rowCls: 'border-l-yellow-500',
  },
  needs_changes: {
    label: 'Нужны правки',
    badgeCls: 'bg-orange-700 text-orange-100 border-orange-600',
    icon: <AlertCircle className="w-3.5 h-3.5" />,
    rowCls: 'border-l-orange-500',
  },
  approved: {
    label: 'Одобрено',
    badgeCls: 'bg-green-700 text-green-100 border-green-600',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    rowCls: 'border-l-green-500',
  },
  rejected: {
    label: 'Отклонено',
    badgeCls: 'bg-red-800 text-red-200 border-red-700',
    icon: <XCircle className="w-3.5 h-3.5" />,
    rowCls: 'border-l-red-600',
  },
};

const FILTER_TABS: { value: ApplicationStatus | 'all'; label: string }[] = [
  { value: 'all',           label: 'Все' },
  { value: 'draft',         label: 'Черновики' },
  { value: 'submitted',     label: 'На проверке' },
  { value: 'in_review',     label: 'Просматривают' },
  { value: 'needs_changes', label: 'Нужны правки' },
  { value: 'approved',      label: 'Одобрено' },
  { value: 'rejected',      label: 'Отклонено' },
];


// ── Компонент карточки ────────────────────────────────────────────────────────

function AppCard({
  app,
  onDeleted,
}: {
  app: ApplicationListItem;
  onDeleted: (id: string) => void;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const cfg = STATUS_CONFIG[app.status];
  const canDelete = app.status === 'draft' || app.status === 'rejected';

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Удалить заявку «${app.name}»?`)) return;
    setDeleting(true);
    try {
      await applicationApiService.remove(app.id);
      onDeleted(app.id);
    } catch {
      setDeleting(false);
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
    >
      <Card
        onClick={() => router.push(`/applications/${app.id}`)}
        className={`bg-gray-800 border-gray-700 border-l-4 ${cfg.rowCls} hover:bg-gray-750 hover:border-gray-500 cursor-pointer transition-all duration-150`}
      >
        <CardContent className="p-4 flex items-center gap-4">
          {/* Аватар */}
          <div className="w-11 h-11 rounded-full bg-gray-700 flex-shrink-0 overflow-hidden flex items-center justify-center border border-gray-600">
            {app.icon_url ? (
              <img src={app.icon_url} alt={app.name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-5 h-5 text-gray-500" />
            )}
          </div>

          {/* Инфо */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="text-white font-semibold truncate text-sm leading-tight">
                {app.name}
              </span>
              <Badge
                className={`flex items-center gap-1 text-xs px-1.5 py-0.5 border ${cfg.badgeCls}`}
              >
                {cfg.icon}
                {cfg.label}
              </Badge>
              {app.status === 'needs_changes' && (
                <span className="text-orange-400 text-xs animate-pulse">● ответьте мастеру</span>
              )}
            </div>

            {app.short_desc && (
              <p className="text-gray-400 text-xs truncate">{app.short_desc}</p>
            )}

            <div className="flex items-center gap-3 mt-1">
              <span className="text-gray-600 text-xs">{app.rule_id_str}</span>
              <span className="text-gray-700 text-xs">·</span>
              <span className="text-gray-600 text-xs flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(app.updated_at).toLocaleDateString('ru', {
                  day: '2-digit', month: 'short',
                })}
              </span>
              {app.tags && app.tags.length > 0 && (
                <>
                  <span className="text-gray-700 text-xs">·</span>
                  <div className="flex gap-1">
                    {app.tags.slice(0, 3).map((t) => (
                      <span key={t} className="text-gray-500 text-xs bg-gray-700 px-1.5 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Действия */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="p-1.5 rounded text-red-500 hover:text-red-300 hover:bg-red-900/30 transition-colors"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            )}
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}


// ── Пустое состояние ──────────────────────────────────────────────────────────

function EmptyState({ filtered }: { filtered: boolean }) {
  const router = useRouter();
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mb-4 border border-gray-700">
        <ScrollText className="w-8 h-8 text-gray-600" />
      </div>
      <p className="text-gray-300 text-lg font-medium mb-1">
        {filtered ? 'Нет заявок с таким статусом' : 'Заявок пока нет'}
      </p>
      <p className="text-gray-600 text-sm mb-6 max-w-xs">
        {filtered
          ? 'Попробуйте выбрать другой фильтр'
          : 'Создайте персонажа и отправьте заявку мастеру на согласование'}
      </p>
      {!filtered && (
        <Button
          onClick={() => router.push('/applications/new')}
          className="bg-blue-600 hover:bg-blue-500 gap-2"
        >
          <Plus className="w-4 h-4" />
          Создать персонажа
        </Button>
      )}
    </motion.div>
  );
}


// ── Счётчики по статусам ──────────────────────────────────────────────────────

function countByStatus(apps: ApplicationListItem[]) {
  return apps.reduce<Partial<Record<ApplicationStatus, number>>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});
}


// ── Главная страница ──────────────────────────────────────────────────────────

export default function ApplicationsPage() {
  return (
    <RequireAuth>
      <ApplicationsPageContent />
    </RequireAuth>
  );
}

function ApplicationsPageContent() {
  const router = useRouter();
  const { state } = useAuth();

  const [apps, setApps] = useState<ApplicationListItem[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ApplicationStatus | 'all'>('all');

  useEffect(() => {
    if (state.loading || !state.isAuthenticated) return;
    applicationApiService
      .getList()
      .then(setApps)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [state.isAuthenticated, state.loading]);

  const counts = countByStatus(apps);
  const filtered =
    activeFilter === 'all' ? apps : apps.filter((a) => a.status === activeFilter);

  const needsAttention = apps.filter(
    (a) => a.status === 'needs_changes' || a.status === 'submitted',
  ).length;

  return (
    <div
      className="min-h-screen flex flex-col bg-gray-900"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <Header />

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Заголовок */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-600/30 flex items-center justify-center">
              <ScrollText className="w-4.5 h-4.5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-white text-xl font-bold leading-tight">Мои персонажи</h1>
              {!loading && (
                <p className="text-gray-500 text-xs">
                  {apps.length} заявок
                  {needsAttention > 0 && (
                    <span className="text-orange-400 ml-2">· {needsAttention} требуют внимания</span>
                  )}
                </p>
              )}
            </div>
          </div>
          <Button onClick={() => setCreateOpen(true)} size="sm" className="bg-blue-600 hover:bg-blue-500 gap-1.5">
            <Plus className="w-4 h-4" /> Создать
          </Button>
        </div>

        <ApplicationCreateFlow
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSaved={(id) => router.push(`/applications/${id}`)}
        />

        {/* Фильтры */}
        {!loading && apps.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-5">
            {FILTER_TABS.map((tab) => {
              const count =
                tab.value === 'all' ? apps.length : (counts[tab.value as ApplicationStatus] ?? 0);
              if (tab.value !== 'all' && count === 0) return null;
              const isActive = activeFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveFilter(tab.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 border border-gray-700'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Контент */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-gray-500 text-sm">Загружаем заявки...</p>
          </div>
        ) : error ? (
          <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-6 text-center">
            <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-300">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 border-red-700 text-red-400"
              onClick={() => window.location.reload()}
            >
              Попробовать снова
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState filtered={activeFilter !== 'all'} />
        ) : (
          <motion.div layout className="space-y-2.5">
            <AnimatePresence mode="popLayout">
              {filtered.map((app) => (
                <AppCard
                  key={app.id}
                  app={app}
                  onDeleted={(id) => setApps((prev) => prev.filter((a) => a.id !== id))}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}