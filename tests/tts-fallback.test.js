const test = require('node:test');
const assert = require('node:assert/strict');
const { buildOpenAITtsOptions, cleanDubTranslationText, isEdgeTtsHandshakeFailure, runTtsProviderChain, ttsWithFallback } = require('../vercel/api/lib/ai');

test('recognizes Edge TTS WebSocket handshakes that incorrectly return HTTP 200', () => {
  assert.equal(isEdgeTtsHandshakeFailure(new Error('Unexpected server response: 200')), true);
  assert.equal(isEdgeTtsHandshakeFailure(new Error('Unexpected server response: 403')), false);
  assert.equal(isEdgeTtsHandshakeFailure(new Error('connection timed out')), false);
});

test('dubbing translation removes model headers and quote wrappers without changing the spoken words', () => {
  assert.equal(cleanDubTranslationText('Claro! Aqui está a tradução: “Olá, mundo!”'), 'Olá, mundo!');
  assert.equal(cleanDubTranslationText('A tradução é: Olá, mundo!'), 'Olá, mundo!');
  assert.equal(cleanDubTranslationText('"Tradução: Olá, mundo!"'), 'Olá, mundo!');
  assert.equal(cleanDubTranslationText('La traducción: Buenos días.'), 'Buenos días.');
  assert.equal(cleanDubTranslationText('```text\nTranslation: Good morning.\n```'), 'Good morning.');
  assert.equal(cleanDubTranslationText('A fala começa agora.'), 'A fala começa agora.');
});

test('OpenAI dubbing TTS receives the selected voice without extra spoken instructions', () => {
  const opts = buildOpenAITtsOptions({ model: 'gpt-4o-mini-tts', text: 'Só as palavras traduzidas.', voice: 'coral', exactTextOnly: true });
  assert.deepEqual(opts, {
    model: 'gpt-4o-mini-tts',
    voice: 'coral',
    input: 'Só as palavras traduzidas.',
    response_format: 'mp3'
  });

  const genericOpts = buildOpenAITtsOptions({ model: 'gpt-4o-mini-tts', text: 'Teste.', voice: 'nova' });
  assert.match(genericOpts.instructions, /dublador humano brasileiro/);
});

test('falls through from a failed Edge TTS WebSocket to the first working voice provider', async () => {
  const called = [];
  const audio = Buffer.alloc(512, 0x21);
  const result = await runTtsProviderChain([
    {
      name: 'neural-hd',
      run: async () => {
        called.push('neural-hd');
        throw new Error('Edge TTS WebSocket error: Unexpected server response: 200');
      }
    },
    {
      name: 'gemini-tts',
      run: async () => {
        called.push('gemini-tts');
        return { buffer: audio, provider: 'gemini/gemini-3.1-flash-tts-preview' };
      }
    },
    {
      name: 'unorouter-tts',
      run: async () => {
        called.push('unorouter-tts');
        return { buffer: Buffer.alloc(512), provider: 'unorouter/tts' };
      }
    }
  ]);

  assert.deepEqual(called, ['neural-hd', 'gemini-tts']);
  assert.equal(result.provider, 'gemini/gemini-3.1-flash-tts-preview');
  assert.strictEqual(result.buffer, audio);
  assert.equal(result.error, undefined);
});

test('ttsWithFallback sends Edge HTTP 200 failures to Gemini without losing the selected text or voice', async () => {
  const called = [];
  const audio = Buffer.alloc(384, 0x33);
  const result = await ttsWithFallback(
    { text: '  Olá, mundo!  ', voice: 'nova', lang: 'pt-BR' },
    {
      edge: async options => {
        called.push('edge');
        assert.deepEqual(options, { text: 'Olá, mundo!', voice: 'nova', lang: 'pt-BR', emotion: '' });
        throw new Error('Edge TTS WebSocket error: Unexpected server response: 200');
      },
      gemini: async options => {
        called.push('gemini');
        assert.deepEqual(options, { text: 'Olá, mundo!', voice: 'nova', lang: 'pt-BR', emotion: '' });
        return { buffer: audio, provider: 'gemini/tts' };
      },
      google: async () => {
        called.push('google');
        return Buffer.alloc(384);
      }
    }
  );

  assert.deepEqual(called, ['edge', 'gemini']);
  assert.equal(result.provider, 'gemini/tts');
  assert.strictEqual(result.buffer, audio);
});

