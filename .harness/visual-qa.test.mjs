import { test } from 'node:test';
import assert from 'node:assert/strict';

test('bbox fora do ancestral rolável não é overlap pintado; interseção real é detectada', async () => {
  const { paintedOverlap } = await import('./visual-qa.mjs');
  const nav = { rect: { left: 0, right: 390, top: 776, bottom: 836 }, clips: [] };
  const control = {
    rect: { left: 10, right: 100, top: 790, bottom: 830 },
    clips: [{ left: 0, right: 390, top: 24, bottom: 768 }],
  };
  assert.equal(paintedOverlap(control, nav), false);
  assert.equal(paintedOverlap({ ...control, clips: [] }, nav), true);
  assert.equal(
    paintedOverlap(
      { rect: { left: 10, right: 100, top: 700, bottom: 740 }, clips: control.clips },
      nav,
    ),
    false,
  );
});
