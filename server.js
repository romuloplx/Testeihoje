require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Storage setup ---
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

function loadProjects() {
  try {
    if (fs.existsSync(PROJECTS_FILE)) {
      return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
    }
  } catch (e) { console.error('load error', e); }
  return [];
}
function saveProjects(projects) {
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}

let projects = loadProjects();

// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Helpers: Mock AI ---
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

  // Generate structured script
  const intro = `**TÍTULO:** ${titulo}\n**DURAÇÃO:** ${dur} minutos | **ESTILO:** ${estiloMap[style] || style} | **VOZ:** ${vozMap[voice] || voice}`;

  const roteiro = [
    `🎬 CENA 1 — ABERTURA (0:00 - 1:30)\nNarração: "Bem-vindos a uma jornada fascinante sobre ${prompt.toLowerCase()}. Prepare-se para descobrir o que ninguém te contou."`,
    `🎬 CENA 2 — CONTEXTO (1:30 - ${Math.round(dur*0.35)}:00)\nNarração: "Tudo começou quando cientistas perceberam que ${prompt.toLowerCase()} escondia segredos que mudariam nossa visão de mundo. Vamos voltar no tempo para entender o porquê."`,
    `🎬 CENA 3 — DESENVOLVIMENTO (${Math.round(dur*0.35)}:00 - ${Math.round(dur*0.75)}:00)\nNarração: "Com evidências impressionantes e relatos exclusivos, mergulhamos no coração do tema. Cada detalhe revela uma nova camada desta história."`,
    `🎬 CENA 4 — CLÍMAX (${Math.round(dur*0.75)}:00 - ${Math.round(dur*0.9)}:00)\nNarração: "E então, a grande revelação: o que parecia impossível se torna claro. ${prompt} nunca mais será visto da mesma forma."`,
    `🎬 CENA 5 — ENCERRAMENTO (${Math.round(dur*0.9)}:00 - ${dur}:00)\nNarração: "Se você gostou, deixe seu like e comente o que achou. Esta foi mais uma produção DubAI PRO — onde sua ideia vira cinema."`,
  ];

  const full = `${intro}\n\n${roteiro.join('\n\n')}\n\n—\n💡 DICA: Este é um roteiro MOCK gerado localmente. Configure OPENAI_API_KEY no .env para geração real com GPT-4o.\n📊 Total de ${cenas} cenas planejadas | Narração ~${dur*130} palavras | Pronto para TTS e renderização.`;

  return {
    title: titulo,
    script: full,
    scenes: roteiro,
    meta: { estilo: estiloMap[style], voz: vozMap[voice], cenas, dur }
  };
}

function mockDubResult({ originalName, language, dubVoice }) {
  const langMap = { en: 'Inglês', es: 'Espanhol', fr: 'Francês', ja: 'Japonês', ko: 'Coreano', de: 'Alemão', it: 'Italiano', '': 'Auto-detectado' };
  const voiceMap = { onyx: 'Masculina', nova: 'Feminina', alloy: 'Neutra' };
  return {
    transcription: `[MOCK] Transcrição original de "${originalName}" (${langMap[language] || 'Auto'}):\n"Hello world, this is an amazing video about artificial intelligence and the future of content creation. We are dubbing it to Brazilian Portuguese."`,
    translation: `[MOCK] Tradução PT-BR:\n"Olá mundo, este é um vídeo incrível sobre inteligência artificial e o futuro da criação de conteúdo. Estamos dublando para português brasileiro."`,
    dubInfo: `Dublagem em PT-BR com voz ${voiceMap[dubVoice] || dubVoice} • Sincronia labial simulada • Pronto para download.\n💡 Configure OPENAI_API_KEY para usar Whisper + GPT + TTS reais.`
  };
}

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

    const chat = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Você é um tradutor profissional de dublagem. Traduza a fala para o idioma alvo de forma natural, pronta para locução (TTS). Não adicione comentários nem explicações — devolva APENAS a tradução.' },
        { role: 'user', content: `Traduza para ${targetLanguage}:\n\n${originalText}` }
      ],
      temperature: 0.3,
      max_tokens: 4000
    });
    const translatedText = (chat.choices[0].message.content || '').trim();

    const parts = [];
    let current = '';
    for (const sentence of translatedText.split(/(?<=[.!?…])\s+/)) {
      if (current && (current + ' ' + sentence).length > 3900) { parts.push(current); current = sentence; }
      else current = current ? current + ' ' + sentence : sentence;
    }
    if (current) parts.push(current);

    const mp3Parts = [];
    for (const part of parts) {
      const speech = await openai.audio.speech.create({
        model: 'tts-1',
        voice: TTS_VOICES[dubVoice] || 'onyx',
        input: part,
        response_format: 'mp3'
      });
      mp3Parts.push(Buffer.from(await speech.arrayBuffer()));
    }

    return {
      transcription: originalText,
      translation: translatedText,
      dubInfo: `Dublagem em ${targetLanguage} gerada com IA (Whisper + GPT + TTS) • Voz: ${dubVoice} • Áudio pronto para download.`,
      audioMp3Base64: Buffer.concat(mp3Parts).toString('base64')
    };
  } catch (e) {
    console.error('OpenAI dub error:', e.message);
    return { error: (e.status ? `HTTP ${e.status} — ` : '') + e.message };
  }
}

