// Lógica de IA compartilhada pelas funções serverless

const TTS_VOICES = {
  onyx: 'onyx', nova: 'nova', alloy: 'alloy', echo: 'echo', fable: 'fable',
  shimmer: 'shimmer', ash: 'ash', coral: 'coral', sage: 'sage'
};

function mockScript({ prompt, duration, style, voice }) {
  const estiloMap = {
    realistic: 'Pessoas realistas em 4K, iluminação natural',
    cinematic: 'Cinematográfico, lente anamórfica, profundidade de campo',
    animation: 'Animação estilo Pixar, cores vibrantes',
    documentary: 'Documentário National Geographic, câmera estável',
    images: 'Slideshow com imagens + narração'
  };
  const vozMap = {
    onyx: 'Masculina grave (Onyx)',
    nova: 'Feminina natural (Nova)',
    alloy: 'Neutra (Alloy)'
  };

  const dur = parseInt(duration) || 10;
  const cenas = Math.max(3, Math.round(dur * 1.2));
  const titulo = prompt.length > 60 ? prompt.slice(0, 60) + '…' : prompt;

  const intro = `**TÍTULO:** ${titulo}\n**DURAÇÃO:** ${dur} minutos | **ESTILO:** ${estiloMap[style] || style} | **VOZ:** ${vozMap[voice] || voice}`;

  const roteiro = [
    `🎬 CENA 1 — ABERTURA (0:00 - 1:30)\nNarração: "Bem-vindos a uma jornada fascinante sobre ${prompt.toLowerCase()}. Prepare-se para descobrir o que ninguém te contou."`,
    `🎬 CENA 2 — CONTEXTO (1:30 - ${Math.round(dur * 0.35)}:00)\nNarração: "Tudo começou quando cientistas perceberam que ${prompt.toLowerCase()} escondia segredos que mudariam nossa visão de mundo. Vamos voltar no tempo para entender o porquê."`,
    `🎬 CENA 3 — DESENVOLVIMENTO (${Math.round(dur * 0.35)}:00 - ${Math.round(dur * 0.75)}:00)\nNarração: "Com evidências impressionantes e relatos exclusivos, mergulhamos no coração do tema. Cada detalhe revela uma nova camada desta história."`,
    `🎬 CENA 4 — CLÍMAX (${Math.round(dur * 0.75)}:00 - ${Math.round(dur * 0.9)}:00)\nNarração: "E então, a grande revelação: o que parecia impossível se torna claro. ${prompt} nunca mais será visto da mesma forma."`,
    `🎬 CENA 5 — ENCERRAMENTO (${Math.round(dur * 0.9)}:00 - ${dur}:00)\nNarração: "Se você gostou, deixe seu like e comente o que achou. Esta foi mais uma produção DubAI PRO — onde sua ideia vira cinema."`
  ];

  const full = `${intro}\n\n${roteiro.join('\n\n')}\n\n—\n📊 Total de ${cenas} cenas planejadas | Narração ~${dur * 130} palavras | Pronto para TTS e renderização.`;

  return { title: titulo, script: full, scenes: roteiro, meta: { estilo: estiloMap[style], voz: vozMap[voice], cenas, dur } };
}

function mockCreateFull({ prompt, duration, style, voice }) {
  const m = mockScript({ prompt, duration, style, voice });
  const dur = parseInt(duration) || 10;
  const per = (dur * 60) / 5;
  const titles = ['Abertura', 'Contexto', 'Desenvolvimento', 'Clímax', 'Encerramento'];
  const narrations = [
    `Bem-vindos a uma jornada fascinante sobre ${prompt.toLowerCase()}. Prepare-se para descobrir o que ninguém te contou.`,
    `Tudo começou quando cientistas perceberam que ${prompt.toLowerCase()} escondia segredos que mudariam nossa visão de mundo. Vamos voltar no tempo para entender o porquê.`,
    `Com evidências impressionantes e relatos exclusivos, mergulhamos no coração do tema. Cada detalhe revela uma nova camada desta história.`,
    `E então, a grande revelação: o que parecia impossível se torna claro. ${prompt} nunca mais será visto da mesma forma.`,
    `Se você gostou, deixe seu like e comente o que achou. Esta foi mais uma produção DubAI PRO — onde sua ideia vira cinema.`
  ];
  const scenes = titles.map((t, i) => ({
    i: i + 1,
    title: t,
    narration: narrations[i],
    visual: `${style} — cena ${i + 1} sobre ${prompt}, cinematográfica, alta qualidade, sem texto`,
    start: Math.round(i * per),
    end: Math.round((i + 1) * per)
  }));
  return {
    script: m.script,
    scenes,
    seo: {
      title: `${prompt.slice(0, 70)} | DubAI PRO`,
      description: `Neste vídeo exploramos ${prompt}. Roteiro, imagens e narração gerados com IA pelo DubAI PRO.\n\n#ia #inteligenciaartificial #youtube`,
      tags: prompt.split(/\s+/).slice(0, 6).join(', ') + ', ia, inteligência artificial, youtube'
    },
    meta: m.meta
  };
}

