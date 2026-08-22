'use client';

import React, { useMemo } from 'react';
import type { StoryBeatList, FrontBadgeInfo } from '@/app/services/types2';
import { TYPE_COLORS, TYPE_ICONS } from '@/lib/constants';
import { ScenarioEntityCardShell } from './common/ScenarioEntityCardShell';
import { SceneExposuresPreview } from './common/SceneExposuresPreview';
import { frontsForEntityTags } from './common/FrontRibbon';

export function ScenarioStoryBeatCard({
  storyBeat,
  onEdit,
  onDelete,
  readOnly = false,
  frontBadges,
  onOpenFront,
}: {
  storyBeat: StoryBeatList;
  onEdit?: (storyBeat: StoryBeatList, readOnly: boolean) => void;
  onDelete?: (storyBeat: StoryBeatList) => Promise<void> | void;
  readOnly?: boolean;
  frontBadges?: FrontBadgeInfo[];
  onOpenFront?: (frontId: string) => void;
}) {
  const iconNode = <TYPE_ICONS.story_beat color={TYPE_COLORS.story_beat} className="w-8 h-8" />;

  const subtitle = useMemo(() => (
    `Порядок: ${storyBeat.order_num ?? 0}`
  ), [storyBeat.order_num]);

  const badges = useMemo(() => (
    <div className="flex items-center gap-2 text-[11px] text-gray-400">
      {storyBeat.parent_story_beat_id && (
        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10">Есть родитель</span>
      )}
    </div>
  ), [storyBeat.parent_story_beat_id]);

  return (
    <ScenarioEntityCardShell
      accentColor={TYPE_COLORS.story_beat}
      typeLabel="Story beat"
      title={storyBeat.name}
      subtitle={subtitle}
      iconNode={iconNode}
      badges={badges}
      footer={<SceneExposuresPreview exposures={storyBeat.scene_exposures} />}
      onView={onEdit ? () => onEdit(storyBeat, true) : undefined}
      onEdit={onEdit ? () => onEdit(storyBeat, false) : undefined}
      onDelete={onDelete ? () => onDelete(storyBeat) : undefined}
      readOnly={readOnly}
      todoProps={{ elementType: 'story_beat', elementId: storyBeat.id, elementName: storyBeat.name }}
      frontBadges={frontsForEntityTags(storyBeat.tags, frontBadges ?? [])}
      onOpenFront={onOpenFront}
    />
  );
}