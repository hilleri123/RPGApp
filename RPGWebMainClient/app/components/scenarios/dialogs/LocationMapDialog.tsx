'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LocationMapEditor } from './LocationMapEditor';

export function locationMapPageUrl(scenarioId: string, locationId: string, live = false) {
  const base = `/scenarios/${scenarioId}/locations/${locationId}/map`;
  return live ? `${base}?live=1` : base;
}

export function LocationMapDialog({
  open,
  scenarioId,
  locationId,
  onClose,
  onSaved,
  live = false,
  initialTab = 'map-raster',
}: {
  open: boolean;
  scenarioId: string;
  locationId: string | null;
  onClose: () => void;
  onSaved?: (id: string, name: string) => void;
  live?: boolean;
  initialTab?: 'map-raster' | 'map-excalidraw' | 'sublocations';
}) {
  const dismissRef = useRef<(() => void) | null>(null);
  if (!open || !locationId) return null;

  const openInNewWindow = () => {
    const width = 1200;
    const height = 900;
    const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
    const features = [
      'popup=yes',
      `width=${width}`,
      `height=${height}`,
      `left=${Math.round(left)}`,
      `top=${Math.round(top)}`,
      'resizable=yes',
      'scrollbars=yes',
    ].join(',');
    const popup = window.open(
      locationMapPageUrl(scenarioId, locationId, live),
      `rpg-location-map-${locationId}`,
      features,
    );
    if (popup) onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        if (live && dismissRef.current) dismissRef.current();
        else onClose();
      }}
    >
      <DialogContent className="max-w-4xl w-full bg-gray-900 max-h-[100vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex flex-row items-center justify-between gap-3">
          <DialogTitle>Карта локации</DialogTitle>
          <Button type="button" variant="secondary" size="sm" onClick={openInNewWindow}>
            В новом окне
          </Button>
        </DialogHeader>
        <LocationMapEditor
          scenarioId={scenarioId}
          locationId={locationId}
          live={live}
          initialTab={initialTab}
          onClose={onClose}
          onBindDismiss={(dismiss) => {
            dismissRef.current = dismiss;
          }}
          onSaved={(id, name) => {
            onSaved?.(id, name);
            if (!live) onClose();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
