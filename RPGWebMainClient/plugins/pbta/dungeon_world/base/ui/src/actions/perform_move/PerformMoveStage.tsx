'use client';

import React from 'react';
import type { ActionHandlerProps } from '@/app/plugins/pluginTypes';
import { PerformMoveDamageStage } from './stages/PerformMoveDamageStage';
import { isPerformMoveAction } from './types';
import { NpcAttackBanner } from './components/NpcAttackBanner';
import { PerformMoveChangeManifestStage } from './stages/PerformMoveChangeManifestStage';
import { PerformMoveSetupStage } from './stages/PerformMoveSetupStage';
import { PerformMoveDeclareStage } from './stages/PerformMoveDeclareStage';
import { PerformMoveAidStage } from '../../../../../../base/ui/src/actions/perform_move/stages/PerformMoveAidStage';
import { PerformMoveRollStage } from '../../../../../../base/ui/src/actions/perform_move/stages/PerformMoveRollStage';
import { PerformMoveChooseStage } from '../../../../../../base/ui/src/actions/perform_move/stages/PerformMoveChooseStage';
import { PerformMoveResultStage } from '../../../../../../base/ui/src/actions/perform_move/stages/PerformMoveResultStage';

function PerformMoveStageBody(props: ActionHandlerProps) {
  const {
    action,
    user_id,
    value,
    onChange,
    onPatch,
    onSubmit,
    setSubmitEnabled,
    stageKey: viewKeyProp,
    readOnly = false,
  } = props;

  if (!isPerformMoveAction(action)) {
    return (
      <div className="text-sm text-red-300/80">
        Некорректный action для perform_move
      </div>
    );
  }

  const stageKey = String(viewKeyProp ?? action?.workflow?.stageKey ?? 'done');
  const wizardCurrent = (
    action?.workflow?.stageData as { wizard?: { currentKey?: string } } | undefined
  )?.wizard?.currentKey;
  const effectiveStageKey =
    stageKey === 'perform_move.pre_roll' || stageKey === 'perform_move.post_roll'
      ? String(
          wizardCurrent ??
            (stageKey === 'perform_move.pre_roll' ? 'perform_move.declare' : 'perform_move.change_manifest'),
        )
      : stageKey;

  const patch = (p: Record<string, unknown>) => {
    if (readOnly) return;
    onChange({ ...(value ?? {}), ...p });
  };

  const syncPatch = (p: Record<string, unknown>) => {
    if (readOnly) return;
    patch(p);
    onPatch?.(p);
  };

  const stageProps = {
    user_id,
    action,
    value: value ?? {},
    patch,
    onPatch: readOnly ? undefined : syncPatch,
    onSubmit,
    setSubmitEnabled,
    readOnly,
  };

  if (effectiveStageKey === 'perform_move.setup') return <PerformMoveSetupStage {...stageProps} />;
  if (effectiveStageKey === 'perform_move.declare') return <PerformMoveDeclareStage {...stageProps} />;
  if (effectiveStageKey === 'perform_move.aid') return <PerformMoveAidStage {...stageProps} />;
  if (effectiveStageKey === 'perform_move.bonuses') return <PerformMoveDeclareStage {...stageProps} />;
  if (effectiveStageKey === 'perform_move.roll') return <PerformMoveRollStage {...stageProps} />;
  if (effectiveStageKey === 'perform_move.choose') return <PerformMoveChooseStage {...stageProps} />;
  if (effectiveStageKey === 'perform_move.change_manifest') {
    return <PerformMoveChangeManifestStage {...stageProps} />;
  }
  if (effectiveStageKey === 'perform_move.damage_roll' || effectiveStageKey === 'perform_move.damage') {
    return <PerformMoveDamageStage {...stageProps} />;
  }
  if (effectiveStageKey === 'perform_move.result' || effectiveStageKey === 'completed') {
    return <PerformMoveResultStage action={action} onSubmit={onSubmit} setSubmitEnabled={setSubmitEnabled} />;
  }

  const wizard = (action?.workflow?.stageData as { wizard?: { steps?: Array<{ key: string; label: string }> } } | undefined)?.wizard;
  const step = wizard?.steps?.find((s) => s.key === effectiveStageKey);

  return (
    <div className="text-sm text-white/50 rounded border border-white/10 p-4">
      <div className="font-medium text-white/70">{step?.label ?? effectiveStageKey}</div>
      <div className="mt-1 text-xs text-white/40">Серверная стадия</div>
    </div>
  );
}

/** Над каждой стадией (кроме выбора актора) держим NPC-атаку хода — она нужна до самых заявок на урон. */
export default function PerformMoveStage(props: ActionHandlerProps) {
  const { action, stageKey } = props;
  const entry = (action as any)?.workflow?.context?.entry;
  const key = String(stageKey ?? (action as any)?.workflow?.stageKey ?? '');
  const showBanner = Boolean(entry?.source_npc_id) && key !== 'perform_move.setup';
  return (
    <>
      {showBanner ? <NpcAttackBanner entry={entry} /> : null}
      <PerformMoveStageBody {...props} />
    </>
  );
}
