'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { availableIcons } from '../../common/PolygonDisplaySettings';
import { Location, MapObjectPolygon } from '@/app/services/types2';
import { getNpcStyle, TYPE_COLORS, TYPE_ICONS } from '@/lib/constants';
import { GameSessionBase, Scene } from '@/app/services/types/session';
import { useExcalidrawPreview } from '@/app/components/common/map/useExcalidrawPreview';
import { useMapBackground } from '@/app/components/common/map/useMapBackground';
import { MapCanvas } from '@/app/components/common/map/MapCanvas';

export interface SceneOverlayEntity {
  id: string;
  name: string;
  kind: 'character' | 'npc' | 'item';
  icon_url?: string | null;
  playerColor?: string | null;
  baseColor: string;
  baseIcon?: React.ComponentType<{ className?: string; color?: string }>;
  tags?: string[];
}

export interface SceneOverlay {
  location_id: string;
  entities: SceneOverlayEntity[];
}

export type MapObjectPolygonPoint = { x: number; y: number };

type Pt = { x: number; y: number };
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export interface MapViewerPureProps {
  location: Location;
  scenes?: Scene[];
  session?: GameSessionBase;
  enabledPolygonIds: string[];
  onPolygonClicked?: (polygon: MapObjectPolygon) => void;
  onImageClick?: () => void;
  className?: string;
  minZoom?: number;
  maxZoom?: number;
  /** When false: no pan/zoom; click opens via onImageClick. */
  interactive?: boolean;
}

function getPolygonCenter(points: MapObjectPolygonPoint[]) {
  if (!points.length) return { x: 0, y: 0 };
  return {
    x: points.reduce((s, p) => s + p.x, 0) / points.length,
    y: points.reduce((s, p) => s + p.y, 0) / points.length,
  };
}

function getPath(points: MapObjectPolygonPoint[], close: boolean) {
  if (!points.length) return '';
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  return close ? `${d} Z` : d;
}

function getPolygonBBox(points: MapObjectPolygonPoint[]) {
  if (!points.length) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    minX: Math.min(...xs), minY: Math.min(...ys),
    maxX: Math.max(...xs), maxY: Math.max(...ys),
  };
}

