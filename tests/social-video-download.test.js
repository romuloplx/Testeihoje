'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeSupportedVideoUrl,
  normalizeDouyinVideoUrl,
  getVideoPlatform,
  getDownloadFilename
} = require('../vercel/lib/social-video-download-handler');
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

test('normalizes supported TikTok and YouTube links and labels platforms', () => {
  const tiktok = normalizeSupportedVideoUrl('https://www.tiktok.com/@creator/video/7456789012345678901?is_from_webapp=1');
  const youtube = normalizeSupportedVideoUrl('youtu.be/AbCdEf12345?t=10');
  assert.equal(getVideoPlatform(tiktok), 'tiktok');
  assert.equal(getVideoPlatform(youtube), 'youtube');
  assert.equal(getDownloadFilename(tiktok), 'tiktok-7456789012345678901.mp4');
  assert.equal(getDownloadFilename('https://www.youtube.com/watch?v=AbCdEf12345'), 'youtube-AbCdEf12345.mp4');
});

test('rejects untrusted hosts, unsafe URL forms, and oversized input', () => {
  for (const url of [
    '',
    'javascript:alert(1)',
    'https://douyin.com.attacker.invalid/video/123456789',
    'https://notdouyin.com/video/123456789',
    'https://user@www.douyin.com/video/123456789',
    'https://www.douyin.com:8443/video/123456789',
    `https://www.douyin.com/${'x'.repeat(2050)}`,
    'https://www.douyin.com/video/12\\34'
  ]) {
    assert.throws(() => normalizeSupportedVideoUrl(url), { code: 'INVALID_VIDEO_URL' }, url);
  }
});

test('builds a safe Douyin MP4 filename from a video ID or short link', () => {
  assert.equal(getDownloadFilename('https://www.douyin.com/video/7456789012345678901'), 'douyin-7456789012345678901.mp4');
  assert.equal(getDownloadFilename('https://v.douyin.com/AbC123/'), 'douyin-video.mp4');
});

test('routes generic video downloads through clips API and rejects invalid links before spawning yt-dlp', async () => {
  const response = makeResponse();
  await clipsHandler({
    method: 'POST',
    url: '/api/clips',
    body: { action: 'video_download', url: 'https://example.com/video/123456789' }
  }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(JSON.parse(response.body).code, 'INVALID_VIDEO_URL');
});

test('offers web MP4 downloads for TikTok, Douyin, and YouTube on both HTML copies', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  for (const file of ['../public/index.html', '../vercel/index.html']) {
    const html = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const downloaderStart = html.indexOf('<section id="social-download"');
    const downloaderEnd = html.indexOf('</section>', downloaderStart);
    assert.ok(downloaderStart >= 0 && downloaderEnd > downloaderStart, 'video download section should exist');
    const downloaderSection = html.slice(downloaderStart, downloaderEnd);
    assert.match(downloaderSection, /id="videoDownloadUrl"/);
    assert.match(downloaderSection, /onclick="downloadSocialVideo\(\)"/);
    assert.match(downloaderSection, /data-platform="youtube"[^>]*aria-pressed="true"[^>]*onclick="setVideoDownloadPlatform\('youtube',this\)"/);
    assert.match(downloaderSection, /data-platform="tiktok"[^>]*onclick="setVideoDownloadPlatform\('tiktok',this\)"/);
    assert.match(downloaderSection, /data-platform="douyin"[^>]*onclick="setVideoDownloadPlatform\('douyin',this\)"/);
    assert.match(html, /function parseSupportedVideoInput\(raw,platform=videoDownloadPlatform\)[\s\S]*config\.hosts\.some/);
    assert.match(downloaderSection, /href="https:\/\/brasil-downloader\.vercel\.app\/"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
    assert.match(downloaderSection, /serviço externo, aberto em outra aba/);
    assert.match(html, /function downloadSocialVideo\(\)[\s\S]*action:'video_download'[\s\S]*URL\.createObjectURL\(videoFile\)[\s\S]*downloadLink\.click\(\)/);
    assert.doesNotMatch(html, /searchDouyinTrends|douyin_search|APIFY_API_TOKEN/);
  }
});

test('keeps Douyin support inside the existing clips serverless function', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  assert.match(fs.readFileSync(path.join(__dirname, '../vercel/api/clips.js'), 'utf8'), /action === 'video_download'/);
  assert.equal(fs.existsSync(path.join(__dirname, '../vercel/api/douyin-download.js')), false);
});