const TTS_VOICES = { onyx: 'onyx', nova: 'nova', alloy: 'alloy', echo: 'echo', fable: 'fable', shimmer: 'shimmer', ash: 'ash', coral: 'coral', sage: 'sage' };

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

async function generateCreateFull({ prompt, duration, style, voice }) {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const dur = parseInt(duration) || 10;
    const nScenes = Math.max(5, Math.min(10, Math.round(dur / 1.5)));

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Você é roteirista e diretor de vídeos para YouTube. Responda APENAS JSON válido neste formato: {"script":"roteiro completo em markdown","scenes":[{"title":"título da cena","narration":"texto falado da cena","visual":"descrição visual detalhada para gerar uma imagem da cena"}],"seo":{"title":"título para YouTube (até 70 caracteres)","description":"descrição com hashtags","tags":"tag1, tag2, tag3"}}. O array scenes deve ter exatamente o número de cenas pedido. As narrações somadas devem ter a quantidade de palavras indicada.' },
        { role: 'user', content: `Crie o roteiro de um vídeo de ${dur} minutos sobre: "${prompt}".\nEstilo visual: ${style}\nNúmero de cenas: ${nScenes} (uma imagem será gerada por cena).\nNarração total: ~${dur * 130} palavras (${Math.round(dur * 130 / nScenes)} palavras por cena).\nIdioma: português brasileiro.` }
      ],
      temperature: 0.8,
      max_tokens: 8000
    });

    const parsed = JSON.parse(completion.choices[0].message.content);
    if (!Array.isArray(parsed.scenes) || !parsed.scenes.length) return { error: 'GPT não retornou cenas válidas.' };

    const per = (dur * 60) / parsed.scenes.length;
    parsed.scenes = parsed.scenes.map((s, idx) => ({
      i: idx + 1,
      title: String(s.title || `Cena ${idx + 1}`),
      narration: String(s.narration || ''),
      visual: String(s.visual || s.title || prompt),
      start: Math.round(idx * per),
      end: Math.round((idx + 1) * per)
    }));
    parsed.script = String(parsed.script || parsed.scenes.map(s => `**CENA ${s.i} — ${s.title}**\n${s.narration}`).join('\n\n'));
    parsed.seo = parsed.seo || {};
    return { data: parsed };
  } catch (e) {
    console.error('OpenAI create error:', e.message);
    return { error: (e.status ? `HTTP ${e.status} — ` : '') + e.message };
  }
}

