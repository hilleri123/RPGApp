'use client';

import React, { useMemo, useState } from "react";
import { List, MapPin, Plus, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { PlayerCharacter, Location, MapObjectPolygon } from "@/app/services/types2";
import MapLocationList from "../masterView/MapLocationList";
import MapViewerPure from "./MapViewerPure";
import FullscreenMap from "./FullscreenMap";
import { GameSessionBase, Scene } from "@/app/services/types/session";
import { useMapUiStore } from "@/app/services/stores/mapUi";
import { resolveSceneMapLocation } from "./SceneMiniMap";
import { locationWithDisplayPolygons } from "./mapPolygons";
import { SessionMapDrawBar } from "./SessionMapDrawBar";
import { useSessionScenarioApi } from "@/app/services/hooks/session/useSessionScenarioApi";
import type { MapObjectPolygonPoint } from "@/app/services/types2";

type CheckedState = boolean | "indeterminate";

interface MapSectionProps {
  currentLocation: Location | null;
  locationList: Location[];
  characters: PlayerCharacter[];
  enabledPolygonIds: string[];

  updateLocationPolygonVisibility?: (locationId: string, polygonId: string, value: boolean) => void;
  setCurrentLocation: (location: Location) => void;

  scenes?: Scene[];
  session?: GameSessionBase;

  editable: boolean;
  className?: string;
  isMaster?: boolean;
  compact?: boolean;

  homeLocation?: Location | null;

  onCreateLocation?: () => void;
  onEditLocation?: (location: Location) => void;

  onToggleHidden?: (locationId: string, hidden: boolean) => void;
  onAddTODO?: (locationId: string, text: string) => void;
}

function filterVisibleForPlayer(locations: Location[], isMaster?: boolean) {
  if (isMaster) return locations;
  return locations;
}

export default function MapSection({
  currentLocation,
  locationList,
  characters,
  enabledPolygonIds,
  updateLocationPolygonVisibility,
  setCurrentLocation,
  scenes,
  session,
  editable,
  className,
  isMaster = false,
  compact = false,
  homeLocation,
  onCreateLocation,
  onEditLocation,
  onToggleHidden,
  onAddTODO,
}: MapSectionProps) {
  const [fullscreenMap, setFullscreenMap] = useState(false);
  const showParentMapIfNoImage = useMapUiStore((s) => s.showParentMapIfNoImage);
  const setShowParentMapIfNoImage = useMapUiStore((s) => s.setShowParentMapIfNoImage);
  const [locationsOpen, setLocationsOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [draftPoints, setDraftPoints] = useState<MapObjectPolygonPoint[]>([]);
  const [areaName, setAreaName] = useState("");
  const [savingArea, setSavingArea] = useState(false);
  const [drawError, setDrawError] = useState<string | null>(null);
  const { api, reloadSessionFields } = useSessionScenarioApi();

  const visibleLocations = useMemo(
    () => filterVisibleForPlayer(locationList, isMaster),
    [locationList, isMaster]
  );

  const mapLocation = useMemo(() => {
    if (!currentLocation) return null;
    // Prefer parent map when checkbox is on and current location has no map;
    // otherwise keep current location so the viewer can show "Нет карты".
    const resolved = resolveSceneMapLocation(
      currentLocation,
      visibleLocations,
      showParentMapIfNoImage,
    );
    return resolved ?? currentLocation;
  }, [currentLocation, visibleLocations, showParentMapIfNoImage]);

  const mapTitleSuffix =
    mapLocation && currentLocation && mapLocation.id !== currentLocation.id
      ? ` (карта: ${mapLocation.name})`
      : "";

  const mapForView = useMemo(
    () => (mapLocation ? locationWithDisplayPolygons(mapLocation, visibleLocations) : null),
    [mapLocation, visibleLocations],
  );

  const cancelDraw = () => {
    setDrawing(false);
    setDraftPoints([]);
    setAreaName("");
    setDrawError(null);
  };

  const saveArea = async () => {
    if (!mapLocation || draftPoints.length < 3 || !areaName.trim()) return;
    if (!api) {
      setDrawError("Нет сценария сессии");
      return;
    }
    setSavingArea(true);
    setDrawError(null);
    try {
      const result = await api.createLocation({
        name: areaName.trim(),
        description_for_master: "",
        description_for_players: "",
        parent_location_id: mapLocation.id,
        force: true,
        data: {},
        tags: [],
        sublocations: [],
        scene_exposures: [],
        map_objects: [
          {
            name: areaName.trim(),
            source_location_id: mapLocation.id,
            target_location_id: null,
            is_shown: true,
            is_filled: true,
            is_line: false,
            alpha: 0.35,
            color: "#74c0fc",
            polygon_list: draftPoints,
          },
        ],
      });
      if (!result.location) {
        setDrawError(result.issues?.[0]?.message || "Не удалось сохранить область");
        return;
      }
      const polygonId = result.location.map_objects?.[0]?.id;
      if (polygonId) {
        updateLocationPolygonVisibility?.(mapLocation.id, String(polygonId), true);
      }
      reloadSessionFields(["locations"]);
      cancelDraw();
    } catch (err) {
      setDrawError(err instanceof Error ? err.message : "Не удалось сохранить область");
    } finally {
      setSavingArea(false);
    }
  };

  const drawBar = isMaster && mapLocation ? (
    <SessionMapDrawBar
      drawing={drawing}
      pointCount={draftPoints.length}
      name={areaName}
      saving={savingArea}
      error={drawError}
      onName={setAreaName}
      onStart={() => {
        setDrawing(true);
        setDraftPoints([]);
        setAreaName("");
        setDrawError(null);
      }}
      onUndo={() => setDraftPoints((points) => points.slice(0, -1))}
      onCancel={cancelDraw}
      onSave={() => void saveArea()}
    />
  ) : null;

  const onToggleShown = (polygonId: string, value: boolean) => {
    if (!mapLocation) return;
    updateLocationPolygonVisibility?.(mapLocation.id, polygonId, value);
  };

  const onPolygonClicked = (_polygon: MapObjectPolygon) => {};

  const canGoHome =
    Boolean(homeLocation?.id) &&
    Boolean(currentLocation?.id) &&
    homeLocation!.id !== currentLocation!.id;

  const handleSelectLocation = (loc: Location) => {
    setCurrentLocation(loc);
    setLocationsOpen(false);
  };

  const openTextModal = () => {
    if (!currentLocation) return;
    setTextOpen(true);
  };

  const isPlayer = !isMaster;

  return (
    <div
      className={`${className ?? ""} ${compact ? "p-2 gap-3" : "p-6 border-r border-gray-700 gap-4"} flex flex-col h-full min-h-0`}
    >
      {/* Header */}
      <div
        className={
          isPlayer
            ? "flex flex-col gap-2"
            : "flex items-start justify-between gap-3"
        }
      >
        {/* Заголовок + кнопка редактирования */}
        <div className="flex items-center gap-2 min-w-0">
          <h2 className={`${compact ? "text-base" : "text-xl"} font-bold flex items-center gap-2 truncate`}>
            <MapPin className="w-5 h-5 shrink-0" />
            {currentLocation?.name ?? "Локация не выбрана"}
            {mapTitleSuffix}
          </h2>

          {isMaster && currentLocation && onEditLocation && (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              title="Редактировать локацию"
              onClick={() => onEditLocation(currentLocation)}
            >
              <Pencil className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Кнопки управления */}
        <div
          className={
            isPlayer
              ? "flex flex-wrap gap-2"
              : "flex items-center gap-2"
          }
        >
          <Button variant="secondary" onClick={() => setLocationsOpen(true)}>
            <List className="w-4 h-4 mr-2" />
            Локации
          </Button>

          {isMaster && onCreateLocation && (
            <Button variant="secondary" onClick={onCreateLocation}>
              <Plus className="w-4 h-4 mr-2" />
              Создать
            </Button>
          )}

          {drawBar}

          {homeLocation && (
            <Button
              variant="secondary"
              disabled={!canGoHome}
              onClick={() => homeLocation && setCurrentLocation(homeLocation)}
            >
              Вернуться{homeLocation?.name ? `: ${homeLocation.name}` : ""}
            </Button>
          )}
        </div>
      </div>

      {currentLocation && mapLocation && mapForView && (
        <>
          {/* Controls */}
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-200">
              <Checkbox
                checked={showParentMapIfNoImage as CheckedState}
                onCheckedChange={(v: CheckedState) => setShowParentMapIfNoImage(Boolean(v))}
              />
              Показывать карту родителя, если у локации нет карты
            </label>
          </div>

          {/* Map */}
          <div className="rounded-md overflow-hidden border border-gray-700">
            <div className={compact ? "h-[40dvh] min-h-[200px]" : "h-[50vh] min-h-[280px]"}>
              <MapViewerPure
                location={mapForView}
                scenes={scenes}
                session={session}
                enabledPolygonIds={enabledPolygonIds}
                dimHidden={isMaster}
                isDrawing={drawing}
                draftPoints={draftPoints}
                onDraftPoint={(point) => setDraftPoints((points) => [...points, point])}
                onImageClick={drawing ? undefined : () => setFullscreenMap(true)}
              />
            </div>
          </div>

          <div
            className="border border-gray-700 rounded-md bg-gray-900/30 cursor-pointer"
            onClick={openTextModal}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") openTextModal();
            }}
          >
            <ScrollArea className={compact ? "h-28" : "h-40"}>
              <div className="p-3 space-y-3">
                <div dangerouslySetInnerHTML={{ __html: currentLocation.description_for_players }} />
                {isMaster && (
                  <div>
                    <div className="font-semibold">Мастеру:</div>
                    <div dangerouslySetInnerHTML={{ __html: currentLocation.description_for_master }} />
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </>
      )}

      {/* Fullscreen map */}
      {fullscreenMap && mapForView && (
        <FullscreenMap
          currentLocation={mapForView}
          enabledPolygonIds={enabledPolygonIds}
          setCurrentLocation={setCurrentLocation}
          locationList={visibleLocations}
          characters={characters}
          scenes={scenes}
          session={session}
          onPolygonClicked={onPolygonClicked}
          onToggleShown={onToggleShown}
          onClose={() => setFullscreenMap(false)}
          isMaster={isMaster}
          dimHidden={isMaster}
          isDrawing={drawing}
          draftPoints={draftPoints}
          onDraftPoint={(point) => setDraftPoints((points) => [...points, point])}
          drawBar={drawBar}
        />
      )}

      {/* Locations dialog */}
      <Dialog open={locationsOpen} onOpenChange={setLocationsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Выбор локации</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 max-h-[80vh] overflow-hidden">
            <MapLocationList
              currentLocation={currentLocation}
              locationList={visibleLocations}
              onClick={handleSelectLocation}
              onToggleHidden={onToggleHidden}
              onAddTODO={onAddTODO}
              isMaster={isMaster}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Text dialog */}
      <Dialog open={textOpen} onOpenChange={setTextOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Описание: {currentLocation?.name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[80vh]">
            <div className="space-y-4 pr-4">
              {currentLocation && (
                <>
                  <div>
                    <div className="text-sm text-gray-400 mb-2">Игрокам</div>
                    <div dangerouslySetInnerHTML={{ __html: currentLocation.description_for_players }} />
                  </div>
                  {isMaster && (
                    <div>
                      <div className="text-sm text-gray-400 mb-2">Мастеру</div>
                      <div dangerouslySetInnerHTML={{ __html: currentLocation.description_for_master }} />
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}