'use client';

import { useMemo } from 'react';
import { MapPin, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

import type { PlayerCharacter, Location, MapObjectPolygon } from '@/app/services/types2';

import MapLocationList from '../masterView/MapLocationList';
import { PolygonListViewer } from '@/app/components/common/PolygonListViewer';
import MapViewerPure from './MapViewerPure';
import { GameSessionBase, Scene } from '@/app/services/types/session';


interface FullscreenMapProps {
  currentLocation: Location;
  enabledPolygonIds: string[];
  setCurrentLocation?: (location: Location) => void;
  locationList?: Location[];
  characters: PlayerCharacter[]; // сейчас не используется, оставил чтобы не ломать API
  onPolygonClicked: (polygon: MapObjectPolygon) => void;
  onToggleShown?: (polygonId: string, value: boolean) => void;
  onClose: () => void;
  scenes?: Scene[];
  session?: GameSessionBase;
  isMaster?: boolean;
}

export default function FullscreenMap({
  currentLocation,
  enabledPolygonIds,
  setCurrentLocation,
  locationList,
  characters,
  onPolygonClicked,
  onToggleShown,
  onClose,
  scenes,
  session,
  isMaster = true,
}: FullscreenMapProps) {
  const showLocationsPanel = Boolean(isMaster && locationList && setCurrentLocation);
  const showPolygonPanel = Boolean(isMaster);

  const hasPolygons = (currentLocation.map_objects?.length ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
      <div
        className={[
          'bg-gray-900 shadow-lg flex flex-col overflow-hidden',
          isMaster ? 'rounded-lg w-[90vw] h-[95vh]' : 'w-screen h-screen rounded-none',
        ].join(' ')}
      >
        {/* Header */}
        <div
          className={[
            'text-white flex items-center justify-between border-b border-gray-700 shrink-0',
            isMaster ? 'p-4 md:p-6' : 'p-2',
          ].join(' ')}
        >
          <div className="flex items-center gap-3 min-w-0">
            <MapPin className={['shrink-0', isMaster ? 'w-6 h-6 md:w-8 md:h-8' : 'w-5 h-5'].join(' ')} />
            <div className="min-w-0">
              <h1 className={['font-bold truncate', isMaster ? 'text-xl md:text-2xl' : 'text-lg'].join(' ')}>
                {currentLocation.name}
              </h1>
            </div>
          </div>

          <Button variant="ghost" onClick={onClose} className={isMaster ? '' : 'h-9 w-9 p-0'}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Content */}
        <div
          className={[
            'flex-1 min-h-0 overflow-hidden',
            isMaster ? 'p-4 md:p-6' : 'p-0',
          ].join(' ')}
        >
          {/* Player: карта на весь экран */}
          {!isMaster ? (
            <div className="h-full min-h-0">
              <MapViewerPure
                location={currentLocation}
                scenes={scenes}
                session={session}
                enabledPolygonIds={enabledPolygonIds}
                onPolygonClicked={onPolygonClicked}
                className="h-full w-full"
              />
            </div>
          ) : (
            /* Master: карта + панели */
            <div className="h-full min-h-0 flex flex-col md:flex-row gap-4 md:gap-6 overflow-hidden">
              <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col md:flex-row gap-4 md:gap-6">
                <div className="flex-1 w-0 min-h-0 min-w-0 overflow-hidden">
                  <MapViewerPure
                    location={currentLocation}
                    scenes={scenes}
                    session={session}
                    enabledPolygonIds={enabledPolygonIds}
                    onPolygonClicked={onPolygonClicked}
                    className="h-full w-full"
                  />
                </div>

                {showPolygonPanel && hasPolygons && (
                  <div className="w-full md:w-[340px] lg:w-[380px] shrink-0 min-h-0 overflow-hidden">
                    <PolygonListViewer 
                      enabledPolygonIds={enabledPolygonIds}
                      location={currentLocation} 
                      onToggleShown={onToggleShown} 
                      isMaster={true} 
                    />
                  </div>
                )}
              </div>

              {showLocationsPanel && (
                <div className="w-full md:w-80 shrink-0 min-h-0 overflow-hidden">
                  <MapLocationList
                    currentLocation={currentLocation}
                    locationList={locationList!}
                    onClick={setCurrentLocation!}
                    isMaster={true}
                  />
                </div>
              )}
            </div>

          )}
        </div>
      </div>
    </div>
  );
}