async function generateSceneImage({ prompt, style }) {
  if (!process.env.OPENAI_API_KEY) return { error: 'OPENAI_API_KEY não definida.' };
  const OpenAI = require('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const fullPrompt = `${style || 'cinematográfico'}, ${prompt}, 16:9 video scene, high quality, detailed, no text, no watermark, no captions`;
  const attempts = [
    { model: 'gpt-image-1', size: '1536x1024', quality: 'medium', n: 1, output_format: 'jpeg' },
    { model: 'gpt-image-1', size: '1536x1024', quality: 'medium', n: 1 },
    { model: 'dall-e-3', size: '1792x1024', quality: 'standard', n: 1, response_format: 'b64_json' }
  ];
  let lastError = 'sem resposta';
  for (const opts of attempts) {
    try {
      const img = await openai.images.generate({ prompt: fullPrompt, ...opts });
      const b64 = img.data[0].b64_json;
      if (!b64) { lastError = `${opts.model}: resposta sem imagem`; continue; }
      const mime = opts.output_format === 'jpeg' ? 'image/jpeg' : 'image/png';
      return { imageBase64: b64, mime, model: opts.model };
    } catch (e) {
      console.error(`Image error (${opts.model}):`, e.message);
      lastError = `${opts.model}: ${(e.status ? 'HTTP ' + e.status + ' — ' : '')}${e.message}`;
    }
  }
  return { error: lastError };
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

// --- API Routes ---

app.get('/api/health', async (req, res) => {
  const out = { ok: true, mode: process.env.OPENAI_API_KEY ? 'openai' : 'mock', projects: projects.length, uptime: process.uptime() };
  if (String(req.query.check) === '1') {
    const { probeOpenAI } = require('./vercel/api/lib/ai');
    out.openaiCheck = await probeOpenAI();
  }
  res.json(out);
});

app.get('/api/projects', (req, res) => {
  res.json(projects);
});

app.get('/api/projects/:id', (req, res) => {
  const p = projects.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Projeto não encontrado' });
  res.json(p);
});

app.delete('/api/projects/:id', (req, res) => {
  const idx = projects.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Projeto não encontrado' });
  const removed = projects.splice(idx, 1)[0];
  saveProjects(projects);
  res.json({ ok: true, removed });
});

app.post('/api/create', async (req, res) => {
  const { prompt, duration, style, voice } = req.body;

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: 'Descreva o vídeo primeiro.' });
  }
  if (prompt.length > 2000) {
    return res.status(400).json({ error: 'Descrição muito longa (máx 2000 caracteres).' });
  }

  // Try OpenAI first, fallback to mock
  let data = null;
  let mode = 'mock';
  let aiError = null;

  const gen = await require('./vercel/api/lib/ai').generateCreateFull({ prompt, duration, style, voice });
  if (gen && gen.data) {
    data = gen.data;
    mode = 'openai';
  } else {
    aiError = (gen && gen.error) || 'sem OPENAI_API_KEY';
    data = mockCreateFull({ prompt, duration, style, voice });
  }
  const scriptText = data.script;
  const scriptMeta = data.meta || null;

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const project = {
    id,
    type: 'create',
    prompt: prompt.trim(),
    title: prompt.trim().slice(0, 80),
    duration: String(duration || '10'),
    style: style || 'realistic',
    voice: voice || 'onyx',
    script: scriptText,
    scenes: data.scenes,
    seo: data.seo,
    meta: scriptMeta,
    mode,
    status: 'roteiro_pronto',
    createdAt: new Date().toISOString(),
    thumbnail: `https://picsum.photos/seed/${id}/640/360`
  };

  projects.unshift(project);
  saveProjects(projects);

  res.json({
    id: project.id,
    script: project.script,
    scenes: data.scenes,
    seo: data.seo,
    project,
    mode,
    warning: mode === 'openai' ? undefined : `A IA real não respondeu (${aiError}). O roteiro abaixo é SIMULADO.`,
    message: mode === 'openai' ? 'Roteiro + cenas + SEO gerados com GPT-4o' : `⚠️ IA real falhou (${aiError}) — roteiro simulado gerado.`
  });
});

