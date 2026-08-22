export const DEFAULT_MAP_WIDTH = 1024;
export const DEFAULT_MAP_HEIGHT = 768;
export const MAP_EXPAND_STEP = 256;

export type ExpandDir = 'n' | 'e' | 's' | 'w';

export type Point = { x: number; y: number };

export function resolveCanvasSize(opts: {
  mapUrl?: string | null;
  mapWidth?: number | null;
  mapHeight?: number | null;
  rasterNatural?: { w: number; h: number } | null;
}): { w: number; h: number } | null {
  if (opts.mapUrl) {
    if (opts.rasterNatural?.w && opts.rasterNatural?.h) {
      return { w: opts.rasterNatural.w, h: opts.rasterNatural.h };
    }
    if (opts.mapWidth && opts.mapHeight) {
      return { w: opts.mapWidth, h: opts.mapHeight };
    }
    return null;
  }
  if (opts.mapWidth && opts.mapHeight) {
    return { w: opts.mapWidth, h: opts.mapHeight };
  }
  return { w: DEFAULT_MAP_WIDTH, h: DEFAULT_MAP_HEIGHT };
}

export function expandDelta(dir: ExpandDir, step = MAP_EXPAND_STEP): {
  dw: number;
  dh: number;
  dx: number;
  dy: number;
} {
  switch (dir) {
    case 'e':
      return { dw: step, dh: 0, dx: 0, dy: 0 };
    case 's':
      return { dw: 0, dh: step, dx: 0, dy: 0 };
    case 'w':
      return { dw: step, dh: 0, dx: step, dy: 0 };
    case 'n':
      return { dw: 0, dh: step, dx: 0, dy: step };
  }
}

export function shiftPoints(points: Point[], dx: number, dy: number): Point[] {
  if (!dx && !dy) return points;
  return points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

export function shiftMapObjects<T extends { polygon_list?: Point[] }>(
  objects: T[],
  dx: number,
  dy: number,
): T[] {
  if (!dx && !dy) return objects;
  return objects.map((o) => ({
    ...o,
    polygon_list: shiftPoints(o.polygon_list ?? [], dx, dy),
  }));
}

export function shiftExcalidrawScene(scene: any, dx: number, dy: number): any {
  if (!scene || (!dx && !dy)) return scene;
  const elements = (scene.elements ?? []).map((el: any) =>
    el?.isDeleted ? el : { ...el, x: Number(el.x ?? 0) + dx, y: Number(el.y ?? 0) + dy },
  );
  return { ...scene, elements };
}

/** Content bbox of non-deleted Excalidraw elements (incl. text). */
export function getExcalidrawElementsBbox(scene: any): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} | null {
  const elements = (scene?.elements ?? []).filter((el: any) => !el?.isDeleted);
  if (!elements.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    const x = Number(el?.x ?? 0);
    const y = Number(el?.y ?? 0);
    const w = Number(el?.width ?? 0);
    const h = Number(el?.height ?? 0);
    minX = Math.min(minX, x, x + w);
    minY = Math.min(minY, y, y + h);
    maxX = Math.max(maxX, x, x + w);
    maxY = Math.max(maxY, y, y + h);
    if (Array.isArray(el?.points)) {
      for (const pt of el.points) {
        const px = x + Number(pt?.[0] ?? 0);
        const py = y + Number(pt?.[1] ?? 0);
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }
    }
  }
  if (!isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

/**
 * Normalize legacy Excalidraw-only maps onto a 0..W x 0..H canvas.
 * Shifts content so min corner is at (0,0) when coords are far from origin.
 */
export function normalizeLegacyCanvasForm(form: {
  map_url?: string | null;
  map_width?: number | null;
  map_height?: number | null;
  excalidraw_map_json?: any;
  map_objects?: Array<{ polygon_list?: Point[] }>;
}): {
  map_width: number;
  map_height: number;
  excalidraw_map_json: any;
  map_objects: Array<{ polygon_list?: Point[] }>;
  changed: boolean;
} {
  const hasRaster = Boolean(form.map_url);
  let w = form.map_width ?? null;
  let h = form.map_height ?? null;
  let scene = form.excalidraw_map_json ?? null;
  let objects = form.map_objects ?? [];
  let changed = false;

  if (hasRaster) {
    // Size will be synced from natural image on the client; keep stored values if present.
    return {
      map_width: w ?? DEFAULT_MAP_WIDTH,
      map_height: h ?? DEFAULT_MAP_HEIGHT,
      excalidraw_map_json: scene,
      map_objects: objects,
      changed: false,
    };
  }

  if (!w || !h) {
    const bbox = getExcalidrawElementsBbox(scene);
    if (bbox) {
      const pad = 40;
      // If content already sits in positive space starting near 0, use max extent.
      const needShift = bbox.minX < -1 || bbox.minY < -1 || bbox.minX > 80 || bbox.minY > 80;
      if (needShift) {
        const dx = -bbox.minX + pad;
        const dy = -bbox.minY + pad;
        scene = shiftExcalidrawScene(scene, dx, dy);
        objects = shiftMapObjects(objects, dx, dy);
        w = Math.ceil(bbox.maxX - bbox.minX + pad * 2);
        h = Math.ceil(bbox.maxY - bbox.minY + pad * 2);
        changed = true;
      } else {
        w = Math.max(DEFAULT_MAP_WIDTH, Math.ceil(bbox.maxX + pad));
        h = Math.max(DEFAULT_MAP_HEIGHT, Math.ceil(bbox.maxY + pad));
        changed = true;
      }
    } else {
      w = DEFAULT_MAP_WIDTH;
      h = DEFAULT_MAP_HEIGHT;
      changed = true;
    }
  }

  return {
    map_width: w!,
    map_height: h!,
    excalidraw_map_json: scene,
    map_objects: objects,
    changed,
  };
}

/** Pad an image with white on N/E/S/W and return a PNG File. */
export async function expandRasterImageFile(
  src: string | Blob,
  dir: ExpandDir,
  step = MAP_EXPAND_STEP,
  fileName = 'map.png',
): Promise<{ file: File; width: number; height: number; dx: number; dy: number }> {
  const { dw, dh, dx, dy } = expandDelta(dir, step);
  const img = await loadImage(src);
  const newW = img.naturalWidth + dw;
  const newH = img.naturalHeight + dh;
  const canvas = document.createElement('canvas');
  canvas.width = newW;
  canvas.height = newH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d unavailable');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, newW, newH);
  ctx.drawImage(img, dx, dy);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  });
  return {
    file: new File([blob], fileName, { type: 'image/png' }),
    width: newW,
    height: newH,
    dx,
    dy,
  };
}

function loadImage(src: string | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let objectUrl: string | null = null;
    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for expand'));
    };
    if (typeof src === 'string') {
      img.src = src;
    } else {
      objectUrl = URL.createObjectURL(src);
      img.src = objectUrl;
    }
  });
}
