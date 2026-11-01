const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('public/index.html', 'utf8');
const vercelHtml = fs.readFileSync('vercel/index.html', 'utf8');
const vercelConfig = JSON.parse(fs.readFileSync('vercel/vercel.json', 'utf8'));

test('OpusClip falls back to the server yt-dlp stream when direct YouTube stream extraction fails', () => {
  assert.match(html, /action: 'video_download', url: `https:\/\/www\.youtube\.com\/watch\?v=\$\{encodeURIComponent\(ytId\)\}`/);
  assert.match(html, /const downloaded = await dlResp\.blob\(\)/);
  assert.match(html, /if\(downloaded\.size > 25000\)/);
  assert.equal(vercelConfig.functions['api/clips.js'].maxDuration, 300);
});

test('OpusClip displays a playable YouTube preview instead of a static thumbnail when extraction falls back', () => {
  assert.match(html, /www\.youtube\.com\/embed\/\$\{encodeURIComponent\(ytId\)\}\?playsinline=1&controls=1&autoplay=0/);
});

test('large-file dubbing has a WebAudio capture path for browsers without HTMLMediaElement.captureStream', () => {
  assert.match(html, /const captureMethod = mediaEl\.captureStream \|\| mediaEl\.mozCaptureStream \|\| mediaEl\.webkitCaptureStream/);
  assert.match(html, /ctx\.createMediaElementSource\(mediaEl\)/);
  assert.match(html, /ctx\.createMediaStreamDestination\(\)/);
});

test('Vercel and public OpusClip pages stay identical', () => {
  assert.equal(vercelHtml, html);
});
