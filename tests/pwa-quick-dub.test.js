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
  assert.match(html, /analyzeQuickDubMusicTimeline\(plan\.mono12k/);
  assert.match(html, /requestQuickDubSoundDesign\(file,duration,quickMusicTimeline\)/);
  assert.match(html, /action:'sound-design'/);
  assert.match(html, /id="dubSoundPlan"/);
  assert.match(html, /renderDubSoundPlan\(quickMode\?quickMusicTimeline:null/);
  assert.match(html, /musicTimeline: quickMusicTimeline/);
  assert.match(html, /quadros do vídeo e o áudio/);
  assert.match(html, /Os quadros são enviados ao provedor multimodal disponível/);
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

test('quick dubbing keeps an audio-only fallback timeline for long or unsupported media', () => {
  const helper = html.match(/function makeQuickDubFallbackMoments\(totalDurationSec,segmentSec=12\)\{[\s\S]*?\n\}/);
  assert.ok(helper, 'fallback timeline builder should exist');
  const context = vm.createContext({ Math });
  vm.runInContext(`${helper[0]};globalThis.build=makeQuickDubFallbackMoments;`, context);
  const moments = context.build(25, 12);
  assert.equal(moments.length, 3);
  assert.equal(moments[0].endSec, 12);
  assert.equal(moments[2].endSec, 25);
  assert.ok(moments.every(moment => moment.style === 'soft_piano'));
});

test('quick dubbing captures a small set of frames and sends them to the sound-design API', () => {
  assert.match(html, /async function captureQuickDubVideoFrames\(file,totalDurationSec,maxFrames=6\)/);
  assert.match(html, /canvas\.toDataURL\('image\/jpeg',0\.48\)/);
  assert.match(html, /frames,moments:audioMoments/);
  assert.match(html, /AI scene sound-design fallback/);
});

test('quick dubbing creates moment-by-moment music cues and handles a short ending', () => {
  const helper = html.match(/function analyzeQuickDubMusicTimeline\(samples,sampleRate=12000,totalDurationSec=0,segmentSec=12\)\{[\s\S]*?\n\}/);
  assert.ok(helper, 'moment-by-moment music analysis should exist');
  const baseHelper = html.match(/function analyzeQuickDubMusic\(samples,sampleRate=12000\)\{[\s\S]*?\n\}/);
  const context = vm.createContext({ Math });
  vm.runInContext(`${baseHelper[0]}\n${helper[0]};globalThis.analyze=analyzeQuickDubMusicTimeline;`, context);
  const input = new Float32Array(15 * 12000);
  for (let i = 0; i < 7 * 12000; i++) input[i] = Math.sin(i * 0.08) * 0.16;
  const moments = context.analyze(input, 12000, 15, 12);
  assert.equal(moments.length, 2);
  assert.equal(moments[0].startSec, 0);
  assert.equal(moments[0].endSec, 12);
  assert.equal(moments[1].endSec, 15);
  assert.ok(moments.every(moment => typeof moment.style === 'string'));
});

test('PWA assets and page copies are present in both deployment roots', () => {
  const fs = require('node:fs');
  for (const rel of ['manifest.webmanifest', 'sw.js', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-512-maskable.png']) {
    assert.ok(fs.existsSync(path.join(__dirname, '../public', rel)), `public/${rel} exists`);
    assert.ok(fs.existsSync(path.join(__dirname, '../vercel', rel)), `vercel/${rel} exists`);
  }
  assert.equal(fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8'), fs.readFileSync(path.join(__dirname, '../vercel/index.html'), 'utf8'));
});
