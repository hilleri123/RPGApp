import { useEffect, useState } from 'react';
import {
  isMapCanvasHelperElement,
  MAP_CANVAS_FRAME_ID,
} from './excalidrawCanvasBounds';

export type ExcalidrawPreview = {
  url: string;
  vbW: number;
  vbH: number;
  /** Always 0 in canvas mode — kept for call-site compatibility. */
  originX: number;
  originY: number;
};

/**
 * Export Excalidraw scene clipped to a fixed canvas (W×H), origin (0,0).
 * Text no longer moves canvas bounds.
 */
export function useExcalidrawPreview(
  excalidrawJson: any,
  enabled: boolean,
  canvasW?: number | null,
  canvasH?: number | null,
): ExcalidrawPreview | null {
  const [result, setResult] = useState<ExcalidrawPreview | null>(null);

  useEffect(() => {
    if (!enabled || !excalidrawJson?.elements?.length) {
      setResult(null);
      return;
    }
    const w = canvasW && canvasW > 0 ? canvasW : null;
    const h = canvasH && canvasH > 0 ? canvasH : null;

    let cancelled = false;
    (async () => {
      try {
        const { exportToSvg } = await import('@excalidraw/excalidraw');
        // Drop editor helpers (masks / border); inject invisible sizing frame instead.
        const elements = (excalidrawJson.elements ?? []).filter(
          (el: any) => !el?.isDeleted && !isMapCanvasHelperElement(el),
        );

        const framed =
          w && h
            ? [
                {
                  id: MAP_CANVAS_FRAME_ID,
                  type: 'rectangle',
                  x: 0,
                  y: 0,
                  width: w,
                  height: h,
                  angle: 0,
                  strokeColor: 'transparent',
                  backgroundColor: 'transparent',
                  fillStyle: 'solid',
                  strokeWidth: 0,
                  strokeStyle: 'solid',
                  roughness: 0,
                  opacity: 0,
                  groupIds: [],
                  frameId: null,
                  roundness: null,
                  seed: 1,
                  versionNonce: 1,
                  isDeleted: false,
                  boundElements: null,
                  updated: 1,
                  link: null,
                  locked: true,
                },
                ...elements,
              ]
            : elements;

        const svg: SVGSVGElement = await exportToSvg({
          elements: framed as any,
          appState: {
            ...(excalidrawJson.appState ?? {}),
            exportWithDarkMode: true,
            exportBackground: false,
            viewBackgroundColor: 'transparent',
          },
          files: excalidrawJson.files ?? null,
          exportPadding: 0,
        });
        if (cancelled) return;

        const vbAttr = svg.getAttribute('viewBox') ?? '0 0 1000 1000';
        const parts = vbAttr.split(/[\s,]+/).map(Number);
        const contentW = Number.isFinite(parts[2]) ? parts[2] : 1000;
        const contentH = Number.isFinite(parts[3]) ? parts[3] : 1000;
        const outW = w ?? contentW;
        const outH = h ?? contentH;

        // Excalidraw keeps absolute scene coords in the SVG; pin viewBox to canvas.
        svg.setAttribute('viewBox', `0 0 ${outW} ${outH}`);
        svg.setAttribute('width', String(outW));
        svg.setAttribute('height', String(outH));

        const url = URL.createObjectURL(
          new Blob([new XMLSerializer().serializeToString(svg)], {
            type: 'image/svg+xml;charset=utf-8',
          }),
        );
        setResult((prev) => {
          if (prev?.url) URL.revokeObjectURL(prev.url);
          return {
            url,
            vbW: outW,
            vbH: outH,
            originX: 0,
            originY: 0,
          };
        });
      } catch {
        if (!cancelled) setResult(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [excalidrawJson, enabled, canvasW, canvasH]);

  useEffect(
    () => () => {
      setResult((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return null;
      });
    },
    [],
  );

  return enabled ? result : null;
}
