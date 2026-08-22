// app/applications/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Edit2, Send, RotateCcw, Trash2, MessageSquare, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { applicationApiService } from '@/app/services/api/application';
import { ApplicationEditDialog } from '@/app/components/applications/ApplicationEditDialog';
import type { Application } from '@/app/services/types2';
import { formatDistanceToNow, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ApplicationStatusBadge } from '@/app/components/applications/ApplicationStatusBadge';

// ── Вспомогалки ───────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return format(new Date(iso), 'dd MMM yyyy, HH:mm', { locale: ru });
}
function fmtAgo(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ru });
}

const ITEM_REQUEST_STATUS: Record<string, string> = {
  pending:  'Ожидает',
  approved: 'Одобрен',
  rejected: 'Отклонён',
  modified: 'Изменён',
};

// ── Блок: история ревью ───────────────────────────────────────────────────────

function ReviewTimeline({ app }: { app: Application }) {
  if (!app.reviews.length) {
    return <p className="text-gray-500 text-sm">Комментариев пока нет.</p>;
  }
  return (
    <ol className="space-y-3">
      {app.reviews.map((r) => (
        <li key={r.id} className="flex gap-3">
          <div className="shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
            {r.author?.icon_url
              ? <img src={r.author.icon_url} className="w-full h-full rounded-full object-cover" alt="" />
              : <MessageSquare className="w-4 h-4 text-gray-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-white font-medium">
                {r.author?.full_name ?? (r.is_player_note ? 'Вы' : 'Мастер')}
              </span>
              <ApplicationStatusBadge status={r.status_set_to} />
              <span className="text-xs text-gray-500">{fmtAgo(r.created_at)}</span>
            </div>
            {r.comment && (
              <p className="text-gray-300 text-sm mt-1 whitespace-pre-wrap">{r.comment}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

// ── Блок: запросы предметов ───────────────────────────────────────────────────

function ItemRequestsList({ app }: { app: Application }) {
  if (!app.item_requests.length) {
    return <p className="text-gray-500 text-sm">Запросов предметов нет.</p>;
  }
  return (
    <ul className="space-y-2">
      {app.item_requests.map((req) => (
        <li key={req.id} className="flex items-center gap-3 py-2 border-b border-gray-700 last:border-0">
          <Package className="w-4 h-4 text-gray-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm">
              {req.requested_name ?? req.requested_item_id ?? '—'}
            </p>
            {req.player_comment && (
              <p className="text-gray-400 text-xs">{req.player_comment}</p>
            )}
            {req.master_comment && (
              <p className="text-yellow-400 text-xs">Мастер: {req.master_comment}</p>
            )}
          </div>
          <Badge
            variant="outline"
            className={
              req.status === 'approved' ? 'border-green-700 text-green-400' :
              req.status === 'rejected' ? 'border-red-700 text-red-400' :
              'border-gray-600 text-gray-400'
            }
          >
            {ITEM_REQUEST_STATUS[req.status] ?? req.status}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

// ── Страница ──────────────────────────────────────────────────────────────────

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [app, setApp]         = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setApp(await applicationApiService.getById(id));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [id]);

  async function handleSubmit() {
    setActionLoading(true);
    try { setApp(await applicationApiService.submit(id)); }
    finally { setActionLoading(false); }
  }

  async function handleWithdraw() {
    setActionLoading(true);
    try { setApp(await applicationApiService.withdraw(id)); }
    finally { setActionLoading(false); }
  }

  async function handleDelete() {
    if (!confirm('Удалить заявку?')) return;
    await applicationApiService.remove(id);
    router.replace('/applications');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Загрузка...</div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-red-400">Заявка не найдена</div>
      </div>
    );
  }

  const canEdit    = app.status === 'draft' || app.status === 'needs_changes';
  const canSubmit  = app.status === 'draft' || app.status === 'needs_changes';
  const canWithdraw = app.status === 'submitted' || app.status === 'in_review';
  const canDelete  = app.status === 'draft';

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Шапка */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost" size="icon"
            className="text-gray-400 hover:text-white"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold truncate">{app.name}</h1>
            <p className="text-gray-400 text-sm">{app.rule_id_str}</p>
          </div>
          <ApplicationStatusBadge status={app.status} />
        </div>

        {/* Действия */}
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button
              size="sm" variant="secondary"
              className="gap-1.5"
              onClick={() => setEditOpen(true)}
            >
              <Edit2 className="w-4 h-4" /> Редактировать
            </Button>
          )}
          {canSubmit && (
            <Button
              size="sm"
              className="gap-1.5 bg-blue-600 hover:bg-blue-500"
              disabled={actionLoading}
              onClick={handleSubmit}
            >
              <Send className="w-4 h-4" /> Отправить мастеру
            </Button>
          )}
          {canWithdraw && (
            <Button
              size="sm" variant="outline"
              className="gap-1.5 border-gray-600"
              disabled={actionLoading}
              onClick={handleWithdraw}
            >
              <RotateCcw className="w-4 h-4" /> Отозвать
            </Button>
          )}
          {canDelete && (
            <Button
              size="sm" variant="destructive"
              className="gap-1.5"
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4" /> Удалить
            </Button>
          )}
        </div>

        {/* Основная инфо */}
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-5 flex gap-5">
            {app.img_url && (
              <img
                src={app.img_url}
                alt={app.name}
                className="w-24 h-24 rounded-lg object-cover shrink-0"
              />
            )}
            <div className="space-y-2 min-w-0">
              {app.short_desc && (
                <p className="text-gray-300">{app.short_desc}</p>
              )}
              {app.story && (
                <p className="text-gray-400 text-sm whitespace-pre-wrap">{app.story}</p>
              )}
              {!!app.tags?.length && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {app.tags.map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="text-xs text-gray-500 pt-1 space-y-0.5">
                <div>Создана: {fmtDate(app.created_at)}</div>
                {app.submitted_at && <div>Отправлена: {fmtDate(app.submitted_at)}</div>}
                <div>Обновлена: {fmtAgo(app.updated_at)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Комментарий игрока */}
        {app.player_comment && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-400">Комментарий к заявке</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-gray-300 text-sm whitespace-pre-wrap">{app.player_comment}</p>
            </CardContent>
          </Card>
        )}

        {/* Запросы предметов */}
        {app.item_requests.length > 0 && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
                <Package className="w-4 h-4" /> Запросы предметов
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ItemRequestsList app={app} />
            </CardContent>
          </Card>
        )}

        {/* История ревью */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> История обсуждения
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ReviewTimeline app={app} />
          </CardContent>
        </Card>

      </div>

      {/* Диалог редактирования */}
      <ApplicationEditDialog
        open={editOpen}
        applicationId={app.id}
        ruleIdStr={app.rule_id_str}
        onClose={() => setEditOpen(false)}
        onSaved={() => { setEditOpen(false); void load(); }}
      />
    </div>
  );
}
