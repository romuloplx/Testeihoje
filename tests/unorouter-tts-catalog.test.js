'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { unorouterTTS } = require('../vercel/api/lib/ai');

test('Unorouter TTS discovers permitted voice models from the key-specific catalog before static fallbacks', async () => {
  const previousKey = process.env.UNOROUTER_API_KEY;
  const previousBase = process.env.UNOROUTER_BASE_URL;
  const previousFetch = global.fetch;
  process.env.UNOROUTER_API_KEY = 'test-unorouter-key';
  process.env.UNOROUTER_BASE_URL = 'https://router.example/v1';
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith('/models')) {
      return new Response(JSON.stringify({ data: [{ id: 'kokoro-tts:free' }, { id: 'text-chat-model' }] }), {
        status: 200, headers: { 'content-type': 'application/json' }
      });
    }
    if (url.endsWith('/audio/speech')) {
      const body = JSON.parse(options.body);
      if (body.model === 'kokoro-tts:free') {
        return new Response(Buffer.alloc(400, 1), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
      }
      return new Response(JSON.stringify({ error: 'unexpected fallback model' }), {
        status: 403, headers: { 'content-type': 'application/json' }
      });
    }
    throw new Error('unexpected request URL');
  };

  try {
    const result = await unorouterTTS({ text: 'Olá, teste de voz.', voice: 'nova' });
    assert.equal(result.provider, 'unorouter/kokoro-tts:free');
    assert.equal(result.buffer.length, 400);
    assert.equal(requests[0].url, 'https://router.example/v1/models');
    assert.equal(requests[1].url, 'https://router.example/v1/audio/speech');
    assert.equal(JSON.parse(requests[1].options.body).model, 'kokoro-tts:free');
    assert.equal(requests[1].options.headers.Authorization, 'Bearer test-unorouter-key');
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.UNOROUTER_API_KEY;
    else process.env.UNOROUTER_API_KEY = previousKey;
    if (previousBase === undefined) delete process.env.UNOROUTER_BASE_URL;
    else process.env.UNOROUTER_BASE_URL = previousBase;
  }
});
