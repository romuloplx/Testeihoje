const test = require('node:test');
const assert = require('node:assert/strict');
const { freeTtsVoiceId, freeTts, ttsWithFallback } = require('../vercel/api/lib/ai');

test('FreeTTS maps selected gender and target language to Neural voices', () => {
  assert.equal(freeTtsVoiceId('en-US', 'nova'), 'en-US-JennyNeural');
  assert.equal(freeTtsVoiceId('en', 'onyx'), 'en-US-GuyNeural');
  assert.equal(freeTtsVoiceId('pt-BR', 'marin'), 'pt-BR-FranciscaNeural');
  assert.equal(freeTtsVoiceId('pt-BR', 'cedar'), 'pt-BR-AntonioNeural');
  assert.equal(freeTtsVoiceId('pt-BR', 'freetts:pt-BR-BrendaNeural'), 'pt-BR-BrendaNeural');
  assert.equal(freeTtsVoiceId('en-US', 'freetts:en-US-JennyNeural'), 'en-US-JennyNeural');
  assert.throws(() => freeTtsVoiceId('en-US', 'freetts:unlisted-voice'), /não reconhecida/);
});

test('FreeTTS sends the selected Neural voice and returns MP3 bytes', async () => {
  const oldKey = process.env.FREETTS_API_KEY;
  const oldFetch = global.fetch;
  process.env.FREETTS_API_KEY = 'test-key';
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return new Response(Buffer.alloc(300, 7), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
  };
  try {
    const result = await freeTts({ text: 'Olá', voice: 'freetts:en-US-JennyNeural', lang: 'en-US' });
    assert.equal(request.url, 'https://freetts.org/api/v1/tts');
    assert.equal(request.options.headers['x-api-key'], 'test-key');
    assert.deepEqual(JSON.parse(request.options.body), {
      text: 'Olá', voice: 'en-US-JennyNeural', output_format: 'mp3'
    });
    assert.equal(result.provider, 'freetts');
    assert.equal(result.buffer.length, 300);
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

test('direct FreeTTS voice is used exactly and errors without switching providers', async () => {
  let alternateCalled = false;
  const success = await ttsWithFallback(
    { text: 'A fala escolhida.', voice: 'freetts:pt-BR-BrendaNeural', lang: 'pt-BR', exactTextOnly: true },
    {
      freetts: async ({ voice }) => {
        assert.equal(voice, 'freetts:pt-BR-BrendaNeural');
        return { buffer: Buffer.alloc(300, 2), provider: 'freetts' };
      },
      edge: async () => { alternateCalled = true; throw new Error('não deve trocar de voz'); },
      google: async () => { alternateCalled = true; throw new Error('não deve usar Google'); }
    }
  );
  assert.equal(success.provider, 'freetts');
  assert.equal(alternateCalled, false);

  const failure = await ttsWithFallback(
    { text: 'A fala escolhida.', voice: 'freetts:pt-BR-BrendaNeural', lang: 'pt-BR', exactTextOnly: true },
    {
      freetts: async () => { throw new Error('API key inválida'); },
      edge: async () => { alternateCalled = true; return { buffer: Buffer.alloc(300) }; }
    }
  );
  assert.match(failure.error, /API key inválida/);
  assert.equal(alternateCalled, false);
});
