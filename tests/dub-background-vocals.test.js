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
