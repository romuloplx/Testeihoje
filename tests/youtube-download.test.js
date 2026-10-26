'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('removes the separate YouTube video-download tab and endpoint', () => {
  for (const file of ['../public/index.html', '../vercel/index.html']) {
    const html = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert.doesNotMatch(html, /tab-youtube-download|id="youtube-download"|Baixar vídeo do YouTube/);
    assert.match(html, /id="tab-social-download"/);
    assert.match(html, /data-platform="youtube"[^>]*setVideoDownloadPlatform\('youtube',this\)/);
    assert.match(html, /data-platform="tiktok"[^>]*setVideoDownloadPlatform\('tiktok',this\)/);
    assert.match(html, /data-platform="douyin"[^>]*setVideoDownloadPlatform\('douyin',this\)/);
  }
  const route = fs.readFileSync(path.join(__dirname, '../vercel/api/clips.js'), 'utf8');
  assert.doesNotMatch(route, /action === 'youtube_formats'|action === 'youtube_download'/);
});
