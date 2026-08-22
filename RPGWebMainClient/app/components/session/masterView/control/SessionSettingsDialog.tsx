'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SessionSettings } from '@/app/services/types/session';
import { SessionObserversPanel } from '@/app/components/session/masterView/SessionObserversPanel';
import { SessionPlayersPanel } from '@/app/components/session/masterView/control/SessionPlayersPanel';
import { Input } from '@/components/ui/input';
import { CloseSessionDialog } from '@/app/components/session/masterView/control/CloseSessionDialog';

type CheckedState = boolean | 'indeterminate';

const DEFAULT_SETTINGS: SessionSettings = {
  show_action_to_everyone: false,
  merge_scenes_for_players: false,
  hide_audio_name: true,
  audio_mode: 'local',
  edit_scenario: false,
  allow_character_swap: false,
  master_filter_tags: [],
};

export function SessionSettingsDialog({
  open,
  onClose,
  settings,
  scenarioId,
  sessionId,
  onSave,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  settings: SessionSettings | null;
  scenarioId?: string | null;
  sessionId?: string | null;
  onSave: (next: SessionSettings) => Promise<void> | void;
  onReset: () => Promise<void> | void;
}) {
  const [local, setLocal] = useState<SessionSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [tab, setTab] = useState<'settings' | 'players' | 'observers' | 'session'>('settings');
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    setLocal(settings ?? DEFAULT_SETTINGS);
    if (!wasOpenRef.current) {
      setTab('settings');
      wasOpenRef.current = true;
    }
  }, [open, settings]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(local);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      await onReset();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Настройки подхода</DialogTitle>
          </DialogHeader>

          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex-1 min-h-0 flex flex-col">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="settings">Основные</TabsTrigger>
              <TabsTrigger value="players">Игроки</TabsTrigger>
              <TabsTrigger value="observers">Обсерверы</TabsTrigger>
              <TabsTrigger value="session">Сессия</TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="flex-1 overflow-y-auto mt-4 space-y-5">
              {scenarioId ? (
                <div className="rounded-md border border-gray-700 bg-gray-800/60 p-3">
                  <div className="text-sm font-medium text-white mb-1">
                    Редактирование как сценарий
                  </div>
                  <p className="text-xs text-gray-400 mb-3">
                    Полный редактор сценария: локации, NPC, сюжетные биты и остальные сущности.
                  </p>
                  <Button variant="secondary" size="sm" asChild>
                    <Link href={`/scenarios/${scenarioId}?fromSession=${sessionId ?? ''}`}>
                      Открыть редактор сценария
                    </Link>
                  </Button>
                </div>
              ) : null}

              <label className="flex items-start gap-3">
                <Checkbox
                  checked={local.show_action_to_everyone as CheckedState}
                  onCheckedChange={(v: CheckedState) =>
                    setLocal((s) => ({ ...s, show_action_to_everyone: Boolean(v) }))
                  }
                />
                <div className="leading-tight">
                  <div className="text-sm font-medium text-white">Показывать действия всем</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Игроки видят активные действия и шаги по общей логике сессии.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3">
                <Checkbox
                  checked={local.merge_scenes_for_players as CheckedState}
                  onCheckedChange={(v: CheckedState) =>
                    setLocal((s) => ({ ...s, merge_scenes_for_players: Boolean(v) }))
                  }
                />
                <div className="leading-tight">
                  <div className="text-sm font-medium text-white">Объединять сцены для игроков</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Игрок может видеть объекты из других сцен по правилам отображения.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3">
                <Checkbox
                  checked={local.allow_character_swap as CheckedState}
                  onCheckedChange={(v: CheckedState) =>
                    setLocal((s) => ({ ...s, allow_character_swap: Boolean(v) }))
                  }
                />
                <div className="leading-tight">
                  <div className="text-sm font-medium text-white">Оставлять персонажа в сессии при смене</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Если игрок меняет персонажа, старый остаётся в пуле сессии — другой игрок сможет его выбрать.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3">
                <Checkbox
                  checked={local.hide_audio_name as CheckedState}
                  onCheckedChange={(v: CheckedState) =>
                    setLocal((s) => ({ ...s, hide_audio_name: Boolean(v) }))
                  }
                />
                <div className="leading-tight">
                  <div className="text-sm font-medium text-white">Скрывать название аудио</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Не показывать название трека игрокам и наблюдателям.
                  </div>
                </div>
              </label>

              <div className="space-y-2">
                <div className="text-sm font-medium text-white">Фильтр мастера (ep: / party:)</div>
                <p className="text-xs text-gray-400">
                  Через запятую: показывать только сущности с совпадающими тегами эпизода или партии.
                </p>
                <Input
                  value={(local.master_filter_tags ?? []).join(', ')}
                  onChange={(e) =>
                    setLocal((s) => ({
                      ...s,
                      master_filter_tags: e.target.value
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean),
                    }))
                  }
                  placeholder="ep:1, party:alpha"
                  className="bg-gray-900 border-gray-700"
                />
              </div>

              <div className="space-y-3">
                <RadioGroup
                  value={local.audio_mode}
                  onValueChange={(value: 'local' | 'observer') =>
                    setLocal((s) => ({ ...s, audio_mode: value }))
                  }
                  className="space-y-2"
                >
                  <label className="flex items-start gap-3 rounded-md border border-gray-800 px-3 py-2 hover:bg-gray-900/60 cursor-pointer">
                    <RadioGroupItem value="local" id="audio-mode-local" className="mt-0.5" />
                    <div className="leading-tight">
                      <div className="text-sm font-medium text-white">Игрокам</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 rounded-md border border-gray-800 px-3 py-2 hover:bg-gray-900/60 cursor-pointer">
                    <RadioGroupItem value="observer" id="audio-mode-observer" className="mt-0.5" />
                    <div className="leading-tight">
                      <div className="text-sm font-medium text-white">Наблюдателям</div>
                    </div>
                  </label>
                </RadioGroup>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="secondary" onClick={onClose} disabled={saving}>
                  Отмена
                </Button>
                <Button variant="outline" onClick={reset} disabled={saving}>
                  Сбросить
                </Button>
                <Button onClick={save} disabled={saving}>
                  Сохранить
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="players" className="flex-1 overflow-y-auto mt-4">
              {sessionId ? <SessionPlayersPanel sessionId={sessionId} /> : null}
            </TabsContent>

            <TabsContent value="observers" className="flex-1 overflow-y-auto mt-4">
              {sessionId ? <SessionObserversPanel sessionId={sessionId} /> : null}
            </TabsContent>

            <TabsContent value="session" className="flex-1 overflow-y-auto mt-4 space-y-4">
              <p className="text-sm text-gray-400">
                Закрытие подхода не уничтожает запущенный сценарий. Мир сохраняется для следующей партии.
              </p>
              <Button variant="destructive" onClick={() => setCloseOpen(true)}>
                Закрыть подход…
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {sessionId ? (
        <CloseSessionDialog
          sessionId={sessionId}
          open={closeOpen}
          onClose={() => {
            setCloseOpen(false);
            onClose();
          }}
        />
      ) : null}
    </>
  );
}
