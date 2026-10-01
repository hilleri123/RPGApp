'use client';

import React from "react";
import { NPC } from "@/app/services/types2";
import { ContextItem, DataRevealedBadge, DraggableSquare } from "../DraggableSquare";
import { Flame, Frown, LucideIcon, PersonStanding, Skull, Smile } from "lucide-react";
import { getNpcStyle } from "@/lib/constants";


interface NPCDraggableSquareProps {
  npc: NPC;
  onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void; 
  contextItems?: ContextItem[];
  onInfo?: () => void;
  isFullSize?: boolean; 
  isMaster?: boolean; 
  draggable?: boolean;
  dataRevealed?: boolean;
}

export function NPCDraggableSquare({
  npc,
  onContextMenu,
  contextItems,
  onInfo,
  isFullSize,
  isMaster,
  draggable,
  dataRevealed,
}: NPCDraggableSquareProps) {
  const handleDragStart = (e: React.DragEvent, npc: NPC) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("application/element-id", npc.id);
    e.dataTransfer.setData("application/element-type", "NPC");
    e.dataTransfer.setData("application/json", JSON.stringify(npc));
  };
  const tags = npc?.tags ?? [];

  const is_dead = tags.includes("dead");
  const is_enemy = tags.includes("enemy");
  const { color, icon: Icon } = getNpcStyle(is_dead, is_enemy);

  let icon: React.ReactNode;

  if (isFullSize && npc.img_url) {
    icon = (
      <img
        src={npc.img_url}
        alt={npc.name}
        className="w-12 h-12 object-cover rounded-lg shadow"
      />
    );
  } else if (npc.icon_url) {
    icon = (
      <img
        src={npc.icon_url}
        alt={npc.name}
        className="w-8 h-8 object-contain rounded"
      />
    );
  } else {
    icon = <Icon className="w-6 h-6" />;
  }

  return (
    <DraggableSquare
      name={npc.name}
      color={color}
      icon={icon}
      onContextMenu={onContextMenu}
      contextItems={contextItems}
      onInfo={onInfo}
      isFullSize={isFullSize}
      draggable={draggable}
      onDragStart={(e) => { handleDragStart(e, npc) }}
      overlay={dataRevealed ? <DataRevealedBadge isFullSize={isFullSize} /> : undefined}
      description={
        <div className="min-w-[220px] max-w-xs space-y-3">
          <h2 className="font-semibold text-white text-sm">
            {npc.name}
          </h2>
          <h3>{is_enemy ? "Враг" : ""}</h3>
          <div className="text-xs text-gray-400">
            {npc.description_for_players}
          </div>
          {isMaster &&
            <div className="text-xs text-gray-400">
              Мастеру: {npc.description_for_master}
            </div>
          }
        </div>
      }
    />
  );
}

export function parseNPCFromDragEvent(
  e: DragEvent | React.DragEvent
): NPC | null {
  if (e.dataTransfer?.getData("application/element-type") != "NPC")
    return null;
  const json = e.dataTransfer?.getData("application/json");
  if (!json) return null;
  try {
    const npc = JSON.parse(json) as NPC;
    if (npc && npc.name && npc.id) {
      return npc;
    }
    return null;
  } catch {
    return null;
  }
}
