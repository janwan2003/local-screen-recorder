// Builds dist/site (GitHub Pages: landing pages + web app at /app/) and dist/extension
// (Chrome/Edge MV3 package) from src/, then zips the extension.
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const dist = path.join(root, 'dist');
const src = (...p) => path.join(root, 'src', ...p);

fs.rmSync(dist, { recursive: true, force: true });
const copyDir = (from, to) => fs.cpSync(from, to, { recursive: true });

function buildApp(to) {
  copyDir(src('app'), to);
  fs.mkdirSync(path.join(to, 'vendor'), { recursive: true });
  fs.copyFileSync(path.join(root, 'node_modules/mediabunny/dist/bundles/mediabunny.min.mjs'), path.join(to, 'vendor/mediabunny.mjs'));
  fs.copyFileSync(path.join(root, 'node_modules/mediabunny/LICENSE'), path.join(to, 'vendor/MEDIABUNNY-LICENSE.txt'));
}

// Extension
const ext = path.join(dist, 'extension');
fs.mkdirSync(ext, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(src('extension/manifest.json'), 'utf8'));
manifest.version = pkg.version;
fs.writeFileSync(path.join(ext, 'manifest.json'), JSON.stringify(manifest, null, 2));
fs.copyFileSync(src('extension/background.js'), path.join(ext, 'background.js'));
copyDir(src('extension/icons'), path.join(ext, 'icons'));
buildApp(path.join(ext, 'app'));
const zip = path.join(dist, `diskreel-${pkg.version}.zip`);
execFileSync('zip', ['-qr9X', zip, '.'], { cwd: ext });

// Site
const site = path.join(dist, 'site');
copyDir(src('site'), site);
buildApp(path.join(site, 'app'));
fs.mkdirSync(path.join(site, 'download'), { recursive: true });
fs.copyFileSync(zip, path.join(site, 'download/diskreel-extension.zip'));
console.log(`built ${path.relative(root, ext)}, ${path.relative(root, site)}, ${path.relative(root, zip)} (${(fs.statSync(zip).size / 1024).toFixed(0)} KB)`);
