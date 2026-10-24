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

const readMissingCaptionTranscriber = context => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const start = html.indexOf('function getOpusCaptionTokens(');
  const end = html.indexOf('\n// Executa o pipeline completo do OpusClip IA', start);
  assert.notEqual(start, -1, 'caption timing helpers should exist');
  assert.notEqual(end, -1, 'missing-caption transcriber should have an end marker');
  vm.createContext(context);
  vm.runInContext(`${html.slice(start, end)}\nglobalThis.recoverMissingCaptions = transcribeMissingOpusClipCaptions;\nglobalThis.hasWordTiming = hasOpusClipWordTiming;`, context);
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

test('missing clip captions are recovered from that clip audio, without replacing existing transcripts', async () => {
  const requests = [];
  const context = readMissingCaptionTranscriber({
    opusState: { mono12k: new Float32Array(12000 * 6).fill(0.2), fullAudioBuffer: null },
    encodeWavMono: samples => new Uint8Array(samples.length * 2 + 44),
    bytesToBase64: bytes => `wav-${bytes.length}`,
    fetch: async (url, options) => {
      assert.equal(url, '/api/clips');
      const body = JSON.parse(options.body);
      requests.push(body);
      return {
        ok: true,
        json: async () => ({
          text: 'fala real do trecho',
          segments: [
            { inicio: body.offsetSec + 0.20, fim: body.offsetSec + 0.35, texto: 'fala' },
            { inicio: body.offsetSec + 0.35, fim: body.offsetSec + 0.50, texto: 'real' },
            { inicio: body.offsetSec + 0.50, fim: body.offsetSec + 0.62, texto: 'do' },
            { inicio: body.offsetSec + 0.62, fim: body.offsetSec + 0.85, texto: 'trecho' }
          ],
          timingGranularity: 'word'
        })
      };
    }
  });
  const clips = [
    { startSec: 2, endSec: 4, captionText: '' },
    {
      startSec: 0,
      endSec: 2,
      captionText: 'transcrição já existente',
      subSegments: [
        { inicio: 0.1, fim: 0.45, texto: 'transcrição' },
        { inicio: 0.5, fim: 0.72, texto: 'já' },
        { inicio: 0.8, fim: 1.2, texto: 'existente' }
      ]
    }
  ];

  const recovered = await context.recoverMissingCaptions(clips);

  assert.equal(recovered, 1);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].action, 'transcribe_segment');
  assert.equal(requests[0].offsetSec, 2);
  assert.equal(requests[0].durationSec, 2);
  assert.equal(clips[0].captionText, 'fala real do trecho');
  assert.equal(clips[0].subSegments[0].texto, 'fala');
  assert.equal(context.hasWordTiming(clips[0]), true);
  assert.equal(clips[1].captionText, 'transcrição já existente');
  assert.equal(context.hasWordTiming(clips[1]), true);
});

test('existing caption text is preserved while missing word timings are recovered from its audio', async () => {
  const requests = [];
  const context = readMissingCaptionTranscriber({
    opusState: { mono12k: new Float32Array(12000 * 6).fill(0.2), fullAudioBuffer: null },
    encodeWavMono: samples => new Uint8Array(samples.length * 2 + 44),
    bytesToBase64: bytes => `wav-${bytes.length}`,
    fetch: async (_url, options) => {
      const body = JSON.parse(options.body);
      requests.push(body);
      return {
        ok: true,
        json: async () => ({
          text: 'Fala real do trecho!',
          segments: [
            { inicio: 2.1, fim: 2.28, texto: 'Fala' },
            { inicio: 2.30, fim: 2.48, texto: 'real' },
            { inicio: 2.50, fim: 2.62, texto: 'do' },
            { inicio: 2.64, fim: 2.95, texto: 'trecho!' }
          ],
          timingGranularity: 'word'
        })
      };
    }
  });
  const clip = {
    startSec: 2,
    endSec: 4,
    captionText: 'Fala real do trecho',
    subSegments: [{ inicio: 2, fim: 4, texto: 'Fala real do trecho' }]
  };

  const synchronized = await context.recoverMissingCaptions([clip]);

  assert.equal(synchronized, 1);
  assert.equal(requests.length, 1);
  assert.equal(clip.captionText, 'Fala real do trecho');
  assert.equal(clip.captionTimingGranularity, 'word');
  assert.deepEqual(clip.subSegments.map(segment => segment.texto), ['Fala', 'real', 'do', 'trecho!']);
  assert.equal(context.hasWordTiming(clip), true);

  const { buildCues } = readOpusCaptionHelpers();
  const words = buildCues(clip.captionText, 2, clip.startSec, clip.subSegments).flatMap(cue => cue.words);
  assert.deepEqual(Array.from(words, word => word.word), ['Fala', 'real', 'do', 'trecho!']);
  assert.equal(Number(words[0].start.toFixed(2)), 0.1);
  assert.equal(Number(words[0].end.toFixed(2)), 0.28);
  assert.equal(Number(words[3].start.toFixed(2)), 0.64);
  assert.equal(Number(words[3].end.toFixed(2)), 0.95);
});

test('mismatched audio transcript does not replace saved caption text or attach wrong timestamps', async () => {
  const existingSegments = [{ inicio: 1, fim: 3, texto: 'texto original do usuário' }];
  const context = readMissingCaptionTranscriber({
    opusState: { mono12k: new Float32Array(12000 * 5).fill(0.2), fullAudioBuffer: null },
    encodeWavMono: samples => new Uint8Array(samples.length * 2 + 44),
    bytesToBase64: bytes => `wav-${bytes.length}`,
    fetch: async () => ({
      ok: true,
      json: async () => ({
        text: 'fala diferente no áudio',
        segments: [
          { inicio: 1.1, fim: 1.3, texto: 'fala' },
          { inicio: 1.3, fim: 1.6, texto: 'diferente' },
          { inicio: 1.6, fim: 1.8, texto: 'no' },
          { inicio: 1.8, fim: 2.1, texto: 'áudio' }
        ],
        timingGranularity: 'word'
      })
    })
  });
  const clip = { startSec: 1, endSec: 3, captionText: 'texto original do usuário', subSegments: existingSegments };

  const synchronized = await context.recoverMissingCaptions([clip]);

  assert.equal(synchronized, 0);
  assert.equal(clip.captionText, 'texto original do usuário');
  assert.deepEqual(clip.subSegments, existingSegments);
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
