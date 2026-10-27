const test = require('node:test');
const assert = require('node:assert/strict');
const { freeTtsVoiceId, freeTts, ttsWithFallback } = require('../vercel/api/lib/ai');

test('FreeTTS maps selected gender and target language to Neural voices', () => {
  assert.equal(freeTtsVoiceId('en-US', 'nova'), 'en-US-JennyNeural');
  assert.equal(freeTtsVoiceId('en', 'onyx'), 'en-US-GuyNeural');
  assert.equal(freeTtsVoiceId('pt-BR', 'marin'), 'pt-BR-FranciscaNeural');
  assert.equal(freeTtsVoiceId('pt-BR', 'cedar'), 'pt-BR-AntonioNeural');
});

test('FreeTTS sends the selected Neural voice and returns MP3 bytes', async () => {
  const oldKey = process.env.FREETTS_API_KEY;
  const oldFetch = global.fetch;
  process.env.FREETTS_API_KEY = 'test-key';
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return new Response(Buffer.from('mp3-data'), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
  };
  try {
    const result = await freeTts({ text: 'Olá', voice: 'nova', lang: 'en-US' });
    assert.equal(request.url, 'https://freetts.org/api/v1/tts');
    assert.equal(request.options.headers['x-api-key'], 'test-key');
    assert.deepEqual(JSON.parse(request.options.body), {
      text: 'Olá', voice: 'en-US-JennyNeural', output_format: 'mp3'
    });
    assert.equal(result.provider, 'freetts');
    assert.equal(result.buffer.toString(), 'mp3-data');
  } finally {
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.FREETTS_API_KEY;
    else process.env.FREETTS_API_KEY = oldKey;
  }
});

test('strict dubbing can use FreeTTS and does not fall through to robotic Google TTS', async () => {
  const result = await ttsWithFallback(
    { text: 'Texto literal.', voice: 'nova', lang: 'pt-BR', exactTextOnly: true },
    {
      freetts: async ({ text, voice }) => {
        assert.equal(text, 'Texto literal.');
        assert.equal(voice, 'nova');
        return { buffer: Buffer.alloc(300, 1), provider: 'freetts' };
      },
      google: async () => { throw new Error('Google não deve ser chamado'); }
    }
  );
  assert.equal(result.provider, 'freetts');
  assert.equal(result.buffer.length, 300);
});
