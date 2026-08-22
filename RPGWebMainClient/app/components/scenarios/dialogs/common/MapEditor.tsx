'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, RotateCcw, Upload, X } from 'lucide-react';

import type {
  LocationList,
  MapObjectPolygonPoint,
  MapObjectPolygonCreate,
} from '@/app/services/types2';

import MapViewer from '@/app/components/common/MapViewer';
import { PolygonDisplaySettings, DrawingSettings } from '@/app/components/common/PolygonDisplaySettings';
import { cn } from '@/lib/utils';

type PolygonDraft = MapObjectPolygonCreate & {
  // id только для UI (tmp_...), на бэк не уходит
  id?: string;
};

type LocationDraft = {
  id?: string | null;
  name?: string | null;
  map_url?: string | null;
  map_width?: number | null;
  map_height?: number | null;
  map_objects: PolygonDraft[];
};

interface MapEditorProps {
  location: LocationDraft;
  allLocations: LocationList[];
  onChange: (next: LocationDraft) => void;
  mapFile?: File | null;
  onUploadMap?: (file: File) => void;
  readOnly?: boolean;
  canvasWidth?: number;
  canvasHeight?: number;
}

function ensureArray<T>(x: unknown, fallback: T[] = []): T[] {
  return Array.isArray(x) ? (x as T[]) : fallback;
}

