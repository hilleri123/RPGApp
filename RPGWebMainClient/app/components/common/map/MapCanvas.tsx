'use client';

import React from 'react';

export type MapCanvasMode = 'canvas' | 'raster' | 'excalidraw' | 'none';

export interface MapCanvasInfo {
  viewBox: string;
  bgWidth: number;
  bgHeight: number;
}

interface MapCanvasProps {
  canvasInfo: MapCanvasInfo | null;
  /** @deprecated dual-layer canvas ignores mode for background stacking */
  mode?: MapCanvasMode;
  rasterSrc?: string | null;
  excalidrawPreviewUrl?: string | null;
  emptyText?: string;
  onClick?: (e: React.MouseEvent<SVGSVGElement>) => void;
  svgRef?: React.RefObject<SVGSVGElement | null>;
  className?: string;
  svgClassName?: string;
  children?: React.ReactNode;
}

export function MapCanvas({
  canvasInfo,
  rasterSrc,
  excalidrawPreviewUrl,
  emptyText = 'Нет карты.',
  onClick,
  svgRef,
  className,
  svgClassName,
  children,
}: MapCanvasProps) {
  if (!canvasInfo) {
    return (
      <div
        className={`w-full h-full flex items-center justify-center text-xs text-gray-600 text-center leading-relaxed px-4 ${className ?? ''}`}
      >
        {emptyText}
      </div>
    );
  }

  const { bgWidth, bgHeight } = canvasInfo;

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={canvasInfo.viewBox}
      preserveAspectRatio="xMidYMid meet"
      onClick={onClick}
      className={svgClassName}
      style={{ display: 'block' }}
    >
      {/* Unified canvas: white board, optional raster, optional Excalidraw overlay */}
      <rect x={0} y={0} width={bgWidth} height={bgHeight} fill="#ffffff" />

      {rasterSrc && bgWidth > 0 && (
        <image
          href={rasterSrc}
          x={0}
          y={0}
          width={bgWidth}
          height={bgHeight}
          preserveAspectRatio="none"
        />
      )}

      {excalidrawPreviewUrl && bgWidth > 0 && (
        <image
          href={excalidrawPreviewUrl}
          x={0}
          y={0}
          width={bgWidth}
          height={bgHeight}
          preserveAspectRatio="none"
          opacity={0.95}
        />
      )}

      {children}
    </svg>
  );
}
