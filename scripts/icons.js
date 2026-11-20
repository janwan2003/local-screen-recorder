// Renders src/app/icon.svg to the PNG icon sizes the extension manifest needs.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { chromium } = require('playwright-core');
const LOCAL = path.join(os.homedir(), '.cache/ms-playwright/chromium-1255/chrome-linux64/chrome');
const CHROME = process.env.CHROME || (fs.existsSync(LOCAL) ? LOCAL : undefined); // undefined: Playwright's own browser
(async () => {
  const svg = fs.readFileSync(path.join(__dirname, '../src/app/icon.svg'), 'utf8');
  const out = path.join(__dirname, '../src/extension/icons');
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: CHROME });
  for (const s of [16, 32, 48, 128]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${s}px;height:${s}px;display:block}</style>${svg}`);
    await p.screenshot({ path: path.join(out, `${s}.png`), omitBackground: true });
    await p.close();
  }
  await b.close();
})();
