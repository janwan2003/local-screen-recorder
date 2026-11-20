// Recording engine. Runs in a dedicated worker so that it keeps working at full speed
// while the recorder tab is in the background (main-thread timers and rAF get throttled).
//
// Input: ReadableStreams of VideoFrame / AudioData (from MediaStreamTrackProcessor).
// Composition: screen frame + round webcam bubble on an OffscreenCanvas.
// Output: fragmented MP4 written straight into OPFS (origin private file system), so a
// crash or a closed tab keeps everything up to the last fragment.
import {
  Output, Mp4OutputFormat, StreamTarget, VideoSampleSource, AudioSampleSource, VideoSample, AudioSample,
  getFirstEncodableVideoCodec, getFirstEncodableAudioCodec, QUALITY_HIGH,
} from './vendor/mediabunny.mjs';
import { fitRect, bubbleRect, videoBitrate } from './lib.js';

const FPS = 30;
const MIN_FPS_INTERVAL = 250; // re-encode the last picture at least every 250 ms, so a still screen still has video
let R = null; // current recording state

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'start') await start(m);
    else if (m.type === 'pause') setPaused(true);
    else if (m.type === 'resume') setPaused(false);
    else if (m.type === 'stop') await stop();
    else if (m.type === 'bubble') { if (R) Object.assign(R.bubble, m.bubble); }
  } catch (err) {
    console.error(err);
    self.postMessage({ type: 'error', message: String((err && err.message) || err) });
    await abort();
  }
};

async function openOpfsFile(name) {
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle('recordings', { create: true });
  const fh = await dir.getFileHandle(name, { create: true });
  const access = await fh.createSyncAccessHandle();
  access.truncate(0);
  return access;
}

async function start(m) {
  if (R) throw new Error('Already recording');
  const { width: W, height: H } = m.size;
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

  const videoCodec = await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1', 'vp8'], { width: W, height: H });
  if (!videoCodec) throw new Error('This browser cannot encode video (WebCodecs).');
  const audioCodec = m.audio ? await getFirstEncodableAudioCodec(['aac', 'opus'], { numberOfChannels: 2, sampleRate: m.sampleRate || 48000 }) : null;

  const access = await openOpfsFile(m.name);
  let lastFlush = 0;
  const writable = new WritableStream({
    write(chunk) {
      access.write(chunk.data, { at: chunk.position });
      const now = performance.now();
      if (now - lastFlush > 3000) { access.flush(); lastFlush = now; }
    },
    close() { access.flush(); access.close(); },
    abort() { try { access.close(); } catch {} },
  });
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'fragmented', minimumFragmentDuration: 1 }),
    target: new StreamTarget(writable), // unbuffered: each fragment reaches the file as soon as it is complete
  });
  const videoSource = new VideoSampleSource({
    codec: videoCodec, bitrate: videoBitrate(W, H, FPS), keyFrameInterval: 2, latencyMode: 'realtime',
  });
  output.addVideoTrack(videoSource, { frameRate: FPS });
  let audioSource = null;
  if (audioCodec) {
    audioSource = new AudioSampleSource({ codec: audioCodec, bitrate: 128000 });
    output.addAudioTrack(audioSource);
  }
  await output.start();

  R = {
    W, H, canvas, ctx, output, videoSource, audioSource, access, name: m.name,
    videoCodec, audioCodec, bubble: { ...m.bubble }, mode: m.mode,
    screen: null, cam: null, readers: [], paused: false, stopped: false,
    t0: performance.now(), pausedAt: 0, pausedTotal: 0, lastTs: -1, lastEncodeAt: 0,
    busy: false, pending: false, samples: 0, sampleRate: 0, frames: 0, chain: Promise.resolve(),
  };
  if (m.screen) pumpVideo(m.screen, 'screen');
  if (m.cam) pumpVideo(m.cam, 'cam');
  if (m.audio && audioSource) pumpAudio(m.audio);
  R.heartbeat = setInterval(() => {
    if (R && !R.paused && performance.now() - R.lastEncodeAt > MIN_FPS_INTERVAL) requestFrame();
  }, MIN_FPS_INTERVAL / 2);
  R.status = setInterval(() => R && self.postMessage({ type: 'status', elapsed: elapsed(), frames: R.frames, bytes: fileSize() }), 500);
  self.postMessage({ type: 'started', videoCodec, audioCodec, width: W, height: H });
}

function fail(err) {
  console.error(err);
  self.postMessage({ type: 'error', message: String((err && err.message) || err) });
}

function fileSize() { try { return R.access.getSize(); } catch { return 0; } }
function elapsed() {
  if (!R) return 0;
  const now = R.paused ? R.pausedAt : performance.now();
  return (now - R.t0 - R.pausedTotal) / 1000;
}

function setPaused(p) {
  if (!R || R.paused === p) return;
  if (p) { R.pausedAt = performance.now(); R.paused = true; }
  else { R.pausedTotal += performance.now() - R.pausedAt; R.paused = false; requestFrame(); }
  self.postMessage({ type: p ? 'paused' : 'resumed', elapsed: elapsed() });
}

