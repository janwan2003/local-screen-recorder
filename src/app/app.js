import { support, listDevices, openCamera, openMic, meter, startRecording } from './capture.js';
import * as lib from './library.js';
import { formatDuration, formatPrecise, formatBytes, normalizeTrim, exportName } from './lib.js';

const $ = (id) => document.getElementById(id);
const SETTINGS_KEY = 'diskreel.settings.v1';
const settings = Object.assign(
  { mode: 'screen', cam: false, mic: true, sys: true, camId: '', micId: '', bsize: 'medium', bcorner: 'bottom-left', countdown: true },
  JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'),
);
const save = () => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

let camStream = null, micStream = null, micMeter = null, rec = null, current = null, pip = null;

// In the extension the About/Privacy links point at the website.
if (location.protocol === 'chrome-extension:') {
  $('home-link').href = 'https://janwan2003.github.io/local-screen-recorder/';
  $('privacy-link').href = 'https://janwan2003.github.io/local-screen-recorder/privacy.html';
  for (const a of [$('home-link'), $('privacy-link')]) a.target = '_blank';
}

function toast(msg, err = false) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast' + (err ? ' err' : '');
  t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { t.hidden = true; }, err ? 7000 : 3500);
}

function show(view) {
  for (const id of ['setup', 'recording', 'review']) $(id).hidden = id !== view;
  $('library').hidden = view === 'recording';
}

// ---------- Support check ----------
function checkSupport() {
  const missing = [];
  if (!support.webcodecs) missing.push('WebCodecs');
  if (!support.opfs) missing.push('browser file storage');
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (missing.length || (!support.display && !mobile)) {
    $('unsupported').hidden = false;
    $('unsupported').textContent = 'Diskreel needs Chrome, Edge, Brave, Opera or another Chromium browser (version 116 or newer) on a computer. ' +
      `This browser is missing: ${missing.join(', ') || 'screen capture'}.`;
    $('start').disabled = !support.webcodecs || !support.opfs;
  } else if (!support.display) {
    $('unsupported').hidden = false;
    $('unsupported').textContent = 'Phones and tablets cannot share their screen with a web page. Open Diskreel on a computer to record your screen; camera-only recording works here.';
  }
}

// ---------- Setup form ----------
function applySettingsToForm() {
  document.querySelector(`input[name=mode][value="${settings.mode}"]`).checked = true;
  document.querySelector(`input[name=bsize][value="${settings.bsize}"]`).checked = true;
  document.querySelector(`input[name=bcorner][value="${settings.bcorner}"]`).checked = true;
  $('sys-audio').checked = settings.sys;
  $('countdown').checked = settings.countdown;
  updateModeUI();
}

function updateModeUI() {
  const camMode = settings.mode === 'camera';
  $('sys-row').hidden = camMode;
  $('bubble-row').hidden = camMode || !settings.cam;
  $('preview').classList.toggle('camera-mode', camMode);
  $('preview').dataset.size = settings.bsize;
  $('preview').dataset.corner = settings.bcorner;
  $('cam-preview').hidden = !camStream;
  $('preview').classList.toggle('has-cam', !!camStream);
  $('preview-label').textContent = camMode ? 'Turn on the camera to record it on its own'
    : 'You choose the screen, window or tab after pressing Start';
}

async function fillDevices() {
  try {
    const { mics, cams } = await listDevices();
    const fill = (sel, devs, chosen, none) => {
      sel.innerHTML = '';
      if (!devs.length) { sel.add(new Option(none, '')); return; }
      devs.forEach((d, i) => sel.add(new Option(d.label || `${none.replace('No ', '')} ${i + 1}`, d.deviceId)));
      if (chosen && devs.some((d) => d.deviceId === chosen)) sel.value = chosen;
    };
    fill($('cam-dev'), cams, settings.camId, 'No camera');
    fill($('mic-dev'), mics, settings.micId, 'No microphone');
  } catch { /* enumerateDevices is unavailable without a secure context */ }
}

async function setCamera(on) {
  if (camStream) { camStream.getTracks().forEach((t) => t.stop()); camStream = null; }
  if (on) {
    try {
      camStream = await openCamera($('cam-dev').value || settings.camId);
      await fillDevices();
      const id = camStream.getVideoTracks()[0].getSettings().deviceId;
      if (id) { $('cam-dev').value = id; settings.camId = id; }
      $('cam-preview').srcObject = camStream;
    } catch (err) {
      on = false;
      toast(permissionMessage(err, 'camera'), true);
    }
  }
  $('cam-on').checked = on;
  $('cam-dev').disabled = !on;
  settings.cam = on; save();
  updateModeUI();
}

