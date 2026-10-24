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
  vm.runInContext(`${html.slice(start, end)}\nglobalThis.buildCues = buildOpusWordByWordCues;\nglobalThis.findCue = findActiveOpusCaptionCue;\nglobalThis.visibleWords = getVisibleOpusCaptionWords;\nglobalThis.wordGap = getOpusCaptionWordGap;`, context);
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

const readAutoCaptionHandler = context => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const start = html.indexOf('async function generateSelectedOpusClipCaptionsFromAudio(');
  const end = html.indexOf('\nfunction onEditSelectedOpusClip', start);
  assert.notEqual(start, -1, 'CapCut-style automatic caption handler should exist');
  assert.notEqual(end, -1, 'automatic caption handler should have an end marker');
  vm.createContext(context);
  vm.runInContext(`${html.slice(start, end)}\nglobalThis.generateCaptionsFromAudio = generateSelectedOpusClipCaptionsFromAudio;`, context);
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

test('word captions reveal progressively instead of showing future speech early', () => {
  const { buildCues, findCue, visibleWords } = readOpusCaptionHelpers();
  const cues = buildCues('Olá mundo!', 1.2, 5, [
    { inicio: 5.1, fim: 5.4, texto: 'Olá' },
    { inicio: 5.6, fim: 5.9, texto: 'mundo!' }
  ]);
  const cue = findCue(cues, 0.2);

  assert.deepEqual(Array.from(visibleWords(cue, 0.2), word => word.word), ['Olá']);
  assert.deepEqual(Array.from(visibleWords(cue, 0.59), word => word.word), ['Olá']);
  assert.deepEqual(Array.from(visibleWords(cue, 0.6), word => word.word), ['Olá', 'mundo!']);
});

test('preview and MP4 export share the progressive word-caption renderer', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const start = html.indexOf('function drawOpusReframedFrame(');
  const end = html.indexOf('\nfunction updateOpusCanvasAspect', start);
  assert.notEqual(start, -1, 'shared caption renderer should exist');
  assert.notEqual(end, -1, 'shared caption renderer should have an end marker');
  const renderer = html.slice(start, end);

  assert.match(renderer, /getVisibleOpusCaptionWords\(activeCue, captionRelSec\)/);
  assert.match(renderer, /if\(captionRelSec < wObj\.start\)/);
  assert.match(html, /drawOpusReframedFrame\(ctx, exportVid, clip, t\)/);
});

test('CapCut-style auto-caption button transcribes the selected cut and updates preview and export source text', async () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  assert.match(html, /id="opusAutoCaptionBtn" onclick="generateSelectedOpusClipCaptionsFromAudio\(\)"/);
  const statuses = [];
  const button = { disabled: false, textContent: '🎙️ Gerar legenda automaticamente pelo áudio' };
  const captionEditor = { value: '' };
  const targetClip = { id: 'cut-2', rank: 2, captionText: 'texto manual', captionManuallyEdited: true };
  const clips = [{ id: 'cut-1', rank: 1 }, targetClip];
  const calls = [];
  const context = readAutoCaptionHandler({
    opusState: { selectedIdx: 1, clips, lastExportBlob: { stale: true }, lastExportClipId: 'old' },
    hasOpusClipAudioSource: () => true,
    document: {
      getElementById: id => id === 'opusAutoCaptionBtn' ? button
        : id === 'opusEditCaption' ? captionEditor : null
    },
    transcribeMissingOpusClipCaptions: async (selectedClips, forceResync) => {
      calls.push({ selectedClips, forceResync, manualAtCall: targetClip.captionManuallyEdited });
      targetClip.captionText = 'fala reconhecida do vídeo';
      targetClip.subSegments = [{ inicio: 4.1, fim: 4.5, texto: 'fala' }];
      targetClip.captionAudioSyncVerified = true;
      targetClip.captionAudioTranscriptionReceived = true;
      return 1;
    },
    showStatus: (...args) => statuses.push(args),
    toast: () => {},
    updateInlineCardCaptionBadges: () => {},
    renderSingleOpusPreviewFrame: () => {},
    renderAllOpusCardStaticPreviews: () => {}
  });

  await context.generateCaptionsFromAudio();

  assert.equal(calls.length, 1);
  assert.deepEqual(Array.from(calls[0].selectedClips), [targetClip]);
  assert.equal(calls[0].forceResync, true);
  assert.equal(calls[0].manualAtCall, false);
  assert.equal(targetClip.captionText, 'fala reconhecida do vídeo');
  assert.equal(targetClip.captionManuallyEdited, false);
  assert.equal(captionEditor.value, 'fala reconhecida do vídeo');
  assert.equal(context.opusState.lastExportBlob, null);
  assert.equal(context.opusState.lastExportClipId, null);
  assert.equal(button.disabled, false);
  assert.match(button.textContent, /Gerar legenda automaticamente/);
  assert.equal(statuses.at(-1)[2], 'success');
});

