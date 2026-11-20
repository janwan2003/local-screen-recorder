// End-to-end test in a real Chromium: records screen + fake webcam + fake mic through the
// web app and through the extension, then checks the files with ffprobe.
// Usage: node scripts/build.js && node test/e2e.js   (needs ffprobe on PATH)
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright-core');
const assert = require('assert/strict');

const LOCAL = path.join(os.homedir(), '.cache/ms-playwright/chromium-1255/chrome-linux64/chrome');
const CHROME = process.env.CHROME || (fs.existsSync(LOCAL) ? LOCAL : undefined); // undefined: Playwright's own browser
const root = path.join(__dirname, '..');
const site = path.join(root, 'dist/site');
const ext = path.join(root, 'dist/extension');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'diskreel-e2e-'));
const ARGS = [
  '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
  '--auto-accept-this-tab-capture', '--autoplay-policy=no-user-gesture-required',
];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.zip': 'application/zip', '.xml': 'application/xml', '.txt': 'text/plain', '.json': 'application/json' };

function serve() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(site, p);
    if (!f.startsWith(site) || !fs.existsSync(f)) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}

function probe(file) {
  const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], { encoding: 'utf8' }));
  const v = j.streams.find((s) => s.codec_type === 'video');
  const a = j.streams.find((s) => s.codec_type === 'audio');
  return { duration: +j.format.duration, format: j.format.format_name, v: v && v.codec_name, w: v && v.width, h: v && v.height, a: a && a.codec_name };
}

// Decodes every frame; ffmpeg exits non-zero on a broken file.
function decodes(file) { execFileSync('ffmpeg', ['-v', 'error', '-xerror', '-i', file, '-f', 'null', '-'], { stdio: 'pipe' }); }

