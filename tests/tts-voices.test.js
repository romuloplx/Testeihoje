'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  TTS_VOICES,
  adaptGemBodyForModel,
  buildGeminiTtsBody,
  buildOpenAITtsOptions,
  openAITtsModelsForVoice,
  ttsWithFallback
} = require('../vercel/api/lib/ai');

const allOpenAiVoices = [
  'alloy', 'ash', 'ballad', 'cedar', 'coral', 'echo', 'fable',
  'marin', 'nova', 'onyx', 'sage', 'shimmer', 'verse'
];
const newOpenAiVoices = ['ballad', 'verse', 'marin', 'cedar'];
const root = path.join(__dirname, '..');

function optionsFor(html, id) {
  const select = html.match(new RegExp(`<select\\b[^>]*id=["']${id}["'][\\s\\S]*?<\\/select>`))?.[0];
  assert.ok(select, `select #${id} should exist`);
  return [...select.matchAll(/<option\s+value=["']([^"']+)["']/g)].map(match => match[1]);
}

test('voice catalogue includes every current OpenAI speech voice, including Marin and Cedar', () => {
  assert.deepEqual(Object.keys(TTS_VOICES).sort(), [...allOpenAiVoices].sort());
});

test('all Create, Avatar, and Dubbing voice selectors expose the full API catalogue', () => {
  for (const file of ['public/index.html', 'vercel/index.html']) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    for (const id of ['voice', 'avatarVoice', 'dubVoice']) {
      const options = optionsFor(html, id).filter(value => !value.startsWith('freetts:'));
      assert.deepEqual(options.sort(), [...allOpenAiVoices].sort(), `${file} #${id}`);
    }
    assert.match(html, /value="marin">⭐ Marin — OpenAI \(recomendada\)/);
    assert.match(html, /value="cedar">⭐ Cedar — OpenAI \(recomendada\)/);
  }
});

test('new OpenAI voices are passed through verbatim and use a model that supports them', () => {
  for (const voice of newOpenAiVoices) {
    const options = buildOpenAITtsOptions({ model: 'gpt-4o-mini-tts', text: 'Somente o texto solicitado.', voice, exactTextOnly: true });
    assert.equal(options.voice, voice);
    assert.equal(options.input, 'Somente o texto solicitado.');
    assert.equal(options.instructions, undefined);
    assert.deepEqual(openAITtsModelsForVoice(voice), ['gpt-4o-mini-tts']);
  }
  assert.deepEqual(openAITtsModelsForVoice('onyx'), ['gpt-4o-mini-tts', 'tts-1-hd', 'tts-1']);
});

test('OpenAI-native voices try their native API voice before provider equivalents', async () => {
  const order = [];
  const audio = Buffer.alloc(320, 0x53);
  const result = await ttsWithFallback(
    { text: 'Texto literal.', voice: 'marin', lang: 'pt-BR', exactTextOnly: true },
    {
      openai: async options => {
        order.push('openai');
        assert.deepEqual(options, { text: 'Texto literal.', voice: 'marin', lang: 'pt-BR', emotion: '' });
        return { buffer: audio, provider: 'openai/gpt-4o-mini-tts' };
      },
      edge: async () => { order.push('edge'); return Buffer.alloc(320, 0x54); },
      google: async () => { order.push('google'); return Buffer.alloc(320, 0x55); }
    }
  );

  assert.deepEqual(order, ['openai']);
  assert.equal(result.provider, 'openai/gpt-4o-mini-tts');
});

test('modern OpenAI voices fall back to distinct providers only after their native API fails', async () => {
  const order = [];
  const result = await ttsWithFallback(
    { text: 'Texto literal.', voice: 'cedar', lang: 'pt-BR', exactTextOnly: true },
    {
      openai: async () => { order.push('openai'); throw new Error('modelo sem acesso'); },
      edge: async options => {
        order.push('edge');
        assert.deepEqual(options, { text: 'Texto literal.', voice: 'cedar', lang: 'pt-BR', emotion: '' });
        return { buffer: Buffer.alloc(320, 0x56), provider: 'neural-hd/pt-BR-NicolauNeural' };
      },
      google: async () => { order.push('google'); return Buffer.alloc(320, 0x57); }
    }
  );

  assert.deepEqual(order, ['openai', 'edge']);
  assert.equal(result.provider, 'neural-hd/pt-BR-NicolauNeural');
});

test('new voice choices map to distinct provider voices when OpenAI is unavailable', () => {
  const aiSource = fs.readFileSync(path.join(root, 'vercel/api/lib/ai.js'), 'utf8');
  const edgeBlock = aiSource.match(/const EDGE_VOICE_PRESETS = \{([\s\S]*?)\n\};/)?.[1] || '';
  const edgePresets = new Set();
  const geminiPresets = new Set();

  for (const voice of newOpenAiVoices) {
    const edgeMatch = edgeBlock.match(new RegExp(`\\b${voice}:\\s*\\{\\s*voice:\\s*'([^']+)'`));
    assert.ok(edgeMatch, `${voice} should have an Edge Neural mapping`);
    edgePresets.add(edgeMatch[1]);

    const body = buildGeminiTtsBody({ text: 'Texto literal.', voice, lang: 'pt-BR', exactTextOnly: true });
    const geminiVoice = body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName;
    assert.ok(geminiVoice, `${voice} should have a Gemini voice mapping`);
    geminiPresets.add(geminiVoice);
    const modernBody = adaptGemBodyForModel(body, 'gemini-3.8-flash-tts');
    assert.deepEqual(modernBody.generationConfig.speechConfig.voiceConfig, { voice: geminiVoice });
  }

  assert.equal(edgePresets.size, newOpenAiVoices.length, 'new selections must not collapse to one Edge voice');
  assert.equal(geminiPresets.size, newOpenAiVoices.length, 'new selections must not collapse to one Gemini voice');
});

test('local server voice map recognizes the added OpenAI voices', () => {
  const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  for (const voice of newOpenAiVoices) assert.match(server, new RegExp(`${voice}: '${voice}'`));
});