app.post('/api/scene-image', async (req, res) => {
  try {
    const { prompt, style } = req.body || {};
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Descreva a cena.' });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.json({ imageBase64: null, mock: true, message: 'Sem OPENAI_API_KEY: imagem placeholder será usada.' });
    }
    const img = await require('./vercel/api/lib/ai').generateSceneImage({ prompt, style });
    if (!img || !img.imageBase64) {
      return res.json({ imageBase64: null, mock: true, error: img && img.error, message: 'Geração de imagem falhou' + (img && img.error ? ` (${img.error})` : '') + ' — placeholder será usado.' });
    }
    res.json({ imageBase64: img.imageBase64, mime: img.mime, model: img.model });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao gerar imagem: ' + e.message });
  }
});

app.post('/api/dub', async (req, res) => {
  try {
    const { fileName, fileSize, language = '', dubVoice = 'onyx', targetLanguage = 'pt-BR', audioBase64 } = req.body || {};
    if (!fileName) {
      return res.status(400).json({ error: 'Selecione um vídeo.' });
    }

    let result = null;
    if (audioBase64) {
      if (!process.env.OPENAI_API_KEY) {
        return res.status(400).json({ error: 'Configure OPENAI_API_KEY no servidor para dublagem real.' });
      }
      result = await require('./vercel/api/lib/ai').dubWithOpenAI({ audioBase64, language, dubVoice, targetLanguage });
      if (!result || result.error) {
        return res.status(502).json({ error: 'Falha ao dublar com a OpenAI' + (result && result.error ? `: ${result.error}` : ' (transcrição/tradução/voz)') + '. Tente com um arquivo menor ou tente novamente.' });
      }
    }
    const mock = result ? null : mockDubResult({ originalName: fileName, language, dubVoice });

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const project = {
      id,
      type: 'dub',
      title: `Dublagem: ${fileName}`,
      prompt: `Dublagem de ${fileName} para PT-BR`,
      fileName,
      fileSize: Number(fileSize) || 0,
      language: language || 'auto',
      dubVoice,
      transcription: result ? result.transcription : mock.transcription,
      translation: result ? result.translation : mock.translation,
      dubInfo: result ? result.dubInfo : mock.dubInfo,
      script: result ? `${result.transcription}\n\n${result.translation}\n\n${result.dubInfo}` : `${mock.transcription}\n\n${mock.translation}\n\n${mock.dubInfo}`,
      status: 'dublado',
      mode: result ? 'openai' : 'mock',
      createdAt: new Date().toISOString(),
      thumbnail: `https://picsum.photos/seed/dub-${id}/640/360`
    };

    projects.unshift(project);
    saveProjects(projects);

    res.json({
      id: project.id,
      project,
      audioBase64: result ? result.audioMp3Base64 : null,
      message: result ? 'Vídeo traduzido e dublado em PT-BR (Whisper + GPT + TTS).' : 'Modo simulação (sem áudio real).'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro no processamento: ' + e.message });
  }
});

// TTS endpoint — cadeia de provedores (OpenAI → Google → StreamElements)
app.post('/api/tts', async (req, res) => {
  const { text, voice = 'onyx', lang = 'pt-BR' } = req.body;
  if (!text) return res.status(400).json({ error: 'Texto vazio' });

  try {
    const out = await require('./vercel/api/lib/ai').ttsWithFallback({ text, voice, lang });
    if (out.error) {
      return res.status(502).json({ error: 'Voz falhou em todos os provedores: ' + out.error, fallback: 'browser' });
    }
    res.set({
      'Content-Type': 'audio/mpeg',
      'X-Audio-Provider': out.provider,
      'Content-Disposition': 'inline; filename="narracao.mp3"',
      'Content-Length': out.buffer.length
    });
    res.send(out.buffer);
  } catch (e) {
    console.error('TTS error', e);
    res.status(500).json({ error: 'Erro TTS: ' + e.message, fallback: 'browser' });
  }
});

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡ DubAI PRO rodando em http://0.0.0.0:${PORT}`);
  console.log(`   Modo: ${process.env.OPENAI_API_KEY ? 'OpenAI REAL' : 'MOCK local (defina OPENAI_API_KEY para IA real)'}`);
  console.log(`   Projetos: ${projects.length} carregados`);
});
