'use client';

import React from 'react';
import dynamic from 'next/dynamic';

export const UI_LOADERS: Record<string, () => Promise<any>> = {
  gumshoe: () => import('@/plugins/gumshoe/base/ui'),
  gumshoe_with_tasks: () => import('@/plugins/gumshoe/with_tasks/ui'),
  ezoterrorists: () => import('@/plugins/gumshoe/ezoterrorists/ui'),
  trail_of_cthulhu: () => import('@/plugins/gumshoe/trail_of_cthulhu/ui'),

  everyone_is_john: () => import('@/plugins/everyone_is_john/base/ui'),

  blades_in_the_dark: () => import('@/plugins/blades_in_the_dark/base/ui'),

  im_bitter_and_i_keep_records: () => import('@/plugins/im_bitter_and_i_keep_records/base/ui'),
  pbta: () => import('@/plugins/pbta/base/ui'),
  dungeon_world: () => import('@/plugins/pbta/dungeon_world/base/ui'),
  // dnd5e: () => import('@/plugins/dnd5e/ui'),
};