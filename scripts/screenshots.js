// Screenshots of the recorder and the website at desktop and phone width.
// Usage: node scripts/build.js && node scripts/screenshots.js <outdir>
// With --site it also writes src/site/screenshot.png and og.png (used by the landing page).
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const { chromium } = require('playwright-core');
const LOCAL = path.join(os.homedir(), '.cache/ms-playwright/chromium-1255/chrome-linux64/chrome');
const CHROME = process.env.CHROME || (fs.existsSync(LOCAL) ? LOCAL : undefined); // undefined: Playwright's own browser
const site = path.join(__dirname, '../dist/site');
const out = path.resolve(process.argv[2] || 'shots');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(site, p);
    if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const b = await chromium.launch({ executablePath: CHROME, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const shots = [
    ['app-desktop', '/app/', { width: 1280, height: 800 }, true],
    ['app-phone', '/app/', { width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 }, false],
    ['site-desktop', '/', { width: 1280, height: 800 }, false],
    ['site-phone', '/', { width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 }, false],
    ['privacy-phone', '/privacy.html', { width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 }, false],
  ];
  for (const [name, url, vp, cam] of shots) {
    const { isMobile, deviceScaleFactor, ...viewport } = vp;
    const ctx = await b.newContext({ viewport, isMobile, deviceScaleFactor: deviceScaleFactor || 1, colorScheme: 'light' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(base + url);
    if (cam) {
      await page.click('label:has(#cam-on)');
      await page.waitForFunction(() => !document.getElementById('cam-preview').hidden);
      await page.waitForFunction(() => document.getElementById('mic-on').checked);
      await page.waitForTimeout(800);
    }
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, name + '.png'), fullPage: !cam });
    if (cam && process.argv.includes('--site')) {
      await page.screenshot({ path: path.join(__dirname, '../src/site/screenshot.png') });
      await page.setViewportSize({ width: 1200, height: 630 });
      await page.screenshot({ path: path.join(__dirname, '../src/site/og.png') });
    }
    if (errors.length) console.log(name, 'console errors:', errors);
    await ctx.close();
  }
  await b.close();
  srv.close();
  console.log('screenshots in', out);
})();
