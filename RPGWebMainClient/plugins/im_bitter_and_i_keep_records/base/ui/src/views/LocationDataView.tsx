'use client';

import type { LocationData } from '../types';

type Props = {
  data: Record<string, any>;
  config?: any;
};

export default function LocationDataView({ data }: Props) {
  const loc = (data ?? {}) as LocationData;

  return (
    <div className="space-y-2">
      <div className="text-sm text-white/80">
        Температура: {loc.temperatureC ?? 0}°C • Свет: {loc.illumination ?? 50}/100
      </div>
    </div>
  );
}
