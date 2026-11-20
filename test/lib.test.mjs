import test from 'node:test';
import assert from 'node:assert/strict';
import { outputSize, fitRect, bubbleRect, formatDuration, formatPrecise, formatBytes, recordingName, exportName, normalizeTrim, videoBitrate } from '../src/app/lib.js';

test('outputSize keeps aspect, caps at 1080p, even numbers', () => {
  assert.deepEqual(outputSize(1920, 1080), { width: 1920, height: 1080 });
  assert.deepEqual(outputSize(3840, 2160), { width: 1920, height: 1080 });
  assert.deepEqual(outputSize(2560, 1600), { width: 1728, height: 1080 });
  assert.deepEqual(outputSize(1281, 721), { width: 1282, height: 722 });
  const p = outputSize(1080, 2400);
  assert.ok(p.height <= 1920 && p.width <= 1080 && p.width % 2 === 0 && p.height % 2 === 0);
  assert.deepEqual(outputSize(0, 0), { width: 2, height: 2 });
});

test('fitRect contain and cover', () => {
  assert.deepEqual(fitRect(100, 50, 200, 200), { x: 0, y: 50, w: 200, h: 100 });
  assert.deepEqual(fitRect(100, 50, 200, 200, 'cover'), { x: -100, y: 0, w: 400, h: 200 });
});

test('bubbleRect corners stay inside the frame', () => {
  for (const c of ['bottom-left', 'bottom-right', 'top-left', 'top-right']) {
    const { x, y, d } = bubbleRect(1920, 1080, 'large', c);
    assert.ok(x >= 0 && y >= 0 && x + d <= 1920 && y + d <= 1080, c);
  }
  assert.ok(bubbleRect(1920, 1080, 'small').d < bubbleRect(1920, 1080, 'large').d);
  assert.equal(bubbleRect(1920, 1080, 'nonsense').d, bubbleRect(1920, 1080, 'medium').d);
});

test('formatting', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(65.9), '1:05');
  assert.equal(formatDuration(3723), '1:02:03');
  assert.equal(formatPrecise(12.46), '0:12.4');
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1500), '1.5 KB');
  assert.equal(formatBytes(250e6), '250 MB');
  assert.equal(formatBytes(-1), '?');
});

test('names', () => {
  assert.equal(recordingName(new Date(2026, 10, 20, 9, 5, 3)), 'Diskreel 2026-11-20 at 09.05.03.mp4');
  assert.equal(exportName('Bug report.mp4', true), 'Bug report (trimmed).mp4');
  assert.equal(exportName('Bug report.mp4', false, 'webm'), 'Bug report.webm');
  assert.equal(exportName('', false), 'Diskreel recording.mp4');
});

test('normalizeTrim', () => {
  assert.equal(normalizeTrim(0, 10, 10), null, 'full range means no trim');
  assert.deepEqual(normalizeTrim(2, 8, 10), { start: 2, end: 8 });
  assert.deepEqual(normalizeTrim(8, 2, 10), { start: 2, end: 8 }, 'swapped handles');
  assert.deepEqual(normalizeTrim(-5, 99, 10), null);
  const t = normalizeTrim(5, 5.1, 10);
  assert.ok(t.end - t.start >= 0.5 - 1e-9, 'minimum length');
  assert.equal(normalizeTrim(1, 2, 0), null);
});

test('videoBitrate is bounded', () => {
  assert.equal(videoBitrate(320, 240), 1.5e6);
  assert.equal(videoBitrate(3840, 2160), 12e6);
  assert.ok(videoBitrate(1920, 1080) > 4e6);
});
