// Main-thread side of a recording: asks for the screen, camera and microphone, mixes audio,
// and hands raw frame streams to the worker. The worker does all encoding and file writing.
import { outputSize, recordingName } from './lib.js';

export const support = {
  display: !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia),
  webcodecs: typeof VideoEncoder === 'function' && typeof MediaStreamTrackProcessor === 'function',
  opfs: !!(navigator.storage && navigator.storage.getDirectory),
  savePicker: typeof window.showSaveFilePicker === 'function',
  pip: 'documentPictureInPicture' in window,
};

export async function listDevices() {
  const all = await navigator.mediaDevices.enumerateDevices();
  return {
    mics: all.filter((d) => d.kind === 'audioinput' && d.deviceId),
    cams: all.filter((d) => d.kind === 'videoinput' && d.deviceId),
  };
}

export async function openCamera(deviceId) {
  return navigator.mediaDevices.getUserMedia({
    video: { deviceId: deviceId ? { exact: deviceId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
  });
}

export async function openMic(deviceId) {
  return navigator.mediaDevices.getUserMedia({
    audio: { deviceId: deviceId ? { exact: deviceId } : undefined, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
}

/** A level meter (0..1) for an audio stream. Returns { level(), close() }. */
export function meter(stream) {
  const ac = new AudioContext();
  const src = ac.createMediaStreamSource(stream);
  const an = ac.createAnalyser();
  an.fftSize = 512;
  src.connect(an);
  const buf = new Float32Array(an.fftSize);
  return {
    level() {
      an.getFloatTimeDomainData(buf);
      let peak = 0;
      for (const v of buf) peak = Math.max(peak, Math.abs(v));
      return Math.min(1, peak * 1.6);
    },
    close() { ac.close(); },
  };
}

/**
 * Starts a recording.
 * opts: { mode: 'screen' | 'camera', camStream, micStream, systemAudio, bubble, maxSize }
 * Returns a controller: { pause(), resume(), stop() -> Promise<result>, setBubble(), on(event, fn), info }.
 */
export async function startRecording(opts) {
  const tracks = [];
  let display = null;
  if (opts.mode !== 'camera') {
    display = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 30, max: 30 }, width: { max: 3840 }, height: { max: 2160 } },
      audio: opts.systemAudio ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false } : false,
      selfBrowserSurface: 'exclude',
      surfaceSwitching: 'include',
      systemAudio: opts.systemAudio ? 'include' : 'exclude',
      monitorTypeSurfaces: 'include',
    });
    tracks.push(...display.getTracks());
  }
  const screenTrack = display && display.getVideoTracks()[0];
  const camTrack = opts.camStream && opts.camStream.getVideoTracks()[0];
  if (!screenTrack && !camTrack) throw new Error('Nothing to record: choose a screen or turn on the camera.');

  const s = (screenTrack || camTrack).getSettings();
  const size = outputSize(s.width || 1280, s.height || 720, ...(opts.maxSize || [1920, 1080]));

  // Mix microphone and tab/system audio into one track.
  const audioIns = [];
  if (opts.micStream && opts.micStream.getAudioTracks().length) audioIns.push(opts.micStream);
  if (display && display.getAudioTracks().length) audioIns.push(new MediaStream(display.getAudioTracks()));
  let ac = null, audioTrack = null;
  if (audioIns.length) {
    ac = new AudioContext({ sampleRate: 48000 });
    const dest = ac.createMediaStreamDestination();
    dest.channelCount = 2;
    for (const st of audioIns) ac.createMediaStreamSource(st).connect(dest);
    audioTrack = dest.stream.getAudioTracks()[0];
  }

  const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  const listeners = {};
  const emit = (ev, d) => (listeners[ev] || []).forEach((fn) => fn(d));
  const name = recordingName();
  let doneResolve, doneReject;
  const done = new Promise((res, rej) => { doneResolve = res; doneReject = rej; });
  let started;
  const startedP = new Promise((res, rej) => { started = { res, rej }; });

  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'started') started.res(m);
    else if (m.type === 'error') { started.rej(new Error(m.message)); doneReject(new Error(m.message)); emit('error', m.message); }
    else if (m.type === 'done') doneResolve(m);
    else emit(m.type, m);
  };
  worker.onerror = (e) => { const err = new Error(e.message || 'Recorder worker failed'); started.rej(err); doneReject(err); };

  const streams = {};
  const transfer = [];
  const proc = (track) => { const r = new MediaStreamTrackProcessor({ track }).readable; transfer.push(r); return r; };
  if (screenTrack) streams.screen = proc(screenTrack);
  if (camTrack) { const c = camTrack.clone(); tracks.push(c); streams.cam = proc(c); }
  if (audioTrack) streams.audio = proc(audioTrack);
  worker.postMessage({
    type: 'start', name, size, mode: opts.mode, bubble: opts.bubble, sampleRate: 48000, ...streams,
  }, transfer);

  let info;
  try { info = await startedP; } catch (err) { cleanup(); throw err; }

  let stopping = null;
  function cleanup() {
    for (const t of tracks) t.stop();
    if (ac) ac.close();
    worker.terminate();
  }
  const ctl = {
    name, info, size,
    pause() { worker.postMessage({ type: 'pause' }); },
    resume() { worker.postMessage({ type: 'resume' }); },
    setBubble(b) { worker.postMessage({ type: 'bubble', bubble: b }); },
    on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    stop() {
      if (!stopping) {
        worker.postMessage({ type: 'stop' });
        stopping = done.finally(cleanup);
      }
      return stopping;
    },
  };
  // The browser's own "Stop sharing" button ends the screen track: treat it as Stop.
  if (screenTrack) screenTrack.addEventListener('ended', () => emit('source-ended'));
  return ctl;
}
