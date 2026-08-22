'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { SessionAction } from '@/app/services/types/session';
import { PluginActionHandlerStub } from '@/app/plugins/mock';
import type { ActionHandlerProps } from '@/app/plugins/pluginTypes';
import { useAuth } from '@/app/services';
import { useParams } from 'next/navigation';
import { useCommonSessionWebSocket } from '@/app/services/hooks/useCommonSessionWebSocket';
import { usePlayerMirrorContext } from '@/app/components/session/masterView/playerMirror/PlayerMirrorContext';
import { ActionWizardNav } from './ActionWizardNav';
import {
  isWizardStepEditable,
  isWizardStepReadonly,
  readActionWizard,
  readStageDraft,
  resolveActionViewKey,
  canUserCancelAction,
} from './actionWizard';
import FreeDiceRollStage from 'plugins/common/ui/actions/free_dice_roll/FreeDiceRollStage';

const FREE_DICE_ACTION_KEY = 'common.free_dice_roll';

function readActionDraft(action: SessionAction | null, stageKey: string): Record<string, unknown> {
  return readStageDraft(action, stageKey);
}


export function ActionModal({
  open,
  onClose,
  action,
  closeOnSubmit = true,
}: {
  open: boolean;
  onClose: () => void;
  action: SessionAction | null;
  closeOnSubmit?: boolean;
}) {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  const { state } = useAuth();
  const { session, pluginUI, submitActionStep, patchActionStep, cancelSceneAction, isMaster } = useCommonSessionWebSocket(sessionId);
  const mirror = usePlayerMirrorContext();
  const mirrorReadOnly = Boolean(mirror?.enabled);

  const ActionHandler = pluginUI?.ActionHandler;
  const Handler = (ActionHandler ?? PluginActionHandlerStub) as React.ComponentType<ActionHandlerProps>;

  const currentStageKey = String(action?.workflow?.stageKey ?? '');
  const wizard = readActionWizard(action);
  const resolvedViewKey = resolveActionViewKey(action);

  const [viewKey, setViewKey] = useState(resolvedViewKey);

  useEffect(() => {
    setViewKey(resolveActionViewKey(action));
  }, [action?.id, action?.workflow?.stageKey, action?.workflow?.stageData, currentStageKey, wizard?.currentKey]);

  const readOnly = mirrorReadOnly || (wizard ? isWizardStepReadonly(wizard, viewKey) : false);
  const canEdit = !mirrorReadOnly && (wizard ? isWizardStepEditable(wizard, viewKey) : true);
  const submitKey = wizard?.currentKey ?? currentStageKey;
  const canSubmit = !mirrorReadOnly && viewKey === submitKey && canEdit;

  // readActionDraft читает только stageData и viewKey, поэтому сериализовать
  // черновик на каждый рендер незачем: ссылка на stageData меняется вместе с
  // приходом обновления от сервера.
  const serverDraftKey = useMemo(
    () => JSON.stringify(readActionDraft(action, viewKey)),
    [action?.workflow?.stageData, viewKey],
  );
  const initialDraft = useMemo(
    () => readActionDraft(action, viewKey),
    [action?.id, viewKey, serverDraftKey],
  );
  const [draft, setDraft] = useState<any>(initialDraft);
  const [submitting, setSubmitting] = useState(false);
  const [submitEnabled, setSubmitEnabled] = useState(true);

  useEffect(() => {
    setDraft(initialDraft);
    setSubmitEnabled(true);
  }, [initialDraft]);

  useEffect(() => {
    setDraft(readActionDraft(action, viewKey));
  }, [action?.id, viewKey, serverDraftKey]);

  useEffect(() => {
    setSubmitEnabled(canSubmit);
  }, [canSubmit]);

  if (!open || !action || !state.user) return null;
  const a = action;
  const isFreeDiceRoll = String(a.actionKey ?? '') === FREE_DICE_ACTION_KEY;
  const canCancel =
    !mirrorReadOnly &&
    !!cancelSceneAction &&
    canUserCancelAction(a, state.user.id, !!isMaster);

  async function handleSubmit(overrideValue?: any) {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      await submitActionStep(a.id, { ...(overrideValue ?? draft), _stageKey: viewKey });
      if (closeOnSubmit) onClose();
    } finally {
      setSubmitting(false);
    }
  }

  function handlePatch(patch: Record<string, unknown>) {
    if (!canEdit) return;
    const { _stageKey: _, ...local } = patch;
    setDraft((prev: Record<string, unknown>) => ({ ...(prev ?? {}), ...local }));
    if (patchActionStep) {
      void patchActionStep(a.id, { ...patch, _stageKey: viewKey });
    }
  }

  async function handleCancelAction() {
    if (!cancelSceneAction) return;
    try {
      setSubmitting(true);
      await cancelSceneAction(a.id);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  // Empty participantIds => visible/interactive for everyone (matches backend policy).
  // In player-eyes mirror, evaluate visibility as the mirrored player.
  const viewerId = mirrorReadOnly && mirror?.playerUserId
    ? String(mirror.playerUserId)
    : String(state.user.id);
  const disabled =
    !mirrorReadOnly &&
    Array.isArray(action.participantIds) &&
    action.participantIds.length > 0 &&
    !action.participantIds.map(String).includes(viewerId);
  const viewStep = wizard?.steps?.find((s) => s.key === viewKey);

  const initiator = [
    session?.master,
    ...(session?.players?.map((p) => p.user) ?? []),
  ].find((u) => u?.id === a.participants.initiatorUserId);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div className="w-full max-w-3xl max-h-[90vh] rounded-lg bg-zinc-900 border border-zinc-700 shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-zinc-700 shrink-0">
          <div className="min-w-0">
            <div className="text-sm text-gray-200 truncate">{a.actionKey} выполняет {initiator?.full_name}</div>
            <div className="text-xs text-gray-500">
              status: {a.status} · id: {a.id}
              {a.workflow?.stageKey ? ` · stage: ${a.workflow.stageKey}` : null}
            </div>
            {Array.isArray(a?.issues) && a?.issues.length ? (
              <div className="mt-1 text-xs text-red-300">{a?.issues[0]?.message ?? 'Workflow error'}</div>
            ) : null}
          </div>

          <div className="flex gap-2 shrink-0">
            {canCancel ? (
              <button
                type="button"
                className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-500 disabled:opacity-60"
                onClick={handleCancelAction}
                disabled={submitting}
              >
                Отменить
              </button>
            ) : null}
            <button
              type="button"
              className="rounded bg-zinc-800 px-3 py-1.5 text-sm text-gray-200 hover:bg-zinc-700 disabled:opacity-60"
              onClick={onClose}
              disabled={submitting}
            >
              Свернуть
            </button>
          </div>
        </div>

        {wizard ? (
          <ActionWizardNav wizard={wizard} viewKey={viewKey} onViewKeyChange={setViewKey} />
        ) : null}

        {/* Body */}
        <div className="p-4 flex-1 min-h-0 overflow-y-auto">
          {readOnly && wizard ? (
            <div className="text-xs text-amber-200/70 mb-3 px-2 py-1 rounded border border-amber-500/20 bg-amber-500/5">
              {viewStep?.disabled
                ? 'Стадия ещё не наступила.'
                : viewStep?.frozen
                  ? 'Зафиксировано — после броска кубов редактирование недоступно.'
                  : 'Режим просмотра.'}
            </div>
          ) : null}
          <div className={disabled ? 'pointer-events-none opacity-50' : ''}>
            {isFreeDiceRoll ? (
              <FreeDiceRollStage
                user_id={state.user.id}
                action={a}
                value={draft}
                onChange={canEdit ? setDraft : () => {}}
                onPatch={canEdit ? handlePatch : undefined}
                onSubmit={handleSubmit}
                setSubmitEnabled={setSubmitEnabled}
                stageKey={viewKey}
                readOnly={readOnly || !canEdit}
              />
            ) : (
              <Handler
                user_id={state.user.id}
                action={a}
                value={draft}
                onChange={canEdit ? setDraft : () => {}}
                onPatch={canEdit ? handlePatch : undefined}
                onSubmit={handleSubmit}
                setSubmitEnabled={setSubmitEnabled}
                stageKey={viewKey}
                readOnly={readOnly || !canEdit}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-zinc-700 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            className="rounded bg-zinc-800 px-3 py-1.5 text-sm text-gray-200 hover:bg-zinc-700 disabled:opacity-60"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>

          <button
            type="button"
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500 disabled:opacity-60"
            onClick={() => handleSubmit()}
            disabled={submitting || disabled || !submitEnabled || !canSubmit}
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
