const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('public/index.html', 'utf8');

test('OpusClip export keeps WebM codec and file extension truthful instead of relabeling it as MP4', () => {
  assert.match(html, /const isMp4 = \/\^video\\\/mp4/);
  assert.match(html, /const ext = isMp4 \? 'mp4' : 'webm'/);
  assert.doesNotMatch(html, /new Blob\(\[blob\], \{ type: 'video\/mp4' \}\)/);
});

test('OpusClip bulk download reports failed exports instead of claiming every clip downloaded', () => {
  assert.match(html, /const failed = \[\]/);
  assert.match(html, /if\(blob && blob\.size > 0\)/);
  assert.match(html, /if\(failed\.length\)/);
  assert.match(html, /\$\{downloaded\}\/\$\{total\} cortes/);
});

test('OpusClip page copies stay synchronized', () => {
  assert.equal(fs.readFileSync('vercel/index.html', 'utf8'), html);
});
