const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const files = ['public/index.html', 'vercel/index.html'];

test('Dublar offers premium caption fonts and applies the selected font to burned subtitles', () => {
  for (const file of files) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(html, /id="dubCaptionFont"/);
    for (const font of ['montserrat', 'anton', 'bebas', 'oswald', 'inter']) {
      assert.match(html, new RegExp(`<option value="${font}"`));
    }
    assert.match(html, /const selectedCaptionFont = captionFonts/);
    assert.match(html, /ctx\.font = `\$\{selectedCaptionFont\.weight\} \$\{fs\}px \$\{captionFontStack\}`/);
    assert.match(html, /lastDubChunksTimeline/);
    assert.match(html, /document\.fonts\.load/);
  }
});

test('production and public HTML copies remain synchronized', () => {
  assert.equal(
    fs.readFileSync(path.join(root, 'public/index.html'), 'utf8'),
    fs.readFileSync(path.join(root, 'vercel/index.html'), 'utf8')
  );
});
