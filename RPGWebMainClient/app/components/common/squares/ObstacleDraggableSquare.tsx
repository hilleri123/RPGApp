'use client';

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { ObstacleOutInline } from "@/app/services/types2";
import { ContextItem, DraggableSquare } from "../DraggableSquare";
import { Shield } from "lucide-react";
import { TYPE_ICONS, TYPE_COLORS } from "@/lib/constants";



interface ObstacleDraggableSquareProps {
  obstacle: ObstacleOutInline;
  onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void; 
  contextItems?: ContextItem[];
  onInfo?: () => void;
  isFullSize?: boolean; 
  isMaster?: boolean; 
  draggable?: boolean
}

export function ObstacleDraggableSquare({
  obstacle,
  onContextMenu,
  contextItems,
  onInfo,
  isFullSize,
  isMaster,
  draggable,
}: ObstacleDraggableSquareProps) {


  const handleDragStart = (e: React.DragEvent, action: ObstacleOutInline) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("application/element-id", action.id);
    e.dataTransfer.setData("application/element-type", "PlayerObstacle");
    e.dataTransfer.setData("application/json", JSON.stringify(action));
  };


  return (
    <DraggableSquare
      name={obstacle.name}
      color={TYPE_COLORS.obstacle}
      icon={<TYPE_ICONS.obstacle className="w-6 h-6" />}
      onContextMenu={onContextMenu}
      contextItems={contextItems}
      onInfo={onInfo}
      isFullSize={isFullSize}
      draggable={draggable}
      onDragStart={(e) => { handleDragStart(e, obstacle) }}
      description={
        <div className="min-w-[220px] max-w-xs space-y-3">
          <div className="font-semibold text-white text-sm">
            {obstacle.description_for_players}
          </div>
          {isMaster &&
            <div className="text-xs text-gray-400">
              Мастеру: {obstacle.description_for_master}
            </div>
          }
        </div>
      }
    />
  );
}

export function parseObstacleFromDragEvent(
  e: DragEvent | React.DragEvent
): ObstacleOutInline | null {
  if (e.dataTransfer?.getData("application/element-type") != "PlayerObstacle")
    return null;
  const json = e.dataTransfer?.getData("application/json");
  if (!json) return null;
  try {
    const action = JSON.parse(json) as ObstacleOutInline;
    if (action && action.id) {
      return action;
    }
    return null;
  } catch {
    return null;
  }
}