async function setMic(on) {
  if (micMeter) { micMeter.close(); micMeter = null; }
  if (micStream) { micStream.getTracks().forEach((t) => t.stop()); micStream = null; }
  if (on) {
    try {
      micStream = await openMic($('mic-dev').value || settings.micId);
      await fillDevices();
      const id = micStream.getAudioTracks()[0].getSettings().deviceId;
      if (id) { $('mic-dev').value = id; settings.micId = id; }
      micMeter = meter(micStream);
    } catch (err) {
      on = false;
      toast(permissionMessage(err, 'microphone'), true);
    }
  }
  $('mic-on').checked = on;
  $('mic-dev').disabled = !on;
  settings.mic = on; save();
}

function permissionMessage(err, what) {
  if (err && err.name === 'NotAllowedError') return `Diskreel was not allowed to use the ${what}. Allow it from the icon in the address bar and try again.`;
  if (err && err.name === 'NotFoundError') return `No ${what} found.`;
  return `Could not open the ${what}: ${err && err.message}`;
}

(function meterLoop() {
  $('mic-level').style.width = micMeter ? `${Math.round(micMeter.level() * 100)}%` : '0';
  requestAnimationFrame(meterLoop);
})();

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.name === 'mode') { settings.mode = t.value; save(); updateModeUI(); if (t.value === 'camera' && !settings.cam) setCamera(true); }
  else if (t.name === 'bsize') { settings.bsize = t.value; save(); updateModeUI(); }
  else if (t.name === 'bcorner') { settings.bcorner = t.value; save(); updateModeUI(); }
  else if (t.id === 'cam-on') setCamera(t.checked);
  else if (t.id === 'mic-on') setMic(t.checked);
  else if (t.id === 'cam-dev') { settings.camId = t.value; save(); setCamera(true); }
  else if (t.id === 'mic-dev') { settings.micId = t.value; save(); setMic(true); }
  else if (t.id === 'sys-audio') { settings.sys = t.checked; save(); }
  else if (t.id === 'countdown') { settings.countdown = t.checked; save(); }
});

// ---------- Recording ----------
async function countdown() {
  if (!settings.countdown) return;
  const ov = $('countdown-ov');
  ov.hidden = false;
  for (let n = 3; n > 0; n--) { $('countdown-n').textContent = n; await new Promise((r) => setTimeout(r, 800)); }
  ov.hidden = true;
}

$('start').addEventListener('click', async () => {
  if (rec) return;
  if (settings.mic && !micStream) await setMic(true);
  if ((settings.cam || settings.mode === 'camera') && !camStream) await setCamera(true);
  if (settings.mode === 'camera' && !camStream) { toast('Turn on the camera first, or choose "Screen, window or tab".', true); return; }
  $('start').disabled = true;
  try {
    // Ask for the screen first, then count down, so the countdown is not spent in Chrome's picker.
    const pending = startRecording({
      mode: settings.mode, camStream, micStream, systemAudio: settings.sys,
      bubble: { size: settings.bsize, corner: settings.bcorner, visible: true },
    });
    rec = await pending;
    rec.pause();
    show('recording');
    $('rec-res').textContent = `${rec.size.width}×${rec.size.height}`;
    $('rec-codec').textContent = codecLabel(rec.info.videoCodec, rec.info.audioCodec);
    $('rec-state').textContent = 'Starting';
    await countdown();
    rec.resume();
    $('rec-state').textContent = 'Recording';
    $('recording').classList.remove('paused');
    $('pause').textContent = 'Pause';
    $('popout').hidden = !support.pip;
    rec.on('status', (s) => {
      $('timer').textContent = formatDuration(s.elapsed);
      $('rec-size').textContent = formatBytes(s.bytes);
      if (pip) pip.document.getElementById('t').textContent = formatDuration(s.elapsed);
    });
    rec.on('paused', () => setPausedUI(true));
    rec.on('resumed', () => setPausedUI(false));
    rec.on('source-ended', () => stopRecording());
    rec.on('error', (m) => toast('Recording error: ' + m, true));
  } catch (err) {
    rec = null;
    $('countdown-ov').hidden = true;
    show('setup');
    if (err && err.name === 'NotAllowedError') toast('Screen sharing was cancelled.');
    else if (err && err.name === 'InvalidStateError') toast('Ready. Press Start recording again to choose what to share.');
    else toast('Could not start recording: ' + (err && err.message), true);
  } finally {
    $('start').disabled = false;
  }
});

function codecLabel(v, a) {
  const names = { avc: 'H.264', vp9: 'VP9', av1: 'AV1', vp8: 'VP8', aac: 'AAC', opus: 'Opus' };
  return `MP4 · ${names[v] || v}${a ? ' + ' + (names[a] || a) : ', no audio'}`;
}

