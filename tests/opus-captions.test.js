'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { transcribeClipSegment } = require('../vercel/api/lib/ai');

const readOpusCaptionHelpers = () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const start = html.indexOf('function buildOpusWordByWordCues(');
  const end = html.indexOf('\n// Renderiza 1 frame ultra-profissional', start);
  assert.notEqual(start, -1, 'caption builder should exist');
  assert.notEqual(end, -1, 'caption helper section should have an end marker');
  const context = {
    opusState: { mono12k: null },
    pickOpusEmojiForPhrase: () => '🎯'
  };
  vm.createContext(context);
  vm.runInContext(`${html.slice(start, end)}\nglobalThis.buildCues = buildOpusWordByWordCues;\nglobalThis.findCue = findActiveOpusCaptionCue;\nglobalThis.wordGap = getOpusCaptionWordGap;`, context);
  return context;
};

test('word timestamps stay absolute-to-relative exact and default to readable two-word blocks', () => {
  const { buildCues } = readOpusCaptionHelpers();
  const cues = buildCues('Olá mundo! Tudo certo.', 2, 10, [
    { inicio: 9.4, fim: 9.8, texto: 'fora' },
    { inicio: 10.20, fim: 10.44, texto: 'Olá' },
    { inicio: 10.50, fim: 10.90, texto: 'mundo!' },
    { inicio: 11.20, fim: 11.48, texto: 'Tudo' },
    { inicio: 11.55, fim: 11.90, texto: 'certo.' },
    { inicio: 12.1, fim: 12.4, texto: 'fora' }
  ]);

  assert.equal(cues.length, 2);
  assert.deepEqual(Array.from(cues, cue => cue.words.length), [2, 2]);
  assert.deepEqual(Array.from(cues[0].words, word => word.word), ['Olá', 'mundo!']);
  assert.equal(Number(cues[0].words[0].start.toFixed(2)), 0.20);
  assert.equal(Number(cues[0].words[0].end.toFixed(2)), 0.44);
  assert.equal(Number(cues[0].words[1].start.toFixed(2)), 0.50);
  assert.equal(Number(cues[0].end.toFixed(2)), 0.90);
  assert.equal(Number(cues[1].start.toFixed(2)), 1.20);

  const sentenceCues = buildCues('do episódio! Presta atenção', 2, 10, null, 3);
  assert.deepEqual(
    Array.from(sentenceCues, cue => Array.from(cue.words, word => word.word)),
    [['do', 'episódio!'], ['Presta', 'atenção']]
  );
});

test('burned-in captions keep a readable gap between highlighted words', () => {
  const { wordGap } = readOpusCaptionHelpers();

  assert.equal(wordGap(34, 9), 18);
  assert.equal(wordGap(20, 10), 11);
  assert.equal(wordGap(20, 20), 20);
});

test('duplicate overlapping transcripts are collapsed without removing repeated words spoken later', () => {
  const ai = fs.readFileSync(path.join(__dirname, '../vercel/api/lib/ai.js'), 'utf8');
  const start = ai.indexOf('function dedupeTimedCaptionSegments(');
  const end = ai.indexOf('\nasync function analyzeViralClips', start);
  assert.notEqual(start, -1, 'timed-segment deduper should exist');
  assert.notEqual(end, -1, 'timed-segment deduper should have an end marker');
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${ai.slice(start, end)}\nglobalThis.dedupe = dedupeTimedCaptionSegments;`, context);

  const segments = context.dedupe([
    { inicio: 1, fim: 1.3, texto: 'Olá' },
    { inicio: 1.02, fim: 1.28, texto: 'Olá!' },
    { inicio: 1.5, fim: 1.8, texto: 'Olá' }
  ]);
  assert.equal(segments.length, 2);
  assert.match(segments[0].texto, /^Olá!?$/);
  assert.equal(segments[1].inicio, 1.5);
});

test('clips without a transcript do not receive invented fallback captions', () => {
  const ai = fs.readFileSync(path.join(__dirname, '../vercel/api/lib/ai.js'), 'utf8');
  const start = ai.indexOf('function buildSmartViralClipsFallback(');
  const end = ai.indexOf('\nfunction dedupeTimedCaptionSegments', start);
  assert.notEqual(start, -1, 'clip fallback should exist');
  assert.notEqual(end, -1, 'clip fallback should have an end marker');
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${ai.slice(start, end)}\nglobalThis.buildFallback = buildSmartViralClipsFallback;`, context);

  const clips = context.buildFallback({
    fileName: 'video.mp4',
    durationSec: 60,
    targetClipLength: '30-60',
    desiredClipsCount: 1,
    energyPeaks: []
  });
  assert.equal(clips.length, 1);
  assert.equal(clips[0].captionText, '');
});

