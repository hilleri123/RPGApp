'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { sessionApiService } from '@/app/services/api/session';
import { campaignsApiService } from '@/app/services/api/campaign';
import { CampaignSessionFinish } from '@/app/services/types/campaign';

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
  const [campaignFinish, setCampaignFinish] = useState<CampaignSessionFinish | null>(null);
  const [busy, setBusy] = useState(false);

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
    onClose();
    router.push('/');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? (campaignFinish ? dismiss() : onClose()) : null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{campaignFinish ? 'Сессия завершена' : 'Закрыть сессию?'}</DialogTitle>
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
        ) : (
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" onClick={() => void closeSession(false)} disabled={busy}>
              Завершить сессию
            </Button>
            <Button variant="outline" onClick={() => void closeSession(true)} disabled={busy}>
              Прервать и закрыть
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
