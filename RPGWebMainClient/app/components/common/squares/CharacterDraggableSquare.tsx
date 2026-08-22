'use client';

import React, { useMemo } from "react";
import { PlayerCharacter, GameItemOut } from "@/app/services/types2";
import { ContextItem, DraggableSquare } from "../DraggableSquare";
import { Crown, PersonStanding } from "lucide-react";
import { Player } from "@/app/services/types/lobby";
import { TYPE_COLORS, TYPE_ICONS } from "@/lib/constants";





interface CharacterDraggableSquareProps {
  character: PlayerCharacter;
  player?: Player;
  onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void; 
  contextItems?: ContextItem[];
  onInfo?: () => void;
  isFullSize?: boolean; 
  isMaster?: boolean; 
  draggable?: boolean
}

export function CharacterDraggableSquare({
  character,
  player,
  onContextMenu,
  contextItems,
  onInfo,
  isFullSize,
  isMaster,
  draggable,
}: CharacterDraggableSquareProps) {


  const handleDragStart = (e: React.DragEvent, character: PlayerCharacter) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("application/element-id", character.id);
    e.dataTransfer.setData("application/element-type", "PlayerCharacter");
    e.dataTransfer.setData("application/json", JSON.stringify(character));
  };

  const iconColor = player?.color || "#ffffff";

  let icon: React.ReactNode;

  if (isFullSize && character.img_url) {
    icon = (
      <img
        src={character.img_url}
        alt={character.name}
        className="w-12 h-12 object-cover rounded-lg shadow"
        style={{ background: "#24273d" }}
      />
    );
  } else if (character.icon_url) {
    icon = (
      <img
        src={character.icon_url}
        alt={character.name}
        className="w-8 h-8 object-contain rounded"
        style={{ background: "#24273d" }}
      />
    );
  } else {
    icon = <TYPE_ICONS.character color={iconColor} className="w-6 h-6" />;
  }

  return (
    <DraggableSquare
      name={character.name}
      color={TYPE_COLORS.character}
      icon={icon}
      onContextMenu={onContextMenu}
      contextItems={contextItems}
      onInfo={onInfo}
      isFullSize={isFullSize}
      draggable={draggable}
      onDragStart={(e) => { handleDragStart(e, character) }}
      description={
        <div className="min-w-[220px] max-w-xs space-y-3">
          <div className="font-semibold text-white text-sm">
            {character.name}
          </div>
          <div className="text-xs text-gray-400">
            {character.short_desc}
          </div>
        </div>
      }
      overlay={<QuestItemMarks items={character.owned_items ?? []} isFullSize={isFullSize} />}
    />
  );
}

export function parsePlayerCharacterFromDragEvent(
  e: DragEvent | React.DragEvent
): PlayerCharacter | null {
  if (e.dataTransfer?.getData("application/element-type") != "PlayerCharacter")
    return null;
  const json = e.dataTransfer?.getData("application/json");
  if (!json) return null;
  try {
    const character = JSON.parse(json) as PlayerCharacter;
    if (character && character.name && character.id) {
      return character;
    }
    return null;
  } catch {
    return null;
  }
}















function QuestItemMarks({
  items,
  isFullSize,
}: {
  items: GameItemOut[];
  isFullSize?: boolean;
}) {
  const marks = useMemo(() => {
    const out: Array<{ id: string; html: string }> = [];
    for (const it of items) {
      const html = it.quest_html_mark;
      if (typeof html !== 'string') continue;
      const s = html.trim();
      if (!s) continue;
      out.push({ id: String(it.id), html: s });
      if (out.length >= 4) break;
    }
    return out;
  }, [items]);

  if (marks.length === 0) return null;

  const box = isFullSize ? 32 : 4;
  const outerClass = isFullSize ? 'w-8 h-8' : 'w-4 h-4';

  const innerStyle: React.CSSProperties = isFullSize
    ? {}
    : { width: 32, height: 32, transform: 'scale(0.125)', transformOrigin: 'top left' };

  return (
    <>
      {marks.map((m) => (
        <div
          key={m.id}
          className={`${outerClass} rounded border border-black/40 bg-black/30 overflow-hidden`}
        >
          {/* fill */}
          <div className="w-full h-full">
            {isFullSize ? (
              <div
                className="w-full h-full"
                dangerouslySetInnerHTML={{ __html: m.html }}
              />
            ) : (
              // small: тоже растягиваемся на весь контейнер,
              // но если ты хочешь именно "весь красный" — без scale вообще
              <div
                className="w-full h-full"
                dangerouslySetInnerHTML={{ __html: m.html }}
              />
            )}
          </div>
        </div>
      ))}

    </>
  );
}
