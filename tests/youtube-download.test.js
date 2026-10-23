'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  extractYoutubeVideoId,
  normalizeDownloadableFormats,
  normalizeYtDlpFormats,
  sanitizeVideoFilename
} = require('../vercel/lib/youtube-download');
const clipsHandler = require('../vercel/api/clips');

test('accepts supported YouTube link forms and rejects foreign hosts', () => {
  assert.equal(extractYoutubeVideoId('abcdefghijk'), 'abcdefghijk');
  assert.equal(extractYoutubeVideoId('https://youtu.be/abcdefghijk?si=share'), 'abcdefghijk');
  assert.equal(extractYoutubeVideoId('https://www.youtube.com/watch?v=abcdefghijk'), 'abcdefghijk');
  assert.equal(extractYoutubeVideoId('https://m.youtube.com/shorts/abcdefghijk'), 'abcdefghijk');
  assert.equal(extractYoutubeVideoId('https://www.youtube.com/embed/abcdefghijk'), 'abcdefghijk');
  assert.equal(extractYoutubeVideoId('https://youtube.com.evil.invalid/watch?v=abcdefghijk'), '');
  assert.equal(extractYoutubeVideoId('https://example.com/watch?v=abcdefghijk'), '');
  assert.equal(extractYoutubeVideoId('short'), '');
});

test('keeps only downloadable, muxed MP4 formats and sorts by quality', () => {
  const formats = normalizeDownloadableFormats([
    { itag: 18, container: 'mp4', hasAudio: true, hasVideo: true, height: 360, qualityLabel: '360p', contentLength: '1000' },
    { itag: 22, container: 'MP4', hasAudio: true, hasVideo: true, height: 720, qualityLabel: '720p', bitrate: 2000 },
    { itag: 137, container: 'mp4', hasAudio: false, hasVideo: true, height: 1080 },
    { itag: 140, container: 'mp4', hasAudio: true, hasVideo: false },
    { itag: 999, container: 'webm', hasAudio: true, hasVideo: true, height: 720 },
    { itag: 500, container: 'mp4', hasAudio: true, hasVideo: true, isDrm: true },
    { itag: 501, container: 'mp4', hasAudio: true, hasVideo: true, isLive: true },
    { itag: 502, container: 'mp4', hasAudio: true, hasVideo: true, isOtf: true },
    { itag: 0, container: 'mp4', hasAudio: true, hasVideo: true },
    { container: 'mp4', hasAudio: true, hasVideo: true }
  ]);

  assert.deepEqual(formats.map(format => format.itag), [22, 18]);
  assert.equal(formats[1].contentLength, 1000);
  assert.equal(formats[0].container, 'mp4');
});

test('accepts yt-dlp muxed MP4 formats and rejects split or non-MP4 streams', () => {
  const formats = normalizeYtDlpFormats([
    { format_id: '18', ext: 'mp4', vcodec: 'avc1.42001E', acodec: 'mp4a.40.2', height: 360, filesize: 1000, tbr: 900, format_note: '360p' },
    { format_id: '22', ext: 'mp4', vcodec: 'avc1.64001F', acodec: 'mp4a.40.2', height: 720, filesize_approx: 2000, tbr: 2500, format_note: '720p' },
    { format_id: '137', ext: 'mp4', vcodec: 'avc1', acodec: 'none', height: 1080 },
    { format_id: '140', ext: 'mp4', vcodec: 'none', acodec: 'mp4a.40.2' },
    { format_id: '251', ext: 'webm', vcodec: 'vp9', acodec: 'opus' },
    { format_id: '22+140', ext: 'mp4', vcodec: 'avc1', acodec: 'mp4a.40.2' },
    { format_id: '500', ext: 'mp4', vcodec: 'avc1', acodec: 'mp4a.40.2', has_drm: true }
  ]);

  assert.deepEqual(formats.map(format => format.itag), [22, 18]);
  assert.equal(formats[0].source, 'yt-dlp');
  assert.equal(formats[1].contentLength, 1000);
  assert.equal(formats[0].container, 'mp4');
});

test('sanitizes filenames for Content-Disposition and Android downloads', () => {
  assert.equal(sanitizeVideoFilename('  Vídeo: /teste?  '), 'Video- -teste-');
  assert.equal(sanitizeVideoFilename(''), 'video-youtube');
});

test('download actions are routed through the existing clips API without extra Vercel functions', async () => {
  const makeResponse = () => ({
    headers: {},
    headersSent: false,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(payload) { this.body = JSON.stringify(payload); return this; },
    end(body) { this.body = body; }
  });

  const postResponse = makeResponse();
  await clipsHandler({ method: 'POST', url: '/api/clips', body: { action: 'youtube_formats', videoId: 'short' } }, postResponse);
  assert.equal(postResponse.statusCode, 400);
  assert.match(JSON.parse(postResponse.body).error, /link válido/i);

  const getResponse = makeResponse();
  await clipsHandler({ method: 'GET', url: '/api/clips?action=youtube_download&videoId=short&itag=18', headers: {} }, getResponse);
  assert.equal(getResponse.statusCode, 400);
  assert.match(JSON.parse(getResponse.body).error, /parâmetros de vídeo inválidos/i);

  const invalidEngineResponse = makeResponse();
  await clipsHandler({
    method: 'GET',
    url: '/api/clips?action=youtube_download&engine=unknown&videoId=abcdefghijk&itag=18',
    headers: {}
  }, invalidEngineResponse);
  assert.equal(invalidEngineResponse.statusCode, 400);
  assert.match(JSON.parse(invalidEngineResponse.body).error, /parâmetros de vídeo inválidos/i);

  const fs = require('node:fs');
  const path = require('node:path');
  for (const functionPath of [
    '../vercel/api/youtube-download.js',
    '../vercel/api/lib/youtube-download.js',
    '../vercel/api/lib/youtube-download-handler.js',
    '../vercel/api/lib/ytdlp-runtime.js'
  ]) {
    assert.equal(fs.existsSync(path.join(__dirname, functionPath)), false, `${functionPath} must not add a Vercel function`);
  }
});