export function MapEditor({
  location,
  allLocations,
  onChange,
  mapFile,
  onUploadMap,
  readOnly = false,
  canvasWidth = 1024,
  canvasHeight = 768,
}: MapEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // гарантируем, что map_objects всегда массив
  const safeLocation: LocationDraft = useMemo(
    () => ({
      id: location?.id ?? null,
      name: location?.name ?? '',
      map_url: location?.map_url ?? null,
      map_width: location?.map_width ?? canvasWidth,
      map_height: location?.map_height ?? canvasHeight,
      map_objects: ensureArray<PolygonDraft>((location as any)?.map_objects, []),
    }),
    [location, canvasWidth, canvasHeight]
  );

  // preview url для файла карты
  const [mapPreviewUrl, setMapPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!mapFile) {
      setMapPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(mapFile);
    setMapPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [mapFile]);

  const effectiveMapUrl = mapPreviewUrl ?? safeLocation.map_url ?? null;
  const hasRaster = Boolean(effectiveMapUrl);
  /** Unified canvas always available (white board if no raster). */
  const hasMap = true;

  // Sync map_width/height from uploaded/current image natural size
  useEffect(() => {
    if (!effectiveMapUrl) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (
        w > 0 &&
        h > 0 &&
        (safeLocation.map_width !== w || safeLocation.map_height !== h)
      ) {
        onChange({
          ...safeLocation,
          map_width: w,
          map_height: h,
        });
      }
    };
    img.src = effectiveMapUrl;
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveMapUrl]);

  // drawing state
  const [currentPolygon, setCurrentPolygon] = useState<MapObjectPolygonPoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedPolygon, setSelectedPolygon] = useState<string | null>(null);

  const [editingPolygon, setEditingPolygon] = useState<PolygonDraft | null>(null);
  const [targetLocationId, setTargetLocationId] = useState<string | null>(null);
  const [editTargetLocationId, setEditTargetLocationId] = useState<string | null>(null);

  const [drawingSettings, setDrawingSettings] = useState<DrawingSettings>({
    color: '#ff0000',
    alpha: 0.5,
    filled: true,
    closed: true,
    icon: 'none',
    icon_url: '',
  });

  const [editDrawingSettings, setEditDrawingSettings] = useState<DrawingSettings>({
    color: '#ff0000',
    alpha: 0.5,
    filled: true,
    closed: true,
    icon: 'none',
    icon_url: '',
  });

  const handleImageUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      onUploadMap?.(file);
    },
    [onUploadMap]
  );

  const startDrawing = useCallback(() => {
    if (!hasMap) return;
    setIsDrawing(true);
    setCurrentPolygon([]);
    setSelectedPolygon(null);
  }, [hasMap]);

  const cancelDrawing = useCallback(() => {
    setIsDrawing(false);
    setCurrentPolygon([]);
  }, []);

  const finishDrawing = useCallback(() => {
    if (currentPolygon.length < 2) {
      setIsDrawing(false);
      setCurrentPolygon([]);
      return;
    }

    const tmpId = `tmp_${crypto.randomUUID()}`;

    const newPolygon: PolygonDraft = {
      id: tmpId,
      name: `Полигон ${safeLocation.map_objects.length + 1}`,
      source_location_id: (safeLocation.id ?? '') as any, // если source_location_id обязателен UUID — заполни на save
      target_location_id: (targetLocationId || null) as any,
      is_shown: true,
      is_line: !drawingSettings.closed,
      is_filled: drawingSettings.filled,
      alpha: drawingSettings.alpha,
      color: drawingSettings.color,
      polygon_list: [...currentPolygon],
      icon: drawingSettings.icon === 'none' ? undefined : drawingSettings.icon,
      icon_url: drawingSettings.icon_url ? (drawingSettings.icon_url as any) : undefined,
    };

    onChange({
      ...safeLocation,
      map_objects: [...safeLocation.map_objects, newPolygon],
      map_url: effectiveMapUrl,
    });

    setTargetLocationId(null);
    setIsDrawing(false);
    setCurrentPolygon([]);
  }, [currentPolygon, safeLocation, targetLocationId, drawingSettings, onChange, effectiveMapUrl]);

  const deletePolygon = useCallback(
    (polygonId: string) => {
      onChange({
        ...safeLocation,
        map_objects: safeLocation.map_objects.filter((p) => String(p.id) !== String(polygonId)),
      });
    },
    [safeLocation, onChange]
  );

  const startEditingPolygon = useCallback((poly: any) => {
    // MapViewer может отдавать полигон с id; приводим к PolygonDraft
    const p = poly as PolygonDraft;

    setEditDrawingSettings({
      color: (p as any).color,
      alpha: (p as any).alpha,
      filled: !!(p as any).is_filled,
      closed: !(p as any).is_line,
      icon: (p as any).icon || 'none',
      icon_url: (p as any).icon_url || '',
    });

    setEditTargetLocationId(((p as any).target_location_id as any) ?? null);
    setEditingPolygon(p);
  }, []);

  const updatePolygon = useCallback(() => {
    if (!editingPolygon) return;

    const updated: PolygonDraft = {
      ...editingPolygon,
      target_location_id: (editTargetLocationId || null) as any,
      is_line: !editDrawingSettings.closed,
      is_filled: editDrawingSettings.filled,
      alpha: editDrawingSettings.alpha,
      color: editDrawingSettings.color,

      // было: null -> нужно undefined
      icon: editDrawingSettings.icon === 'none' ? undefined : editDrawingSettings.icon,

      // если icon_url в типах Optional[HttpUrl] -> в TS обычно string | undefined
      icon_url: editDrawingSettings.icon_url ? (editDrawingSettings.icon_url as any) : undefined,
    };


    onChange({
      ...safeLocation,
      map_objects: safeLocation.map_objects.map((p) => (String(p.id) === String(updated.id) ? updated : p)),
    });

    setEditingPolygon(null);
  }, [editingPolygon, editTargetLocationId, editDrawingSettings, safeLocation, onChange]);

  const onToggleShown = useCallback(
    (polygonId: string, value: boolean) => {
      onChange({
        ...safeLocation,
        map_objects: safeLocation.map_objects.map((p) =>
          String(p.id) === String(polygonId) ? { ...p, is_shown: value } : p
        ),
      });
    },
    [safeLocation, onChange]
  );


  /* ---------D&D-------- */
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (!file || !file.type.startsWith('image/')) return;
      onUploadMap?.(file);
    },
    [onUploadMap],
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };


  return (
    <div className="w-full bg-gray-900 text-white rounded-lg border border-gray-700 overflow-hidden">
      <div className="h-14 flex items-center justify-center border-b border-gray-700 px-4">
        <div className="text-lg font-bold">Карта: {safeLocation.name || 'Новая локация'}</div>
      </div>

      <div className="flex h-[70vh]">
        <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col overflow-y-auto">
          <Card className="m-4 bg-gray-700 border-gray-600">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Изображение карты</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="w-full">
                <Upload className="w-4 h-4 mr-2" />
                Выбрать файл карты
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />

              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => !readOnly && fileInputRef.current?.click()}
                className={cn(
                  'flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-5 px-3 transition cursor-pointer select-none',
                  isDragOver
                    ? 'border-blue-400 bg-blue-950/40 text-blue-300'
                    : hasRaster
                    ? 'border-green-700 bg-green-950/30'
                    : 'border-gray-600 bg-gray-800/50 hover:border-gray-400',
                  readOnly && 'pointer-events-none opacity-60',
                )}
              >
                <Upload className="w-5 h-5 mb-1 text-gray-400" />
                {isDragOver ? (
                  <div className="text-sm text-blue-300">Отпустите для загрузки</div>
                ) : hasRaster ? (
                  <div className="text-sm text-green-300 text-center">
                    Фон загружен (preview).<br />
                    <span className="text-gray-400 text-xs">Перетащите или кликните, чтобы заменить</span>
                  </div>
                ) : (
                  <div className="text-sm text-yellow-300 text-center">
                    Белый холст {canvasWidth}×{canvasHeight}.<br />
                    <span className="text-gray-400 text-xs">Загрузите растр или рисуйте полигоны</span>
                  </div>
                )}
              </div>

            </CardContent>
          </Card>

          <Card className="m-4 bg-gray-700 border-gray-600">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Инструменты</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={startDrawing}
                disabled={isDrawing || readOnly}
                variant={isDrawing ? 'secondary' : 'default'}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                {isDrawing ? 'Рисую...' : 'Новый полигон'}
              </Button>

              {isDrawing && (
                <div className="space-y-2">
                  <div className="text-sm text-blue-300">Точек: {currentPolygon.length}</div>
                  <div className="flex gap-2">
                    <Button onClick={finishDrawing} size="sm" className="flex-1">
                      Завершить
                    </Button>
                    <Button onClick={cancelDrawing} size="sm" variant="outline" className="flex-1 bg-transparent">
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Отмена
                    </Button>
                  </div>
                </div>
              )}

              <div>
                <label className="block mb-2 text-sm font-medium">Связать с локацией</label>
                <select
                  className="w-full mb-4 p-2 rounded bg-gray-700 border-gray-600 text-white"
                  value={targetLocationId ?? ''}
                  onChange={(e) => setTargetLocationId(e.target.value || null)}
                >
                  <option value="">Без связи</option>
                  {(allLocations ?? []).map((loc: any) => (
                    <option key={String(loc.id)} value={String(loc.id)}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <PolygonDisplaySettings drawingSettings={drawingSettings} setDrawingSettings={setDrawingSettings} />
            </CardContent>
          </Card>
        </div>

        <div className="flex-1 min-w-0">
          <MapViewer
            location={{ ...(safeLocation as any), map_url: effectiveMapUrl }}
            canvasWidth={safeLocation.map_width ?? canvasWidth}
            canvasHeight={safeLocation.map_height ?? canvasHeight}
            onToggleShown={onToggleShown}
            onEditPolygon={startEditingPolygon}
            onDeletePolygon={deletePolygon}
            editable={true}
            isDrawing={isDrawing}
            currentPolygon={currentPolygon}
            setCurrentPolygon={setCurrentPolygon}
            drawingSettings={drawingSettings}
            setSelectedPolygon={setSelectedPolygon}
          />
        </div>
      </div>

      <AnimatePresence>
        {editingPolygon && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setEditingPolygon(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-800 rounded-lg p-6 max-w-md mx-4 w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Редактировать полигон</h2>
                <Button variant="ghost" onClick={() => setEditingPolygon(null)}>
                  <X className="w-6 h-6" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Название</Label>
                  <Input
                    value={editingPolygon.name}
                    onChange={(e) => setEditingPolygon({ ...editingPolygon, name: e.target.value })}
                    className="bg-gray-700 border-gray-600"
                  />
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium">Связать с локацией</label>
                  <select
                    className="w-full mb-4 p-2 rounded bg-gray-700 border-gray-600 text-white"
                    value={editTargetLocationId ?? ''}
                    onChange={(e) => setEditTargetLocationId(e.target.value || null)}
                  >
                    <option value="">Без связи</option>
                    {(allLocations ?? []).map((loc: any) => (
                      <option key={String(loc.id)} value={String(loc.id)}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <PolygonDisplaySettings drawingSettings={editDrawingSettings} setDrawingSettings={setEditDrawingSettings} />

                <div className="bg-gray-900 rounded p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Точек:</span>
                    <span>{(editingPolygon.polygon_list ?? []).length}</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button onClick={updatePolygon} className="flex-1">
                    Сохранить
                  </Button>
                  <Button variant="outline" onClick={() => setEditingPolygon(null)} className="flex-1">
                    Отмена
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
