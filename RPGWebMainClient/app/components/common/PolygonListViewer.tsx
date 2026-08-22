'use client';

import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import { Location, MapObjectPolygon } from "@/app/services/types2";

interface PolygonListViewerProps {
  location: Location;
  enabledPolygonIds: string[];
  onToggleShown?: (polygonId: string, value: boolean) => void;
  onEditPolygon?: (polygon: MapObjectPolygon) => void;
  onDeletePolygon?: (polygonId: string) => void;
  editable?: boolean;
  isMaster?: boolean;
}

export function PolygonListViewer({
  location,
  enabledPolygonIds,
  onToggleShown,
  onEditPolygon,
  onDeletePolygon,
  editable = false,
  isMaster = true
}: PolygonListViewerProps) {
  if (!location?.map_objects?.length) {
    if (!editable) {
      return (<></>);
    }
    return (
      <div className="text-center py-8 text-gray-400">
        <p className="text-sm">Полигоны не созданы</p>
        <p className="text-xs">Нажмите "Новый полигон" для начала</p>
      </div>
    );
  }
  const sortedPolygons = [...location.map_objects].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="font-semibold">Полигоны</span>
        {isMaster &&
          <Badge variant="secondary">{location.map_objects.length}</Badge>
        }
      </div>
      <div className="space-y-2">
        {sortedPolygons.map((polygon) => {
          console.debug(polygon)
          if (!enabledPolygonIds.includes(polygon.id) && !isMaster)
            return ;
          return (
          <div
            key={polygon.id}
            className="flex items-center gap-3 p-2 rounded-lg border bg-gray-800 border-gray-600 hover:bg-gray-750 transition-all"
          >
            {onToggleShown &&
              <Checkbox
                checked={enabledPolygonIds.includes(polygon.id)}
                onCheckedChange={(checked) =>
                  onToggleShown && onToggleShown(polygon.id, !!checked)
                }
              />
            }
            <span className="font-medium text-sm">{polygon.name}</span>
            <span className="text-xs text-gray-400">
              {polygon.polygon_list.length} точек
              {polygon.is_filled && " • Заполнен"}
              {!polygon.is_line && " • Замкнут"}
            </span>
            {editable && (
              <div className="flex gap-1 ml-auto">
                {onEditPolygon &&
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => onEditPolygon?.(polygon)}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                }
                {onDeletePolygon &&
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-red-400"
                    onClick={() => onDeletePolygon?.(polygon.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                }
              </div>
            )}
          </div>
        )})}
      </div>
    </div>
  );
}
