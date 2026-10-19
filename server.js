require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Storage setup ---
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

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

// Multer for dub uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `dub-${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // accept video/audio
    if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/') || file.mimetype === 'application/octet-stream') cb(null, true);
    else cb(null, true); // allow anyway for demo
  }
});

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

app.get('/api/health', (req, res) => {
  res.json({ ok: true, mode: process.env.OPENAI_API_KEY ? 'openai' : 'mock', projects: projects.length, uptime: process.uptime() });
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
  // try delete upload file if exists
  if (removed.filePath && fs.existsSync(removed.filePath)) {
    try { fs.unlinkSync(removed.filePath); } catch {}
  }
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
  let scriptText = null;
  let scriptMeta = null;
  let mode = 'mock';

  const openaiScript = await generateWithOpenAI(prompt, duration, style, voice);
  if (openaiScript) {
    scriptText = openaiScript;
    mode = 'openai';
  } else {
    const mocked = mockScript({ prompt, duration, style, voice });
    scriptText = mocked.script;
    scriptMeta = mocked.meta;
  }

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
    project,
    message: mode === 'openai' ? 'Roteiro gerado com GPT-4o' : 'Roteiro MOCK gerado localmente (defina OPENAI_API_KEY para IA real)'
  });
});

app.post('/api/dub', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Selecione um vídeo.' });
    }
    const { language = '', dubVoice = 'onyx' } = req.body;

    const mock = mockDubResult({ originalName: req.file.originalname, language, dubVoice });

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const project = {
      id,
      type: 'dub',
      title: `Dublagem: ${req.file.originalname}`,
      prompt: `Dublagem de ${req.file.originalname} para PT-BR`,
      fileName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      language: language || 'auto',
      dubVoice,
      transcription: mock.transcription,
      translation: mock.translation,
      dubInfo: mock.dubInfo,
      script: `${mock.transcription}\n\n${mock.translation}\n\n${mock.dubInfo}`,
      status: 'dublado',
      mode: process.env.OPENAI_API_KEY ? 'openai' : 'mock',
      createdAt: new Date().toISOString(),
      thumbnail: `https://picsum.photos/seed/dub-${id}/640/360`
    };

    projects.unshift(project);
    saveProjects(projects);

    res.json({
      id: project.id,
      project,
      message: 'Vídeo recebido e dublado (MOCK). Configure OPENAI_API_KEY para Whisper+TTS real.'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro no processamento: ' + e.message });
  }
});

// TTS endpoint — tenta OpenAI, senão instrui frontend a usar Web Speech API
app.post('/api/tts', async (req, res) => {
  const { text, voice = 'onyx' } = req.body;
  if (!text) return res.status(400).json({ error: 'Texto vazio' });

  if (!process.env.OPENAI_API_KEY) {
    return res.json({
      mode: 'browser',
      message: 'Modo browser: use speechSynthesis no frontend. Defina OPENAI_API_KEY para TTS em MP3 real.',
      useBrowserTTS: true
    });
  }

  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const voiceMap = { onyx: 'onyx', nova: 'nova', alloy: 'alloy', echo: 'echo', fable: 'fable', shimmer: 'shimmer' };
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voiceMap[voice] || 'onyx',
      input: text.slice(0, 4096),
      response_format: 'mp3'
    });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': 'inline; filename="narracao.mp3"',
      'Content-Length': buffer.length
    });
    res.send(buffer);
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
