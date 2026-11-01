const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('public/index.html', 'utf8');
const ai = fs.readFileSync('vercel/api/lib/ai.js', 'utf8');

test('OpusClip removes the editable caption-text field from the Studio and clip cards', () => {
  assert.doesNotMatch(html, /✍️\s*Texto da Legenda/);
  assert.doesNotMatch(html, /id="opusEditCaption"/);
  assert.doesNotMatch(html, /Editar texto da legenda deste corte/);
  assert.doesNotMatch(html, /<textarea[^>]*oninput="onInlineEditCardCaptionText/);
});

test('OpusClip captions use only timestamped speech within each clip, never LLM-authored caption text', () => {
  assert.match(ai, /const fullCaptionText = timedCaptionText;/);
  assert.match(ai, /return sg\.inicio >= startSec && sg\.fim <= endSec;/);
  assert.match(ai, /Ignora captionText do LLM para não inventar falas/);
});

test('OpusClip explains that unclear speech is left without an invented caption', () => {
  assert.match(html, /Se não houver fala clara, não inventamos texto/);
});

test('caption copy in public and Vercel pages stays synchronized', () => {
  assert.equal(fs.readFileSync('vercel/index.html', 'utf8'), html);
});
