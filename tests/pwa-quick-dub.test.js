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

test('quick dubbing runs subtitle/title/music steps and automatically exports after dubbing', () => {
  assert.match(html, /id="dubQuickModeBtn" onclick="startQuickDubbing\(\)"/);
  assert.match(html, /setValue\('dubBurnSubs','yes'\)/);
  assert.match(html, /analyzeQuickDubMusic\(reference/);
  assert.match(html, /const socialMetadataPromise=generateDubSocialPackage/);
  assert.match(html, /if\(quickMode\) await socialMetadataPromise/);
  assert.match(html, /const exported=await downloadDubVideo\(\)/);
});

test('quick music reader handles short or silent input safely with a soft generated bed', () => {
  const helper = html.match(/function analyzeQuickDubMusic\(samples,sampleRate=12000\)\{[\s\S]*?\n\}/);
  assert.ok(helper, 'quick audio-profile function should exist');
  const context = vm.createContext({ Math });
  vm.runInContext(`${helper[0]};globalThis.analyze=analyzeQuickDubMusic;`, context);
  const short = context.analyze(new Float32Array(1200));
  assert.equal(short.style, 'soft_piano');
  assert.equal(short.confidence, 'baixa');
  const silent = context.analyze(new Float32Array(24000));
  assert.equal(silent.style, 'soft_piano');
});

test('PWA assets and page copies are present in both deployment roots', () => {
  const fs = require('node:fs');
  for (const rel of ['manifest.webmanifest', 'sw.js', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png']) {
    assert.ok(fs.existsSync(path.join(__dirname, '../public', rel)), `public/${rel} exists`);
    assert.ok(fs.existsSync(path.join(__dirname, '../vercel', rel)), `vercel/${rel} exists`);
  }
  assert.equal(fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8'), fs.readFileSync(path.join(__dirname, '../vercel/index.html'), 'utf8'));
});
