'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const publicHtml = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const vercelHtml = fs.readFileSync(path.join(root, 'vercel/index.html'), 'utf8');

function extractDrawDubLogo(html) {
  const match = html.match(/function drawDubLogo\(ctx, image, settings = \{\}\)\{[\s\S]*?\n\}/);
  assert.ok(match, 'drawDubLogo should be defined');
  return new Function(`${match[0]}\nreturn drawDubLogo;`)();
}

test('Dubbing UI includes upload, placement, size, opacity, preview, and removal controls', () => {
  for (const [file, html] of [['public/index.html', publicHtml], ['vercel/index.html', vercelHtml]]) {
    assert.match(html, /id="dubLogoPanel"[^>]*aria-label="Logo no vídeo dublado"/);
    assert.match(html, /id="dubLogoFile" accept="image\/png,image\/jpeg,image\/webp,[^"]*" onchange="onSelectDubLogo\(this\)"/);
    assert.match(html, /id="dubLogoPosition" onchange="onDubLogoSettingsChange\(\)"/);
    assert.match(html, /id="dubLogoSize" min="8" max="30"/);
    assert.match(html, /id="dubLogoOpacity" min="20" max="100"/);
    assert.match(html, /id="dubLogoPreview" class="hidden"/);
    assert.match(html, /id="dubLogoRemoveBtn"[^>]*onclick="removeDubLogo\(\)"/);
    assert.match(html, /A logo aparece no vídeo final, não no áudio nem na prévia original\./);
    assert.ok(html.includes(`function onSelectDubLogo(input){`), `${file} must load the selected logo`);
    assert.ok(html.includes(`function removeDubLogo(){`), `${file} must allow removing the logo`);
  }
});

test('uploaded logos are validated as small raster images and stale exports are invalidated', () => {
  for (const html of [publicHtml, vercelHtml]) {
    assert.match(html, /const DUB_LOGO_MAX_BYTES = 20 \* 1024 \* 1024;/);
    assert.ok(html.includes("const isRasterLogo = /^image\\/(png|jpeg|webp)$/"));
    assert.match(html, /function invalidateDubVideoExport\(\)/);
    assert.match(html, /URL\.revokeObjectURL\(dubLogoObjectUrl\)/);
    assert.match(html, /function onDubLogoSettingsChange\(\)/);
  }
});

test('video export burns the uploaded logo into every rendered frame before captions', () => {
  for (const html of [publicHtml, vercelHtml]) {
    const start = html.indexOf('async function downloadDubVideo(opts = {})');
    const end = html.indexOf('// --- Projects', start);
    assert.ok(start >= 0 && end > start, 'downloadDubVideo source should be present');
    const exportSource = html.slice(start, end);
    assert.match(exportSource, /const dubLogoForExport = dubLogoImage;/);
    assert.match(exportSource, /const dubLogoSettings = \{/);
    assert.match(exportSource, /const dubLogoConfigAtStart = dubLogoConfigVersion;/);
    assert.match(exportSource, /dubLogoConfigVersion !== dubLogoConfigAtStart/);
    const logoDrawIndex = exportSource.indexOf('drawDubLogo(ctx, dubLogoForExport, dubLogoSettings)');
    const captionsIndex = exportSource.indexOf('if(subCues.length)');
    assert.ok(logoDrawIndex >= 0, 'logo should be drawn into the export canvas');
    assert.ok(captionsIndex > logoDrawIndex, 'captions should remain above the logo layer');
    assert.match(exportSource, /drawFn: draw/);
  }
});

test('logo drawing preserves the image ratio, opacity, and all four corner choices', () => {
  const drawDubLogo = extractDrawDubLogo(publicHtml);
  const image = { naturalWidth: 400, naturalHeight: 200 };
  const frame = { width: 1000, height: 500 };

  const renderAt = position => {
    let drawn = null;
    const ctx = {
      canvas: { width: frame.width, height: frame.height },
      globalAlpha: 1,
      save() {},
      restore() {},
      drawImage(source, x, y, width, height) {
        drawn = { source, x, y, width, height, opacity: this.globalAlpha };
      }
    };
    drawDubLogo(ctx, image, { sizePct: 20, opacityPct: 60, position });
    return drawn;
  };

  const inset = 18;
  const expected = {
    'top-left': { x: inset, y: inset },
    'top-right': { x: 1000 - 200 - inset, y: inset },
    'bottom-left': { x: inset, y: 500 - 100 - inset },
    'bottom-right': { x: 1000 - 200 - inset, y: 500 - 100 - inset }
  };
  for (const [position, coordinates] of Object.entries(expected)) {
    const drawn = renderAt(position);
    assert.equal(drawn.source, image);
    assert.equal(drawn.width / drawn.height, image.naturalWidth / image.naturalHeight);
    assert.ok(Math.abs(drawn.width - 200) < 0.001);
    assert.ok(Math.abs(drawn.height - 100) < 0.001);
    assert.equal(drawn.x, coordinates.x, `${position} x coordinate`);
    assert.equal(drawn.y, coordinates.y, `${position} y coordinate`);
    assert.equal(drawn.opacity, 0.6);
  }
});

test('public and Vercel HTML copies stay synchronized', () => {
  assert.equal(publicHtml, vercelHtml);
});