function mockDubResult({ originalName, language, dubVoice }) {
  const langMap = { en: 'Inglês', es: 'Espanhol', fr: 'Francês', ja: 'Japonês', ko: 'Coreano', de: 'Alemão', it: 'Italiano', '': 'Auto-detectado' };
  const voiceMap = { onyx: 'Masculina', nova: 'Feminina', alloy: 'Neutra' };
  return {
    transcription: `[MOCK] Transcrição original de "${originalName}" (${langMap[language] || 'Auto'}):\n"Hello world, this is an amazing video about artificial intelligence and the future of content creation. We are dubbing it to Brazilian Portuguese."`,
    translation: `[MOCK] Tradução PT-BR:\n"Olá mundo, este é um vídeo incrível sobre inteligência artificial e o futuro da criação de conteúdo. Estamos dublando para português brasileiro."`,
    dubInfo: `Dublagem em PT-BR com voz ${voiceMap[dubVoice] || dubVoice} • Sincronia labial simulada • Pronto para download.\n💡 Versão demo: a dublagem real (Whisper + GPT + TTS) fica para o backend completo.`
  };
}

async function generateWithOpenAI(prompt, duration, style, voice) {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const estiloDesc = { realistic: 'pessoas realistas foto-realistas', cinematic: 'cinematográfico', animation: 'animação', documentary: 'documentário', images: 'imagens com narração' }[style] || style;
    const vozDesc = { onyx: 'masculina grave', nova: 'feminina natural', alloy: 'neutra' }[voice] || voice;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Você é um roteirista profissional de vídeos para YouTube/TikTok. Crie roteiros envolventes, com cenas cronometradas, falas de narração e descrições visuais. Responda em português brasileiro, formato markdown.' },
        { role: 'user', content: `Crie um roteiro completo de vídeo de ${duration} minutos sobre: "${prompt}".\nEstilo visual: ${estiloDesc}\nVoz de narração: ${vozDesc}\nInclua: título, hook de abertura, 4-5 cenas com timestamps, narração completa e call-to-action final.` }
      ],
      temperature: 0.8,
      max_tokens: 2000
    });
    return completion.choices[0].message.content;
  } catch (e) {
    console.error('OpenAI error:', e.message);
    return null;
  }
}

