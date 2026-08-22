'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { SessionAction } from '@/app/services/types/session';
import { useCommonSessionWebSocket } from '@/app/services/hooks/useCommonSessionWebSocket';
import { useAuth } from '@/app/services';
import { ActionModal } from './feeds/actions/ActionModal';
import { useMasterUiStore } from '@/app/services/stores/masterUi';

export function ActiveActionCenter({ sessionId }: { sessionId: string }) {
  const { actions } = useCommonSessionWebSocket(sessionId);
  const { state } = useAuth();

  const hiddenActiveActionIds = useMasterUiStore((s) => s.hiddenActiveActionIds);
  const addHiddenActiveActionId = useMasterUiStore((s) => s.addHiddenActiveActionId);
  const setHiddenActiveActionIds = useMasterUiStore((s) => s.setHiddenActiveActionIds);

  const focusActiveActionId = useMasterUiStore((s) => s.focusActiveActionId);
  const clearFocusActiveActionId = useMasterUiStore((s) => s.clearFocusActiveActionId);

  const openCompletedActionIds = useMasterUiStore((s) => s.openCompletedActionIds);
  const addOpenCompletedActionId = useMasterUiStore((s) => s.addOpenCompletedActionId);
  const removeOpenCompletedActionId = useMasterUiStore((s) => s.removeOpenCompletedActionId);

  const hiddenActiveSet = useMemo(
    () => new Set(hiddenActiveActionIds),
    [hiddenActiveActionIds],
  );
  const openCompletedSet = useMemo(
    () => new Set(openCompletedActionIds),
    [openCompletedActionIds],
  );

  const visibleActions = useMemo(() => {
    const arr: SessionAction[] = Array.isArray(actions) ? actions : [];
    return arr.filter((a) => {
      if (!a) return false;

      if (a.status === 'active') {
        if (hiddenActiveSet.has(a.id)) return false;
        return true;
      }

      if (a.status === 'completed') {
        // показываем только те completed, которые явно открыты
        return openCompletedSet.has(a.id);
      }

      return false;
    });
  }, [actions, hiddenActiveSet, openCompletedSet]);

  const [currentId, setCurrentId] = useState<string | null>(null);

  const actionById = useMemo(() => {
    const m = new Map<string, SessionAction>();
    (Array.isArray(actions) ? actions : []).forEach((a) => m.set(a.id, a));
    return m;
  }, [actions]);

  useEffect(() => {
    const arr: SessionAction[] = Array.isArray(actions) ? actions : [];
    const activeHidden = hiddenActiveActionIds.filter((id) => {
      const a = arr.find((x) => x.id === id);
      return a?.status === 'active';
    });
    if (activeHidden.length !== hiddenActiveActionIds.length) {
      setHiddenActiveActionIds(activeHidden);
    }
  }, [actions, hiddenActiveActionIds, setHiddenActiveActionIds]);

  useEffect(() => {
    if (visibleActions.length === 0) {
      setCurrentId(null);
      return;
    }

    if (
      focusActiveActionId &&
      visibleActions.some((a) => a.id === focusActiveActionId)
    ) {
      setCurrentId(focusActiveActionId);
      clearFocusActiveActionId();
      return;
    }

    if (!currentId || !visibleActions.some((a) => a.id === currentId)) {
      setCurrentId(visibleActions[0].id);
    }
  }, [visibleActions, currentId, focusActiveActionId, clearFocusActiveActionId]);

  const currentAction = currentId ? actionById.get(currentId) ?? null : null;

  if (!state.user) return null;
  if (!currentAction) return null;

  const handleClose = () => {
    if (!currentId || !currentAction) {
      setCurrentId(null);
      return;
    }

    if (currentAction.status === 'active') {
      // активное — считаем просмотренным и больше не показываем
      addHiddenActiveActionId(currentId);
    }

    if (currentAction.status === 'completed') {
      // завершённое — просто закрываем (убираем из "открытых")
      removeOpenCompletedActionId(currentId);
    }

    setCurrentId(null);
  };

  return (
    <ActionModal
      open={true}
      onClose={handleClose}
      closeOnSubmit={false}
      action={currentAction}
    />
  );
}
