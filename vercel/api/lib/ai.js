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

// Roteiro estruturado + cenas + SEO em uma chamada (JSON mode)
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
    if (!Array.isArray(parsed.scenes) || !parsed.scenes.length) return null;

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
    return parsed;
  } catch (e) {
    console.error('OpenAI create error:', e.message);
    return null;
  }
}

// Imagem de uma cena: gpt-image-1 (jpeg → png) com fallback para DALL·E 3
async function generateSceneImage({ prompt, style }) {
  if (!process.env.OPENAI_API_KEY) return null;
  const OpenAI = require('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const fullPrompt = `${style || 'cinematográfico'}, ${prompt}, 16:9 video scene, high quality, detailed, no text, no watermark, no captions`;
  const attempts = [
    { model: 'gpt-image-1', size: '1536x1024', quality: 'medium', n: 1, output_format: 'jpeg' },
    { model: 'gpt-image-1', size: '1536x1024', quality: 'medium', n: 1 },
    { model: 'dall-e-3', size: '1792x1024', quality: 'standard', n: 1, response_format: 'b64_json' }
  ];
  for (const opts of attempts) {
    try {
      const img = await openai.images.generate({ prompt: fullPrompt, ...opts });
      const b64 = img.data[0].b64_json;
      if (!b64) continue;
      const mime = opts.output_format === 'jpeg' ? 'image/jpeg' : 'image/png';
      return { imageBase64: b64, mime, model: opts.model };
    } catch (e) {
      console.error(`Image error (${opts.model}):`, e.message);
    }
  }
  return null;
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
    return null;
  }
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
  getBody, send
};