test('automatic captions clearly require local video audio when a remote source exposes no audio', async () => {
  const statuses = [];
  let transcribeCalls = 0;
  const clip = { id: 'cut-1', captionText: 'legenda existente' };
  const context = readAutoCaptionHandler({
    opusState: { selectedIdx: 0, clips: [clip] },
    hasOpusClipAudioSource: () => false,
    document: { getElementById: () => null },
    transcribeMissingOpusClipCaptions: async () => { transcribeCalls++; },
    showStatus: (...args) => statuses.push(args),
    toast: () => {}
  });

  await context.generateCaptionsFromAudio();

  assert.equal(transcribeCalls, 0);
  assert.equal(clip.captionText, 'legenda existente');
  assert.equal(statuses.at(-1)[2], 'warn');
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
  assert.equal(clips[0].captionAudioTranscriptionReceived, true);
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
  assert.equal(clip.captionAudioSyncVerified, true);

  const { buildCues } = readOpusCaptionHelpers();
  const words = buildCues(clip.captionText, 2, clip.startSec, clip.subSegments).flatMap(cue => cue.words);
  assert.deepEqual(Array.from(words, word => word.word), ['Fala', 'real', 'do', 'trecho!']);
  assert.equal(Number(words[0].start.toFixed(2)), 0.1);
  assert.equal(Number(words[0].end.toFixed(2)), 0.28);
  assert.equal(Number(words[3].start.toFixed(2)), 0.64);
  assert.equal(Number(words[3].end.toFixed(2)), 0.95);
});

test('automatic caption text is corrected from the exact cut audio when it differs', async () => {
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
  const clip = {
    startSec: 1,
    endSec: 3,
    captionText: 'texto original do vídeo',
    subSegments: [{ inicio: 1, fim: 3, texto: 'texto original do vídeo' }]
  };

  const synchronized = await context.recoverMissingCaptions([clip]);

  assert.equal(synchronized, 1);
  assert.equal(clip.captionText, 'fala diferente no áudio');
  assert.deepEqual(clip.subSegments.map(segment => segment.texto), ['fala', 'diferente', 'no', 'áudio']);
  assert.equal(context.hasWordTiming(clip), true);
  assert.equal(clip.captionAudioMismatch, false);
  assert.equal(clip.captionAudioSyncVerified, true);
});

test('manual caption text is preserved when it differs from the cut audio', async () => {
  const existingSegments = [{ inicio: 1, fim: 3, texto: 'texto manual do usuário' }];
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
  const clip = {
    startSec: 1,
    endSec: 3,
    captionText: 'texto manual do usuário',
    captionManuallyEdited: true,
    subSegments: existingSegments
  };

  const synchronized = await context.recoverMissingCaptions([clip], true);

  assert.equal(synchronized, 0);
  assert.equal(clip.captionText, 'texto manual do usuário');
  assert.deepEqual(clip.subSegments, existingSegments);
  assert.equal(clip.captionAudioMismatch, true);
  assert.equal(clip.captionAudioSyncVerified, false);
});