// Roteiro estruturado + cenas + SEO em 2 fases (plano → narração por cena) — robusto em qualquer modelo
async function generateCreateFull({ prompt, duration, style, voice }) {
  const dur = parseInt(duration) || 10;
  const nScenes = Math.max(5, Math.min(10, Math.round(dur / 1.5)));
  const wordsPerScene = Math.round((dur * 130) / nScenes);

  // Fase 1: plano (título + SEO + cenas com descrição visual)
  const outlineSystem = 'Você é roteirista de vídeos para YouTube. Responda APENAS JSON válido neste formato: {"title":"título do vídeo","seo":{"title":"título para YouTube (até 70 caracteres)","description":"descrição com hashtags","tags":"tag1, tag2, tag3"},"scenes":[{"title":"título curto da cena","visual":"descrição visual detalhada para gerar uma imagem da cena"}]}.';
  const outlineUser = `Crie o plano de um vídeo de ${dur} minutos sobre "${prompt}". Estilo visual: ${style}. Exatamente ${nScenes} cenas em ordem cronológica. Idioma: português brasileiro.`;
  const res = await withRetries(() => chatWithFallback({ system: outlineSystem, user: outlineUser, json: true, maxTokens: 3000 }), 2);
  if (res.error) return { error: res.error };
  const outline = extractJson(res.text);
  if (!outline || !Array.isArray(outline.scenes) || !outline.scenes.length) {
    return { error: `IA (${res.provider}) não retornou o plano de cenas válido.` };
  }
  const scenesPlan = outline.scenes.slice(0, nScenes);
  const providers = new Set([res.provider]);

  // Fase 2: narração completa de cada cena (chamadas menores = modelos grátis aguentam)
  const narrations = [];
  for (let i = 0; i < scenesPlan.length; i++) {
    const s = scenesPlan[i];
    const nres = await withRetries(() => chatWithFallback({
      system: 'Você é narrador profissional de vídeos. Escreva APENAS o texto da narração, sem título, sem aspas, sem comentários.',
      user: `Vídeo sobre: "${prompt}". Cena ${i + 1} de ${scenesPlan.length}: "${s.title}" (${s.visual || ''}). Escreva a narração desta cena em português brasileiro, com aproximadamente ${wordsPerScene} palavras, em tom envolvente.`
    }), 2);
    if (nres.error) return { error: `Narração da cena ${i + 1} falhou: ${nres.error}` };
    providers.add(nres.provider);
    narrations.push((nres.text || '').trim().replace(/^["'\s]+|["'\s]+$/g, ''));
  }

  const per = (dur * 60) / scenesPlan.length;
  const scenes = scenesPlan.map((s, idx) => ({
    i: idx + 1,
    title: String(s.title || `Cena ${idx + 1}`),
    narration: narrations[idx],
    visual: String(s.visual || s.title || prompt),
    start: Math.round(idx * per),
    end: Math.round((idx + 1) * per)
  }));
  const script = (outline.title ? `**TÍTULO:** ${outline.title}\n\n` : '') + scenes.map(s => `**CENA ${s.i} — ${s.title}**\n${s.narration}`).join('\n\n');
  return { data: { script, scenes, seo: outline.seo || {}, title: outline.title || '' }, provider: [...providers].join(' + ') };
}

// Imagem de uma cena: gpt-image-1 (jpeg → png) com fallback para DALL·E 3
async function generateSceneImage({ prompt, style }) {
  const errors = [];
  const fullPrompt = `${style || 'cinematográfico'}, ${prompt}, 16:9 video scene, high quality, detailed, no text, no watermark, no captions`;
  if (process.env.OPENAI_API_KEY) {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const attempts = [
      { model: 'gpt-image-1', size: '1536x1024', quality: 'medium', n: 1, output_format: 'jpeg' },
      { model: 'gpt-image-1', size: '1536x1024', quality: 'medium', n: 1 },
      { model: 'dall-e-3', size: '1792x1024', quality: 'standard', n: 1, response_format: 'b64_json' }
    ];
    for (const opts of attempts) {
      try {
        const img = await openai.images.generate({ prompt: fullPrompt, ...opts });
        const b64 = img.data[0].b64_json;
        if (!b64) { errors.push(`${opts.model}: resposta sem imagem`); continue; }
        const mime = opts.output_format === 'jpeg' ? 'image/jpeg' : 'image/png';
        return { imageBase64: b64, mime, model: opts.model };
      } catch (e) {
        console.error(`Image error (${opts.model}):`, e.message);
        errors.push(`${opts.model}: ${(e.status ? 'HTTP ' + e.status + ' — ' : '')}${e.message}`);
        if (e.status === 401) break;
      }
    }
  } else errors.push('openai: sem OPENAI_API_KEY');
  // Fallback gratuito: Pollinations (Flux → Turbo, com retentativa)
  for (const model of ['flux', 'turbo']) {
    for (let tent = 0; tent < 2; tent++) {
      try {
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=1280&height=720&nologo=true&seed=${Math.floor(Math.random() * 100000)}&model=${model}`;
        const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
        if (r.status === 429) { errors.push(`pollinations/${model}: HTTP 429 (limite de uso)`); await sleep(3000); continue; }
        if (!r.ok) { errors.push(`pollinations/${model}: HTTP ${r.status}`); break; }
        const buf = Buffer.from(await r.arrayBuffer());
        if (!buf.length) { errors.push(`pollinations/${model}: imagem vazia`); continue; }
        return { imageBase64: buf.toString('base64'), mime: r.headers.get('content-type') || 'image/jpeg', model: `pollinations-${model}(free)` };
      } catch (e) {
        errors.push(`pollinations/${model}: ${e.message}`);
        await sleep(1500);
      }
    }
  }
  return { error: errors.join(' | ') };
}

// Dublagem real: Whisper (transcrição) + GPT (tradução) + TTS (voz)
async function dubWithOpenAI({ audioBase64, language, dubVoice, targetLanguage = 'pt-BR' }) {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const OpenAI = require('openai');
    const { toFile } = OpenAI;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const audioBuf = Buffer.from(audioBase64, 'base64');
    const file = await toFile(audioBuf, 'audio.wav', { type: 'audio/wav' });
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: language || undefined
    });
    const originalText = (transcription.text || '').trim();
    if (!originalText) throw new Error('Não foi possível transcrever o áudio.');

    // Tradução com cadeia de provedores (GPT → IA gratuita)
    const tr = await chatWithFallback({
      system: 'Você é um tradutor profissional de dublagem. Traduza a fala para o idioma alvo de forma natural, pronta para locução (TTS). Não adicione comentários nem explicações — devolva APENAS a tradução.',
      user: `Traduza para ${targetLanguage}:\n\n${originalText}`
    });
    if (tr.error) throw new Error('Tradução falhou: ' + tr.error);
    const translatedText = (tr.text || '').trim();

    const parts = [];
    let current = '';
    for (const sentence of translatedText.split(/(?<=[.!?…])\s+/)) {
      if (current && (current + ' ' + sentence).length > 3900) { parts.push(current); current = sentence; }
      else current = current ? current + ' ' + sentence : sentence;
    }
    if (current) parts.push(current);

    // Voz com cadeia de provedores (TTS OpenAI → Google → StreamElements)
    const mp3Parts = [];
    const usedProviders = new Set();
    for (const part of parts) {
      const t = await ttsWithFallback({ text: part, voice: dubVoice, lang: targetLanguage });
      if (t.error) throw new Error('Voz falhou: ' + t.error);
      mp3Parts.push(t.buffer);
      usedProviders.add(t.provider);
    }

    return {
      transcription: originalText,
      translation: translatedText,
      dubInfo: `Dublagem em ${targetLanguage} gerada com IA • Voz: ${dubVoice} • Provedores: ${[...usedProviders].join(', ')} • Áudio pronto para download.`,
      audioMp3Base64: Buffer.concat(mp3Parts).toString('base64')
    };
  } catch (e) {
    console.error('OpenAI dub error:', e.message);
    return { error: (e.status ? `HTTP ${e.status} — ` : '') + e.message };
  }
}

// Testa candidatos de provedores gratuitos (texto/imagem/voz) — para plugar só o que funciona
async function candidatesProbe() {
  const out = { text: {}, image: {}, tts: {} };
  const t = async (name, fn) => { try { out.text[name] = await fn(); } catch (e) { out.text[name] = { ok: false, error: e.message }; } };
  await t('pollinationsBare', async () => {
    const r = await fetch('https://text.pollinations.ai/' + encodeURIComponent('responda apenas: ok'), { signal: AbortSignal.timeout(20000) });
    return { ok: r.ok, status: r.status, sample: r.ok ? (await r.text()).slice(0, 20) : '' };
  });
  await t('pollinationsOpenai', async () => {
    const r = await fetch('https://text.pollinations.ai/' + encodeURIComponent('responda apenas: ok') + '?model=openai', { signal: AbortSignal.timeout(20000) });
    return { ok: r.ok, status: r.status, sample: r.ok ? (await r.text()).slice(0, 20) : '' };
  });
  await t('pollinationsPost', async () => {
    const r = await fetch('https://text.pollinations.ai/openai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'openai', messages: [{ role: 'user', content: 'responda apenas: ok' }] }), signal: AbortSignal.timeout(25000) });
    let sample = ''; try { const j = await r.json(); sample = j.choices ? (j.choices[0].message.content || '').slice(0, 20) : JSON.stringify(j).slice(0, 60); } catch (e) {}
    return { ok: r.ok, status: r.status, sample };
  });
  await t('hackclub', async () => {
    const r = await fetch('https://ai.hackclub.com/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'responda apenas: ok' }] }), signal: AbortSignal.timeout(25000) });
    let sample = ''; try { const j = await r.json(); sample = j.choices ? (j.choices[0].message.content || '').slice(0, 20) : JSON.stringify(j).slice(0, 60); } catch (e) {}
    return { ok: r.ok && !!sample, status: r.status, sample };
  });
  for (const [name, url] of [
    ['pollinations256', 'https://image.pollinations.ai/prompt/a%20red%20apple?width=256&height=256&nologo=true&seed=1'],
    ['pollinations1024', 'https://image.pollinations.ai/prompt/a%20red%20apple?width=1024&height=576&nologo=true&seed=2'],
    ['loremflickr', 'https://loremflickr.com/640/360/cat'],
    ['picsum', 'https://picsum.photos/seed/abc/640/360']
  ]) {
    try {
      const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(40000) });
      const b = r.ok ? Buffer.from(await r.arrayBuffer()) : Buffer.alloc(0);
      out.image[name] = { ok: r.ok && b.length > 1000, status: r.status, bytes: b.length };
    } catch (e) { out.image[name] = { ok: false, error: e.message }; }
  }
  try {
    const r = await fetch('https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=hello%20world', { signal: AbortSignal.timeout(15000) });
    const b = r.ok ? Buffer.from(await r.arrayBuffer()) : Buffer.alloc(0);
    out.tts.streamelements = { ok: r.ok && b.length > 0, status: r.status, bytes: b.length };
  } catch (e) { out.tts.streamelements = { ok: false, error: e.message }; }
  return out;
}

// Teste do pipeline REAL (roteiro 5 min + voz + imagem) — igual à produção
async function fullPipelineProbe() {
  const out = {};
  try {
    const c = await generateCreateFull({ prompt: 'a história dos gatos', duration: 5, style: 'cinematic', voice: 'nova' });
    out.create = c.error ? { ok: false, error: c.error } : { ok: true, provider: c.provider, scenes: c.data.scenes.length, palavras: c.data.scenes.reduce((n, s) => n + String(s.narration || '').split(/\s+/).length, 0) };
  } catch (e) { out.create = { ok: false, error: e.message }; }
  try {
    const t = await ttsWithFallback({ text: 'Esta é uma prova de narração do DubAI PRO com tamanho realista para validar a voz em produção, com várias palavras para simular uma cena inteira.', voice: 'nova', lang: 'pt-BR' });
    out.tts = t.error ? { ok: false, error: t.error } : { ok: true, provider: t.provider, bytes: t.buffer.length };
  } catch (e) { out.tts = { ok: false, error: e.message }; }
  try {
    const img = await generateSceneImage({ prompt: 'um gato astronauta na lua, cinematográfico', style: 'cinematic' });
    out.image = img.error ? { ok: false, error: img.error } : { ok: true, model: img.model, kb: Math.round((img.imageBase64 || '').length * 0.75 / 1024) };
  } catch (e) { out.image = { ok: false, error: e.message }; }
  return out;
}

// Sonda de diagnóstico: testa modelos, chat e TTS e devolve o resultado de cada um
async function probeOpenAI() {
  const report = { keyPresent: !!process.env.OPENAI_API_KEY };
  if (!report.keyPresent) return report;
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    try {
      const models = await openai.models.list();
      report.models = { ok: true, count: (models.data || []).length };
    } catch (e) { report.models = { ok: false, status: e.status, error: e.message }; }
    try {
      const c = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'responda apenas: ok' }], max_tokens: 5 });
      report.chat = { ok: true, reply: (c.choices[0].message.content || '').slice(0, 30) };
    } catch (e) { report.chat = { ok: false, status: e.status, error: e.message }; }
    try {
      const s = await openai.audio.speech.create({ model: 'tts-1', voice: 'onyx', input: 'olá', response_format: 'mp3' });
      const b = Buffer.from(await s.arrayBuffer());
      report.tts = { ok: true, bytes: b.length };
    } catch (e) { report.tts = { ok: false, status: e.status, error: e.message }; }
    try {
      const img = await openai.images.generate({ model: 'dall-e-3', prompt: 'um gato astronauta, cartoon', n: 1, size: '1024x1024', response_format: 'b64_json' });
      report.image = { ok: true, bytes: img.data[0].b64_json ? img.data[0].b64_json.length : 0 };
    } catch (e) { report.image = { ok: false, status: e.status, error: e.message }; }
  } catch (e) {
    report.sdk = { ok: false, error: e.message };
  }
  // Teste dos provedores gratuitos (fallback)
  try {
    const t = await chatViaPollinations({ user: 'responda apenas: ok', json: false });
    report.pollinationsText = { ok: true, reply: t.slice(0, 30) };
  } catch (e) { report.pollinationsText = { ok: false, error: e.message }; }
  try {
    const r = await fetch('https://image.pollinations.ai/prompt/a%20red%20apple?width=256&height=256&nologo=true&seed=1', { signal: AbortSignal.timeout(60000) });
    const b = r.ok ? Buffer.from(await r.arrayBuffer()) : Buffer.alloc(0);
    report.pollinationsImage = { ok: r.ok && b.length > 0, status: r.status, bytes: b.length };
  } catch (e) { report.pollinationsImage = { ok: false, error: e.message }; }
  try {
    const b = await ttsGoogle({ text: 'olá', lang: 'pt-BR' });
    report.googleTts = { ok: true, bytes: b.length };
  } catch (e) { report.googleTts = { ok: false, error: e.message }; }
  return report;
}

// ============ CADEIA DE PROVEDORES (fallback automático) ============
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Repete a cadeia em caso de falha (provedores gratuitos limitam rajadas)
async function withRetries(fn, times = 2) {
  let last = { error: 'sem tentativas' };
  for (let i = 0; i < times; i++) {
    last = await fn();
    if (!last.error) return last;
    if (i < times - 1) await sleep(2500);
  }
  return last;
}

function extractJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) {}
  const m = String(text).match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}

// Texto gratuito (sem chave): Pollinations (com retentativas e modelos alternativos)
async function chatViaPollinations({ system, user, json }) {
  const prompt = (system ? system + '\n\n' : '') + user + (json ? '\n\nResponda APENAS JSON válido, sem comentários nem markdown.' : '');
  const urls = [
    'https://text.pollinations.ai/' + encodeURIComponent(prompt) + '?model=openai',
    'https://text.pollinations.ai/' + encodeURIComponent(prompt) + '?model=mistral',
    'https://text.pollinations.ai/' + encodeURIComponent(prompt)
  ];
  let lastErr = new Error('pollinations indisponível');
  for (const url of urls) {
    for (let tent = 0; tent < 2; tent++) {
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(45000) });
        if (r.status === 429) { lastErr = new Error('HTTP 429 (limite de uso)'); await sleep(3000); continue; }
        if (!r.ok) { lastErr = new Error('HTTP ' + r.status); break; }
        const text = (await r.text()).trim();
        if (!text) { lastErr = new Error('resposta vazia'); continue; }
        return text;
      } catch (e) { lastErr = e; await sleep(1500); }
    }
  }
  throw lastErr;
}

// Chat com cadeia: OpenAI (vários modelos) → Pollinations
async function chatWithFallback({ system, user, json = false, maxTokens = 8000 }) {
  const errors = [];
  if (process.env.OPENAI_API_KEY) {
    for (const model of ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo']) {
      try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const body = {
          model,
          messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: user }],
          temperature: 0.8,
          max_tokens: model === 'gpt-3.5-turbo' ? 4000 : maxTokens
        };
        if (json && model !== 'gpt-3.5-turbo') body.response_format = { type: 'json_object' };
        const c = await openai.chat.completions.create(body);
        const text = (c.choices[0].message.content || '').trim();
        if (!text) throw new Error('resposta vazia');
        return { text, provider: 'openai/' + model };
      } catch (e) {
        errors.push(`openai/${model}: ${(e.status ? 'HTTP ' + e.status + ' — ' : '')}${e.message}`);
        if (e.status === 401) break; // chave inválida: não adianta trocar de modelo
      }
    }
  } else errors.push('openai: sem OPENAI_API_KEY');
  try {
    const text = await chatViaPollinations({ system, user, json });
    return { text, provider: 'pollinations(free)' };
  } catch (e) {
    errors.push('pollinations: ' + e.message);
  }
  return { error: errors.join(' | '), errors };
}

// Voz gratuita: Google Translate TTS (limitado, mas funciona sem chave)
async function ttsGoogle({ text, lang = 'pt' }) {
  const chunks = [];
  let cur = '';
  for (const word of String(text).split(/\s+/)) {
    if ((cur + ' ' + word).trim().length > 170) { chunks.push(cur.trim()); cur = word; }
    else cur = (cur ? cur + ' ' : '') + word;
  }
  if (cur.trim()) chunks.push(cur.trim());
  const parts = [];
  for (const ch of chunks.slice(0, 40)) {
    const url = 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=' + encodeURIComponent(lang) + '&q=' + encodeURIComponent(ch);
    let ok = false, lastErr = new Error('google-tts indisponível');
    for (let tent = 0; tent < 3 && !ok; tent++) {
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (r.status === 429) { lastErr = new Error('HTTP 429 (limite de uso)'); await sleep(2500); continue; }
        if (!r.ok) { lastErr = new Error('HTTP ' + r.status); break; }
        const b = Buffer.from(await r.arrayBuffer());
        if (!b.length) { lastErr = new Error('áudio vazio'); continue; }
        parts.push(b); ok = true;
      } catch (e) { lastErr = e; await sleep(1200); }
    }
    if (!ok) throw lastErr;
    await sleep(350);
  }
  return Buffer.concat(parts);
}

// Voz gratuita alternativa: StreamElements (inglês)
async function ttsStreamElements({ text, voice = 'Brian' }) {
  const url = 'https://api.streamelements.com/kappa/v2/speech?voice=' + encodeURIComponent(voice) + '&text=' + encodeURIComponent(String(text).slice(0, 1200));
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const b = Buffer.from(await r.arrayBuffer());
  if (!b.length) throw new Error('áudio vazio');
  return b;
}

const TTS_LANGS = { 'pt-BR': 'pt-BR', pt: 'pt-BR', en: 'en', es: 'es', fr: 'fr', de: 'de', it: 'it' };

// Voz com cadeia: OpenAI tts-1 → tts-1-hd → Google → StreamElements
async function ttsWithFallback({ text, voice = 'onyx', lang = 'pt-BR' }) {
  const errors = [];
  if (process.env.OPENAI_API_KEY) {
    for (const model of ['tts-1', 'tts-1-hd']) {
      try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const s = await openai.audio.speech.create({ model, voice: TTS_VOICES[voice] || 'onyx', input: String(text).slice(0, 4096), response_format: 'mp3' });
        const b = Buffer.from(await s.arrayBuffer());
        if (!b.length) throw new Error('áudio vazio');
        return { buffer: b, provider: 'openai/' + model };
      } catch (e) {
        errors.push(`openai/${model}: ${(e.status ? 'HTTP ' + e.status + ' — ' : '')}${e.message}`);
        if (e.status === 401) break;
      }
    }
  } else errors.push('openai: sem OPENAI_API_KEY');
  try {
    const b = await ttsGoogle({ text, lang: TTS_LANGS[lang] || 'pt-BR' });
    return { buffer: b, provider: 'google-tts(free)' };
  } catch (e) { errors.push('google-tts: ' + e.message); }
  try {
    const b = await ttsStreamElements({ text });
    return { buffer: b, provider: 'streamelements(free)' };
  } catch (e) { errors.push('streamelements: ' + e.message); }
  return { error: errors.join(' | '), errors };
}

// Leitura compatível do body (runtime antigo e novo do Vercel)
async function getBody(req) {
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) return req.body;
  try { if (typeof req.json === 'function') return await req.json(); } catch (e) {}
  try {
    const text = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', c => (data += c));
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
    return text ? JSON.parse(text) : {};
  } catch (e) {
    return {};
  }
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(obj));
}

module.exports = {
  TTS_VOICES, mockScript, mockCreateFull, mockDubResult,
  generateWithOpenAI, generateCreateFull, generateSceneImage, dubWithOpenAI,
  chatWithFallback, ttsWithFallback, chatViaPollinations, ttsGoogle, ttsStreamElements,
  probeOpenAI, fullPipelineProbe, candidatesProbe, getBody, send
};