async function opfsFile(page, name) {
  const b64 = await page.evaluate(async (n) => {
    const f = await window.diskreel.lib.getFile(n);
    const buf = new Uint8Array(await f.arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  }, name);
  const out = path.join(tmp, 'opfs-' + name.replace(/[^\w.-]/g, '_'));
  fs.writeFileSync(out, Buffer.from(b64, 'base64'));
  return out;
}

function watchConsole(page, errors) {
  page.on('console', (m) => { if (process.env.DEBUG) console.log('[page]', m.type(), m.text()); if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
}

async function record(page, { pauseMs = 0, ms = 3000, cam = true, mic = true } = {}) {
  await page.waitForSelector('#start:not([disabled])');
  if (await page.isChecked('#countdown')) await page.click('label:has(#countdown)');
  if (cam !== await page.isChecked('#cam-on')) await page.click('label:has(#cam-on)');
  if (mic !== await page.isChecked('#mic-on')) await page.click('label:has(#mic-on)');
  if (cam) await page.waitForFunction(() => !document.getElementById('cam-preview').hidden);
  await page.click('#start');
  await page.waitForSelector('#recording:not([hidden])', { timeout: 15000 });
  await page.waitForFunction(() => document.getElementById('rec-state').textContent === 'Recording');
  if (pauseMs) {
    await page.waitForTimeout(ms / 2);
    await page.click('#pause');
    await page.waitForFunction(() => document.getElementById('rec-state').textContent === 'Paused');
    await page.waitForTimeout(pauseMs);
    await page.click('#pause');
    await page.waitForFunction(() => document.getElementById('rec-state').textContent === 'Recording');
    await page.waitForTimeout(ms / 2);
  } else await page.waitForTimeout(ms);
  await page.click('#stop');
  await page.waitForSelector('#review:not([hidden])', { timeout: 20000 });
  await page.waitForFunction(() => /MP4/.test(document.getElementById('info').textContent), null, { timeout: 15000 });
  return page.evaluate(() => window.diskreel.current.name);
}

async function webApp(browser, base) {
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 860 } });
  // Force the download fallback: the native save dialog cannot be driven from a test.
  await ctx.addInitScript(() => { delete window.showSaveFilePicker; });
  const page = await ctx.newPage();
  const errors = [];
  watchConsole(page, errors);
  await page.goto(base + '/app/');
  assert.equal(await page.isVisible('#unsupported'), false, 'support notice must be hidden in Chromium');

  // 1) Screen + webcam bubble + mic, with a 1.5 s pause in the middle.
  const name = await record(page, { ms: 4000, pauseMs: 1500 });
  assert.match(name, /^Diskreel \d{4}-\d\d-\d\d at \d\d\.\d\d\.\d\d\.mp4$/);
  const raw = probe(await opfsFile(page, name));
  console.log('recorded (OPFS, fragmented):', raw);
  assert.equal(raw.v, 'h264');
  assert.ok(raw.a === 'opus' || raw.a === 'aac', 'has an audio track');
  assert.ok(raw.duration > 3 && raw.duration < 5.5, `duration ${raw.duration} should be about 4 s, pause excluded`);
  const info = await page.textContent('#info');
  assert.match(info, /H\.264/);

  // 2) Trimmed MP4 export (download fallback).
  await page.$eval('#trim-a', (el) => { el.value = 250; el.dispatchEvent(new Event('input')); });
  await page.$eval('#trim-b', (el) => { el.value = 750; el.dispatchEvent(new Event('input')); });
  assert.match(await page.textContent('#trim-label'), /–/);
  let [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('#save-mp4')]);
  assert.match(dl.suggestedFilename(), /\(trimmed\)\.mp4$/);
  const trimmed = path.join(tmp, 'trimmed.mp4');
  await dl.saveAs(trimmed);
  const t = probe(trimmed);
  console.log('trimmed MP4:', t);
  assert.equal(t.v, 'h264');
  assert.ok(t.duration > 1 && t.duration < raw.duration - 0.5, `trimmed duration ${t.duration}`);
  decodes(trimmed);
  if (process.env.FRAME_OUT) execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '1', '-i', trimmed, '-frames:v', '1', process.env.FRAME_OUT]);
  // A normal (non-fragmented) MP4 has its index ("moov") before the media data, so it streams and uploads cleanly.
  const head = fs.readFileSync(trimmed).subarray(0, 4096).toString('latin1');
  assert.ok(head.indexOf('moov') > 0 && head.indexOf('moof') < 0, 'export is a regular fast-start MP4');

  // 3) Full-length WebM export.
  await page.$eval('#trim-a', (el) => { el.value = 0; el.dispatchEvent(new Event('input')); });
  await page.$eval('#trim-b', (el) => { el.value = 1000; el.dispatchEvent(new Event('input')); });
  [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#save-webm')]);
  assert.match(dl.suggestedFilename(), /\.webm$/);
  const webm = path.join(tmp, 'full.webm');
  await dl.saveAs(webm);
  const w = probe(webm);
  console.log('WebM:', w);
  assert.equal(w.v, 'vp9');
  assert.equal(w.a, 'opus');
  decodes(webm);

  // 4) Library, rename and delete.
  await page.fill('#rec-name', 'Bug report');
  await page.press('#rec-name', 'Enter');
  await page.waitForFunction(() => [...document.querySelectorAll('#lib-list .nm')].some((e) => e.textContent === 'Bug report'));
  page.once('dialog', (d) => d.accept());
  await page.click('#delete');
  await page.waitForSelector('#setup:not([hidden])');
  await page.waitForFunction(() => document.querySelectorAll('#lib-list li').length === 0);

  // 5) Camera-only mode.
  await page.click('label:has(input[name=mode][value=camera])');
  const camName = await record(page, { ms: 2000, cam: true, mic: false });
  const c = probe(await opfsFile(page, camName));
  console.log('camera-only:', c);
  assert.equal(c.v, 'h264');
  assert.equal(c.a, undefined, 'no audio track when the mic is off');

  // 6) Reload: the recording is still listed (it lives in OPFS) and opens.
  await page.reload();
  await page.waitForSelector('#lib-list li');
  await page.click('#lib-list li button');
  await page.waitForFunction(() => /MP4/.test(document.getElementById('info').textContent));

  // 7) Crash safety: close the tab mid-recording; the partial file must be listed and playable.
  await page.click('#new');
  const before = await page.$$eval('#lib-list li', (l) => l.length);
  await page.click('label:has(input[name=mode][value=screen])');
  await page.click('#start');
  await page.waitForFunction(() => document.getElementById('rec-state').textContent === 'Recording');
  // The promise is "everything up to the last written fragment": wait until data is on disk, then 3 s more.
  await page.waitForFunction(() => document.getElementById('rec-size').textContent !== '0 B', null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.close({ runBeforeUnload: false });
  const page2 = await ctx.newPage();
  watchConsole(page2, errors);
  await page2.goto(base + '/app/');
  await page2.waitForFunction((n) => document.querySelectorAll('#lib-list li').length === n + 1, before);
  const crashed = await page2.$$eval('#lib-list .nm', (l) => l.map((e) => e.title));
  const newest = crashed[0];
  const cr = probe(await opfsFile(page2, newest));
  console.log('after closing the tab mid-recording:', cr);
  assert.equal(cr.v, 'h264');
  assert.ok(cr.duration >= 1.5, `kept at least 1.5 s of the recording (got ${cr.duration})`);
  await page2.click('#lib-list li button');
  await page2.waitForFunction(() => /MP4/.test(document.getElementById('info').textContent));

  assert.deepEqual(errors, [], 'no console errors');
  await ctx.close();
}

async function extension() {
  const ctx = await chromium.launchPersistentContext(path.join(tmp, 'profile'), {
    executablePath: CHROME, headless: true, args: [...ARGS, `--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const id = new URL(sw.url()).host;
  // onInstalled opens the recorder once.
  await new Promise((r) => setTimeout(r, 1000));
  let page = ctx.pages().find((p) => p.url().startsWith(`chrome-extension://${id}/app/`));
  assert.ok(page, 'install opens the recorder tab');
  const errors = [];
  watchConsole(page, errors);
  const name = await record(page, { ms: 2500, cam: true, mic: true });
  const r = probe(await opfsFile(page, name));
  console.log('extension recording:', r);
  assert.equal(r.v, 'h264');
  assert.ok(r.a);
  assert.deepEqual(errors, [], 'no console errors in the extension');
  await ctx.close();
}

(async () => {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ARGS });
  try {
    await webApp(browser, base);
    console.log('ok web app');
    await extension();
    console.log('ok extension');
  } finally {
    await browser.close();
    srv.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log('e2e passed');
})().catch((e) => { console.error(e); process.exit(1); });
