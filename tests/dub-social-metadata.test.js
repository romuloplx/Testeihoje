'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { generateDubSocialMetadata } = require('../vercel/api/lib/ai');

const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

function loadClientHelpers() {
  const start = html.indexOf('let dubSocialRequestSeq = 0;');
  const end = html.indexOf('\nasync function dubVideo(){', start);
  assert.notEqual(start, -1, 'dubbing social helpers should exist');
  assert.notEqual(end, -1, 'social helpers should end before dubVideo');
  const context = vm.createContext({});
  vm.runInContext(`${html.slice(start, end)}\nglobalThis.makeFallback = buildClientDubSocialFallback;\nglobalThis.normalizeTags = normalizeClientDubHashtags;\nglobalThis.generatePackage = generateDubSocialPackage;`, context);
  return context;
}

test('dubbing metadata AI creates a bounded topic, caption, and normalized hashtags from the dubbed text', async () => {
  let request;
  const result = await generateDubSocialMetadata({
    translation: 'A cidade desapareceu durante a noite. Os moradores encontraram uma pista.',
    originalTranscript: 'The city vanished overnight.',
    fileName: 'misterio.mp4',
    targetLanguage: 'pt-BR'
  }, async input => {
    request = input;
    return {
      provider: 'mock-text-model',
      text: JSON.stringify({
        topic: 'O mistério da cidade que sumiu',
        description: 'Uma pista inesperada muda tudo.',
        hashtags: ['#mistério', '#viral', '#shorts', '#viral', '#descobertas', '#reels', '#excesso']
      })
    };
  });

  assert.equal(result.topic, 'O mistério da cidade que sumiu');
  assert.equal(result.description, 'Uma pista inesperada muda tudo.');
  assert.deepEqual(result.hashtags, ['#mistério', '#viral', '#shorts', '#descobertas', '#reels', '#excesso']);
  assert.equal(result.provider, 'mock-text-model');
  assert.equal(result.fallback, false);
  assert.equal(request.json, true);
  assert.match(request.user, /A cidade desapareceu durante a noite/);
  assert.match(request.system, /nem prometa viralização/);
});

test('dubbing metadata falls back locally when text AI is unavailable', async () => {
  const result = await generateDubSocialMetadata({
    translation: 'A viagem revelou um segredo antigo. A família encontrou uma pista.',
    fileName: 'viagem.mp4',
    targetLanguage: 'pt-BR'
  }, async () => ({ error: 'offline' }));

  assert.equal(result.fallback, true);
  assert.equal(result.provider, 'local-fallback');
  assert.equal(result.topic, 'A viagem revelou um segredo antigo.');
  assert.ok(result.hashtags.length >= 6);
  assert.ok(result.hashtags.includes('#dublagem'));
  assert.ok(result.hashtags.includes('#viral'));
});

test('Vercel dubbing route dispatches social metadata without requiring an uploaded media file', async () => {
  const aiPath = require.resolve('../vercel/api/lib/ai');
  const routePath = require.resolve('../vercel/api/dub');
  const ai = require(aiPath);
  const originalGenerator = ai.generateDubSocialMetadata;
  let received;
  ai.generateDubSocialMetadata = async input => {
    received = input;
    return { topic: 'Tema sugerido', description: 'Legenda pronta.', hashtags: ['#viral', '#shorts', '#dublagem', '#reels'] };
  };
  delete require.cache[routePath];
  const handler = require(routePath);
  const res = {
    headers: {}, statusCode: 0,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body) { this.body = body; }
  };

  try {
    await handler({ method: 'POST', body: { action: 'social-metadata', translation: 'Conteúdo dublado.' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(received.translation, 'Conteúdo dublado.');
    assert.equal(JSON.parse(res.body).topic, 'Tema sugerido');
  } finally {
    ai.generateDubSocialMetadata = originalGenerator;
    delete require.cache[routePath];
  }
});

test('Dublagem displays the generated topic, caption and hashtags with a one-tap copy action', () => {
  const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  assert.match(html, /id="dubSocialPackage"/);
  assert.match(html, /id="dubSocialTopic"/);
  assert.match(html, /id="dubSocialHashtags"/);
  assert.match(html, /void generateDubSocialPackage\(\{ translation: fullTranslation/);
  assert.match(html, /onclick="copyDubSocialPackage\(\)"/);
  assert.match(server, /body\.action === 'social-metadata'/);
});

test('browser fallback creates content-based topics and relevant language hashtags', () => {
  const helpers = loadClientHelpers();
  const fallback = helpers.makeFallback({
    translation: 'A descoberta muda a história. O mistério continua.',
    fileName: 'documentario.mp4',
    targetLanguage: 'pt-BR'
  });
  assert.equal(fallback.topic, 'A descoberta muda a história.');
  assert.ok(fallback.hashtags.includes('#dublagem'));
  assert.ok(fallback.hashtags.includes('#viral'));
  assert.ok(fallback.hashtags.length >= 6);
  assert.deepEqual(Array.from(helpers.normalizeTags(['#viral', '#VIRAL', '#shorts'])), ['#viral', '#shorts']);
});

test('browser renders the server-generated share pack as soon as dubbing finishes', async () => {
  const helpers = loadClientHelpers();
  const elements = new Map();
  for (const id of ['dubSocialPackage', 'dubSocialStatus', 'dubSocialTopic', 'dubSocialDescription', 'dubSocialDescriptionWrap', 'dubSocialHashtags']) {
    elements.set(id, {
      textContent: '',
      classList: {
        removed: false,
        hidden: false,
        remove() { this.hidden = false; },
        add() { this.hidden = true; },
        toggle(_name, hidden) { this.hidden = !!hidden; }
      }
    });
  }
  helpers.document = { getElementById: id => elements.get(id) || null };
  helpers.AbortSignal = AbortSignal;
  let request;
  helpers.fetch = async (url, options) => {
    request = { url, body: JSON.parse(options.body) };
    return {
      ok: true,
      json: async () => ({
        topic: 'O segredo que ninguém percebeu',
        description: 'Uma pista muda tudo.',
        hashtags: ['#mistério', '#viral', '#shorts', '#reels'],
        provider: 'mock-model'
      })
    };
  };

  await helpers.generatePackage({ translation: 'A transcrição dublada mostra uma pista.', fileName: 'historia.mp4', targetLanguage: 'pt-BR' });

  assert.equal(request.url, '/api/dub');
  assert.equal(request.body.action, 'social-metadata');
  assert.equal(request.body.translation, 'A transcrição dublada mostra uma pista.');
  assert.equal(elements.get('dubSocialTopic').textContent, 'O segredo que ninguém percebeu');
  assert.equal(elements.get('dubSocialHashtags').textContent, '#mistério #viral #shorts #reels');
  assert.match(elements.get('dubSocialStatus').textContent, /mock-model/);
  assert.equal(elements.get('dubSocialPackage').classList.hidden, false);
});
