import test from 'node:test';
import assert from 'node:assert/strict';

import { convertToBase } from '@/lib/nutrients';

test('apple piece converts to 150 grams', () => {
  const grams = convertToBase(1, '顆', 'g', { ingredientName: 'Apple' });
  assert.equal(grams, 150);
});

test('apple piece (Chinese name) converts to 150 grams', () => {
  const grams = convertToBase(1, '顆', 'g', { ingredientName: '蘋果' });
  assert.equal(grams, 150);
});

test('one cup converts to 240 milliliters', () => {
  const ml = convertToBase(1, 'cup', 'ml');
  assert.equal(ml, 240);
});
