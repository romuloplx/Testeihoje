const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const htmlFiles = ['public/index.html', 'vercel/index.html'];

test('Dublar offers original, TikTok vertical, and YouTube horizontal output formats', () => {
  for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(html, /id="dubOutputFormat"/);
    assert.match(html, /value="9:16"[^>]*>📱 Vertical 9:16 — TikTok \/ Reels \/ Shorts/);
    assert.match(html, /value="16:9"[^>]*>🖥️ Horizontal 16:9 — YouTube/);
    assert.match(html, /id="dubFrameMode"/);
    assert.match(html, /value="fit"[^>]*>✨ Encaixar tudo com fundo desfocado/);
    assert.match(html, /value="fill"[^>]*>✂️ Preencher tela cortando as bordas/);
    assert.match(html, /const targetAspect = outputFormat === '9:16' \? 9\/16 : outputFormat === '16:9' \? 16\/9 : srcW\/srcH/);
    assert.match(html, /if\(frameMode === 'fill'\)/);
    assert.match(html, /lastDubChunksTimeline/);
    assert.match(html, /invalidateDubVideoExport\(\)/);
  }
});

test('public and Vercel Dublar pages remain synchronized', () => {
  assert.equal(
    fs.readFileSync(path.join(root, 'public/index.html'), 'utf8'),
    fs.readFileSync(path.join(root, 'vercel/index.html'), 'utf8')
  );
});
