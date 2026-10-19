'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { sessionApiService } from '@/app/services/api/session';
import { campaignsApiService } from '@/app/services/api/campaign';
import { CampaignSessionFinish } from '@/app/services/types/campaign';
import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';

const INTERRUPT_CONFIRM_AFTER_MS = 5 * 60 * 1000;

export function CloseSessionDialog({
  open,
  onClose,
  sessionId,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
}) {
  const router = useRouter();
  const { session } = useSessionWebSocket(sessionId);
  const [campaignFinish, setCampaignFinish] = useState<CampaignSessionFinish | null>(null);
  const [confirmInterrupt, setConfirmInterrupt] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) setConfirmInterrupt(false);
  }, [open]);

  const sessionIsLong = () => {
    const started = Date.parse(session?.created_at || '');
    if (!Number.isFinite(started)) return true;
    return Date.now() - started >= INTERRUPT_CONFIRM_AFTER_MS;
  };

  const closeSession = async (forced: boolean = false) => {
    setBusy(true);
    try {
      const res = await sessionApiService.closeSession(sessionId, forced);
      if (res.campaign?.has_next && !forced) {
        setCampaignFinish(res.campaign);
        return;
      }
      router.push('/');
    } finally {
      setBusy(false);
    }
  };

  const continueCampaign = async () => {
    if (!campaignFinish?.campaign_id) return;
    setBusy(true);
    try {
      const res = await campaignsApiService.continueCampaign(campaignFinish.campaign_id);
      router.push(`/session/${res.session_id}`);
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    setCampaignFinish(null);
    setConfirmInterrupt(false);
    onClose();
    router.push('/');
  };

  const askToInterrupt = () => {
    if (sessionIsLong()) {
      setConfirmInterrupt(true);
      return;
    }
    void closeSession(true);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? (campaignFinish ? dismiss() : onClose()) : null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {campaignFinish ? 'Сессия завершена' : confirmInterrupt ? 'Прервать сессию?' : 'Закрыть сессию?'}
          </DialogTitle>
        </DialogHeader>

        {campaignFinish ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Прогресс кампании сохранён. Можно сразу начать следующий сценарий — персонажи, NPC и предметы
              перенесутся в новую сессию.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={dismiss} disabled={busy}>
                На главную
              </Button>
              <Button onClick={() => void continueCampaign()} disabled={busy}>
                Продолжить кампанию
              </Button>
            </div>
          </div>
        ) : confirmInterrupt ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Вы уверены, что хотите прервать сессию, весь прогресс будет сброшен
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setConfirmInterrupt(false)} disabled={busy}>
                Остаться
              </Button>
              <Button variant="destructive" onClick={() => void closeSession(true)} disabled={busy}>
                Прервать сессию
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" onClick={() => void closeSession(false)} disabled={busy}>
              Завершить сессию
            </Button>
            <Button variant="outline" onClick={askToInterrupt} disabled={busy}>
              Прервать и закрыть
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