let isPaused = false;
function setPausedUI(p) {
  isPaused = p;
  $('recording').classList.toggle('paused', p);
  $('rec-state').textContent = p ? 'Paused' : 'Recording';
  $('pause').textContent = p ? 'Resume' : 'Pause';
  if (pip) pip.document.getElementById('p').textContent = p ? 'Resume' : 'Pause';
}
function togglePause() { if (rec) (isPaused ? rec.resume() : rec.pause()); }
$('pause').addEventListener('click', togglePause);
$('stop').addEventListener('click', () => stopRecording());

async function stopRecording() {
  if (!rec || rec.stopping) return;
  const r = rec;
  r.stopping = true;
  $('rec-state').textContent = 'Saving';
  $('stop').disabled = $('pause').disabled = true;
  if (pip) { pip.close(); pip = null; }
  try {
    const res = await r.stop();
    rec = null;
    await openReview(res.name);
  } catch (err) {
    rec = null;
    toast('Could not finish the recording: ' + err.message + '. What was recorded is kept in the list below.', true);
    show('setup');
  } finally {
    $('stop').disabled = $('pause').disabled = false;
    isPaused = false;
    refreshLibrary();
  }
}

window.addEventListener('beforeunload', (e) => { if (rec) { e.preventDefault(); e.returnValue = ''; } });

// Floating, always-on-top controls (Document Picture-in-Picture).
$('popout').addEventListener('click', async () => {
  if (!support.pip || pip) return;
  pip = await documentPictureInPicture.requestWindow({ width: 280, height: 76 });
  const d = pip.document;
  d.body.innerHTML = `<style>
    body{margin:0;font:600 14px system-ui,sans-serif;background:#161b22;color:#e6edf3;display:flex;align-items:center;gap:10px;padding:0 14px;height:100vh}
    i{width:10px;height:10px;border-radius:50%;background:#e5484d;flex:none}
    #t{font-size:22px;font-variant-numeric:tabular-nums;flex:1}
    button{font:inherit;border:0;border-radius:8px;padding:7px 12px;cursor:pointer;background:#2a313c;color:#e6edf3}
    #s{background:#e5484d;color:#fff}</style>
    <i></i><span id="t">${$('timer').textContent}</span><button id="p">${isPaused ? 'Resume' : 'Pause'}</button><button id="s">Stop</button>`;
  d.getElementById('p').onclick = togglePause;
  d.getElementById('s').onclick = () => stopRecording();
  pip.addEventListener('pagehide', () => { pip = null; });
});

// ---------- Review ----------
async function openReview(name) {
  const file = await lib.getFile(name);
  if (current && current.url) URL.revokeObjectURL(current.url);
  current = { name, file, url: URL.createObjectURL(file), duration: 0, info: null };
  $('rec-name').value = name.replace(/\.mp4$/i, '');
  $('player').src = current.url;
  $('trim-a').value = 0; $('trim-b').value = 1000;
  show('review');
  $('info').textContent = `${formatBytes(file.size)}`;
  try {
    const info = await lib.probe(file);
    current.info = info;
    current.duration = info.duration;
    const v = info.video ? `${info.video.width}×${info.video.height}` : 'no video';
    $('info').textContent = `${formatDuration(info.duration)} · ${v} · ${codecLabel(info.video && info.video.codec, info.audio && info.audio.codec)} · ${formatBytes(file.size)}`;
  } catch (err) {
    $('info').textContent = `${formatBytes(file.size)} · could not read details (${err.message})`;
  }
  updateTrimUI();
  window.scrollTo({ top: 0 });
}

function trimRange() {
  const d = current && current.duration;
  if (!d) return null;
  return normalizeTrim($('trim-a').value / 1000 * d, $('trim-b').value / 1000 * d, d);
}

function updateTrimUI(moved) {
  let a = +$('trim-a').value, b = +$('trim-b').value;
  if (a > b - 5) { if (moved === 'a') $('trim-a').value = a = b - 5; else $('trim-b').value = b = a + 5; }
  $('trim-sel').style.left = a / 10 + '%';
  $('trim-sel').style.right = (100 - b / 10) + '%';
  const d = current && current.duration;
  const t = trimRange();
  $('trim-label').textContent = !d ? '' : t ? `${formatPrecise(t.start)} – ${formatPrecise(t.end)} (${formatDuration(t.end - t.start)} of ${formatDuration(d)})` : `Full recording, ${formatDuration(d)}`;
  if (moved && d) $('player').currentTime = (moved === 'a' ? a : b) / 1000 * d;
}
$('trim-a').addEventListener('input', () => updateTrimUI('a'));
$('trim-b').addEventListener('input', () => updateTrimUI('b'));
$('set-a').addEventListener('click', () => { if (current && current.duration) { $('trim-a').value = Math.round($('player').currentTime / current.duration * 1000); updateTrimUI(); } });
$('set-b').addEventListener('click', () => { if (current && current.duration) { $('trim-b').value = Math.round($('player').currentTime / current.duration * 1000); updateTrimUI(); } });

