/** Locked visual frame + helpers to keep Excalidraw content inside the map canvas. */

export const MAP_CANVAS_FRAME_ID = '__map_canvas_frame__';
export const MAP_CANVAS_ELEMENT_PREFIX = '__map_canvas_';
const MASK_PAD = 50_000;

export function isMapCanvasHelperElement(el: { id?: string } | null | undefined): boolean {
  return Boolean(el?.id?.startsWith(MAP_CANVAS_ELEMENT_PREFIX));
}

export function createCanvasFrameElement(width: number, height: number) {
  return {
    id: MAP_CANVAS_FRAME_ID,
    type: 'rectangle' as const,
    x: 0,
    y: 0,
    width,
    height,
    angle: 0,
    strokeColor: '#6366f1',
    backgroundColor: 'transparent',
    fillStyle: 'solid' as const,
    strokeWidth: 2,
    strokeStyle: 'dashed' as const,
    roughness: 0,
    opacity: 100,
    groupIds: [] as string[],
    frameId: null,
    roundness: null,
    seed: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: true,
  };
}

function createCanvasMaskElements(width: number, height: number) {
  const fill = '#0f1117';
  const base = {
    angle: 0,
    strokeColor: 'transparent',
    backgroundColor: fill,
    fillStyle: 'solid' as const,
    strokeWidth: 0,
    strokeStyle: 'solid' as const,
    roughness: 0,
    opacity: 55,
    groupIds: [] as string[],
    frameId: null,
    roundness: null,
    seed: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: true,
    type: 'rectangle' as const,
  };
  return [
    {
      ...base,
      id: `${MAP_CANVAS_ELEMENT_PREFIX}mask_n`,
      x: -MASK_PAD,
      y: -MASK_PAD,
      width: width + MASK_PAD * 2,
      height: MASK_PAD,
    },
    {
      ...base,
      id: `${MAP_CANVAS_ELEMENT_PREFIX}mask_s`,
      x: -MASK_PAD,
      y: height,
      width: width + MASK_PAD * 2,
      height: MASK_PAD,
    },
    {
      ...base,
      id: `${MAP_CANVAS_ELEMENT_PREFIX}mask_w`,
      x: -MASK_PAD,
      y: 0,
      width: MASK_PAD,
      height,
    },
    {
      ...base,
      id: `${MAP_CANVAS_ELEMENT_PREFIX}mask_e`,
      x: width,
      y: 0,
      width: MASK_PAD,
      height,
    },
  ];
}

function nearlyEqual(a: number, b: number, eps = 0.01) {
  return Math.abs(a - b) <= eps;
}

