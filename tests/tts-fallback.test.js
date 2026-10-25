const test = require('node:test');
const assert = require('node:assert/strict');
const { adaptGemBodyForModel, buildGeminiTtsBody, buildOpenAITtsOptions, cleanDubTranslationText, geminiGenerateTried, isEdgeTtsHandshakeFailure, runTtsProviderChain, ttsWithFallback } = require('../vercel/api/lib/ai');

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

test('strict Gemini TTS sends only the translated transcript and the selected voice', () => {
  const body = buildGeminiTtsBody({ text: 'Somente a fala traduzida.', voice: 'coral', lang: 'pt-BR', exactTextOnly: true });
  assert.deepEqual(body.contents, [{ role: 'user', parts: [{ text: 'Somente a fala traduzida.' }] }]);
  assert.equal(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Zephyr');
  assert.deepEqual(body.generationConfig.responseModalities, ['AUDIO']);

  const gemini38Body = adaptGemBodyForModel(body, 'gemini-3.8-flash-tts');
  assert.deepEqual(gemini38Body.contents, body.contents);
  assert.deepEqual(gemini38Body.generationConfig.speechConfig.voiceConfig, { voice: 'Zephyr' });
});

test('strict Gemini TTS skips models denied by the key and retries an accessible exact-text model', async () => {
  const previousFetch = global.fetch;
  const previousKey = process.env.GEMINI_API_KEY;
  const calls = [];
  process.env.GEMINI_API_KEY = 'test-key';
  global.fetch = async (url, options = {}) => {
    const requestUrl = String(url);
    if (requestUrl.endsWith('/models?pageSize=200')) {
      return {
        ok: true,
        json: async () => ({ models: [
          { name: 'models/gemini-3.8-flash-tts', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-3.1-flash-tts-preview', supportedGenerationMethods: ['generateContent'] }
        ] })
      };
    }

    const model = requestUrl.match(/\/models\/([^:]+):generateContent/)?.[1];
    calls.push({ model, body: JSON.parse(options.body) });
    if (model.startsWith('gemini-3.8-')) {
      return { ok: false, status: 403, text: async () => '{"error":{"message":"TTS model access denied"}}' };
    }
    return { ok: true, text: async () => '{"candidates":[]}' };
  };

  try {
    const body = buildGeminiTtsBody({ text: 'Só a tradução.', voice: 'coral', lang: 'pt-BR', exactTextOnly: true });
    const result = await geminiGenerateTried({ body, kind: 'tts' });

    assert.deepEqual(calls.map(call => call.model), [
      'gemini-3.8-flash-tts',
      'gemini-3.8-flash-lite-tts',
      'gemini-3.1-flash-tts-preview'
    ]);
    assert.equal(calls[0].body.contents[0].parts[0].text, 'Só a tradução.');
    assert.deepEqual(calls[0].body.generationConfig.speechConfig.voiceConfig, { voice: 'Zephyr' });
    assert.equal(calls[2].body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Zephyr');
    assert.deepEqual(result, { candidates: [] });
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
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

test('strict dubbing falls back from Edge TTS to Gemini using only the translated text and selected voice', async () => {
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
      gemini: async options => {
        called.push('gemini');
        assert.deepEqual(options, { text: 'A tradução exata do vídeo.', voice: 'coral', lang: 'pt-BR', emotion: '' });
        return { buffer: audio, provider: 'gemini/gemini-3.8-flash-tts' };
      },
      unorouter: async () => {
        called.push('unorouter');
        return { buffer: Buffer.alloc(384), provider: 'unorouter/tts' };
      },
      google: async () => {
        called.push('google');
        return Buffer.alloc(384);
      },
      streamElements: async () => {
        called.push('streamElements');
        return Buffer.alloc(384);
      }
    }
  );

  assert.deepEqual(called, ['edge', 'gemini']);
  assert.equal(result.provider, 'gemini/gemini-3.8-flash-tts');
  assert.strictEqual(result.buffer, audio);
});

test('strict dubbing falls through to Unorouter only when exact Gemini TTS also fails', async () => {
  const called = [];
  const audio = Buffer.alloc(384, 0x45);
  const result = await ttsWithFallback(
    { text: 'A fala traduzida.', voice: 'sage', lang: 'pt-BR', exactTextOnly: true },
    {
      edge: async () => { called.push('edge'); throw new Error('indisponível'); },
      gemini: async options => {
        called.push('gemini');
        assert.deepEqual(options, { text: 'A fala traduzida.', voice: 'sage', lang: 'pt-BR', emotion: '' });
        throw new Error('403 sem acesso ao modelo TTS');
      },
      unorouter: async () => {
        called.push('unorouter');
        return { buffer: audio, provider: 'unorouter/tts' };
      }
    }
  );

  assert.deepEqual(called, ['edge', 'gemini', 'unorouter']);
  assert.equal(result.provider, 'unorouter/tts');
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
