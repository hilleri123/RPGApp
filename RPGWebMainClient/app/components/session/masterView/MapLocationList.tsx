'use client';

import React from "react";
import { Location } from "@/app/services/types2";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildLocationTree, LocationTree } from "../../common/LocationTree";

interface MapLocationListProps {
  currentLocation: Location | null;
  locationList: Location[];
  onClick: (location: Location) => void;
  onToggleHidden?: (locationId: string, hidden: boolean) => void;
  isMaster?: boolean;
  onToggleShowDescription?: (value: boolean) => void;
  onAddTODO?: (locationId: string, text: string) => void;
}

function getParent(loc: Location | null, all: Location[]): Location | null {
  if (!loc?.parent_location_id) return null;
  return all.find((x) => x.id === loc.parent_location_id) ?? null;
}

export default function MapLocationList({
  currentLocation,
  locationList,
  onClick,
  onToggleHidden,
  isMaster = true,
  onToggleShowDescription,
  onAddTODO,
}: MapLocationListProps) {
  const [tab, setTab] = React.useState<"tree" | "nearby">("tree");
  const [showDescription, setShowDescription] = React.useState(false);
  const [showHidden, setShowHidden] = React.useState(false);

  // для игроков скрытые всегда не видны
  const visibleLocations = React.useMemo(() => {
    if (isMaster) return locationList;
    return locationList.filter((loc) => !loc.tags?.includes("hidden"));
  }, [locationList, isMaster]);

  const treeNodes = React.useMemo(
    () => buildLocationTree(visibleLocations),
    [visibleLocations]
  );

  const parent = React.useMemo(
    () => getParent(currentLocation, visibleLocations),
    [currentLocation, visibleLocations]
  );

  const children = React.useMemo(() => {
    if (currentLocation) {
      return visibleLocations.filter((l) => l.parent_location_id === currentLocation.id);
    }
    return visibleLocations.filter((l) => !l.parent_location_id);
  }, [currentLocation, visibleLocations]);

  const onSelect = (location_id: string) => {
    const selected = visibleLocations.find((loc) => loc.id === location_id);
    if (selected) onClick(selected);
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <h3 className="text-lg font-semibold">Доступные карты</h3>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-gray-300">
            <Checkbox
              checked={showDescription}
              onCheckedChange={(v) => {
                setShowDescription(Boolean(v));
                onToggleShowDescription?.(Boolean(v));
              }}
            />
            Описание
          </label>

          {isMaster && (
            <label className="flex items-center gap-2 text-xs text-gray-300">
              <Checkbox
                checked={showHidden}
                onCheckedChange={(v) => setShowHidden(Boolean(v))}
              />
              Показывать скрытые
            </label>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="tree">Дерево</TabsTrigger>
          <TabsTrigger value="nearby">Соседние</TabsTrigger>
        </TabsList>

        <TabsContent value="tree" className="mt-3">
          <LocationTree
            nodes={treeNodes}
            onSelect={onSelect}
            onToggleHidden={isMaster ? onToggleHidden : undefined}
            onAddTODO={isMaster ? onAddTODO : undefined}
            currentLocation={currentLocation}
            isMaster={isMaster}
            showDescription={showDescription}
            showHidden={showHidden}
          />
        </TabsContent>

        <TabsContent value="nearby" className="mt-3">
          {!currentLocation ? (
            <div className="space-y-2">
              <div className="text-sm text-gray-300">Корневые локации</div>
              {children.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {children.map((c) => (
                    <Button
                      key={c.id}
                      variant="secondary"
                      className={`w-full justify-start ${c.tags?.includes("hidden") ? "opacity-50 line-through" : ""}`}
                      onClick={() => onClick(c)}
                    >
                      {c.name}
                      {c.tags?.includes("hidden") && isMaster && (
                        <span className="ml-2 text-xs text-gray-400">(скрыта)</span>
                      )}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">Нет доступных локаций.</div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-300 mb-2">Родитель</div>
                {parent ? (
                  <Button variant="secondary" className="w-full justify-start" onClick={() => onClick(parent)}>
                    ↑ {parent.name}
                  </Button>
                ) : (
                  <div className="text-sm text-gray-500">Нет родителя.</div>
                )}
              </div>
              <div>
                <div className="text-sm text-gray-300 mb-2">Дочерние</div>
                {children.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {children.map((c) => (
                      <Button
                        key={c.id}
                        variant={currentLocation.id === c.id ? "default" : "secondary"}
                        className={`w-full justify-start ${c.tags?.includes("hidden") ? "opacity-50" : ""}`}
                        onClick={() => onClick(c)}
                      >
                        {c.name}
                        {c.tags?.includes("hidden") && isMaster && (
                          <span className="ml-2 text-xs text-gray-400">(скрыта)</span>
                        )}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">Нет дочерних локаций.</div>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}