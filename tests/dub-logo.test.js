'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const publicHtml = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const vercelHtml = fs.readFileSync(path.join(root, 'vercel/index.html'), 'utf8');

function extractLogoDrawingFunctions(html) {
  const metrics = html.match(/function getDubLogoRenderMetrics\([\s\S]*?\n\}/);
  const draw = html.match(/function drawDubLogo\(ctx, image, settings = \{\}\)\{[\s\S]*?\n\}/);
  assert.ok(metrics, 'getDubLogoRenderMetrics should be defined');
  assert.ok(draw, 'drawDubLogo should be defined');
  return new Function(`${metrics[0]}\n${draw[0]}\nreturn { getDubLogoRenderMetrics, drawDubLogo };`)();
}

test('Dubbing UI supports free dragging over the video preview plus corner presets', () => {
  for (const [file, html] of [['public/index.html', publicHtml], ['vercel/index.html', vercelHtml]]) {
    assert.match(html, /id="dubLogoPanel"[^>]*aria-label="Logo no vídeo dublado"/);
    assert.match(html, /id="dubLogoFile" accept="image\/png,image\/jpeg,image\/webp,[^"]*" onchange="onSelectDubLogo\(this\)"/);
    assert.match(html, /id="dubLogoPosition" onchange="onDubLogoSettingsChange\(\)"/);
    assert.match(html, /option value="custom">🖐 Personalizada — arrastar na prévia/);
    assert.match(html, /id="dubLogoSize" min="8" max="30"/);
    assert.match(html, /id="dubLogoOpacity" min="20" max="100"/);
    assert.match(html, /id="dubLogoPreview" class="hidden"/);
    assert.match(html, /id="dubLogoDragOverlay"[^>]*onpointerdown="startDubLogoDrag\(event\)"/);
    assert.match(html, /onpointermove="moveDubLogoDrag\(event\)"[^>]*onpointerup="endDubLogoDrag\(event\)"/);
    assert.match(html, /id="dubSyncPreviewFrame"[^>]*class="hidden"/);
    assert.match(html, /id="dubSyncLogoOverlay"[^>]*pointer-events:none/);
    assert.match(html, /id="dubLogoRemoveBtn"[^>]*onclick="removeDubLogo\(\)"/);
    assert.match(html, /Arraste a logo por cima da prévia do vídeo para colocar exatamente onde quiser/);
    assert.ok(html.includes(`function onSelectDubLogo(input){`), `${file} must load the selected logo`);
    assert.ok(html.includes(`function removeDubLogo(){`), `${file} must allow removing the logo`);
    assert.ok(html.includes(`function startDubLogoDrag(event){`), `${file} must support pointer/touch dragging`);
    assert.ok(html.includes(`function moveDubLogoDrag(event){`), `${file} must update the free position while dragging`);
  }
});

test('uploaded logos are validated as small raster images and stale exports are invalidated', () => {
  for (const html of [publicHtml, vercelHtml]) {
    assert.match(html, /const DUB_LOGO_MAX_BYTES = 20 \* 1024 \* 1024;/);
    assert.ok(html.includes("const isRasterLogo = /^image\\/(png|jpeg|webp)$/"));
    assert.match(html, /function invalidateDubVideoExport\(\)/);
    assert.match(html, /URL\.revokeObjectURL\(dubLogoObjectUrl\)/);
    assert.match(html, /function onDubLogoSettingsChange\(\)/);
    assert.match(html, /overlay\.setPointerCapture\(event\.pointerId\)/);
    assert.match(html, /dubLogoPositionX = x \/ frameRect\.width/);
    assert.match(html, /dubLogoPositionY = y \/ frameRect\.height/);
  }
});

