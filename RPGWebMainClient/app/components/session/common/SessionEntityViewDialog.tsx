'use client';

import React from 'react';
import { MapPin, Package, User, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TYPE_COLORS } from '@/lib/constants';
import { getNpcStyle } from '@/lib/constants';
import type { GameItem, Location, NPC, PlayerCharacter } from '@/app/services/types2';
import type { SeenDataAccess } from '@/app/services/types/playerSeen';
import { cn } from '@/lib/utils';
import type { PluginUI } from '@/app/plugins/pluginTypes';
import { SessionEntityPluginDataView } from './SessionEntityPluginDataView';

export type SessionEntityViewKind = 'npc' | 'game_item' | 'player_character' | 'location';

type SessionEntityViewDialogProps = {
  open: boolean;
  onClose: () => void;
  canDismiss?: boolean;
  kind: SessionEntityViewKind;
  entity: NPC | GameItem | PlayerCharacter | Location;
  dataAccess?: SeenDataAccess;
  onOpenData?: () => void;
  canOpenData?: boolean;
  onCloseData?: () => void;
  canCloseData?: boolean;
  pluginUI?: PluginUI | null;
  scenarioId?: string | null;
  sceneId?: string | null;
};

const KIND_META: Record<
  SessionEntityViewKind,
  { label: string; color: string; Icon: typeof Users }
> = {
  npc: { label: 'NPC', color: TYPE_COLORS.npc, Icon: Users },
  game_item: { label: 'Предмет', color: TYPE_COLORS.item, Icon: Package },
  player_character: { label: 'Персонаж', color: TYPE_COLORS.character, Icon: User },
  location: { label: 'Локация', color: TYPE_COLORS.location, Icon: MapPin },
};

const KINDS_WITH_RULES_DATA: SessionEntityViewKind[] = ['npc', 'game_item', 'player_character'];

function stripHtml(value?: string | null): string {
  if (!value) return '';
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function EntityMedia({
  entity,
  kind,
}: {
  entity: NPC | GameItem | PlayerCharacter | Location;
  kind: SessionEntityViewKind;
}) {
  const imgUrl =
    kind === 'location'
      ? (entity as Location).map_url ?? null
      : (entity as NPC).img_url ?? null;
  const iconUrl = entity.icon_url ?? null;

  if (imgUrl) {
    return (
      <div className="flex items-center justify-center w-full min-h-[180px] max-h-[320px] rounded-xl border border-white/10 bg-black/30 p-3">
        <img
          src={imgUrl}
          alt={entity.name}
          className="max-h-[280px] max-w-full object-contain"
        />
      </div>
    );
  }

  const DefaultIcon = KIND_META[kind].Icon;
  let fallbackIcon: React.ReactNode = <DefaultIcon className="w-16 h-16 text-white/80" />;

  if (kind === 'npc') {
    const npc = entity as NPC;
    const tags = npc.tags ?? [];
    const { icon: NpcIcon } = getNpcStyle(tags.includes('dead'), tags.includes('enemy'));
    fallbackIcon = <NpcIcon className="w-16 h-16 text-white/80" />;
  }

  return (
    <div className="flex items-center justify-center w-full min-h-[140px] rounded-xl border border-white/10 bg-black/30 p-6">
      {iconUrl ? (
        <img
          src={iconUrl}
          alt={entity.name}
          className="max-h-28 max-w-full object-contain"
        />
      ) : (
        fallbackIcon
      )}
    </div>
  );
}

function DescriptionBlock({
  title,
  html,
}: {
  title: string;
  html?: string | null;
}) {
  if (!html?.trim()) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</h3>
      <div
        className="prose prose-invert prose-sm max-w-none text-gray-200 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  );
}

export function SessionEntityViewDialog({
  open,
  onClose,
  canDismiss = true,
  kind,
  entity,
  dataAccess = 'none',
  onOpenData,
  canOpenData = false,
  onCloseData,
  canCloseData = false,
  pluginUI,
  scenarioId,
  sceneId,
}: SessionEntityViewDialogProps) {
  // Для NPC цвет и иконка зависят от тегов (враг — красный, мёртвый — серый), как в квадрате.
  const npcTags = kind === 'npc' ? ((entity as NPC).tags ?? []).map(String) : [];
  const npcStyle = kind === 'npc' ? getNpcStyle(npcTags.includes('dead'), npcTags.includes('enemy')) : null;
  const meta = npcStyle
    ? { ...KIND_META[kind], color: npcStyle.color, Icon: npcStyle.icon }
    : KIND_META[kind];
  const description =
    (entity as NPC).description_for_players ??
    (entity as Location).description_for_players ??
    null;
  const story = kind === 'player_character' ? (entity as PlayerCharacter).story : null;
  const rulesData =
    dataAccess === 'full' && 'data' in entity && entity.data && typeof entity.data === 'object'
      ? (entity.data as Record<string, unknown>)
      : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && canDismiss) onClose();
      }}
    >
      <DialogContent className="max-w-lg w-[calc(100vw-1.5rem)] max-h-[90dvh] overflow-y-auto bg-gray-950 border border-white/10 text-white p-0 gap-0">
        <div className="h-1.5 shrink-0" style={{ backgroundColor: meta.color }} />

        <div className="p-4 sm:p-5 space-y-4">
          <DialogHeader className="space-y-2 text-left p-0">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
              >
                <meta.Icon className="w-3 h-3" />
                {meta.label}
              </span>
            </div>
            <DialogTitle className="text-xl font-semibold leading-tight text-white">
              {entity.name}
            </DialogTitle>
            {kind === 'player_character' && (entity as PlayerCharacter).short_desc ? (
              <p className="text-sm text-gray-400">{(entity as PlayerCharacter).short_desc}</p>
            ) : description ? (
              <p className="text-sm text-gray-500 line-clamp-2">{stripHtml(description)}</p>
            ) : null}
          </DialogHeader>

          <EntityMedia entity={entity} kind={kind} />

          {story ? (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">История</h3>
              <div
                className="prose prose-invert prose-sm max-w-none text-gray-200"
                dangerouslySetInnerHTML={{ __html: story }}
              />
            </section>
          ) : null}

          <DescriptionBlock title="Описание" html={description} />

          {rulesData && KINDS_WITH_RULES_DATA.includes(kind) ? (
            <SessionEntityPluginDataView
              kind={kind}
              data={rulesData}
              pluginUI={pluginUI}
              scenarioId={scenarioId}
              sceneId={sceneId}
            />
          ) : null}

          {dataAccess !== 'full' && KINDS_WITH_RULES_DATA.includes(kind) ? (
            <p className={cn('text-xs text-gray-500 italic')}>
              Подробные игровые данные пока скрыты.
            </p>
          ) : null}
        </div>

        {canDismiss ? (
          <div className="sticky bottom-0 border-t border-white/10 bg-gray-950/95 backdrop-blur px-4 py-3 space-y-2">
            {canOpenData && onOpenData ? (
              <Button variant="default" className="w-full" onClick={onOpenData}>
                Открыть данные игрокам
              </Button>
            ) : null}
            {canCloseData && onCloseData ? (
              <Button variant="outline" className="w-full border-orange-500/40 text-orange-200 hover:bg-orange-950/40" onClick={onCloseData}>
                Закрыть данные
              </Button>
            ) : null}
            <Button variant="secondary" className="w-full" onClick={onClose}>
              Закрыть
            </Button>
          </div>
        ) : (
          <div className="sticky bottom-0 border-t border-white/10 bg-gray-950/95 backdrop-blur px-4 py-3">
            <p className="text-center text-xs text-gray-500">
              Мастер закроет просмотр для всех
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
