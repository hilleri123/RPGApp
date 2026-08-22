// app/master/applications/[id]/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Edit2, MessageSquare, Package, User, Save, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ApplicationStatusBadge } from '@/app/components/applications/ApplicationStatusBadge';
import { masterApplicationApiService, applicationApiService } from '@/app/services/api/application';
import { loadPluginEditorConfigForEntity } from '@/app/services/loadPluginEditorConfigs';
import { useMasterApplicationDialog } from '@/app/services/hooks/applications/useMasterApplicationDialog';
import { getPluginUI } from '@/app/plugins/uiRegistry';
import type { Application, ApplicationStatus } from '@/app/services/types2';
import { format, formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { DialogModeProvider } from '@/app/components/scenarios/dialogs/common/DialogModeContext';
import { CharacterMainTab, CharacterRulesTab } from '@/app/components/scenarios/dialogs/tabs/character';

function fmtDate(iso: string) {
  return format(new Date(iso), 'dd MMM yyyy, HH:mm', { locale: ru });
}
function fmtAgo(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ru });
}

const REVIEW_TRANSITIONS: Record<string, { value: string; label: string; className: string }[]> = {
  // draft: [
  //   { value: 'in_review',     label: 'Взять в работу',   className: 'bg-yellow-700 hover:bg-yellow-600' },
  //   { value: 'needs_changes', label: 'Запросить правки', className: 'bg-orange-700 hover:bg-orange-600' },
  //   { value: 'approved',      label: 'Одобрить',         className: 'bg-green-700 hover:bg-green-600' },
  //   { value: 'rejected',      label: 'Отклонить',        className: 'bg-red-800 hover:bg-red-700' },
  // ],
  submitted: [
    { value: 'in_review',     label: 'Взять в работу',      className: 'bg-yellow-700 hover:bg-yellow-600' },
    { value: 'needs_changes', label: 'Запросить правки',    className: 'bg-orange-700 hover:bg-orange-600' },
    { value: 'approved',      label: 'Одобрить',            className: 'bg-green-700 hover:bg-green-600' },
    { value: 'rejected',      label: 'Отклонить',           className: 'bg-red-800 hover:bg-red-700' },
  ],
  in_review: [
    { value: 'needs_changes', label: 'Запросить правки',    className: 'bg-orange-700 hover:bg-orange-600' },
    { value: 'approved',      label: 'Одобрить',            className: 'bg-green-700 hover:bg-green-600' },
    { value: 'rejected',      label: 'Отклонить',           className: 'bg-red-800 hover:bg-red-700' },
  ],
  needs_changes: [
    { value: 'in_review',     label: 'Вернуть на проверку', className: 'bg-yellow-700 hover:bg-yellow-600' },
    { value: 'approved',      label: 'Одобрить',            className: 'bg-green-700 hover:bg-green-600' },
    { value: 'rejected',      label: 'Отклонить',           className: 'bg-red-800 hover:bg-red-700' },
  ],
};

const ITEM_STATUS: Record<string, string> = {
  pending: 'Ожидает', approved: 'Одобрен', rejected: 'Отклонён', modified: 'Изменён',
};

// ── readOnly dlg-объект для просмотра на странице ─────────────────────────────
function useReadOnlyDlg(app: Application, config: any) {
  return useMemo(() => ({
    form: {
      id: app.id,
      name: app.name,
      short_desc: app.short_desc ?? null,
      story: app.story ?? null,
      icon_url: app.icon_url ?? null,
      img_url: app.img_url ?? null,
      tags: (app.tags as string[]) ?? [],
      player_comment: app.player_comment ?? null,
      owned_items: [],
      take_from_other_owner_ids: [],
    },
    assets:  { iconFile: null, imgFile: null },
    lookups: { items: [], locations: [] },
    data:    (app.data as Record<string, unknown>) ?? {},
    config,
    issues:  [],
  }), [app, config]);
}

