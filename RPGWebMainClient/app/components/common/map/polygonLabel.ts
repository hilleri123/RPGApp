export type PlainElement = {
  id?: string;
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  isDeleted?: boolean;
  containerId?: string | null;
  points?: [number, number][];
};

const AUTO_NAME = /^(rectangle|ellipse|diamond|freedraw|line|arrow) [0-9a-f]{4}$/i;

export function isAutoPolygonName(name: string | null | undefined): boolean {
  return Boolean(name && AUTO_NAME.test(name.trim()));
}

function polygonOf(el: PlainElement): { x: number; y: number }[] {
  const x = Number(el.x ?? 0);
  const y = Number(el.y ?? 0);
  const w = Number(el.width ?? 0);
  const h = Number(el.height ?? 0);
  if (el.type === 'rectangle') {
    return [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ];
  }
  if (el.type === 'diamond') {
    return [
      { x: x + w / 2, y },
      { x: x + w, y: y + h / 2 },
      { x: x + w / 2, y: y + h },
      { x, y: y + h / 2 },
    ];
  }
  if (el.type === 'ellipse') {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = Math.abs(w) / 2;
    const ry = Math.abs(h) / 2;
    const steps = 32;
    return Array.from({ length: steps }, (_, i) => {
      const a = (Math.PI * 2 * i) / steps;
      return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
    });
  }
  return [];
}

function pointInPolygon(px: number, py: number, polygon: { x: number; y: number }[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const hit = (yi > py) !== (yj > py)
      && px < ((xj - xi) * (py - yi)) / ((yj - yi) || 1e-9) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

function center(el: PlainElement): { x: number; y: number } {
  return {
    x: Number(el.x ?? 0) + Number(el.width ?? 0) / 2,
    y: Number(el.y ?? 0) + Number(el.height ?? 0) / 2,
  };
}

export function labelInsideShape(el: PlainElement, elements: PlainElement[]): string | null {
  const bound = elements.find(
    (text) => text.type === 'text' && !text.isDeleted && text.containerId === el.id,
  );
  const boundText = (bound?.text ?? '').trim();
  if (boundText) return boundText;

  const polygon = polygonOf(el);
  if (polygon.length < 3) return null;
  const origin = center(el);
  let best: string | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const text of elements) {
    if (text.type !== 'text' || text.isDeleted || text.containerId) continue;
    const value = (text.text ?? '').trim();
    if (!value) continue;
    const at = center(text);
    if (!pointInPolygon(at.x, at.y, polygon)) continue;
    const dist = (at.x - origin.x) ** 2 + (at.y - origin.y) ** 2;
    if (dist < bestDist) {
      best = value;
      bestDist = dist;
    }
  }
  return best;
}

export function polygonNameFromShape(
  existing: { name?: string | null; name_is_manual?: boolean } | null | undefined,
  el: PlainElement,
  elements: PlainElement[],
): { name: string; name_is_manual: boolean } {
  const fallback = `${el.type ?? 'shape'} ${String(el.id ?? '').slice(0, 4)}`;
  const label = labelInsideShape(el, elements);
  if (existing?.name_is_manual) {
    return { name: existing.name || label || fallback, name_is_manual: true };
  }
  if (label) return { name: label, name_is_manual: false };
  if (existing?.name && !isAutoPolygonName(existing.name)) {
    return { name: existing.name, name_is_manual: false };
  }
  return { name: fallback, name_is_manual: false };
}
