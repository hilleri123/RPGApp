import type { LibraryItem, LibraryItems } from '@excalidraw/excalidraw/types/types';

/**
 * Значки карты — контуры Lucide (ISC), https://lucide.dev
 * castle, house, mountain, waves, trees, tree-pine.
 *
 * Превью во вкладке библиотеки строится без файлов картинок, поэтому
 * значок должен быть линиями, а не картинкой. Тёмная тема потом
 * инвертирует и холст, и это превью, поэтому цвет линии — до инверсии:
 * чёрный становится белым, тёмно-синий — голубым, тёмно-зелёный — зелёным.
 */

const TOPONYM_PREFIX = 'rpg-toponym-';

const INK = '#000000';
const RIVER = '#005098';
const TREES = '#00640c';

const SCALE = 3;
const STROKE = 6;

type IconSpec = {
  id: string;
  name: string;
  paths: string[];
  stroke: string;
};

const ICONS: IconSpec[] = [
  {
    id: `${TOPONYM_PREFIX}tower-v3`,
    name: 'Башня',
    stroke: INK,
    paths: [
      'M22 20v-9H2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2Z',
      'M18 11V4H6v7',
      'M15 22v-4a3 3 0 0 0-3-3a3 3 0 0 0-3 3v4',
      'M22 11V9',
      'M2 11V9',
      'M6 4V2',
      'M18 4V2',
      'M10 4V2',
      'M14 4V2',
    ],
  },
  {
    id: `${TOPONYM_PREFIX}house-v3`,
    name: 'Дом',
    stroke: INK,
    paths: [
      'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8',
      'M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    ],
  },
  {
    id: `${TOPONYM_PREFIX}mountain-v3`,
    name: 'Гора',
    stroke: INK,
    paths: ['m8 3 4 8 5-5 5 15H2L8 3z'],
  },
  {
    id: `${TOPONYM_PREFIX}river-v3`,
    name: 'Река',
    stroke: RIVER,
    paths: [
      'M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1',
      'M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1',
      'M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1',
    ],
  },
  {
    id: `${TOPONYM_PREFIX}forest-v3`,
    name: 'Лес',
    stroke: TREES,
    paths: [
      'M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z',
      'M7 16v6',
      'M13 19v3',
      'M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5',
    ],
  },
  {
    id: `${TOPONYM_PREFIX}trees-v3`,
    name: 'Деревья',
    stroke: TREES,
    paths: [
      'm17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z',
      'M12 22v-3',
    ],
  },
];

function samplePath(d: string): Array<[number, number]> {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  const length = path.getTotalLength();
  if (!length) return [];
  const steps = Math.max(8, Math.ceil(length / 0.6));
  const raw: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i += 1) {
    const point = path.getPointAtLength((length * i) / steps);
    const prev = raw[raw.length - 1];
    if (prev && Math.hypot(point.x - prev[0], point.y - prev[1]) < 0.05) continue;
    raw.push([point.x, point.y]);
  }
  return raw;
}

function lineFromPath(d: string, stroke: string) {
  const raw = samplePath(d);
  if (raw.length < 2) return null;
  const [x0, y0] = raw[0];
  return {
    type: 'line' as const,
    x: x0 * SCALE,
    y: y0 * SCALE,
    points: raw.map(([x, y]) => [(x - x0) * SCALE, (y - y0) * SCALE]),
    strokeColor: stroke,
    backgroundColor: 'transparent',
    fillStyle: 'solid' as const,
    strokeWidth: STROKE,
    strokeStyle: 'solid' as const,
    roughness: 0,
    opacity: 100,
  };
}

export async function toponymLibrary(): Promise<LibraryItem[]> {
  const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw');
  const created = 1;
  return ICONS.map((icon) => ({
    id: icon.id,
    name: icon.name,
    status: 'published' as const,
    created,
    elements: convertToExcalidrawElements(
      icon.paths.map((d) => lineFromPath(d, icon.stroke)).filter((line) => line != null) as never,
    ),
  }));
}

export function mergeToponymLibrary(current: LibraryItems, items: LibraryItem[]): LibraryItem[] {
  return [...current.filter((item) => !String(item.id).startsWith(TOPONYM_PREFIX)), ...items];
}
