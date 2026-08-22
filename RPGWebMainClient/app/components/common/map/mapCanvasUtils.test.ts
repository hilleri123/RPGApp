import { describe, expect, it } from 'vitest';
import {
  expandDelta,
  normalizeLegacyCanvasForm,
  shiftExcalidrawScene,
  shiftMapObjects,
} from './mapCanvasUtils';
import {
  clampElementToCanvas,
  constrainSceneToCanvas,
  isMapCanvasHelperElement,
  MAP_CANVAS_FRAME_ID,
} from './excalidrawCanvasBounds';

describe('mapCanvasUtils', () => {
  it('expandDelta shifts content for west/north', () => {
    expect(expandDelta('e', 256)).toEqual({ dw: 256, dh: 0, dx: 0, dy: 0 });
    expect(expandDelta('w', 256)).toEqual({ dw: 256, dh: 0, dx: 256, dy: 0 });
    expect(expandDelta('n', 100)).toEqual({ dw: 0, dh: 100, dx: 0, dy: 100 });
  });

  it('shifts map objects and excalidraw elements', () => {
    const objs = shiftMapObjects(
      [{ polygon_list: [{ x: 10, y: 20 }] }],
      5,
      7,
    );
    expect(objs[0].polygon_list).toEqual([{ x: 15, y: 27 }]);

    const scene = shiftExcalidrawScene(
      { elements: [{ id: 'a', x: 1, y: 2, isDeleted: false }] },
      3,
      4,
    );
    expect(scene.elements[0]).toMatchObject({ x: 4, y: 6 });
  });

  it('normalizeLegacyCanvasForm sets default white canvas', () => {
    const out = normalizeLegacyCanvasForm({
      map_url: null,
      map_width: null,
      map_height: null,
      excalidraw_map_json: null,
      map_objects: [],
    });
    expect(out.map_width).toBe(1024);
    expect(out.map_height).toBe(768);
    expect(out.changed).toBe(true);
  });

  it('normalizeLegacyCanvasForm shifts far-away excalidraw content', () => {
    const out = normalizeLegacyCanvasForm({
      map_url: null,
      map_width: null,
      map_height: null,
      excalidraw_map_json: {
        elements: [
          { id: 'r', type: 'rectangle', x: 500, y: 600, width: 100, height: 80, isDeleted: false },
        ],
      },
      map_objects: [{ polygon_list: [{ x: 500, y: 600 }] }],
    });
    expect(out.changed).toBe(true);
    expect(out.excalidraw_map_json.elements[0].x).toBeLessThan(500);
    expect(out.map_objects[0].polygon_list![0].x).toBeLessThan(500);
  });

  it('clamps elements into canvas and injects visible frame', () => {
    const { element, changed } = clampElementToCanvas(
      { id: 'r', x: -50, y: 10, width: 40, height: 40 },
      200,
      100,
    );
    expect(changed).toBe(true);
    expect(element.x).toBe(0);

    const scene = constrainSceneToCanvas(
      [{ id: 'r', x: 250, y: 10, width: 40, height: 40 }],
      200,
      100,
    );
    expect(scene.changed).toBe(true);
    expect(scene.elements.some((el) => el.id === MAP_CANVAS_FRAME_ID)).toBe(true);
    const user = scene.elements.find((el) => el.id === 'r')!;
    expect(user.x + user.width).toBeLessThanOrEqual(200);
    expect(isMapCanvasHelperElement({ id: MAP_CANVAS_FRAME_ID })).toBe(true);
  });
});
