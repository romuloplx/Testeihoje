'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

test('DubAI PRO has an installable PWA shell and keeps API responses out of offline cache', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/manifest.webmanifest'), 'utf8'));
  const worker = fs.readFileSync(path.join(__dirname, '../public/sw.js'), 'utf8');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(html, /id="installAppBtn"/);
  assert.match(html, /navigator\.serviceWorker\.register\('\/sw\.js'\)/);
  assert.match(worker, /url\.pathname\.startsWith\('\/api\/'\)/);
});

test('quick dubbing keeps captions, social metadata, and automatic video export without a music panel', () => {
  assert.match(html, /id="dubQuickModeBtn" onclick="startQuickDubbing\(\)"/);
  assert.match(html, /setValue\('dubBurnSubs','yes'\)/);
  assert.match(html, /const socialMetadataPromise=generateDubSocialPackage/);
  assert.match(html, /if\(quickMode\) await socialMetadataPromise/);
  assert.match(html, /const exported=await downloadDubVideo\(\)/);
  assert.doesNotMatch(html, /dubBgMusicStyle|dubBgMusicVol|dubPostBgStyle|dubCustomMusicFile|dubSoundPlan/);
  assert.doesNotMatch(html, /quickSoundDesignPromise|analyzeQuickDubMusicTimeline|downloadDubBackgroundAudio/);
});

test('PWA assets and page copies are present in both deployment roots', () => {
  const fs = require('node:fs');
  for (const rel of ['manifest.webmanifest', 'sw.js', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-512-maskable.png']) {
    assert.ok(fs.existsSync(path.join(__dirname, '../public', rel)), `public/${rel} exists`);
    assert.ok(fs.existsSync(path.join(__dirname, '../vercel', rel)), `vercel/${rel} exists`);
  }
  assert.equal(fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8'), fs.readFileSync(path.join(__dirname, '../vercel/index.html'), 'utf8'));
});