test('strict dubbing fallback skips providers that cannot keep the selected voice', async () => {
  const called = [];
  const audio = Buffer.alloc(384, 0x44);
  const result = await ttsWithFallback(
    { text: '  A tradução exata do vídeo.  ', voice: 'coral', lang: 'pt-BR', exactTextOnly: true },
    {
      edge: async options => {
        called.push('edge');
        assert.deepEqual(options, { text: 'A tradução exata do vídeo.', voice: 'coral', lang: 'pt-BR', emotion: '' });
        throw new Error('Edge TTS indisponível');
      },
      gemini: async () => {
        called.push('gemini');
        return { buffer: Buffer.alloc(384), provider: 'gemini/tts' };
      },
      unorouter: async options => {
        called.push('unorouter');
        assert.deepEqual(options, { text: 'A tradução exata do vídeo.', voice: 'coral', lang: 'pt-BR', emotion: '' });
        return { buffer: audio, provider: 'unorouter/aura-1:free' };
      },
      google: async () => {
        called.push('google');
        return { buffer: Buffer.alloc(384), provider: 'google-translate-tts' };
      },
      streamElements: async () => {
        called.push('streamElements');
        return Buffer.alloc(384);
      }
    }
  );

  assert.deepEqual(called, ['edge', 'unorouter']);
  assert.equal(result.provider, 'unorouter/aura-1:free');
  assert.strictEqual(result.buffer, audio);
});

test('strict dubbing does not silently switch to a fixed Google voice when selected-voice providers fail', async () => {
  const called = [];
  const result = await ttsWithFallback(
    { text: 'Texto para dublar.', voice: 'sage', lang: 'pt-BR', exactTextOnly: true },
    {
      edge: async () => { called.push('edge'); throw new Error('indisponível'); },
      google: async () => { called.push('google'); return Buffer.alloc(384); }
    }
  );

  assert.deepEqual(called, ['edge']);
  assert.match(result.error, /neural-hd: indisponível/);
});

test('ttsWithFallback proceeds to Unorouter when Edge and Gemini both fail', async () => {
  const called = [];
  const result = await ttsWithFallback(
    { text: 'Fala de teste', voice: 'onyx', lang: 'pt-BR' },
    {
      edge: async () => { called.push('edge'); throw new Error('Unexpected server response: 200'); },
      gemini: async () => { called.push('gemini'); throw new Error('quota temporariamente indisponível'); },
      unorouter: async () => {
        called.push('unorouter');
        return { buffer: Buffer.alloc(300, 0x55), provider: 'unorouter/tts' };
      }
    }
  );

  assert.deepEqual(called, ['edge', 'gemini', 'unorouter']);
  assert.equal(result.provider, 'unorouter/tts');
});

test('skips empty audio and continues to the next provider', async () => {
  const result = await runTtsProviderChain([
    { name: 'neural-hd', run: async () => ({ buffer: Buffer.alloc(0) }) },
    { name: 'google-translate-tts', run: async () => Buffer.alloc(300, 0x42) }
  ]);

  assert.equal(result.provider, 'google-translate-tts');
  assert.equal(result.buffer.length, 300);
});

test('returns provider-specific diagnostics when every voice service fails', async () => {
  const result = await runTtsProviderChain([
    { name: 'neural-hd', run: async () => { throw new Error('Unexpected server response: 200'); } },
    { name: 'gemini-tts', run: async () => ({ error: 'quota indisponível' }) }
  ]);

  assert.match(result.error, /neural-hd: Unexpected server response: 200/);
  assert.match(result.error, /gemini-tts: quota indisponível/);
  assert.equal(result.errors.length, 2);
});
