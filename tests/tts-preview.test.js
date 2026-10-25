'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const uiFiles = ['public/index.html', 'vercel/index.html'];

function readUi(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function clientFunction(source, functionStart, functionEnd) {
  const start = source.indexOf(functionStart);
  const end = source.indexOf(functionEnd, start);
  assert.notEqual(start, -1, `${functionStart} should exist`);
  assert.notEqual(end, -1, `${functionEnd} should follow ${functionStart}`);
  return source.slice(start, end);
}

test('voice previews use the selected voice strictly and never silently switch to browser speech', () => {
  for (const file of uiFiles) {
    const html = readUi(file);
    const preview = clientFunction(html, 'async function previewVoice(voice){', '\nasync function runDiag(){');
    const sceneAudio = clientFunction(html, 'async function fetchSceneAudio(', '\nasync function buildCreateVideo(){');
    const speak = clientFunction(html, "async function speakText(text, voiceOverride = ''){", '\n// ============ AVATAR STUDIO ENGINE');
    const historyPlayback = clientFunction(html, 'function speakProjectText(id){', '\nfunction deleteProject(id){');
    const avatarTts = clientFunction(html, 'async function synthesizeAvatarSpeech(', '\nasync function toggleAvatarLivePreview(){');
    const avatarPreview = clientFunction(html, 'async function toggleAvatarLivePreview(){', '\nconst AVATAR_SCRIPT_TEMPLATES');
    const createVideo = clientFunction(html, 'async function buildCreateVideo(){', '\nfunction downloadSceneImages(){');
    const podcastDemo = clientFunction(html, 'async function generateOpusDemoVideo(){', '\n// Varre a energia acústica real');

    assert.match(preview, /voice,exactTextOnly:true/);
    assert.match(preview, /prévia indisponível|Voz selecionada indisponível/);
    assert.match(sceneAudio, /exactTextOnly:true/);
    assert.match(speak, /voice: chosenVoice, lang: 'pt-BR', exactTextOnly: true/);
    assert.match(speak, /voiceOverride \|\|/);
    assert.match(speak, /Voz selecionada indisponível/);
    assert.doesNotMatch(speak, /speechSynthesis\.speak/);
    assert.match(historyPlayback, /p\.dubVoice \|\| p\.voice \|\| p\.avatarVoice/);
    assert.match(historyPlayback, /speakText\([\s\S]*savedVoice\)/);
    assert.match(avatarTts, /voice, exactTextOnly: true/);
    assert.match(avatarPreview, /Voz selecionada indisponível/);
    assert.doesNotMatch(avatarPreview, /SpeechSynthesisUtterance|speechSynthesis\.speak/);
    assert.match(html, /avatarVoice:\s*voice/);
    assert.match(createVideo, /selectedVoiceErrors\.length/);
    assert.match(createVideo, /Voz selecionada indisponível/);
    assert.match(podcastDemo, /Voz selecionada indisponível/);
    assert.doesNotMatch(podcastDemo, /audioBuffer: null/);
  }
});

test('Vercel TTS route forwards strict voice selection to the provider chain', async () => {
  const ai = require('../vercel/api/lib/ai');
  const routePath = require.resolve('../vercel/api/tts');
  const originalTts = ai.ttsWithFallback;
  const audio = Buffer.alloc(384, 0x31);
  let received;

  ai.ttsWithFallback = async options => {
    received = options;
    return { buffer: audio, provider: 'mock/selected-voice' };
  };
  delete require.cache[routePath];
  const handler = require(routePath);
  const res = {
    headers: {},
    statusCode: 0,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body) { this.body = body; }
  };

  try {
    await handler({
      method: 'POST',
      body: { text: 'Olá.', voice: 'coral', lang: 'pt-BR', exactTextOnly: true }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(received.voice, 'coral');
    assert.equal(received.exactTextOnly, true);
    assert.equal(res.headers['x-audio-provider'], 'mock/selected-voice');
    assert.strictEqual(res.body, audio);
  } finally {
    ai.ttsWithFallback = originalTts;
    delete require.cache[routePath];
  }
});

test('TTS errors report selected-voice unavailability without claiming a browser fallback', async () => {
  const ai = require('../vercel/api/lib/ai');
  const routePath = require.resolve('../vercel/api/tts');
  const originalTts = ai.ttsWithFallback;
  ai.ttsWithFallback = async () => ({ error: 'Gemini indisponível' });
  delete require.cache[routePath];
  const handler = require(routePath);
  const res = {
    headers: {},
    statusCode: 0,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body) { this.body = body; }
  };

  try {
    await handler({
      method: 'POST',
      body: { text: 'Olá.', voice: 'coral', exactTextOnly: true }
    }, res);

    const body = JSON.parse(res.body);
    assert.equal(res.statusCode, 502);
    assert.match(body.error, /Voz selecionada indisponível/);
    assert.equal(Object.hasOwn(body, 'fallback'), false);
  } finally {
    ai.ttsWithFallback = originalTts;
    delete require.cache[routePath];
  }
});

test('local TTS endpoint also forwards exactTextOnly for preview requests', () => {
  const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.match(server, /exactTextOnly = false/);
  assert.match(server, /exactTextOnly: exactTextOnly === true/);
  assert.doesNotMatch(server, /fallback:\s*'browser'/);
});