test('caption cue lookup leaves silence gaps blank instead of distributing text over the whole clip', () => {
  const { findCue } = readOpusCaptionHelpers();
  const cues = [
    { start: 0.2, end: 0.9, phraseIdx: 0 },
    { start: 1.2, end: 1.8, phraseIdx: 1 }
  ];

  assert.equal(findCue(cues, 0.6).phraseIdx, 0);
  assert.equal(findCue(cues, 1.05), null);
  assert.equal(findCue(cues, 1.4).phraseIdx, 1);
  assert.equal(findCue([], 0.5), null);
});

test('Whisper word timestamps are requested and returned with the clip offset', async () => {
  const originalFetch = global.fetch;
  const savedEnv = {
    UNOROUTER_API_KEY: process.env.UNOROUTER_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY
  };
  process.env.UNOROUTER_API_KEY = 'unit-test-unorouter-key';
  process.env.OPENAI_API_KEY = '';
  process.env.GEMINI_API_KEY = 'unit-test-gemini-key';
  let calls = 0;

  global.fetch = async (url, options) => {
    calls += 1;
    assert.match(String(url), /\/audio\/transcriptions$/);
    assert.equal(options.body.get('response_format'), 'verbose_json');
    assert.deepEqual(options.body.getAll('timestamp_granularities[]'), ['word', 'segment']);
    return new Response(JSON.stringify({
      text: 'Olá mundo!',
      words: [
        { word: ' Olá', start: 0.2, end: 0.45 },
        { word: ' mundo!', start: 0.52, end: 0.9 }
      ],
      segments: []
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    const out = await transcribeClipSegment({
      audioBase64: Buffer.from('test-audio').toString('base64'),
      offsetSec: 7.5,
      durationSec: 2
    });
    assert.equal(calls, 1);
    assert.equal(out.text, 'Olá mundo!');
    assert.equal(out.timingGranularity, 'word');
    assert.equal(out.provider, 'unorouter/whisper-large-v3-turbo:free');
    assert.deepEqual(out.segments, [
      { inicio: 7.7, fim: 7.95, texto: 'Olá' },
      { inicio: 8.02, fim: 8.4, texto: 'mundo!' }
    ]);
  } finally {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('text-only transcription estimates stay inside the actual audio duration', async () => {
  const originalFetch = global.fetch;
  const savedEnv = {
    UNOROUTER_API_KEY: process.env.UNOROUTER_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY
  };
  process.env.UNOROUTER_API_KEY = 'unit-test-unorouter-key';
  process.env.OPENAI_API_KEY = '';
  process.env.GEMINI_API_KEY = '';
  global.fetch = async () => new Response(JSON.stringify({ text: 'Uma frase. Outra frase.' }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });

  try {
    const out = await transcribeClipSegment({
      audioBase64: Buffer.from('test-audio').toString('base64'),
      offsetSec: 10,
      durationSec: 4
    });
    assert.equal(out.timingGranularity, 'estimated');
    assert.equal(out.segments[0].inicio, 10);
    assert.equal(out.segments.at(-1).fim, 14);
    assert.ok(out.segments.every(segment => segment.inicio >= 10 && segment.fim <= 14));
  } finally {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
