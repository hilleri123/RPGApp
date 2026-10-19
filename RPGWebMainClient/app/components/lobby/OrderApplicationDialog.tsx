'use client';

import { useEffect, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { lobbyApiService } from '@/app/services/api/lobby';
import type { User } from '@/app/services/types/auth';
import type { LobbyUserHit } from '@/app/services/types/lobby';

function errorText(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'Не удалось заказать заявку';
}

interface Props {
  open: boolean;
  lobbyId: string;
  playerUserId: string;
  playerName: string;
  defaultReviewer: User | null | undefined;
  onClose: () => void;
}

/** Мастер заказывает игроку черновик. Проверяющий — мастер лобби, его можно сменить. */
export function OrderApplicationDialog({
  open,
  lobbyId,
  playerUserId,
  playerName,
  defaultReviewer,
  onClose,
}: Props) {
  const [reviewerId, setReviewerId] = useState(defaultReviewer?.id ?? '');
  const [reviewerName, setReviewerName] = useState(defaultReviewer?.full_name || 'мастер лобби');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<LobbyUserHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReviewerId(defaultReviewer?.id ?? '');
    setReviewerName(defaultReviewer?.full_name || 'мастер лобби');
    setQuery('');
    setHits([]);
  }, [open, defaultReviewer?.id, defaultReviewer?.full_name]);

  useEffect(() => {
    const q = query.trim().replace(/^@/, '');
    if (!open || q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      lobbyApiService
        .searchUsersToInvite(lobbyId, q)
        .then((res) => {
          if (!cancelled) setHits(res);
        })
        .catch(() => {
          if (!cancelled) setHits([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query, lobbyId]);

  const order = async () => {
    setSaving(true);
    try {
      await lobbyApiService.openCharacterApplication(lobbyId, {
        user_id: playerUserId,
        reviewer_id: reviewerId || undefined,
      });
      toast.success(`Заявка заказана у ${playerName}`);
      onClose();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-sm bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle>Заказать заявку</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-400">
          {playerName} получит черновик заявки и ссылку в Telegram.
        </p>
        <div className="space-y-2">
          <div className="text-xs text-gray-500">Проверяющий</div>
          <div className="text-sm">{reviewerName}</div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-2.5 text-gray-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Другой мастер"
              className="pl-8 bg-gray-800 border-gray-600"
            />
          </div>
          {searching ? <Loader2 className="w-4 h-4 animate-spin text-gray-500" /> : null}
          {hits.length > 0 ? (
            <ul className="max-h-40 overflow-auto rounded border border-gray-700">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-800"
                    onClick={() => {
                      setReviewerId(hit.id);
                      setReviewerName(hit.full_name || hit.tg || 'мастер');
                      setQuery('');
                      setHits([]);
                    }}
                  >
                    {hit.full_name || hit.tg}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" className="border-gray-600" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={order} disabled={saving || !reviewerId}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Заказать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