test('large local videos recheck captions by capturing each final cut without decoding the whole file', async () => {
  const requests = [];
  const extractedCuts = [];
  const makeVideoElement = () => {
    const listeners = {};
    return {
      duration: 6,
      addEventListener: (name, callback) => { listeners[name] = callback; },
      removeEventListener: name => { delete listeners[name]; },
      load: () => { if(listeners.loadedmetadata) listeners.loadedmetadata(); },
      pause: () => {},
      removeAttribute: () => {}
    };
  };
  const context = readMissingCaptionTranscriber({
    opusState: { mono12k: null, fullAudioBuffer: null, fileUrl: 'blob:local-video', durationSec: 6 },
    document: { createElement: tag => { assert.equal(tag, 'video'); return makeVideoElement(); } },
    setTimeout,
    clearTimeout,
    extractSingleChunkStreaming: async (_media, startSec, endSec) => {
      extractedCuts.push([startSec, endSec]);
      return { base64: 'captured-cut-audio', audioMime: 'audio/webm', seconds: endSec - startSec };
    },
    fetch: async (_url, options) => {
      const body = JSON.parse(options.body);
      requests.push(body);
      return {
        ok: true,
        json: async () => ({
          text: 'fala real do trecho',
          segments: [
            { inicio: 1.1, fim: 1.3, texto: 'fala' },
            { inicio: 1.35, fim: 1.55, texto: 'real' },
            { inicio: 1.6, fim: 1.7, texto: 'do' },
            { inicio: 1.75, fim: 1.95, texto: 'trecho' }
          ],
          timingGranularity: 'word'
        })
      };
    }
  });
  const clip = { startSec: 1, endSec: 3, captionText: '' };

  const synchronized = await context.recoverMissingCaptions([clip], true);

  assert.equal(synchronized, 1);
  assert.deepEqual(extractedCuts, [[1, 3]]);
  assert.equal(requests[0].audioBase64, 'captured-cut-audio');
  assert.equal(requests[0].audioMime, 'audio/webm');
  assert.equal(clip.captionText, 'fala real do trecho');
  assert.equal(context.hasWordTiming(clip), true);
  assert.equal(clip.captionAudioSyncVerified, true);
});

test('forced synchronization refreshes word timings even when old timings look valid but are offset', async () => {
  const context = readMissingCaptionTranscriber({
    opusState: { mono12k: new Float32Array(12000 * 6).fill(0.2), fullAudioBuffer: null },
    encodeWavMono: samples => new Uint8Array(samples.length * 2 + 44),
    bytesToBase64: bytes => `wav-${bytes.length}`,
    fetch: async (_url, options) => {
      const body = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          text: 'Fala real do trecho',
          segments: [
            { inicio: body.offsetSec + 0.10, fim: body.offsetSec + 0.28, texto: 'Fala' },
            { inicio: body.offsetSec + 0.30, fim: body.offsetSec + 0.48, texto: 'real' },
            { inicio: body.offsetSec + 0.50, fim: body.offsetSec + 0.62, texto: 'do' },
            { inicio: body.offsetSec + 0.64, fim: body.offsetSec + 0.95, texto: 'trecho' }
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
    subSegments: [
      { inicio: 0.10, fim: 0.28, texto: 'Fala' },
      { inicio: 0.30, fim: 0.48, texto: 'real' },
      { inicio: 0.50, fim: 0.62, texto: 'do' },
      { inicio: 0.64, fim: 0.95, texto: 'trecho' }
    ]
  };

  assert.equal(context.hasWordTiming(clip), true);
  const synchronized = await context.recoverMissingCaptions([clip], true);

  assert.equal(synchronized, 1);
  assert.equal(clip.captionText, 'Fala real do trecho');
  assert.equal(clip.subSegments[0].inicio, 2.1);
  assert.equal(clip.subSegments[3].fim, 2.95);
  assert.equal(clip.captionAudioSyncVerified, true);
});

test('forced synchronization drops stale word times if the audio recheck returns no timings', async () => {
  const context = readMissingCaptionTranscriber({
    opusState: { mono12k: new Float32Array(12000 * 5).fill(0.2), fullAudioBuffer: null },
    encodeWavMono: samples => new Uint8Array(samples.length * 2 + 44),
    bytesToBase64: bytes => `wav-${bytes.length}`,
    fetch: async () => ({
      ok: true,
      json: async () => ({ text: 'fala real do trecho', segments: [], timingGranularity: 'estimated' })
    })
  });
  const clip = {
    startSec: 1,
    endSec: 4,
    captionText: 'fala real do trecho',
    subSegments: [
      { inicio: 1.1, fim: 1.3, texto: 'fala' },
      { inicio: 1.4, fim: 1.6, texto: 'real' },
      { inicio: 1.7, fim: 1.8, texto: 'do' },
      { inicio: 1.9, fim: 2.2, texto: 'trecho' }
    ]
  };

  const synchronized = await context.recoverMissingCaptions([clip], true);

  assert.equal(synchronized, 0);
  assert.deepEqual(Array.from(clip.subSegments), []);
  assert.equal(clip.captionTimingGranularity, 'none');
  assert.equal(clip.captionAudioSyncVerified, false);
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
