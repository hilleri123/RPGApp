// @ts-nocheck
import { expect, test } from 'vitest';
import { polygonNameFromShape } from './polygonLabel';

const shape = { id: 'abcd1234', type: 'rectangle', x: 0, y: 0, width: 100, height: 80 };
const text = { id: 't1', type: 'text', x: 30, y: 30, width: 40, height: 20, text: 'Таверна' };

test('text in the center of a shape names the polygon', () => {
  const named = polygonNameFromShape(null, shape, [shape, text]);
  expect(named.name).toBe('Таверна');
  expect(named.name_is_manual).toBe(false);
});

test('a manually named polygon keeps its name', () => {
  const named = polygonNameFromShape(
    { name: 'Своё', name_is_manual: true },
    shape,
    [shape, text],
  );
  expect(named.name).toBe('Своё');
  expect(named.name_is_manual).toBe(true);
});
