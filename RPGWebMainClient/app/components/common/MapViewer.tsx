'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Location, MapObjectPolygon, MapObjectPolygonPoint } from "@/app/services/types2";
import { DrawingSettings, availableIcons } from "./PolygonDisplaySettings";
import { PolygonListViewer } from "./PolygonListViewer";

interface MapViewerProps {
  location: Location;
  /** When no map_url — white canvas size (unified map board). */
  canvasWidth?: number;
  canvasHeight?: number;
  onToggleShown?: (polygonId: string, value: boolean) => void;
  onEditPolygon?: (polygon: MapObjectPolygon) => void;
  onDeletePolygon?: (polygonId: string) => void;
  editable?: boolean;
  isDrawing?: boolean;
  currentPolygon?: MapObjectPolygonPoint[];
  setCurrentPolygon?: React.Dispatch<React.SetStateAction<MapObjectPolygonPoint[]>>;
  drawingSettings?: DrawingSettings;
  setSelectedPolygon?: (polygonId: string) => void;
  onPolygonClicked?: (polygon: MapObjectPolygon) => void;
  onImageClick?: () => void;
  isMaster?: boolean;
}

type Pt = { x: number; y: number };
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export default function MapViewer({
  location,
  canvasWidth,
  canvasHeight,
  onToggleShown,
  onEditPolygon,
  onDeletePolygon,
  editable = false,
  isDrawing = false,
  currentPolygon,
  setCurrentPolygon,
  drawingSettings,
  setSelectedPolygon,
  onPolygonClicked,
  onImageClick,
  isMaster = true,
}: MapViewerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const hasRaster = Boolean(location.map_url);
  const [imageSize, setImageSize] = useState({
    width: canvasWidth || 800,
    height: canvasHeight || 600,
  });

  useEffect(() => {
    if (!hasRaster && canvasWidth && canvasHeight) {
      setImageSize({ width: canvasWidth, height: canvasHeight });
    }
  }, [hasRaster, canvasWidth, canvasHeight]);

  const viewMode = !editable && !isDrawing;

  // zoom/pan только для viewMode
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Pt>({ x: 0, y: 0 });

  // жесты
  const pointersRef = useRef<Map<number, PointerEvent>>(new Map());
  const pinchStartRef = useRef<{ dist: number; zoom: number } | null>(null);
  const panStartRef = useRef<{ startClient: Pt; startOffset: Pt } | null>(null);

  // чтобы отличать клик от драга/пинча и не ломать onImageClick
  const movedRef = useRef(false);

  useEffect(() => {
    // при смене локации сбросим зум, чтобы всегда "fit"
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [location.id]);

  const handleImgLoad = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const w = img.naturalWidth || 800;
    const h = img.naturalHeight || 600;
    setImageSize({ width: w, height: h });
  }, []);

  const getSVGCoordinates = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current) return { x: 0, y: 0 };

      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = imageSize.width / rect.width;
      const scaleY = imageSize.height / rect.height;

      return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
      };
    },
    [imageSize]
  );

  const handleSVGClick = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      // на svg-клик (в любом режиме) считаем как "клик по карте"
      onImageClick?.();

      if (!isDrawing) return;
      const point = getSVGCoordinates(event);
      setCurrentPolygon?.((prev) => [...prev, point]);
    },
    [onImageClick, isDrawing, getSVGCoordinates, setCurrentPolygon]
  );

  const getPolygonCenter = useCallback((points: MapObjectPolygonPoint[]) => {
    if (points.length === 0) return { x: 0, y: 0 };
    const sumX = points.reduce((sum, p) => sum + p.x, 0);
    const sumY = points.reduce((sum, p) => sum + p.y, 0);
    return { x: sumX / points.length, y: sumY / points.length };
  }, []);

  const getIconComponent = useCallback((iconValue: string) => {
    const iconData = availableIcons.find((icon) => icon.value === iconValue);
    return iconData?.icon || null;
  }, []);

  const transformStyle = useMemo(() => {
    return {
      transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
      transformOrigin: "50% 50%",
    } as React.CSSProperties;
  }, [offset, zoom]);

  // wheel zoom (desktop)
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!viewMode) return;
      e.preventDefault();

      const delta = -e.deltaY;
      const step = delta > 0 ? 0.15 : -0.15;
      const nextZoom = clamp(zoom + step, 1, 6);

      setZoom(nextZoom);
      if (nextZoom === 1) setOffset({ x: 0, y: 0 });
    },
    [viewMode, zoom]
  );

  // pointer gestures (mobile + desktop touch)
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!viewMode) return;

      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      pointersRef.current.set(e.pointerId, e.nativeEvent);

      movedRef.current = false;

      const pts = Array.from(pointersRef.current.values());
      if (pts.length === 1) {
        panStartRef.current = {
          startClient: { x: e.clientX, y: e.clientY },
          startOffset: offset,
        };
      } else if (pts.length === 2) {
        const [a, b] = pts;
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        pinchStartRef.current = { dist, zoom };
        panStartRef.current = null;
        movedRef.current = true; // пинч = не клик
      }
    },
    [viewMode, offset, zoom]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!viewMode) return;

      if (pointersRef.current.has(e.pointerId)) {
        pointersRef.current.set(e.pointerId, e.nativeEvent);
      }
      const pts = Array.from(pointersRef.current.values());

      // pinch zoom
      if (pts.length === 2 && pinchStartRef.current) {
        const [a, b] = pts;
        const curDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const ratio = curDist / pinchStartRef.current.dist;
        const nextZoom = clamp(pinchStartRef.current.zoom * ratio, 1, 6);
        setZoom(nextZoom);
        if (nextZoom === 1) setOffset({ x: 0, y: 0 });
        movedRef.current = true;
        return;
      }

      // pan (только когда zoom > 1)
      if (pts.length === 1 && panStartRef.current && zoom > 1) {
        const dx = e.clientX - panStartRef.current.startClient.x;
        const dy = e.clientY - panStartRef.current.startClient.y;

        // ограничение простое: чтобы не улетало совсем далеко
        const max = 2000;
        const next = {
          x: clamp(panStartRef.current.startOffset.x + dx, -max, max),
          y: clamp(panStartRef.current.startOffset.y + dy, -max, max),
        };
        setOffset(next);
        if (Math.abs(dx) + Math.abs(dy) > 4) movedRef.current = true;
      }
    },
    [viewMode, zoom]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!viewMode) return;

      pointersRef.current.delete(e.pointerId);
      const pts = Array.from(pointersRef.current.values());
      if (pts.length < 2) pinchStartRef.current = null;
      if (pts.length === 0) panStartRef.current = null;

      // если это был "тап" без сдвига — считаем как клик по карте
      if (!movedRef.current) {
        onImageClick?.();
      }
    },
    [viewMode, onImageClick]
  );

  return (
    <div className="flex-1 flex-col md:flex-row overflow-auto bg-gray-800 rounded-lg p-4 h-full">
      {/* Карта */}
      <div className="relative flex-1 overflow-hidden bg-gray-800" onWheel={onWheel}>
        {/* ВАЖНО: этот wrapper не absolute, чтобы не исчезало на iOS.
            Он занимает доступное место, а контент внутри вписывается через object-contain. */}
        <div
          className={[
            "relative w-full h-full",
            viewMode ? "touch-none" : "", // жесты обрабатываем pointer events
          ].join(" ")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* transform слой: зум/пан. По умолчанию zoom=1 => ровно fit-картинка */}
          <div style={transformStyle} className={viewMode ? "w-full h-full" : "w-full h-full"}>
            {hasRaster ? (
              <img
                ref={imgRef}
                src={location.map_url || ""}
                alt="Карта"
                draggable={false}
                onLoad={handleImgLoad}
                className="w-full h-full object-contain select-none"
              />
            ) : (
              <div
                className="w-full h-full"
                style={{
                  aspectRatio: `${imageSize.width} / ${imageSize.height}`,
                  background: '#ffffff',
                }}
              />
            )}

            {/* SVG overlay */}
            <svg
              ref={svgRef}
              className={[
                "absolute top-0 left-0 w-full h-full",
                viewMode ? "cursor-grab" : isDrawing ? "cursor-crosshair" : "cursor-default",
              ].join(" ")}
              onClick={viewMode ? undefined : handleSVGClick}
              viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {!hasRaster && (
                <rect
                  x={0}
                  y={0}
                  width={imageSize.width}
                  height={imageSize.height}
                  fill="#ffffff"
                />
              )}
              {location.map_objects
                .filter((polygon) => polygon.is_shown)
                .map((polygon) => {
                  const IconComponent = getIconComponent(polygon.icon_url || "");
                  const center = getPolygonCenter(polygon.polygon_list);
                  const pathData =
                    polygon.polygon_list
                      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
                      .join(" ") + (!polygon.is_line ? " Z" : "");

                  return (
                    <g key={polygon.id}>
                      <path
                        d={pathData}
                        fill={polygon.is_filled ? polygon.color : "none"}
                        fillOpacity={polygon.is_filled ? polygon.alpha : 0}
                        stroke={polygon.color}
                        strokeWidth="2"
                        strokeOpacity={polygon.alpha}
                        className="cursor-pointer hover:stroke-width-3"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPolygon?.(polygon.id);
                          onPolygonClicked?.(polygon);
                        }}
                      />

                      {polygon.polygon_list.map((point, index) => (
                        <circle
                          key={index}
                          cx={point.x}
                          cy={point.y}
                          r="3"
                          fill={polygon.color}
                          stroke="white"
                          strokeWidth="1"
                          className="cursor-pointer"
                        />
                      ))}

                      {IconComponent && polygon.polygon_list.length > 0 && (
                        <foreignObject
                          x={center.x - 12}
                          y={center.y - 12}
                          width="24"
                          height="24"
                          className="pointer-events-none"
                        >
                          <div className="flex items-center justify-center w-full h-full">
                            <IconComponent
                              className="w-6 h-6 text-white drop-shadow-lg"
                              style={{ filter: "drop-shadow(0 0 2px rgba(0,0,0,0.8))" }}
                            />
                          </div>
                        </foreignObject>
                      )}
                    </g>
                  );
                })}

              {currentPolygon && drawingSettings && currentPolygon.length > 0 && (
                <g>
                  <path
                    d={currentPolygon
                      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
                      .join(" ")}
                    fill="none"
                    stroke={drawingSettings.color}
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    strokeOpacity={drawingSettings.alpha}
                  />
                  {currentPolygon.map((point, index) => (
                    <circle
                      key={index}
                      cx={point.x}
                      cy={point.y}
                      r="4"
                      fill={drawingSettings.color}
                      stroke="white"
                      strokeWidth="2"
                    />
                  ))}
                </g>
              )}
            </svg>
          </div>
        </div>
      </div>

      {/* Инструкции */}
      {isDrawing && (
        <div className="mt-4 p-3 bg-blue-600 rounded-lg">
          <p className="text-sm font-medium">Режим рисования активен</p>
          <p className="text-xs opacity-90">
            Кликайте по карте для добавления точек. Нажмите "Завершить" когда закончите.
          </p>
        </div>
      )}

      {/* Панель редактирования */}
      {editable && (
        <div>
          <PolygonListViewer
            location={location}
            enabledPolygonIds={location.map_objects.map(p => p.id)}
            onToggleShown={onToggleShown}
            onEditPolygon={onEditPolygon}
            onDeletePolygon={onDeletePolygon}
            editable={editable}
            isMaster={isMaster}
          />
        </div>
      )}
    </div>
  );
}
