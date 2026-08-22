'use client';

import { Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCommonSessionWebSocket } from '@/app/services/hooks/useCommonSessionWebSocket';
import { useMasterUiStore } from '@/app/services/stores/masterUi';
import type { SessionAction } from '@/app/services/types/session';
import { useMemo } from 'react';

function actionDockTitle(action: SessionAction, initiatorName: string | undefined) {
  const who = initiatorName ?? 'игрок';
  return `${action.actionKey} · ${who}`;
}

export function MinimizedActionDock({ sessionId }: { sessionId: string }) {
  const hiddenActiveActionIds = useMasterUiStore((s) => s.hiddenActiveActionIds);
  const removeHiddenActiveActionId = useMasterUiStore((s) => s.removeHiddenActiveActionId);
  const requestFocusActiveActionId = useMasterUiStore((s) => s.requestFocusActiveActionId);

  const { actions, session } = useCommonSessionWebSocket(sessionId);

  const initiatorNameByUserId = useMemo(() => {
    const m = new Map<string, string>();
    if (session?.master?.id) {
      m.set(String(session.master.id), session.master.full_name ?? '');
    }
    for (const p of session?.players ?? []) {
      const u = p.user;
      if (u?.id) m.set(String(u.id), u.full_name ?? '');
    }
    return m;
  }, [session]);

  const minimizedActions = useMemo(() => {
    const hiddenSet = new Set(hiddenActiveActionIds);
    const arr: SessionAction[] = Array.isArray(actions) ? actions : [];
    return hiddenActiveActionIds
      .map((id) => arr.find((a) => a.id === id))
      .filter((a): a is SessionAction => !!a && a.status === 'active' && hiddenSet.has(a.id));
  }, [actions, hiddenActiveActionIds]);

  if (minimizedActions.length === 0) return null;

  const restore = (id: string) => {
    removeHiddenActiveActionId(id);
    requestFocusActiveActionId(id);
  };

  return (
    <div className="fixed bottom-0 right-0 z-[70] pointer-events-none flex justify-end px-3 pb-2 gap-2">
      {minimizedActions.map((action) => (
        <div
          key={action.id}
          className="pointer-events-auto flex items-center gap-1 rounded-t-lg border border-zinc-600 border-b-0 bg-zinc-900 shadow-xl max-w-[320px]"
        >
          <button
            type="button"
            className="flex-1 min-w-0 px-3 py-2 text-left text-sm text-gray-100 truncate hover:bg-zinc-800 rounded-tl-lg"
            onClick={() => restore(action.id)}
            title="Развернуть действие"
          >
            {actionDockTitle(
              action,
              initiatorNameByUserId.get(String(action.participants?.initiatorUserId)),
            )}
          </button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0 text-gray-400 hover:text-white rounded-tr-lg"
            onClick={() => restore(action.id)}
            title="Развернуть"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}