$('rec-name').addEventListener('change', async () => {
  if (!current) return;
  const clean = $('rec-name').value.replace(/[\\/:*?"<>|]+/g, ' ').trim();
  if (!clean) { $('rec-name').value = current.name.replace(/\.mp4$/i, ''); return; }
  const next = clean + '.mp4';
  if (next === current.name) return;
  try { await lib.rename(current.name, next); current.name = next; refreshLibrary(); }
  catch (err) { toast('Could not rename: ' + err.message, true); $('rec-name').value = current.name.replace(/\.mp4$/i, ''); }
});

async function saveAs(format) {
  if (!current) return;
  const trim = trimRange();
  const name = exportName(current.name, !!trim, format);
  let sink = null;
  if (support.savePicker) {
    try {
      const h = await window.showSaveFilePicker({
        suggestedName: name,
        types: [format === 'webm' ? { description: 'WebM video', accept: { 'video/webm': ['.webm'] } } : { description: 'MP4 video', accept: { 'video/mp4': ['.mp4'] } }],
      });
      sink = await h.createWritable();
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      throw err;
    }
  }
  const bar = $('progress');
  bar.hidden = false;
  const label = format === 'webm' ? 'Converting to WebM' : 'Saving MP4';
  const setP = (p) => { $('progress-bar').style.width = `${Math.round(p * 100)}%`; $('progress-label').textContent = `${label}… ${Math.round(p * 100)}%`; };
  setP(0);
  for (const b of document.querySelectorAll('#review .actions button')) b.disabled = true;
  try {
    const blob = await lib.exportRecording(current.file, { format, trim, sink, onProgress: setP });
    if (blob) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    }
    toast(`Saved ${name}`);
  } catch (err) {
    toast('Could not save: ' + err.message, true);
  } finally {
    bar.hidden = true;
    for (const b of document.querySelectorAll('#review .actions button')) b.disabled = false;
  }
}
$('save-mp4').addEventListener('click', () => saveAs('mp4').catch((e) => toast(e.message, true)));
$('save-webm').addEventListener('click', () => saveAs('webm').catch((e) => toast(e.message, true)));
$('delete').addEventListener('click', async () => {
  if (!current || !confirm(`Delete "${current.name}" from this browser? Copies you saved to disk are not affected.`)) return;
  await lib.remove(current.name);
  closeReview();
  refreshLibrary();
  toast('Recording deleted');
});
$('new').addEventListener('click', () => closeReview());

function closeReview() {
  $('player').removeAttribute('src');
  $('player').load();
  if (current && current.url) URL.revokeObjectURL(current.url);
  current = null;
  show('setup');
}

// ---------- Library ----------
async function refreshLibrary() {
  try {
    const items = await lib.list();
    const ul = $('lib-list');
    ul.innerHTML = '';
    for (const it of items) {
      const li = document.createElement('li');
      const nm = document.createElement('span');
      nm.className = 'nm'; nm.textContent = it.name.replace(/\.mp4$/i, ''); nm.title = it.name;
      const date = document.createElement('span');
      date.className = 'meta date'; date.textContent = new Date(it.modified).toLocaleString();
      const size = document.createElement('span');
      size.className = 'meta'; size.textContent = formatBytes(it.size);
      const open = document.createElement('button');
      open.className = 'btn sm'; open.type = 'button'; open.textContent = 'Open';
      open.onclick = () => { if (!rec) openReview(it.name).catch((e) => toast(e.message, true)); };
      li.append(nm, date, size, open);
      ul.append(li);
    }
    $('lib-empty').hidden = items.length > 0;
    const u = await lib.usage();
    $('usage').textContent = u.quota ? `${formatBytes(u.used)} used of ${formatBytes(u.quota)} available` : '';
  } catch (err) {
    $('lib-empty').textContent = 'Recordings cannot be listed in this browser.';
  }
}

// ---------- Init ----------
checkSupport();
applySettingsToForm();
show('setup');
refreshLibrary();
// Devices whose permission is already granted open straight away; the others show as on
// and ask for permission when Start is pressed (no prompt just for opening the page).
async function granted(name) {
  try { return (await navigator.permissions.query({ name })).state === 'granted'; } catch { return false; }
}
fillDevices().then(async () => {
  $('mic-on').checked = settings.mic;
  $('cam-on').checked = settings.cam;
  if (settings.cam && await granted('camera')) setCamera(true);
  if (settings.mic && await granted('microphone')) setMic(true);
});
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
window.diskreel = { lib, get recording() { return rec; }, get current() { return current; } };