test('dubbed-video preview shows the selected logo and the downloaded export keeps it burned in', () => {
  for (const html of [publicHtml, vercelHtml]) {
    const previewStart = html.indexOf('function updateDubResultLogoOverlay(){');
    const previewEnd = html.indexOf('\nfunction startDubLogoDrag', previewStart);
    assert.ok(previewStart >= 0 && previewEnd > previewStart, 'synchronized result logo overlay helper should exist');
    const previewSource = html.slice(previewStart, previewEnd);
    assert.match(previewSource, /dubSyncLogoOverlay/);
    assert.match(previewSource, /getDubLogoRenderMetrics\(videoRect\.width, videoRect\.height, dubLogoImage\)/);
    assert.match(previewSource, /dubLogoPositionX \* videoRect\.width/);
    assert.match(previewSource, /dubLogoPositionY \* videoRect\.height/);

    const dubStart = html.indexOf('async function dubVideo(options={}){');
    const dubEnd = html.indexOf('\n// --- Vozes + montagem de vídeo', dubStart);
    assert.ok(dubStart >= 0 && dubEnd > dubStart, 'dubbing pipeline source should be present');
    const dubSource = html.slice(dubStart, dubEnd);
    assert.match(dubSource, /vResFrame\.classList\.remove\('hidden'\)/);
    assert.match(dubSource, /requestAnimationFrame\(updateDubResultPreviewLayout\)/);

    const exportStart = html.indexOf('async function downloadDubVideo(opts = {})');
    const exportEnd = html.indexOf('// --- Projects', exportStart);
    const exportSource = html.slice(exportStart, exportEnd);
    assert.match(exportSource, /drawDubLogo\(ctx, dubLogoForExport, dubLogoSettings\);/);
    assert.match(exportSource, /syncFrame\.classList\.add\('hidden'\)/);
    assert.match(exportSource, /syncLogoOverlay\.classList\.add\('hidden'\)/);
  }
});

