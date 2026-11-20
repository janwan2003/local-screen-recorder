// Pure helpers shared by the UI, the worker and the unit tests. No DOM access here.

/** Output size for a source of srcW x srcH, fitted inside maxW x maxH, rounded to even numbers. */
export function outputSize(srcW, srcH, maxW = 1920, maxH = 1080) {
  srcW = Math.max(2, srcW | 0); srcH = Math.max(2, srcH | 0);
  // A portrait source (a phone-shaped window) gets the box rotated.
  if (srcH > srcW && maxW > maxH) [maxW, maxH] = [maxH, maxW];
  const s = Math.min(1, maxW / srcW, maxH / srcH);
  const even = (n) => Math.max(2, Math.round(n / 2) * 2);
  return { width: even(srcW * s), height: even(srcH * s) };
}

/** Rectangle that fits (contain) or fills (cover) a w x h source into a W x H box. */
export function fitRect(w, h, W, H, mode = 'contain') {
  const s = mode === 'cover' ? Math.max(W / w, H / h) : Math.min(W / w, H / h);
  const dw = w * s, dh = h * s;
  return { x: (W - dw) / 2, y: (H - dh) / 2, w: dw, h: dh };
}

export const BUBBLE_SIZES = { small: 0.18, medium: 0.26, large: 0.36 };
export const BUBBLE_CORNERS = ['bottom-left', 'bottom-right', 'top-left', 'top-right'];

/** Webcam bubble square (x, y, d) on a W x H canvas. */
export function bubbleRect(W, H, size = 'medium', corner = 'bottom-left') {
  const d = Math.round(Math.min(W, H) * (BUBBLE_SIZES[size] || BUBBLE_SIZES.medium));
  const m = Math.round(Math.min(W, H) * 0.035);
  const x = corner.endsWith('right') ? W - d - m : m;
  const y = corner.startsWith('top') ? m : H - d - m;
  return { x, y, d };
}

/** "1:05", "1:02:03". */
export function formatDuration(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** "0:12.4" for the trim handles. */
export function formatPrecise(sec) {
  sec = Math.max(0, sec || 0);
  const whole = Math.floor(sec);
  return `${formatDuration(whole)}.${Math.floor((sec - whole) * 10)}`;
}

export function formatBytes(n) {
  if (!Number.isFinite(n) || n < 0) return '?';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return `${n >= 100 || i === 0 ? Math.round(n) : n.toFixed(1)} ${u[i]}`;
}

/** File name for a new recording: "Diskreel 2026-11-20 at 19.45.03.mp4". */
export function recordingName(date = new Date(), ext = 'mp4') {
  const p = (n) => String(n).padStart(2, '0');
  return `Diskreel ${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} at ` +
    `${p(date.getHours())}.${p(date.getMinutes())}.${p(date.getSeconds())}.${ext}`;
}

/** Name for an exported copy: keeps the base name, adds " (trimmed)" when trimmed. */
export function exportName(name, trimmed, ext = 'mp4') {
  const base = String(name || 'Diskreel recording').replace(/\.[a-z0-9]+$/i, '');
  return `${base}${trimmed ? ' (trimmed)' : ''}.${ext}`;
}

/** Clamp a trim range to [0, duration] with a minimum length. Returns null when it covers everything. */
export function normalizeTrim(start, end, duration, minLen = 0.5) {
  if (!(duration > 0)) return null;
  let s = Math.max(0, Math.min(Number(start) || 0, duration));
  let e = Math.max(0, Math.min(Number.isFinite(end) ? end : duration, duration));
  if (e < s) [s, e] = [e, s];
  if (e - s < minLen) e = Math.min(duration, s + minLen), s = Math.max(0, e - minLen);
  if (s <= 0.05 && e >= duration - 0.05) return null;
  return { start: s, end: e };
}

/** Bitrate in bits/s for a size and frame rate, roughly 0.1 bits per pixel per frame for screen content. */
export function videoBitrate(width, height, fps = 30) {
  return Math.round(Math.min(12e6, Math.max(1.5e6, width * height * fps * 0.1)));
}
