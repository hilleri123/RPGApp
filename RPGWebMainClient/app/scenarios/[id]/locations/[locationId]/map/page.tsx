'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { LocationMapEditor } from '@/app/components/scenarios/dialogs/LocationMapEditor';

export default function LocationMapPage() {
  const params = useParams<{ id: string; locationId: string }>();
  const live = useSearchParams().get('live') === '1';
  const scenarioId = params?.id;
  const locationId = params?.locationId;

  if (!scenarioId || !locationId) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="px-6 py-4 text-lg font-semibold border-b border-gray-800">Карта локации</div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <LocationMapEditor
          scenarioId={scenarioId}
          locationId={locationId}
          fill
          live={live}
          initialTab={live ? 'map-excalidraw' : 'map-raster'}
          onClose={() => window.close()}
        />
      </div>
    </div>
  );
}
