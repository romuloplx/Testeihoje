'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

test('center-cancel option keeps original stereo instrumental at dubbing mix time', () => {
  assert.ok(html.includes('<option value="duck-no-vocals">🎼 Manter instrumental original, reduzindo a voz</option>'));
  assert.match(html, /function getCenterCancelledMono12k\(audioBuffer\)/);
  assert.match(html, /backgroundSideMono12k = getCenterCancelledMono12k\(decoded\)/);
  assert.match(html, /A dublagem continuará com o áudio original sem redução de voz/);
  assert.match(html, /bgMixMode = 'duck'/);

  const helper = html.match(/function getCenterCancelledMono12k\(audioBuffer\)\{[\s\S]*?\n\}/);
  const context = vm.createContext({ Float32Array, Math });
  vm.runInContext(`${helper[0]};globalThis.reduce= getCenterCancelledMono12k;`, context);
  const channels = [new Float32Array([0.8, 0.5, -0.4]), new Float32Array([0.4, -0.1, -0.4])];
  const stereoBuffer = { numberOfChannels: 2, duration: 3/12000, sampleRate: 12000, getChannelData: i => channels[i] };
  const reducedMono = Array.from(context.reduce(stereoBuffer));
  assert.ok(Math.abs(reducedMono[0] - 0.2) < 1e-6);
  assert.ok(Math.abs(reducedMono[1] - 0.3) < 1e-6);
  assert.equal(reducedMono[2], 0);
  assert.equal(context.reduce({ ...stereoBuffer, numberOfChannels: 1 }), null);
});

test('voice edge silence trimming is defined and preserves speech with a safety margin', () => {
  const helper = html.match(/function stripVoiceEdgeSilence\(samples, sr\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(helper, 'stripVoiceEdgeSilence should be available to the master audio assembler');
  const context = vm.createContext({ Float32Array, Math });
  vm.runInContext(`${helper};globalThis.strip=stripVoiceEdgeSilence;`, context);
  const samples = new Float32Array(500);
  samples.fill(0.1, 100, 300);
  const trimmed = context.strip(samples, 1000);
  assert.ok(trimmed.length < samples.length);
  assert.ok(trimmed.length > 200, 'the safety margin should protect the speech onset and ending');
  assert.equal(trimmed[0], 0);
  assert.equal(trimmed[trimmed.length - 1], 0);
  assert.equal(context.strip(new Float32Array(100), 1000).length, 100);
});

test('Dublar removed the separate synthetic/custom music panel', () => {
  assert.doesNotMatch(html, /Som \/ Música de Fundo Leve \(Auto-Ducking Inteligente\)/);
  assert.doesNotMatch(html, /dubBgMusicStyle|dubBgMusicVol|dubPostBgStyle|dubCustomMusicFile|dubRemoveMusicVocals/);
  assert.match(html, /id="dubBgMix"/);
  assert.match(html, /duck-no-vocals/);
});
