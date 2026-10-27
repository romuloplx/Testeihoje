'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

test('custom background music enables vocal reduction by default and explains stereo limits', () => {
  assert.match(html, /id="dubRemoveMusicVocals" checked/);
  assert.match(html, /remoção funciona melhor em áudio estéreo com a voz no centro; mono não pode ser separado/i);
  assert.match(html, /Este arquivo é mono\. Para tentar tirar a voz, escolha uma música estéreo\./);
});

test('center-cancel option keeps original stereo instrumental at dubbing mix time', () => {
  assert.ok(html.includes('<option value="duck-no-vocals">🎼 Manter instrumental original, reduzindo a voz</option>'));
  assert.match(html, /function getCenterCancelledMono12k\(audioBuffer\)/);
  assert.match(html, /backgroundSideMono12k = getCenterCancelledMono12k\(decoded\)/);
  assert.match(html, /lastDubOrigSideMono12k = backgroundSideMono12k/);
  assert.match(html, /A voz pode permanecer; não dá para aplicar a redução em mono/);

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

test('center cancellation keeps side-channel music while cancelling centered audio', () => {
  const helper = html.match(/function removeCenteredDubVocals\(left,right\)\{[\s\S]*?\n\}/);
  assert.ok(helper, 'vocal reduction helper should exist');
  const context = vm.createContext({ Float32Array });
  vm.runInContext(`${helper[0]};globalThis.reduceVocals=removeCenteredDubVocals;`, context);
  const left = new Float32Array([0.8, 0.5, -0.4]);
  const right = new Float32Array([0.4, -0.1, -0.4]);
  const reduced = Array.from(context.reduceVocals(left, right));
  assert.ok(Math.abs(reduced[0] - 0.2) < 1e-6);
  assert.ok(Math.abs(reduced[1] - 0.3) < 1e-6);
  assert.equal(reduced[2], 0);
});
