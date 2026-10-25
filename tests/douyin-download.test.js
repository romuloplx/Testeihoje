'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeDouyinVideoUrl,
  getDownloadFilename
} = require('../vercel/lib/douyin-download-handler');
const clipsHandler = require('../vercel/api/clips');

function makeResponse() {
  return {
    headers: {},
    headersSent: false,
    destroyed: false,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(payload) { this.body = JSON.stringify(payload); return this; },
    end(body) { this.body = body; }
  };
}

test('normalizes official Douyin and share links to HTTPS', () => {
  assert.equal(
    normalizeDouyinVideoUrl('https://www.douyin.com/video/7456789012345678901?from=share#comments'),
    'https://www.douyin.com/video/7456789012345678901?from=share'
  );
  assert.equal(
    normalizeDouyinVideoUrl('v.douyin.com/AbC123/'),
    'https://v.douyin.com/AbC123/'
  );
  assert.equal(
    normalizeDouyinVideoUrl('http://www.iesdouyin.com/share/video/7456789012345678901'),
    'https://www.iesdouyin.com/share/video/7456789012345678901'
  );
});

test('rejects untrusted hosts, unsafe URL forms, and oversized input', () => {
  for (const url of [
    '',
    'javascript:alert(1)',
    'https://douyin.com.attacker.invalid/video/123456789',
    'https://notdouyin.com/video/123456789',
    'https://youtube.com/watch?v=abcdefghijk',
    'https://user@www.douyin.com/video/123456789',
    'https://www.douyin.com:8443/video/123456789',
    `https://www.douyin.com/${'x'.repeat(2050)}`,
    'https://www.douyin.com/video/12\\34'
  ]) {
    assert.throws(() => normalizeDouyinVideoUrl(url), { code: 'INVALID_DOUYIN_URL' }, url);
  }
});

test('builds a safe Douyin MP4 filename from a video ID or short link', () => {
  assert.equal(getDownloadFilename('https://www.douyin.com/video/7456789012345678901'), 'douyin-7456789012345678901.mp4');
  assert.equal(getDownloadFilename('https://v.douyin.com/AbC123/'), 'douyin-video.mp4');
});

test('routes Douyin downloads through clips API and rejects invalid links before spawning yt-dlp', async () => {
  const response = makeResponse();
  await clipsHandler({
    method: 'POST',
    url: '/api/clips',
    body: { action: 'douyin_download', url: 'https://douyin.com.attacker.invalid/video/123456789' }
  }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(JSON.parse(response.body).code, 'INVALID_DOUYIN_URL');
});

test('adds the Douyin handoff and manual TikTok share flow to both deployed HTML copies', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  for (const file of ['../public/index.html', '../vercel/index.html']) {
    const html = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const downloaderStart = html.indexOf('<section id="youtube-download"');
    const downloaderEnd = html.indexOf('</section>', downloaderStart);
    assert.ok(downloaderStart >= 0 && downloaderEnd > downloaderStart, 'download section should exist');
    const downloaderSection = html.slice(downloaderStart, downloaderEnd);
    assert.match(downloaderSection, /id="douyinDownloadUrl"/);
    assert.match(downloaderSection, /onclick="downloadDouyinAndOpenDub\(\)"/);
    assert.match(downloaderSection, /href="https:\/\/brasil-downloader\.vercel\.app\/"[^>]*target="_blank"[^>]*rel="noopener noreferrer"[^>]*aria-label="Abrir Brasil Downloader em uma nova aba \(serviço externo\)"/);
    assert.match(html, /function downloadDouyinAndOpenDub\(\)[\s\S]*previewVideo\(videoFile\)/);

    const dubSectionStart = html.indexOf('<section id="dub"');
    const dubSectionEnd = html.indexOf('</section>', dubSectionStart);
    const dubSection = html.slice(dubSectionStart, dubSectionEnd);
    assert.match(dubSection, /id="shareDubToTikTokBtn"/);
    assert.match(dubSection, /onclick="shareDubToTikTok\(\)"/);
    assert.match(dubSection, /Escolha TikTok e confirme a postagem no app/);
    assert.match(html, /navigator\.share\(\{[\s\S]*files:\[file\]/);
    assert.match(html, /nada é publicado automaticamente/);
  }
});

test('keeps Douyin support inside the existing clips serverless function', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  assert.match(fs.readFileSync(path.join(__dirname, '../vercel/api/clips.js'), 'utf8'), /action === 'douyin_download'/);
  assert.equal(fs.existsSync(path.join(__dirname, '../vercel/api/douyin-download.js')), false);
});