function clampScalar(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function clampElementToCanvas<T extends Record<string, any>>(
  el: T,
  canvasW: number,
  canvasH: number,
): { element: T; changed: boolean } {
  if (isMapCanvasHelperElement(el) || el.isDeleted) {
    return { element: el, changed: false };
  }

  const W = Math.max(1, canvasW);
  const H = Math.max(1, canvasH);

  if (Array.isArray(el.points) && el.points.length > 0) {
    const abs = el.points.map((pt: [number, number]) => [
      Number(el.x ?? 0) + Number(pt?.[0] ?? 0),
      Number(el.y ?? 0) + Number(pt?.[1] ?? 0),
    ]);
    const clamped = abs.map(([ax, ay]: number[]) => [
      clampScalar(ax, 0, W),
      clampScalar(ay, 0, H),
    ]);
    const ox = clamped[0][0];
    const oy = clamped[0][1];
    const points = clamped.map(([ax, ay]: number[]) => [ax - ox, ay - oy] as [number, number]);
    let changed =
      !nearlyEqual(ox, Number(el.x ?? 0)) || !nearlyEqual(oy, Number(el.y ?? 0));
    if (!changed) {
      for (let i = 0; i < points.length; i++) {
        if (
          !nearlyEqual(points[i][0], Number(el.points[i]?.[0] ?? 0)) ||
          !nearlyEqual(points[i][1], Number(el.points[i]?.[1] ?? 0))
        ) {
          changed = true;
          break;
        }
      }
    }
    if (!changed) return { element: el, changed: false };
    return { element: { ...el, x: ox, y: oy, points }, changed: true };
  }

  const x = Number(el.x ?? 0);
  const y = Number(el.y ?? 0);
  const w = Number(el.width ?? 0);
  const h = Number(el.height ?? 0);

  const minX = Math.min(x, x + w);
  const minY = Math.min(y, y + h);
  const absW = Math.min(Math.abs(w) || 0, W);
  const absH = Math.min(Math.abs(h) || 0, H);

  if (absW === 0 && absH === 0) {
    const nx = clampScalar(x, 0, W);
    const ny = clampScalar(y, 0, H);
    if (nearlyEqual(nx, x) && nearlyEqual(ny, y)) return { element: el, changed: false };
    return { element: { ...el, x: nx, y: ny }, changed: true };
  }

  const nx = clampScalar(minX, 0, Math.max(0, W - absW));
  const ny = clampScalar(minY, 0, Math.max(0, H - absH));
  const outW = w < 0 ? -absW : absW;
  const outH = h < 0 ? -absH : absH;
  const finalX = w < 0 ? nx + absW : nx;
  const finalY = h < 0 ? ny + absH : ny;

  if (
    nearlyEqual(finalX, x) &&
    nearlyEqual(finalY, y) &&
    nearlyEqual(outW, w) &&
    nearlyEqual(outH, h)
  ) {
    return { element: el, changed: false };
  }

  return {
    element: { ...el, x: finalX, y: finalY, width: outW, height: outH },
    changed: true,
  };
}

export function clampElementsToCanvas<T extends Record<string, any>>(
  elements: readonly T[],
  canvasW: number,
  canvasH: number,
): { elements: T[]; changed: boolean } {
  let changed = false;
  const next = elements.map((el) => {
    const r = clampElementToCanvas(el, canvasW, canvasH);
    if (r.changed) changed = true;
    return r.element;
  });
  return { elements: next, changed };
}

/** Ensure helpers exist and user content stays inside the canvas. */
export function constrainSceneToCanvas<T extends Record<string, any>>(
  elements: readonly T[],
  canvasW: number,
  canvasH: number,
): { elements: T[]; changed: boolean } {
  const user = elements.filter((el) => !isMapCanvasHelperElement(el));
  const helpers = [
    ...createCanvasMaskElements(canvasW, canvasH),
    createCanvasFrameElement(canvasW, canvasH),
  ] as unknown as T[];

  const hadAllHelpers =
    elements.some((el) => el.id === MAP_CANVAS_FRAME_ID) &&
    elements.some((el) => el.id === `${MAP_CANVAS_ELEMENT_PREFIX}mask_n`) &&
    elements.some((el) => el.id === `${MAP_CANVAS_ELEMENT_PREFIX}mask_e`) &&
    elements.some((el) => el.id === `${MAP_CANVAS_ELEMENT_PREFIX}mask_s`) &&
    elements.some((el) => el.id === `${MAP_CANVAS_ELEMENT_PREFIX}mask_w`);

  const framePrev = elements.find((el) => el.id === MAP_CANVAS_FRAME_ID);
  const frameSizeOk =
    framePrev &&
    nearlyEqual(Number(framePrev.width), canvasW) &&
    nearlyEqual(Number(framePrev.height), canvasH) &&
    nearlyEqual(Number(framePrev.x), 0) &&
    nearlyEqual(Number(framePrev.y), 0);

  const { elements: clampedUser, changed: contentChanged } = clampElementsToCanvas(
    user,
    canvasW,
    canvasH,
  );

  const helpersChanged = !hadAllHelpers || !frameSizeOk;
  const changed = helpersChanged || contentChanged;

  return {
    elements: [...helpers, ...clampedUser],
    changed,
  };
}