test('video export burns the freely positioned logo into every rendered frame before captions', () => {
  for (const html of [publicHtml, vercelHtml]) {
    const start = html.indexOf('async function downloadDubVideo(opts = {})');
    const end = html.indexOf('// --- Projects', start);
    assert.ok(start >= 0 && end > start, 'downloadDubVideo source should be present');
    const exportSource = html.slice(start, end);
    assert.match(exportSource, /const dubLogoForExport = dubLogoImage;/);
    assert.match(exportSource, /const dubLogoSettings = \{/);
    assert.match(exportSource, /xFraction: dubLogoPositionX/);
    assert.match(exportSource, /yFraction: dubLogoPositionY/);
    assert.match(exportSource, /const dubLogoConfigAtStart = dubLogoConfigVersion;/);
    assert.match(exportSource, /dubLogoConfigVersion !== dubLogoConfigAtStart/);
    const logoDrawIndex = exportSource.indexOf('drawDubLogo(ctx, dubLogoForExport, dubLogoSettings)');
    const captionsIndex = exportSource.indexOf('if(subCues.length)');
    assert.ok(logoDrawIndex >= 0, 'logo should be drawn into the export canvas');
    assert.ok(captionsIndex > logoDrawIndex, 'captions should remain above the logo layer');
    assert.match(exportSource, /drawFn: draw/);
  }
});

test('translated video export re-encodes media to omit source metadata', () => {
  for (const html of [publicHtml, vercelHtml]) {
    const start = html.indexOf('async function downloadDubVideo(opts = {})');
    const end = html.indexOf('// --- Projects', start);
    assert.ok(start >= 0 && end > start, 'downloadDubVideo source should be present');
    const exportSource = html.slice(start, end);
    assert.match(exportSource, /não copia os bytes nem os átomos MP4 do original/);
    assert.match(exportSource, /recordCanvasVideo\(\{/);
    assert.match(exportSource, /drawFn: draw/);
    assert.match(exportSource, /audioBuffer: lastDubMasterBuffer/);
  }
});

test('logo renderer preserves ratio, opacity, corner presets, and arbitrary dragged coordinates', () => {
  const { getDubLogoRenderMetrics, drawDubLogo } = extractLogoDrawingFunctions(publicHtml);
  const image = { naturalWidth: 400, naturalHeight: 200 };
  const frame = { width: 1000, height: 500 };
  const metrics = getDubLogoRenderMetrics(frame.width, frame.height, image, 20);
  assert.deepEqual(metrics, { width: 200, height: 100, inset: 18 });

  const renderAt = (position, extra = {}) => {
    let drawn = null;
    const alphaStack = [];
    const ctx = {
      canvas: { width: frame.width, height: frame.height },
      globalAlpha: 1,
      save() { alphaStack.push(this.globalAlpha); },
      restore() { this.globalAlpha = alphaStack.pop(); },
      drawImage(source, x, y, width, height) {
        drawn = { source, x, y, width, height, opacity: this.globalAlpha };
      }
    };
    drawDubLogo(ctx, image, { sizePct: 20, opacityPct: 60, position, ...extra });
    assert.equal(ctx.globalAlpha, 1, 'canvas alpha should be restored after compositing');
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
    assert.equal(drawn.width, metrics.width);
    assert.equal(drawn.height, metrics.height);
    assert.equal(drawn.x, coordinates.x, `${position} x coordinate`);
    assert.equal(drawn.y, coordinates.y, `${position} y coordinate`);
    assert.equal(drawn.opacity, 0.6);
  }

  const custom = renderAt('custom', { xFraction: 0.4, yFraction: 0.3 });
  assert.equal(custom.x, 400);
  assert.equal(custom.y, 150);
  const clamped = renderAt('custom', { xFraction: 0.99, yFraction: 0.99 });
  assert.equal(clamped.x, frame.width - metrics.width);
  assert.equal(clamped.y, frame.height - metrics.height);
});

test('synchronized dubbing preview keeps the logo aligned with the resized result video', () => {
  const metricsMatch = publicHtml.match(/function getDubLogoRenderMetrics\([\s\S]*?\n\}/);
  const updateMatch = publicHtml.match(/function updateDubResultLogoOverlay\(\)\{[\s\S]*?\n\}/);
  assert.ok(metricsMatch, 'logo size helper should exist');
  assert.ok(updateMatch, 'result preview overlay updater should exist');

  const image = { naturalWidth: 400, naturalHeight: 200 };
  const overlay = {
    src: '',
    style: {},
    getAttribute(name){ return name === 'src' ? this.src : null; },
    classList: { hidden: true, add(){ this.hidden = true; }, remove(){ this.hidden = false; } }
  };
  const frame = { getBoundingClientRect: () => ({ left: 10, top: 20, width: 1040, height: 540 }) };
  const video = {
    videoWidth: 1920,
    videoHeight: 1080,
    classList: { contains: () => false },
    getBoundingClientRect: () => ({ left: 28, top: 46, width: 1000, height: 500 })
  };
  const controls = {
    dubLogoPosition: { value: 'custom' },
    dubLogoSize: { value: '20' },
    dubLogoOpacity: { value: '60' }
  };
  const context = vm.createContext({
    document: {
      getElementById: id => ({
        dubSyncLogoOverlay: overlay,
        dubSyncPreviewFrame: frame,
        dubSyncVideo: video,
        ...controls
      })[id] || null
    },
    dubLogoImage: image,
    dubLogoObjectUrl: 'blob:logo',
    dubLogoPositionX: 0.4,
    dubLogoPositionY: 0.3
  });
  vm.runInContext(`${metricsMatch[0]}\n${updateMatch[0]}\nglobalThis.update = updateDubResultLogoOverlay;`, context);
  context.update();

  assert.equal(overlay.src, 'blob:logo');
  assert.equal(overlay.style.left, '418px');
  assert.equal(overlay.style.top, '176px');
  assert.equal(overlay.style.width, '200px');
  assert.equal(overlay.style.height, '100px');
  assert.equal(overlay.style.opacity, '0.6');
  assert.equal(overlay.classList.hidden, false);
});

test('synchronized result player is resized to video aspect ratio before placing the logo', () => {
  const layoutMatch = publicHtml.match(/function updateDubResultPreviewLayout\(\)\{[\s\S]*?\n\}/);
  assert.ok(layoutMatch, 'result preview layout updater should exist');
  const frame = { style: {}, parentElement: { clientWidth: 800 } };
  const video = {
    videoWidth: 1920,
    videoHeight: 1080,
    style: {},
    classList: { contains: () => false }
  };
  let overlayRefreshes = 0;
  const context = vm.createContext({
    document: { getElementById: id => id === 'dubSyncPreviewFrame' ? frame : id === 'dubSyncVideo' ? video : null },
    updateDubResultLogoOverlay: () => overlayRefreshes++
  });
  vm.runInContext(layoutMatch[0], context);
  context.updateDubResultPreviewLayout();

  assert.equal(frame.style.width, '800px');
  assert.equal(frame.style.height, '450px');
  assert.equal(video.style.width, '100%');
  assert.equal(video.style.height, '100%');
  assert.equal(video.style.maxHeight, 'none');
  assert.equal(video.style.objectFit, 'fill');
  assert.equal(overlayRefreshes, 1);
});

test('public and Vercel HTML copies stay synchronized', () => {
  assert.equal(publicHtml, vercelHtml);
});