export default function MapViewerPure({
  location,
  scenes,
  session,
  enabledPolygonIds,
  onPolygonClicked,
  onImageClick,
  className,
  minZoom = 1,
  maxZoom = 6,
  interactive = true,
}: MapViewerPureProps) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Pt>({ x: 0, y: 0 });

  const pointersRef = useRef<Map<number, PointerEvent>>(new Map());
  const pinchStartRef = useRef<{ dist: number; zoom: number } | null>(null);
  const panStartRef = useRef<{ startClient: Pt; startOffset: Pt } | null>(null);
  const movedRef = useRef(false);

  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [location.id, location.map_url]);

  // ── карта: единый холст (растр/белый + Excalidraw overlay) ────────────────
  const mapWidth = (location as any).map_width as number | null | undefined;
  const mapHeight = (location as any).map_height as number | null | undefined;
  const hasExcalidraw = Boolean((location as any).excalidraw_map_json?.elements?.length);
  const hasStoredCanvas = Boolean(mapWidth && mapHeight) || Boolean(location.map_url);

  // Legacy: no stored canvas → first export without fixed size to learn bbox, then pin.
  const legacyPreview = useExcalidrawPreview(
    (location as any).excalidraw_map_json ?? null,
    hasExcalidraw && !hasStoredCanvas,
    null,
    null,
  );

  const effectiveW = mapWidth ?? legacyPreview?.vbW ?? null;
  const effectiveH = mapHeight ?? legacyPreview?.vbH ?? null;

  const canvasInfo = useMapBackground({
    mode: 'canvas',
    mapUrl: location.map_url ?? null,
    mapWidth: effectiveW,
    mapHeight: effectiveH,
    rasterSrc: location.map_url ?? null,
  });

  const excalidrawPreview = useExcalidrawPreview(
    (location as any).excalidraw_map_json ?? null,
    hasExcalidraw && hasStoredCanvas,
    canvasInfo?.bgWidth,
    canvasInfo?.bgHeight,
  );

  const overlayUrl = hasStoredCanvas ? excalidrawPreview?.url : legacyPreview?.url;

  // ── сцены ─────────────────────────────────────────────────────────────────
  const players = session?.players ?? [];

  const sceneOverlays: SceneOverlay[] = useMemo(() => {
    if (!scenes) return [];
    return scenes.map((scene) => {
      const chars: SceneOverlayEntity[] = (scene.characters ?? []).map((c: any) => {
        const player = players.find(
          (p: any) => String(p?.character_id ?? p?.characterid ?? '') === String(c?.id ?? ''),
        );
        return {
          id: c.id, name: c.name ?? '', kind: 'character' as const,
          icon_url: c.icon_url ?? null, playerColor: player?.color ?? null,
          baseColor: TYPE_COLORS.character, baseIcon: TYPE_ICONS.character,
          tags: c.tags ?? [],
        };
      });
      const npcs: SceneOverlayEntity[] = (scene.public?.npcs ?? []).map((n: any) => {
        const tags = n?.tags ?? [];
        const { color, icon } = getNpcStyle(tags.includes('dead'), tags.includes('enemy'));
        return {
          id: n.id, name: n.name ?? '', kind: 'npc' as const,
          icon_url: n.icon_url ?? null, playerColor: null,
          baseColor: color, baseIcon: icon, tags,
        };
      });
      return { location_id: scene.location?.id ?? '', entities: [...chars, ...npcs] };
    });
  }, [scenes, players]);

  // Canvas coords — no origin shift
  const visiblePolygons = useMemo(
    () => enabledPolygonIds.length === 0
      ? location.map_objects
      : location.map_objects.filter((p) => enabledPolygonIds.includes(p.id)),
    [location.map_objects, enabledPolygonIds],
  );

  // ── zoom/pan ──────────────────────────────────────────────────────────────
  const transformStyle = useMemo(() => ({
    transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
    transformOrigin: '50% 50%',
  }) as React.CSSProperties, [offset, zoom]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!interactive) return;
    e.preventDefault();
    const nextZoom = clamp(zoom + (e.deltaY < 0 ? 0.15 : -0.15), minZoom, maxZoom);
    setZoom(nextZoom);
    if (nextZoom === minZoom) setOffset({ x: 0, y: 0 });
  }, [interactive, zoom, minZoom, maxZoom]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!interactive) {
      movedRef.current = false;
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, e.nativeEvent);
    movedRef.current = false;
    const pts = Array.from(pointersRef.current.values());
    if (pts.length === 1) {
      panStartRef.current = { startClient: { x: e.clientX, y: e.clientY }, startOffset: offset };
    } else if (pts.length === 2) {
      const [a, b] = pts;
      pinchStartRef.current = { dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), zoom };
      panStartRef.current = null;
      movedRef.current = true;
    }
  }, [interactive, offset, zoom]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!interactive) return;
    if (pointersRef.current.has(e.pointerId)) pointersRef.current.set(e.pointerId, e.nativeEvent);
    const pts = Array.from(pointersRef.current.values());
    if (pts.length === 2 && pinchStartRef.current) {
      const [a, b] = pts;
      const nextZoom = clamp(
        pinchStartRef.current.zoom * (Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinchStartRef.current.dist),
        minZoom, maxZoom,
      );
      setZoom(nextZoom);
      if (nextZoom === minZoom) setOffset({ x: 0, y: 0 });
      movedRef.current = true;
      return;
    }
    if (pts.length === 1 && panStartRef.current && zoom > minZoom) {
      const dx = e.clientX - panStartRef.current.startClient.x;
      const dy = e.clientY - panStartRef.current.startClient.y;
      setOffset({
        x: clamp(panStartRef.current.startOffset.x + dx, -2000, 2000),
        y: clamp(panStartRef.current.startOffset.y + dy, -2000, 2000),
      });
      if (Math.abs(dx) + Math.abs(dy) > 4) movedRef.current = true;
    }
  }, [interactive, zoom, minZoom, maxZoom]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!interactive) {
      onImageClick?.();
      return;
    }
    pointersRef.current.delete(e.pointerId);
    const pts = Array.from(pointersRef.current.values());
    if (pts.length < 2) pinchStartRef.current = null;
    if (pts.length === 0) panStartRef.current = null;
    if (!movedRef.current) onImageClick?.();
  }, [interactive, onImageClick]);

  const getIconComponent = useCallback((iconValue: string) =>
    availableIcons.find((icon) => icon.value === iconValue)?.icon ?? null,
  []);

  const handlePolygonClick = useCallback(
    (polygon: MapObjectPolygon) => { onPolygonClicked?.(polygon); },
    [onPolygonClicked],
  );

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className={['w-full h-full min-h-0 min-w-0', className ?? ''].join(' ')}>
      <div className="w-full h-full min-h-0 overflow-hidden bg-gray-800" onWheel={onWheel}>
        <div
          className="relative w-full h-full touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div style={transformStyle} className="w-full h-full">
            <MapCanvas
              canvasInfo={canvasInfo}
              mode="canvas"
              rasterSrc={location.map_url ?? null}
              excalidrawPreviewUrl={overlayUrl}
              emptyText="Нет карты"
            >
              {/* полигоны */}
              {visiblePolygons.map((polygon) => {
                const IconComponent = getIconComponent(polygon.icon_url || '');
                const center = getPolygonCenter(polygon.polygon_list);
                const d = getPath(polygon.polygon_list, !polygon.is_line);
                return (
                  <g key={polygon.id}>
                    <path
                      d={d}
                      fill={polygon.is_filled ? polygon.color : 'none'}
                      fillOpacity={polygon.is_filled ? polygon.alpha : 0}
                      stroke={polygon.color}
                      strokeWidth="2"
                      strokeOpacity={polygon.alpha}
                      className="cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); handlePolygonClick(polygon); }}
                    />
                    {IconComponent && polygon.polygon_list.length > 0 && (
                      <foreignObject x={center.x - 12} y={center.y - 12} width="24" height="24" className="pointer-events-none">
                        <div className="flex items-center justify-center w-full h-full">
                          <IconComponent
                            className="w-6 h-6 text-white drop-shadow-lg"
                            style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.8))' }}
                          />
                        </div>
                      </foreignObject>
                    )}
                  </g>
                );
              })}

              {/* scene entity overlays */}
              {visiblePolygons.map((polygon) => {
                const overlay = sceneOverlays.find((o) => o.location_id === polygon.target_location_id);
                if (!overlay?.entities.length) return null;
                const bbox = getPolygonBBox(polygon.polygon_list);
                if (!bbox) return null;
                const { minX, minY, maxX, maxY } = bbox;
                const SIZE = 18, GAP = 3;
                const chars = overlay.entities.filter((e) => e.kind === 'character');
                const npcs  = overlay.entities.filter((e) => e.kind === 'npc');

                const renderRow = (entities: SceneOverlayEntity[], rowCenterY: number, labelAbove: boolean) =>
                  entities.map((entity, i) => {
                    const x = minX + i * (SIZE + GAP);
                    const y = rowCenterY - SIZE / 2;
                    const color = entity.kind === 'character' ? (entity.playerColor || entity.baseColor) : entity.baseColor;
                    const BaseIcon = entity.baseIcon;
                    return (
                      <g key={entity.id}>
                        <circle cx={x + SIZE / 2} cy={rowCenterY} r={SIZE / 2} fill={color} fillOpacity={0.9} />
                        <circle cx={x + SIZE / 2} cy={rowCenterY} r={SIZE / 2} fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="1.5" />
                        {entity.icon_url ? (
                          <>
                            <defs>
                              <clipPath id={`clip-${entity.id}`}>
                                <circle cx={x + SIZE / 2} cy={rowCenterY} r={SIZE / 2 - 1} />
                              </clipPath>
                            </defs>
                            <image
                              x={x + 1} y={y + 1}
                              width={SIZE - 2} height={SIZE - 2}
                              href={entity.icon_url}
                              clipPath={`url(#clip-${entity.id})`}
                              preserveAspectRatio="xMidYMid slice"
                            />
                          </>
                        ) : BaseIcon ? (
                          <foreignObject x={x + 2} y={y + 2} width={SIZE - 4} height={SIZE - 4}>
                            <div className="flex items-center justify-center w-full h-full">
                              <BaseIcon className="w-3.5 h-3.5" color="#ffffff" />
                            </div>
                          </foreignObject>
                        ) : (
                          <text x={x + SIZE / 2} y={rowCenterY + 4} textAnchor="middle" fontSize="9" fill="white" fontWeight="bold">
                            {entity.name?.[0]?.toUpperCase() ?? '?'}
                          </text>
                        )}
                        <text
                          x={x + SIZE / 2}
                          y={labelAbove ? y - 2 : y + SIZE + 9}
                          textAnchor="middle" fontSize="7"
                          fill="rgba(255,255,255,0.8)"
                          style={{ textShadow: '0 0 3px rgba(0,0,0,0.9)' }}
                        >
                          {entity.name?.slice(0, 7)}
                        </text>
                      </g>
                    );
                  });

                return (
                  <g key={`overlay-${polygon.id}`} className="pointer-events-none">
                    {renderRow(chars, minY, true)}
                    {renderRow(npcs, maxY, false)}
                  </g>
                );
              })}
            </MapCanvas>
          </div>
        </div>
      </div>
    </div>
  );
}