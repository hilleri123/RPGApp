import { useState } from "react";
import { Users, Gamepad2, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

interface TimeLineEvent {
  id: string;
  title: string;
  description: string;
  type: string;
  time: Date;
  position: number; // 0-100, процент по линии
}

interface TimeLineScene {
  id: string;
  title: string;
  description: string;
  color: string; // например, "from-green-400 to-blue-500"
  icon: React.ComponentType<{ className?: string }>;
  timePosition: number; // 0-100
}

interface TimeLineProps {
  events: TimeLineEvent[];
  scenes: TimeLineScene[];
  connectedPlayers: { status: string }[];
  showPlayersPanel: boolean;
  setShowPlayersPanel: (v: boolean) => void;
  showSessionPanel: boolean;
  setShowSessionPanel: (v: boolean) => void;
  updateSceneTimePosition: (sceneId: string, position: number) => void;
  getEventTypeColor: (type: string) => string;
}

export function TimeLine({
  events,
  scenes,
  connectedPlayers,
  showPlayersPanel,
  setShowPlayersPanel,
  showSessionPanel,
  setShowSessionPanel,
  updateSceneTimePosition,
  getEventTypeColor,
}: TimeLineProps) {
  const [collapsed, setCollapsed] = useState(false);

  // TODO
  return ( <div/> );

  if (collapsed) {
    return (
      <div className="fixed bottom-0 right-0 z-50 p-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Показать временную ленту
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-4 z-50">
      <div className="max-w-full mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => setShowPlayersPanel(!showPlayersPanel)}
              variant={showPlayersPanel ? "secondary" : "outline"}
              className="flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              Игроки ({connectedPlayers.filter((p) => p.status === "online").length})
            </Button>
            <Button
              onClick={() => setShowSessionPanel(!showSessionPanel)}
              variant={showSessionPanel ? "secondary" : "outline"}
              className="flex items-center gap-2"
            >
              <Gamepad2 className="w-4 h-4" />
              Сессия
            </Button>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Временная лента событий
            </h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(true)}
            className="flex items-center gap-2"
          >
            Скрыть
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="relative bg-gray-900 rounded-lg p-4 h-24">
          <div className="absolute top-1/2 left-4 right-4 h-1 bg-gray-600 rounded-full transform -translate-y-1/2" />

          <TooltipProvider>
            {events.map((event) => (
              <Tooltip key={event.id}>
                <TooltipTrigger asChild>
                  <div
                    className={`absolute w-1 h-12 ${getEventTypeColor(event.type)} rounded-full cursor-pointer hover:scale-110 transition-transform transform -translate-y-1/2`}
                    style={{
                      left: `${event.position}%`,
                      top: "50%",
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-gray-700 border-gray-600">
                  <div className="text-sm">
                    <div className="font-semibold">{event.title}</div>
                    <div className="text-gray-300">{event.description}</div>
                    <div className="text-xs text-gray-400 mt-1">{event.time.toLocaleTimeString()}</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>

          {scenes.map((scene) => (
            <TooltipProvider key={scene.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`absolute w-6 h-6 bg-gradient-to-r ${scene.color} rounded-full cursor-pointer hover:scale-110 transition-transform transform -translate-y-1/2 border-2 border-white shadow-lg`}
                    style={{
                      left: `${scene.timePosition}%`,
                      top: "50%",
                    }}
                    draggable
                    onDragEnd={(e) => {
                      const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                      if (rect) {
                        const newPosition = ((e.clientX - rect.left - 16) / (rect.width - 32)) * 100;
                        const clampedPosition = Math.max(0, Math.min(100, newPosition));
                        updateSceneTimePosition(scene.id, clampedPosition);
                      }
                    }}
                  >
                    <scene.icon className="w-3 h-3 text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="bg-gray-700 border-gray-600">
                  <div className="text-sm">
                    <div className="font-semibold">{scene.title}</div>
                    <div className="text-gray-300">{scene.description}</div>
                    <div className="text-xs text-gray-400 mt-1">Позиция: {Math.round(scene.timePosition)}%</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}

          <div className="absolute bottom-1 left-4 right-4 flex justify-between text-xs text-gray-400">
            <span>Начало</span>
            <span>Сейчас</span>
          </div>
        </div>
      </div>
    </div>
  );
}