async function pumpVideo(stream, kind) {
  const reader = stream.getReader();
  R.readers.push(reader);
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done || !R || R.stopped) { if (value) value.close(); break; }
      const old = R[kind];
      R[kind] = value;
      if (old) old.close();
      // The camera drives the frame rate when it is on; otherwise the screen does.
      if (kind === 'cam' || !R.cam || R.mode === 'screen') requestFrame();
    }
  } catch (err) {
    if (R && !R.stopped) console.warn(kind, 'stream ended', err);
  }
}

async function pumpAudio(stream) {
  const reader = stream.getReader();
  R.readers.push(reader);
  try {
    for (;;) {
      const { value: data, done } = await reader.read();
      if (done || !R || R.stopped) { if (data) data.close(); break; }
      if (R.paused) { data.close(); continue; }
      const s = new AudioSample(data); // takes ownership of `data`; s.close() closes it
      if (!R.sampleRate) R.sampleRate = s.sampleRate;
      // Timestamps come from the sample count, so pauses leave no gap and audio stays continuous.
      s.setTimestamp(R.samples / R.sampleRate);
      R.samples += s.numberOfFrames;
      const src = R.audioSource;
      R.chain = R.chain.then(() => src.add(s)).catch(fail).finally(() => s.close());
    }
  } catch (err) {
    if (R && !R.stopped) console.warn('audio stream ended', err);
  }
}

function requestFrame() {
  if (!R || R.paused || R.stopped) return;
  if (R.busy) { R.pending = true; return; }
  const wait = 1000 / FPS - (performance.now() - R.lastEncodeAt) - 1;
  if (wait > 0) {
    if (!R.timer) R.timer = setTimeout(() => { if (R) { R.timer = 0; requestFrame(); } }, wait);
    return;
  }
  encodeFrame();
}

function draw() {
  const { ctx, W, H, screen, cam, bubble } = R;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  if (R.mode === 'camera') {
    if (cam) drawMirrored(ctx, cam, fitRect(cam.displayWidth, cam.displayHeight, W, H, 'contain'));
    return;
  }
  if (screen) {
    const r = fitRect(screen.displayWidth, screen.displayHeight, W, H, 'contain');
    ctx.drawImage(screen, r.x, r.y, r.w, r.h);
  }
  if (cam && bubble.visible !== false) {
    const { x, y, d } = bubbleRect(W, H, bubble.size, bubble.corner);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2);
    ctx.clip();
    drawMirrored(ctx, cam, { ...fitRect(cam.displayWidth, cam.displayHeight, d, d, 'cover'), ox: x, oy: y });
    ctx.restore();
    ctx.lineWidth = Math.max(2, d * 0.02);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(x + d / 2, y + d / 2, d / 2 - ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// Webcam is mirrored, as in every video-call preview, so gestures point the right way.
function drawMirrored(ctx, frame, r) {
  const ox = r.ox || 0, oy = r.oy || 0;
  ctx.save();
  ctx.translate(ox + r.x + r.w, oy + r.y);
  ctx.scale(-1, 1);
  ctx.drawImage(frame, 0, 0, r.w, r.h);
  ctx.restore();
}

async function encodeFrame() {
  if (!R) return;
  const rec = R;
  rec.busy = true;
  rec.pending = false;
  rec.lastEncodeAt = performance.now();
  try {
    draw();
    let ts = (performance.now() - rec.t0 - rec.pausedTotal) / 1000;
    if (ts <= rec.lastTs) ts = rec.lastTs + 0.001;
    rec.lastTs = ts;
    const sample = new VideoSample(rec.canvas, { timestamp: ts });
    try { await rec.videoSource.add(sample); } finally { sample.close(); }
    rec.frames++;
  } finally {
    rec.busy = false;
  }
  if (rec.pending && R === rec) requestFrame();
}

async function stop() {
  if (!R) return;
  const rec = R;
  rec.stopped = true;
  clearInterval(rec.heartbeat); clearInterval(rec.status); clearTimeout(rec.timer);
  for (const r of rec.readers) { try { await r.cancel(); } catch {} }
  while (rec.busy) await new Promise((r) => setTimeout(r, 10));
  await rec.chain;
  for (const f of [rec.screen, rec.cam]) if (f) f.close();
  rec.videoSource.close();
  if (rec.audioSource) rec.audioSource.close();
  await rec.output.finalize();
  const duration = Math.max(rec.lastTs, rec.samples / (rec.sampleRate || 1));
  R = null;
  self.postMessage({ type: 'done', name: rec.name, duration, frames: rec.frames, videoCodec: rec.videoCodec, audioCodec: rec.audioCodec });
}

async function abort() {
  if (!R) return;
  const rec = R;
  R = null;
  rec.stopped = true;
  clearInterval(rec.heartbeat); clearInterval(rec.status); clearTimeout(rec.timer);
  for (const r of rec.readers) { try { await r.cancel(); } catch {} }
  try { await rec.output.cancel(); } catch {}
  try { rec.access.close(); } catch {}
}
