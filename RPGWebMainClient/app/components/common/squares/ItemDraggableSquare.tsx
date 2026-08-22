'use client';

import React, { useMemo } from "react";
import { GameItem } from "@/app/services/types2";
import { ContextItem, DataRevealedBadge, DraggableSquare } from "../DraggableSquare";
import { Crown, MapPin, Package, PersonStanding, ShoppingBag } from "lucide-react";
import { getNpcStyle, TYPE_COLORS, TYPE_ICONS } from "@/lib/constants";


interface ItemDraggableSquareProps {
  item: GameItem;
  onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void; 
  contextItems?: ContextItem[];
  onInfo?: () => void;
  isFullSize?: boolean; 
  isMaster?: boolean; 
  draggable?: boolean;
  dataRevealed?: boolean;
}

export function ItemDraggableSquare({
  item,
  onContextMenu,
  contextItems,
  onInfo,
  isFullSize,
  isMaster,
  draggable,
  dataRevealed,
}: ItemDraggableSquareProps) {


  const handleDragStart = (e: React.DragEvent, item: GameItem) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("application/element-id", item.id);
    e.dataTransfer.setData("application/element-type", "GameItem");
    e.dataTransfer.setData("application/json", JSON.stringify(item));
  };

  let icon: React.ReactNode;

  if (isFullSize && (item.img_url)) {
    icon = (
      <img
        src={item.img_url}
        alt={item.name}
        className="w-12 h-12 object-cover rounded-lg shadow"
        style={{ background: "#24273d" }}
      />
    );
  } else if (item.icon_url) {
    icon = (
      <img
        src={item.icon_url}
        alt={item.name}
        className="w-8 h-8 object-contain rounded"
        style={{ background: "#24273d" }}
      />
    );
  } else {
    icon = <TYPE_ICONS.item className="w-6 h-6" />;
  }

  return (
    <DraggableSquare
      name={item.name}
      color={TYPE_COLORS.item}
      icon={icon}
      onContextMenu={onContextMenu}
      contextItems={contextItems}
      onInfo={onInfo}
      isFullSize={isFullSize}
      draggable={draggable}
      onDragStart={(e) => { handleDragStart(e, item) }}
      overlay={
        <>
          {dataRevealed ? <DataRevealedBadge isFullSize={isFullSize} /> : null}
          <ItemQuestMark item={item} isFullSize={isFullSize} />
        </>
      }
      description={
        <div className="min-w-[220px] max-w-xs space-y-3">
          <div className="font-semibold text-white text-sm">
            {item.name}
            {/* 
            {item.character && (() => {
              const color = TYPE_COLORS.character;
              return (
                <span className="flex items-center gap-1 text-xs" style={color ? { color } : {}}>
                  <TYPE_ICONS.character className="w-4 h-4" />
                  {item.character.name}
                </span>
              );
            })()}

            {item.npc && (() => {
              const { color, icon: Icon } = getNpcStyle(item.npc.is_dead, item.npc.is_enemy);
              return (
                <span className="flex items-center gap-1 text-xs" style={color ? { color } : {}}>
                  <Icon className="w-4 h-4" />
                  {item.npc.name}
                </span>
              );
            })()}

            {item.location && (() => {
              const color = TYPE_COLORS.location;
              return (
                <span className="flex items-center gap-1 text-xs" style={color ? { color } : {}}>
                  <TYPE_ICONS.location className="w-4 h-4" />
                  {item.location.name}
                </span>
              );
            })()}
            */}
          </div>
          <div className="text-xs text-gray-400">
            {item.description_for_players}
          </div>
          {isMaster &&
            <div className="text-xs text-gray-400">
              Мастеру: {item.description_for_master}
            </div>
          }
        </div>
      }
    />
  );
}

export function parseGameItemFromDragEvent(
  e: DragEvent | React.DragEvent
): GameItem | null {
  if (e.dataTransfer?.getData("application/element-type") != "GameItem")
    return null;
  const json = e.dataTransfer?.getData("application/json");
  if (!json) return null;
  try {
    const item = JSON.parse(json) as GameItem;
    if (item && item.name && item.id) {
      return item;
    }
    return null;
  } catch {
    return null;
  }
}



function ItemQuestMark({
  item,
  isFullSize,
}: {
  item: GameItem;
  isFullSize?: boolean;
}) {
  const html = useMemo(() => {
    const s = item.quest_html_mark;
    if (typeof s !== "string") return null;
    const t = s.trim();
    return t.length ? t : null;
  }, [item.quest_html_mark]);

  if (!html) return null;

  // FULL: реальный HTML 32x32
  if (isFullSize) {
    return (
      <div className="w-8 h-8 rounded border border-black/40 bg-black/30 overflow-hidden">
        <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    );
  }

  // SMALL: тестовый режим — тоже покажем HTML, но он должен быть width/height:100%
  return (
    <div className="w-4 h-4 rounded border border-black/40 bg-black/30 overflow-hidden">
      <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
