'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Map, LayoutGrid, ScrollText } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

import MapSection from '@/app/components/session/common/MapSection';
import { SessionFeedsTabs } from '@/app/components/session/common/SessionFeedsTabs';

import { useSessionWebSocket } from '@/app/services/hooks/useSessionWebSocket';
import { useMasterUiStore, type LeftColumnTab, type MapTab } from '@/app/services/stores/masterUi';
import { useUrlTab } from '@/app/services/hooks/useUrlTab';

import type { Location } from '@/app/services/types2';
import { LocationExposuresPanel } from './LocationExposuresPanel';
import LocationSessionEditDialog from './control/dialogs/LocationSessionEditDialog';
import { MasterContentPanel } from './MasterControlTabsView';
import { TimelineTabPanel } from './TimelineTabPanel';

const LEFT_COLUMN_TABS: readonly LeftColumnTab[] = ['map', 'content', 'journal'];
const MAP_TABS: readonly MapTab[] = ['location', 'scene', 'timeline'];

export function MasterLeftColumn({ sessionId }: { sessionId: string }) {
  const {
    locations,
    characters,
    scenes,
    session,
    polygon_shown,
    isMaster,
    timeline,
    setLocationCheck,
    setSceneLocation,
    toggleLocationHidden,
    applySceneExposure,
  } = useSessionWebSocket(sessionId);

  const wikiTabRequest = useMasterUiStore((s) => s.wikiTabRequest);

  const [leftColumnTab, setLeftColumnTab] = useUrlTab<LeftColumnTab>(LEFT_COLUMN_TABS, 'map');
  const [mapTab, setMapTab] = useUrlTab<MapTab>(MAP_TABS, 'location', { paramName: 'map' });

  useEffect(() => {
    if (wikiTabRequest > 0) setLeftColumnTab('content');
  }, [wikiTabRequest, setLeftColumnTab]);

  const currentSceneId = useMasterUiStore((s) => s.currentSceneId);
  const setCurrentSceneId = useMasterUiStore((s) => s.setCurrentSceneId);

  const currentLocationId = useMasterUiStore((s) => s.currentLocationId);
  const setCurrentLocationId = useMasterUiStore((s) => s.setCurrentLocationId);

  const sceneLocationId = useMasterUiStore((s) => s.sceneLocationId);
  const setSceneLocationId = useMasterUiStore((s) => s.setSceneLocationId);

  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);

  const currentLocation: Location | null = useMemo(() => {
    if (!currentLocationId) return null;
    return locations.find((l) => l.id === currentLocationId) ?? null;
  }, [locations, currentLocationId]);

  const sceneLocation: Location | null = useMemo(() => {
    if (!sceneLocationId) return null;
    return locations.find((l) => l.id === sceneLocationId) ?? null;
  }, [locations, sceneLocationId]);

  const mapLocation: Location | null = mapTab === 'scene' ? sceneLocation : currentLocation;

  const updateLocationPolygonVisibility = useCallback(
    (locationId: string, polygonId: string, value: boolean) => {
      setLocationCheck(locationId, polygonId, value);
    },
    [setLocationCheck],
  );

  const setMapLocation = useCallback(
    (location: Location | null) => {
      if (!location) return;

      if (mapTab === 'scene') {
        if (!currentSceneId) return;
        setSceneLocation(currentSceneId, location.id);
        return;
      }

      setCurrentLocationId(location.id);
    },
    [mapTab, currentSceneId, setSceneLocation, setCurrentLocationId],
  );

  const openCreateLocationDialog = useCallback(() => {
    setEditingLocation(null);
    setLocationDialogOpen(true);
  }, []);

  const openEditLocationDialog = useCallback((location: Location) => {
    setEditingLocation(location);
    setLocationDialogOpen(true);
  }, []);

  const closeLocationDialog = useCallback(() => {
    setLocationDialogOpen(false);
    setEditingLocation(null);
  }, []);

  const canUseSceneMap = !!sceneLocationId;

  const selectSceneFromTimeline = useCallback(
    (sceneId: string) => {
      setCurrentSceneId(sceneId);
      const scene = scenes?.find((s) => String(s.id) === String(sceneId));
      const locId = scene?.location?.id;
      if (locId) {
        setSceneLocationId(String(locId));
      }
    },
    [scenes, setCurrentSceneId, setSceneLocationId],
  );

  const mapTabLabel =
    mapTab === 'timeline'
      ? 'Таймлайн'
      : mapTab === 'scene'
        ? (sceneLocation?.name ?? '—')
        : (currentLocation?.name ?? '—');

  return (
    <>
      <div className="flex-1 min-w-0 min-h-0 flex flex-col border-r border-gray-700">
        <div className="px-3 py-2 border-b border-gray-800 bg-gray-950">
          <Tabs
            value={leftColumnTab}
            onValueChange={(v) => setLeftColumnTab(v as LeftColumnTab)}
            className="w-full"
          >
            <TabsList className="w-full">
              <TabsTrigger value="map" className="flex items-center gap-1.5">
                <Map className="w-3.5 h-3.5" /> Карта
              </TabsTrigger>
              <TabsTrigger value="content" className="flex items-center gap-1.5">
                <LayoutGrid className="w-3.5 h-3.5" /> Контент
              </TabsTrigger>
              <TabsTrigger value="journal" className="flex items-center gap-1.5">
                <ScrollText className="w-3.5 h-3.5" /> Журнал
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {leftColumnTab === 'content' ? (
          <div className="flex-1 min-h-0 p-3 overflow-hidden">
            <MasterContentPanel sessionId={sessionId} />
          </div>
        ) : leftColumnTab === 'journal' ? (
          <div className="flex-1 min-h-0 p-3 overflow-hidden">
            <SessionFeedsTabs sessionId={sessionId} />
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="px-3 py-2 border-b border-gray-800 bg-gray-950 flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant={mapTab === 'location' ? 'secondary' : 'outline'}
                onClick={() => setMapTab('location')}
              >
                Локация
              </Button>
              <Button
                size="sm"
                variant={mapTab === 'scene' ? 'secondary' : 'outline'}
                disabled={!canUseSceneMap}
                title={!canUseSceneMap ? 'Выбери сцену, чтобы была локация сцены' : undefined}
                onClick={() => setMapTab('scene')}
              >
                Локация сцены
              </Button>
              <Button
                size="sm"
                variant={mapTab === 'timeline' ? 'secondary' : 'outline'}
                onClick={() => setMapTab('timeline')}
              >
                Таймлайн
              </Button>
              <div className="ml-auto text-xs text-gray-400 truncate max-w-[140px]">
                {mapTabLabel}
              </div>
            </div>

            {mapTab === 'timeline' ? (
              <TimelineTabPanel
                sessionId={sessionId}
                scenes={scenes ?? []}
                timeline={timeline}
                currentSceneId={currentSceneId}
                onSelectScene={selectSceneFromTimeline}
              />
            ) : (
              <>
                <div className="flex-1 min-h-0">
                  <MapSection
                    currentLocation={mapLocation}
                    locationList={locations}
                    enabledPolygonIds={polygon_shown}
                    scenes={scenes}
                    session={session}
                    characters={characters}
                    editable={true}
                    isMaster={isMaster}
                    updateLocationPolygonVisibility={updateLocationPolygonVisibility}
                    setCurrentLocation={setMapLocation}
                    onCreateLocation={openCreateLocationDialog}
                    onEditLocation={openEditLocationDialog}
                    onToggleHidden={toggleLocationHidden}
                    onAddTODO={(id: string, text: string) => {}}
                    className="w-full h-full"
                  />
                </div>

                {mapTab === 'scene' && (
                  <LocationExposuresPanel
                    location={sceneLocation}
                    scene_id={currentSceneId}
                    applySceneExposure={applySceneExposure}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>

      <LocationSessionEditDialog
        open={locationDialogOpen}
        onClose={closeLocationDialog}
        editingLocation={editingLocation}
        readOnly={!isMaster}
      />
    </>
  );
}
