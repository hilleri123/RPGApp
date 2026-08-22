// components/master/StoryBeatPicker.tsx
"use client";

import { useMemo, useState } from "react";
import type { StoryBeatOut } from "@/app/services/types2";
import type { Scene } from "@/app/services/types/session";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  EntityTagFilterChips,
  collectTagKeysFromItems,
  entityHasAllTags,
} from "@/app/components/scenarios/dialogs/common/EntityTagFilterChips";

interface StoryBeatPickerProps {
  storyBeats: StoryBeatOut[];
  scene: Scene | null;
  onSelect: (beat: StoryBeatOut) => void;
  /** Extra tags that must all match (e.g. selected front tag_key). */
  requiredTags?: string[];
}

function getStoryBeatGroupPriority(beat: StoryBeatOut, scene: Scene | null): number {
  if (!scene) return 2;

  const locationIds = beat.location_ids ?? [];
  const npcIds = beat.npc_ids ?? [];

  const sceneLocationId = (scene as any).location_id ?? null;
  const sceneNpcIds: string[] = ((scene as any).npcs ?? []).map((n: any) =>
    String(n.id),
  );

  if (sceneLocationId && locationIds.includes(sceneLocationId)) return 0;
  if (sceneNpcIds.some((id) => npcIds.includes(id))) return 1;
  return 2;
}

export function StoryBeatPicker({
  storyBeats,
  scene,
  onSelect,
  requiredTags = [],
}: StoryBeatPickerProps) {
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const tagOptions = useMemo(
    () => collectTagKeysFromItems(storyBeats.map((b) => ({ tags: b.tags ?? [] }))),
    [storyBeats],
  );

  const sorted = useMemo(() => {
    const filtered = storyBeats.filter((b) => {
      if (!entityHasAllTags(b.tags, requiredTags)) return false;
      if (!entityHasAllTags(b.tags, activeTags)) return false;
      return b.name.toLowerCase().includes(search.toLowerCase());
    });

    return [...filtered].sort((a, b) => {
      const ga = getStoryBeatGroupPriority(a, scene);
      const gb = getStoryBeatGroupPriority(b, scene);
      if (ga !== gb) return ga - gb;
      return (a.order_num ?? 0) - (b.order_num ?? 0);
    });
  }, [storyBeats, scene, search, activeTags, requiredTags]);

  const groups: Record<number, { label: string; beats: StoryBeatOut[] }> = {
    0: { label: "По локации сцены", beats: [] },
    1: { label: "По NPC сцены", beats: [] },
    2: { label: "Остальные", beats: [] },
  };

  for (const beat of sorted) {
    const g = getStoryBeatGroupPriority(beat, scene);
    groups[g].beats.push(beat);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="mb-2 space-y-2">
        <input
          className="w-full border rounded px-2 py-1 text-sm bg-gray-900 border-gray-700 text-white"
          placeholder="Поиск по названию…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {tagOptions.length > 0 ? (
          <EntityTagFilterChips options={tagOptions} value={activeTags} onChange={setActiveTags} />
        ) : null}
      </div>

      <ScrollArea className="h-full pr-3">
        <div className="flex flex-col gap-4">
          {([0, 1, 2] as const).map((key) => {
            const { label, beats } = groups[key];
            if (!beats.length) return null;

            return (
              <div key={key}>
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">
                  {label}
                </p>
                <div className="flex flex-col gap-1">
                  {beats.map((beat) => (
                    <button
                      key={beat.id}
                      type="button"
                      onClick={() => onSelect(beat)}
                      className="w-full text-left px-3 py-2 rounded bg-gray-800 border border-gray-700 hover:bg-gray-750 transition-colors text-sm"
                    >
                      <div className="font-medium truncate">
                        {beat.name || "(без названия)"}
                      </div>
                      {beat.text_for_master && (
                        <div
                          className="text-xs text-gray-300 line-clamp-1"
                          dangerouslySetInnerHTML={{
                            __html: beat.text_for_master,
                          }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {sorted.length === 0 && (
            <div className="text-xs text-gray-500 italic">
              Стори‑битов пока нет
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