// ── диалог редактирования ─────────────────────────────────────────────────────
function MasterEditDialog({
  app,
  onClose,
  onSaved,
}: {
  app: Application;
  onClose: () => void;
  onSaved: () => void;
}) {
  const hook = useMasterApplicationDialog({
    open:          true,
    applicationId: app.id,
    ruleIdStr:     app.rule_id_str,
    initialApp:    app,
    onSaved:       () => onSaved(),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-gray-900 border-gray-700 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-6">
            <span>Редактировать персонажа</span>
            {hook.error && <span className="text-red-400 text-sm font-normal">{hook.error}</span>}
          </DialogTitle>
        </DialogHeader>

        <DialogModeProvider readOnly={false}>
          <Tabs defaultValue="main" className="mt-2">
            <TabsList className="bg-gray-800 w-full">
              <TabsTrigger value="main"  className="flex-1">Основное</TabsTrigger>
              <TabsTrigger value="rules" className="flex-1">Правила</TabsTrigger>
            </TabsList>
            <TabsContent value="main" className="mt-4">
              <CharacterMainTab dlg={hook.dlg} />
            </TabsContent>
            <TabsContent value="rules" className="mt-4">
              <CharacterRulesTab dlg={hook.dlg} pluginUI={hook.pluginUI} rulesMode="edit" />
            </TabsContent>
          </Tabs>
        </DialogModeProvider>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-700 mt-4">
          <Button variant="ghost" className="text-gray-400" onClick={onClose}>
            <X className="w-4 h-4 mr-1" /> Отмена
          </Button>
          <Button
            className="bg-teal-700 hover:bg-teal-600 gap-1.5"
            disabled={hook.saving}
            onClick={() => void hook.save()}
          >
            <Save className="w-4 h-4" />
            {hook.saving ? 'Сохраняем...' : 'Сохранить'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── панель ревью ──────────────────────────────────────────────────────────────
function ReviewPanel({ app, onReviewed }: { app: Application; onReviewed: () => void }) {
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const transitions = REVIEW_TRANSITIONS[app.status] ?? [];
  if (!transitions.length) return null;

  async function submit(newStatus: string) {
    setLoading(true);
    try {
      await masterApplicationApiService.review(app.id, {
        new_status: newStatus as ApplicationStatus,
        comment: comment || undefined,
      });
      setComment('');
      onReviewed();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-400">Решение мастера</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          placeholder="Комментарий для игрока (необязательно)..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="bg-gray-900 border-gray-600 text-white placeholder:text-gray-500 resize-none"
          rows={3}
        />
        <div className="flex flex-wrap gap-2">
          {transitions.map((t) => (
            <Button
              key={t.value} size="sm"
              className={`${t.className} text-white`}
              disabled={loading}
              onClick={() => void submit(t.value)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── item requests ─────────────────────────────────────────────────────────────
function ItemRequestsPanel({ app, onUpdated }: { app: Application; onUpdated: () => void }) {
  const [loading, setLoading] = useState<string | null>(null);
  if (!app.item_requests?.length) return null;

  async function decide(reqId: string, status: 'approved' | 'rejected') {
    setLoading(reqId);
    try {
      await masterApplicationApiService.decideItemRequest(app.id, reqId, status);
      onUpdated();
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
          <Package className="w-4 h-4" /> Запросы предметов
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {app.item_requests.map((req) => (
            <li key={req.id} className="border-b border-gray-700 last:border-0 pb-3 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium">
                    {req.requested_name ?? req.requested_item_id ?? '—'}
                  </p>
                  {req.player_comment && (
                    <p className="text-gray-400 text-xs mt-0.5">{req.player_comment}</p>
                  )}
                  {req.master_comment && (
                    <p className="text-yellow-400 text-xs mt-0.5">↳ {req.master_comment}</p>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={
                    req.status === 'approved' ? 'border-green-700 text-green-400 shrink-0' :
                    req.status === 'rejected' ? 'border-red-700 text-red-400 shrink-0' :
                    'border-gray-600 text-gray-400 shrink-0'
                  }
                >
                  {ITEM_STATUS[req.status]}
                </Badge>
              </div>
              {req.status === 'pending' && (
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm" variant="outline"
                    className="border-green-700 text-green-400 hover:bg-green-900 h-7 text-xs"
                    disabled={loading === req.id}
                    onClick={() => void decide(req.id, 'approved')}
                  >Одобрить</Button>
                  <Button
                    size="sm" variant="outline"
                    className="border-red-700 text-red-400 hover:bg-red-900 h-7 text-xs"
                    disabled={loading === req.id}
                    onClick={() => void decide(req.id, 'rejected')}
                  >Отклонить</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ── таймлайн ──────────────────────────────────────────────────────────────────
function ReviewTimeline({ app }: { app: Application }) {
  if (!app.reviews?.length)
    return <p className="text-gray-500 text-sm">Обсуждений пока нет.</p>;

  return (
    <ol className="space-y-3">
      {app.reviews.map((r) => (
        <li key={r.id} className="flex gap-3">
          <div className="shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
            {r.author?.icon_url
              ? <img src={r.author.icon_url} alt="" className="w-full h-full object-cover" />
              : <MessageSquare className="w-4 h-4 text-gray-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-white font-medium">
                {r.author?.full_name ?? (r.is_player_note ? 'Игрок' : 'Мастер')}
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

// ── главная страница ──────────────────────────────────────────────────────────
export default function MasterApplicationDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();

  const [app, setApp]           = useState<Application | null>(null);
  const [loading, setLoading]   = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  // конфиг правил для readOnly-просмотра данных плагина
  const [rulesConfig, setRulesConfig] = useState<any>(null);

  async function load() {
    setLoading(true);
    try {
      const loaded = await masterApplicationApiService.getById(id);
      setApp(loaded);
      // грузим конфиг для View-рендера плагина
      if (loaded.rule_id_str) {
        loadPluginEditorConfigForEntity({
          scope: { scope: 'rule', id: loaded.rule_id_str },
          entity: 'character',
          needInit: false,
          fetchSchema: (entity, etag) =>
            applicationApiService.getRuleSchema(loaded.rule_id_str, entity, etag),
        })
          .then(setRulesConfig)
          .catch(() => setRulesConfig(null));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [id]);

  const pluginUI = useMemo(
    () => (app?.rule_id_str ? getPluginUI(app.rule_id_str) : null),
    [app?.rule_id_str],
  );

  const readOnlyDlg = useReadOnlyDlg(app ?? ({} as Application), rulesConfig);

  if (loading)
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Загрузка...</div>;
  if (!app)
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-red-400">Заявка не найдена</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">

        {/* ── Шапка ── */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold truncate">{app.name}</h1>
            <div className="flex items-center gap-2 text-sm text-gray-400 mt-0.5">
              <User className="w-3.5 h-3.5" />
              {app.user?.full_name ?? '—'}
              <span className="text-gray-600">·</span>
              {app.rule_id_str}
            </div>
          </div>
          <ApplicationStatusBadge status={app.status} />
        </div>

        {/* ── Кнопка редактирования ── */}
        <div>
          <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => setEditOpen(true)}>
            <Edit2 className="w-4 h-4" /> Редактировать персонажа
          </Button>
        </div>

        {/* ── Просмотр персонажа + данных плагина (readOnly) ── */}
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-0">
            <DialogModeProvider readOnly>
              <Tabs defaultValue="main">
                <TabsList className="bg-gray-900 w-full rounded-none border-b border-gray-700 px-4 pt-3">
                  <TabsTrigger value="main"  className="flex-1 data-[state=active]:bg-gray-800">Персонаж</TabsTrigger>
                  {pluginUI?.CharacterDataView && (
                    <TabsTrigger value="rules" className="flex-1 data-[state=active]:bg-gray-800">Правила</TabsTrigger>
                  )}
                  <TabsTrigger value="meta"  className="flex-1 data-[state=active]:bg-gray-800">Инфо</TabsTrigger>
                </TabsList>

                {/* Основная вкладка — CharacterMainTab в readOnly */}
                <TabsContent value="main" className="p-4">
                  <CharacterMainTab dlg={readOnlyDlg} />
                </TabsContent>

                {/* Данные плагина через CharacterDataView */}
                {pluginUI?.CharacterDataView && (
                  <TabsContent value="rules" className="p-4">
                    <CharacterRulesTab dlg={readOnlyDlg} pluginUI={pluginUI} rulesMode="view" />
                  </TabsContent>
                )}

                {/* Мета: даты, теги, комментарий игрока */}
                <TabsContent value="meta" className="p-4 space-y-3">
                  {app.player_comment && (
                    <div className="bg-gray-900 rounded-lg p-3 text-sm text-gray-300">
                      <div className="text-gray-500 text-xs mb-1">Комментарий игрока</div>
                      {app.player_comment}
                    </div>
                  )}

                  {!!app.tags?.length && (
                    <div>
                      <div className="text-gray-500 text-xs mb-1.5">Теги</div>
                      <div className="flex flex-wrap gap-1">
                        {(app.tags as string[]).map((t) => (
                          <span key={t} className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-gray-500 space-y-1 pt-1">
                    <div>Создана: {fmtDate(app.created_at)}</div>
                    {app.submitted_at && <div>Отправлена: {fmtDate(app.submitted_at)}</div>}
                    <div>Обновлена: {fmtAgo(app.updated_at)}</div>
                  </div>
                </TabsContent>
              </Tabs>
            </DialogModeProvider>
          </CardContent>
        </Card>

        {/* ── Панель решения ── */}
        <ReviewPanel app={app} onReviewed={() => void load()} />

        {/* ── Запросы предметов ── */}
        <ItemRequestsPanel app={app} onUpdated={() => void load()} />

        {/* ── История обсуждения ── */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> История обсуждения
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReviewTimeline app={app} />
          </CardContent>
        </Card>

      </div>

      {/*
        key={app.id} — перемонтирует диалог при смене заявки.
        Рендерим только при editOpen=true, чтобы состояние формы
        сбрасывалось при закрытии.
      */}
      {editOpen && (
        <MasterEditDialog
          key={app.id}
          app={app}
          onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); void load(); }}
        />
      )}
    </div>
  );
}