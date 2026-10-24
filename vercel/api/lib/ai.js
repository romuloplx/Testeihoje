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

// Mantém o MESMO dublador / narrador do começo ao fim do vídeo (nunca troca para outra voz no meio!)
function pickDistinctCastVoices(narratorVoice = 'onyx', chars = [], style = 'cinematic') {
  const lockedVoice = (narratorVoice && TTS_VOICES[narratorVoice]) ? narratorVoice : 'onyx';
  const colors = ['#38bdf8', '#f472b6', '#34d399', '#c084fc'];
  const defPortraitStyle = style === 'animation' ? 'pixar' : 'studio';
  return chars.map((c, idx) => {
    const isFemale = /fem|mulher|garota|menina|dra|ela|woman|girl|female|mãe|mae|princesa|rainha|avó|avo|irmã|irma|amiga|cachorrinha|gatinha|raposa|fada|bruxa|exploradora|investigadora|mentora|engenheira|professora|sofia|luna|helena|maya|lyra|nina|mel|clara|lara|ana|julia|maria|alice|bela/i.test(`${c.gender || ''} ${c.name || ''} ${c.role || ''} ${c.appearance || ''}`);
    return {
      id: c.id || `char${idx + 1}`,
      name: String(c.name || (isFemale ? 'Sofia' : 'Kael')).trim(),
      role: String(c.role || (idx === 0 ? 'Protagonista' : 'Companheiro(a) de Jornada')).trim(),
      personality: String(c.personality || (idx === 0 ? 'expressivo, curioso e determinado' : 'observador, leal e espirituoso')).trim(),
      gender: isFemale ? 'female' : 'male',
      voice: lockedVoice,
      themeColor: c.themeColor || colors[idx % colors.length],
      portraitStyle: c.portraitStyle || defPortraitStyle,
      appearance: String(c.appearance || (isFemale
        ? 'expressive young woman with warm bright eyes, dark wavy hair, wearing a stylish adventure jacket, cinematic lighting'
        : 'charismatic young man with short dark hair, expressive eyes, wearing a rugged travel jacket, cinematic lighting')).trim()
    };
  });
}

function formatConnectedScript(title, characters, scenes) {
  const castHeader = characters && characters.length
    ? `🎭 **PERSONAGENS DA HISTÓRIA & VOZES:**\n• 🎙️ Narrador (voz cinematográfica)\n` + characters.map(c => `• 🗣️ **${c.name}** — ${c.role}${c.personality ? ` (${c.personality})` : ''} [voz: ${c.voice}]`).join('\n') + '\n\n'
    : '';
  const body = scenes.map(s => {
    const loc = s.locationName ? ` (${s.locationName})` : '';
    const lines = Array.isArray(s.beats) && s.beats.length
      ? s.beats.map(b => {
          const emoTag = b.emotion && b.emotion !== 'storyteller' ? ` [${b.emotion}]` : '';
          const actTag = b.action ? ` *(${b.action})*` : '';
          return `${b.speaker === 'narrator' ? '🎙️ Narrador' : '🗣️ ' + (b.speakerName || 'Personagem')}${emoTag}:${actTag} "${b.text}"`;
        }).join('\n')
      : s.narration;
    return `🎬 **CENA ${s.i} — ${s.title}${loc}**\n🏞️ *Cenário em Ação:* ${s.sceneSummaryPt || s.locationName || s.title}\n${lines}`;
  }).join('\n\n');
  return `${title ? `**TÍTULO:** ${title}\n\n` : ''}${castHeader}${body}`;
}

// Extrai personagens sugeridos pelo usuário ou cria protagonistas ricos baseados no tema da história
function inferCharactersFromPrompt(prompt = '', customCharacters = '', style = 'cinematic') {
  const rawCustom = String(customCharacters || '').trim();
  const text = `${rawCustom} ${prompt}`.trim();
  const isAnim = style === 'animation';
  const styleTag = isAnim ? '3D Pixar Disney animated character' : 'photorealistic cinematic film character';

  if (rawCustom) {
    const parts = rawCustom.split(/\s*(?:,|;|\be\b|\+|\/)\s*/i).map(s => s.trim()).filter(Boolean).slice(0, 3);
    if (parts.length >= 1) {
      const list = parts.map((p, i) => {
        const m = p.match(/^([A-À-ÿa-z0-9_ -]{2,26}?)(?:\s*[\(:,-]\s*(.+?)\)?$|$)/);
        const name = (m && m[1] ? m[1].trim() : `Personagem ${i + 1}`).slice(0, 24);
        const desc = (m && m[2] ? m[2].trim() : p).slice(0, 120);
        const isFem = /fem|mulher|menina|garota|ela|mãe|mae|princesa|rainha|amiga|cachorrinha|gatinha|raposa|fada|exploradora|investigadora|mentora|engenheira|sofia|ana|julia|lara|helena|maria|luna|clara|alice|nina|mel|maya|lyra|bela/i.test(p);
        return {
          id: `char${i + 1}`,
          name,
          role: desc || (i === 0 ? 'Protagonista' : 'Co-protagonista'),
          personality: i === 0 ? 'corajoso, expressivo e cheio de vida' : 'inteligente, leal e carismático',
          gender: isFem ? 'female' : 'male',
          portraitStyle: isAnim ? 'pixar' : 'studio',
          appearance: `${styleTag}, ${name} (${desc}), expressive face, detailed hair and signature outfit, cinematic lighting`
        };
      });
      if (list.length === 1) {
        const firstFem = list[0].gender === 'female';
        list.push({
          id: 'char2',
          name: firstFem ? 'Leo' : 'Clara',
          role: 'Parceiro(a) de Aventura',
          personality: 'curioso, espontâneo e leal',
          gender: firstFem ? 'male' : 'female',
          portraitStyle: isAnim ? 'pixar' : 'studio',
          appearance: `${styleTag}, ${firstFem ? 'charismatic young man Leo with warm eyes and adventure jacket' : 'expressive young woman Clara with bright eyes and stylish jacket'}, cinematic lighting`
        });
      }
      return list;
    }
  }

  // Detecta arquétipos pela história pedida
  if (/crian[çc]a|menino|menina|infantil|f[áa]bula|brinquedo|escola|cachorro|gato|le[ãa]o|floresta encantada/i.test(text)) {
    return [
      {
        id: 'char1', name: 'Theo', role: 'Jovem Aventureiro', personality: 'curioso, sonhador e corajoso', gender: 'male',
        portraitStyle: isAnim ? 'pixar' : 'studio',
        appearance: `${styleTag}, 11-year-old boy with messy brown hair, wide curious eyes, wearing a bright red hoodie and explorer backpack`
      },
      {
        id: 'char2', name: 'Luna', role: 'Melhor Amiga Destemida', personality: 'esperta, bem-humorada e criativa', gender: 'female',
        portraitStyle: isAnim ? 'pixar' : 'studio',
        appearance: `${styleTag}, 11-year-old girl with curly dark hair, warm smile, wearing a denim jacket with star pins and glowing lantern`
      }
    ];
  }
  if (/detetive|crime|mist[ée]rio|suspense|terror|noite|sombra|investiga|segredo/i.test(text)) {
    return [
      {
        id: 'char1', name: 'Dante', role: 'Investigador', personality: 'perspicaz, intenso e destemido', gender: 'male',
        portraitStyle: isAnim ? 'pixar' : 'studio',
        appearance: `${styleTag}, sharp 34-year-old detective man with dark coat, intense expressive eyes, dramatic noir lighting`
      },
      {
        id: 'char2', name: 'Maya', role: 'Especialista em Pistas', personality: 'analítica, corajosa e direta', gender: 'female',
        portraitStyle: isAnim ? 'pixar' : 'studio',
        appearance: `${styleTag}, intelligent 29-year-old woman with dark hair pulled back, leather jacket, observant eyes, dramatic lighting`
      }
    ];
  }
  if (/futuro|rob[ôo]|espa[çc]o|gal[áa]xia|nave|cyber|ia|tecnologia|planeta/i.test(text)) {
    return [
      {
        id: 'char1', name: 'Kael', role: 'Piloto Explorador', personality: 'audacioso, curioso e carismático', gender: 'male',
        portraitStyle: isAnim ? 'pixar' : 'studio',
        appearance: `${styleTag}, 27-year-old sci-fi explorer man with glowing cyan collar flight jacket, tousled dark hair, expressive face`
      },
      {
        id: 'char2', name: 'Lyra', role: 'Engenheira Estelar', personality: 'brilhante, sarcástica e corajosa', gender: 'female',
        portraitStyle: isAnim ? 'pixar' : 'studio',
        appearance: `${styleTag}, 26-year-old sci-fi woman with silver-streaked dark hair, sleek futuristic suit, bright expressive eyes`
      }
    ];
  }
  return [
    {
      id: 'char1', name: 'Gabriel', role: 'Protagonista da História', personality: 'expressivo, determinado e carismático', gender: 'male',
      portraitStyle: isAnim ? 'pixar' : 'studio',
      appearance: `${styleTag}, charismatic 28-year-old man with short dark hair, expressive eyes, wearing a modern dark olive jacket`
    },
    {
      id: 'char2', name: 'Sofia', role: 'Protagonista & Parceira', personality: 'viva, inteligente e emocionante', gender: 'female',
      portraitStyle: isAnim ? 'pixar' : 'studio',
      appearance: `${styleTag}, expressive 26-year-old woman with warm brown eyes, wavy dark hair, wearing a stylish amber jacket`
    }
  ];
}

function mockCreateFull({ prompt, duration, style, voice, customCharacters = '' }) {
  const durNum = Math.max(0.5, parseFloat(duration) || 1);
  const cleanPrompt = String(prompt || 'uma aventura inesquecível').trim();
  const baseChars = inferCharactersFromPrompt(cleanPrompt, customCharacters, style);
  const characters = pickDistinctCastVoices(voice || 'onyx', baseChars, style);
  const c1 = characters[0];
  const c2 = characters[1] || characters[0];

  const rawScenes = [
    {
      title: 'Onde Tudo Começa',
      locationName: 'Cenário Inicial da História',
      sceneSummaryPt: `${c1.name} e ${c2.name} entram no cenário principal de ${cleanPrompt}`,
      cameraMove: 'zoomIn',
      atmosphere: 'sunbeams',
      visual: `Cinematic wide shot of the environment of ${cleanPrompt}, featuring ${c1.appearance} and ${c2.appearance} arriving in the scene, rich atmospheric lighting, detailed background, no text`,
      actionVisual: `Medium dynamic cinema shot inside the scenario of ${cleanPrompt}, ${c1.appearance} looking amazed and pointing forward alongside ${c2.appearance}, shallow depth of field, dramatic lighting, no text`,
      beats: [
        { speaker: 'narrator', speakerName: 'Narrador', emotion: 'storyteller', shot: 'establishing', cameraMove: 'zoomIn', action: 'câmera abre revelando o cenário', text: `O vento soprava forte quando ${c1.name} e ${c2.name} deram o primeiro passo diante daquele cenário que mudaria tudo: ${cleanPrompt}.` },
        { speaker: 'char1', speakerName: c1.name, emotion: 'excited', shot: 'action', cameraMove: 'dollyIn', action: `${c1.name} olha ao redor impressionado`, text: `${c2.name}, você está vendo isso?! Não é só uma história, está acontecendo de verdade bem na nossa frente!` },
        { speaker: 'char2', speakerName: c2.name, emotion: 'curious', shot: 'action', cameraMove: 'panRight', action: `${c2.name} se aproxima para observar de perto`, text: `Calma, ${c1.name}... olha aquele brilho ali no fundo. Se a gente quiser descobrir a verdade, precisa ir até lá agora!` }
      ]
    },
    {
      title: 'O Mistério se Revela',
      locationName: 'Interior do Cenário Principal',
      sceneSummaryPt: `${c1.name} e ${c2.name} exploram os detalhes e enfrentam o primeiro desafio`,
      cameraMove: 'panRight',
      atmosphere: 'particles',
      visual: `Detailed cinematic environment showing the heart of ${cleanPrompt}, with ${c1.appearance} and ${c2.appearance} walking through the dramatic scenery, volumetric rays, no text`,
      actionVisual: `Dramatic close-medium action shot of ${c2.appearance} and ${c1.appearance} discovering a glowing clue inside ${cleanPrompt}, emotional expressions, cinematic lighting, no text`,
      beats: [
        { speaker: 'narrator', speakerName: 'Narrador', emotion: 'tense', shot: 'establishing', cameraMove: 'panRight', action: 'os personagens avançam pelo cenário', text: `A cada passo lá dentro, o ambiente ao redor se transformava, revelando detalhes que ninguém jamais havia testemunhado.` },
        { speaker: 'char2', speakerName: c2.name, emotion: 'surprised', shot: 'action', cameraMove: 'zoomIn', action: `${c2.name} toca em um detalhe misterioso do local`, text: `Espera aí! Olha só para isso aqui, ${c1.name}! Tudo neste lugar foi construído para guardar esse segredo!` },
        { speaker: 'char1', speakerName: c1.name, emotion: 'determined', shot: 'action', cameraMove: 'panLeft', action: `${c1.name} segura firme e toma a frente`, text: `Eu sabia que não estávamos loucos! Vamos continuar, não dá para voltar atrás agora!` }
      ]
    },
    {
      title: 'O Momento Decisivo',
      locationName: 'Ápice da Aventura',
      sceneSummaryPt: `O clímax emocionante em que o cenário se transforma diante de ${c1.name} e ${c2.name}`,
      cameraMove: 'zoomIn',
      atmosphere: 'embers',
      visual: `Epic climactic wide cinema shot of ${cleanPrompt} in full glory, ${c1.appearance} and ${c2.appearance} standing at the center of the action, dramatic golden and cyan light, no text`,
      actionVisual: `Intense emotional cinema shot of ${c1.appearance} and ${c2.appearance} reacting with awe during the climax of ${cleanPrompt}, dynamic camera angle, sparks and light, no text`,
      beats: [
        { speaker: 'narrator', speakerName: 'Narrador', emotion: 'excited', shot: 'establishing', cameraMove: 'zoomIn', action: 'luz intensa ilumina todo o cenário', text: `De repente, um som profundo ecoou por todo o lugar, e o momento mais aguardado finalmente aconteceu diante dos dois.` },
        { speaker: 'char1', speakerName: c1.name, emotion: 'surprised', shot: 'action', cameraMove: 'dollyIn', action: `${c1.name} abre um sorriso emocionado`, text: `Inacreditável, ${c2.name}! Olha o tamanho disso! É muito mais extraordinário do que nos nossos melhores sonhos!` },
        { speaker: 'char2', speakerName: c2.name, emotion: 'happy', shot: 'action', cameraMove: 'zoomOut', action: `${c2.name} comemora ao lado de ${c1.name}`, text: `Conseguimos, ${c1.name}! Cada desafio no caminho valeu a pena para viver esse instante!` }
      ]
    },
    {
      title: 'Um Novo Começo',
      locationName: 'Horizonte Iluminado',
      sceneSummaryPt: `${c1.name} e ${c2.name} contemplam o cenário transformado no desfecho da jornada`,
      cameraMove: 'zoomOut',
      atmosphere: 'sunbeams',
      visual: `Breathtaking panoramic sunset shot of ${cleanPrompt}, ${c1.appearance} and ${c2.appearance} looking out over the horizon together, warm cinematic glow, no text`,
      actionVisual: `Warm cinematic two-shot of ${c1.appearance} and ${c2.appearance} smiling at each other at sunset in ${cleanPrompt}, golden hour rim light, no text`,
      beats: [
        { speaker: 'narrator', speakerName: 'Narrador', emotion: 'warm', shot: 'establishing', cameraMove: 'zoomOut', action: 'pôr do sol dourado envolve os protagonistas', text: `Quando a luz suave do entardecer cobriu o horizonte, nada mais era como antes. A história havia deixado sua marca para sempre.` },
        { speaker: 'char2', speakerName: c2.name, emotion: 'warm', shot: 'action', cameraMove: 'panRight', action: `${c2.name} olha para o horizonte com gratidão`, text: `Sabe do que eu tenho certeza agora, ${c1.name}? Essa foi só a primeira de muitas aventuras que ainda vamos viver.` },
        { speaker: 'char1', speakerName: c1.name, emotion: 'excited', shot: 'action', cameraMove: 'zoomIn', action: `${c1.name} olha para a câmera convidando o público`, text: `Pode apostar que sim! E para você que viveu cada segundo dessa história com a gente, nos vemos no próximo episódio!` }
      ]
    }
  ];

  const chosen = durNum <= 0.6 ? rawScenes.slice(0, 3) : rawScenes;
  const per = (durNum * 60) / chosen.length;
  const charVoiceMap = { narrator: voice || 'onyx', char1: c1.voice, char2: c2.voice };
  const scenes = chosen.map((s, idx) => {
    const beats = s.beats.map(b => ({
      ...b,
      focus: b.speaker === 'narrator' ? 'wide' : 'dialogue',
      voice: charVoiceMap[b.speaker] || voice || 'onyx'
    }));
    return {
      i: idx + 1,
      title: s.title,
      locationName: s.locationName,
      sceneSummaryPt: s.sceneSummaryPt,
      cameraMove: s.cameraMove,
      atmosphere: s.atmosphere,
      narration: beats.map(b => b.text).join(' '),
      beats,
      visual: `${style || 'cinematic'} — ${s.visual}`,
      actionVisual: `${style || 'cinematic'} — ${s.actionVisual || s.visual}`,
      start: Math.round(idx * per),
      end: Math.round((idx + 1) * per)
    };
  });

  const title = `${cleanPrompt.slice(0, 62)}${cleanPrompt.length > 62 ? '…' : ''}`;
  return {
    title,
    mood: 'adventure',
    artStylePrompt: `${style || 'cinematic'} 4K film look, cohesive lighting and color palette`,
    characters,
    script: formatConnectedScript(title, characters, scenes),
    scenes,
    seo: {
      title: `${cleanPrompt.slice(0, 65)} | DubAI PRO`,
      description: `História animada com personagens vivos e cenários cinematográficos sobre ${cleanPrompt}.\n\n#dubaipro #ia #cinema #historia`,
      tags: cleanPrompt.split(/\s+/).slice(0, 6).join(', ') + ', ia, história com personagens, animação, youtube'
    },
    meta: { estilo: style, voz: voice, cenas: scenes.length, dur: durNum }
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
    const openai = makeOpenAI();
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

// Cinema Conectado & Histórias com Personagens Vivos (Narrador + Cenários Multi-Plano + Personagens Atuando na Cena)
async function generateCreateFull({ prompt, duration, style, voice, cinemaMode = 'connected', customCharacters = '', aiModel = 'auto-router' }) {
  const durNum = Math.max(0.5, parseFloat(duration) || 1);
  const styleAnchorMap = {
    realistic: '35mm cinema film photography, photorealistic characters and environment, natural skin texture, dramatic ARRI Alexa lighting, rich color grading',
    cinematic: 'epic anamorphic 4K cinema movie still, volumetric light rays, expressive characters in scene, rich contrast, shallow depth of field',
    animation: '3D Pixar and Disney feature film animation style, expressive animated characters acting in rich detailed 3D environments, warm global illumination',
    documentary: 'National Geographic 4K cinema documentary photography, authentic natural atmosphere, crisp lens detail',
    images: 'masterpiece digital concept art illustration, expressive characters in rich environment, cohesive cinematic color palette'
  };
  const artStylePrompt = styleAnchorMap[style] || styleAnchorMap.cinematic;
  const fallbackChars = inferCharactersFromPrompt(prompt, customCharacters, style);

  // MODO HISTÓRIA COM PERSONAGENS / CINEMA CONECTADO (Padrão)
  if (cinemaMode !== 'classic') {
    const nScenes = durNum <= 0.6 ? 3 : durNum <= 1.2 ? 4 : durNum <= 2.5 ? 5 : Math.min(7, Math.round(durNum * 1.1));
    const wordsPerBeat = durNum <= 1.2 ? 19 : durNum <= 2.5 ? 25 : 32;
    const isPureStory = cinemaMode === 'story';

    const customCharHint = String(customCharacters || '').trim()
      ? `\nPERSONAGENS DEFINIDOS PELO USUÁRIO (OBRIGATÓRIO USAR ESTES PERSONAGENS): "${String(customCharacters).trim()}"`
      : '\nSe o pedido do usuário citar nomes ou tipos de personagens (ex: um menino, um cachorro, um detetive, um rei, dois irmãos, etc.), CRIE EXATAMENTE esses personagens! Caso contrário, crie 2 protagonistas carismáticos que vivem a história na prática.';

    const cinemaSystem = [
      'Você é um Diretor de Animação (estilo Pixar / Netflix) e Roteirista Dramático de Histórias Cinematográficas.',
      'PROIBIDO criar textos robóticos, didáticos ou genéricos do tipo "Bem-vindos a uma jornada sobre..." ou comentaristas de estúdio dizendo "Olha este lugar!".',
      'Você deve criar uma HISTÓRIA VIVA COM PERSONAGENS REAIS que estão DENTRO do cenário vivendo a ação, sentindo emoções reais (surpresa, medo, alegria, curiosidade, urgência, coragem) e interagindo com os elementos do ambiente.',
      'Responda APENAS um objeto JSON válido (sem markdown e sem comentários) com esta estrutura exata:',
      '{',
      '  "title": "título envolvente da história em português",',
      '  "mood": "adventure | mystery | epic | warm | tech",',
      '  "seo": { "title": "título YouTube até 70 chars", "description": "descrição envolvente com hashtags", "tags": "tag1, tag2, tag3" },',
      '  "characters": [',
      '    { "id": "char1", "name": "Nome do protagonista 1", "role": "Quem ele é na história", "personality": "traço emocional marcante", "gender": "male | female", "appearance": "concise English visual description of character face, age, hair, and signature outfit (e.g. 12yo boy with curly brown hair and red hoodie)" },',
      '    { "id": "char2", "name": "Nome do protagonista 2", "role": "Quem ele é na história", "personality": "traço emocional marcante", "gender": "female | male", "appearance": "concise English visual description of character face, age, hair, and signature outfit" }',
      '  ],',
      '  "scenes": [',
      '    {',
      '      "title": "título dramático curto da cena",',
      '      "locationName": "Local exato onde a cena acontece em português",',
      '      "sceneSummaryPt": "Resumo em 1 frase em português do que os personagens estão fazendo neste cenário",',
      '      "cameraMove": "zoomIn | panRight | zoomOut | panLeft | dollyIn",',
      '      "atmosphere": "sunbeams | particles | embers | rain | cyber",',
      '      "visual": "English visual prompt (max 38 words) showing the FULL SCENARIO/ENVIRONMENT AND the characters (using their exact appearance) arriving or acting inside this location, cinematic lighting, no text",',
      '      "actionVisual": "English visual prompt (max 38 words) showing a CLOSER DYNAMIC CAMERA ANGLE in the SAME scenario with the characters performing the key action or emotional reaction of this scene, no text",',
      '      "beats": [',
      '        { "speaker": "narrator", "speakerName": "Narrador", "emotion": "storyteller | tense | warm | excited", "shot": "establishing", "cameraMove": "zoomIn", "action": "ação visual que acontece no cenário", "text": "narração cinematográfica envolvente em português contando o que acontece na cena (nunca robótica)" },',
      '        { "speaker": "char1", "speakerName": "Nome do char1", "emotion": "excited | curious | surprised | tense | happy | sad | determined", "shot": "action", "cameraMove": "dollyIn", "action": "o que char1 faz fisicamente na cena", "text": "fala viva, humana e cheia de emoção em português brasileiro natural" },',
      '        { "speaker": "char2", "speakerName": "Nome do char2", "emotion": "curious | surprised | excited | tense | happy | warm | determined", "shot": "action", "cameraMove": "panRight", "action": "reação física de char2 no cenário", "text": "resposta natural e expressiva em português fazendo a história avançar" }',
      '      ]',
      '    }',
      '  ]',
      '}',
      'REGRAS OBRIGATÓRIAS DE FLUIDEZ E NATURALIDADE:',
      `1. Crie exatamente ${nScenes} cenas com início intrigante, desenvolvimento cheio de ação/descoberta, clímax emocionante e desfecho memorável.`,
      `2. Cada fala em "beats" deve ter cerca de ${wordsPerBeat} palavras em português brasileiro falado, com emoção humana real, contrações naturais e ritmo fluido, sem rubricas entre colchetes no campo "text" e sem emojis.`,
      '3. Os campos "visual" e "actionVisual" DEVEM incluir os personagens atuando DENTRO do cenário descrito (nunca gere cenários vazios sem os personagens da história).',
      isPureStory ? '4. Como o modo escolhido é História Pura, a primeira fala da cena pode ser uma narração curta de 1 frase situando a ação, seguida de diálogo intenso e expressivo entre os personagens.' : '4. Conecte 100% o que o narrador descreve com o que aparece no cenário e com o que os personagens falam e fazem.'
    ].join('\n');

    const cinemaUser = `Pedido da história/vídeo: "${prompt}"${customCharHint}\nEstilo visual: ${style} (${artStylePrompt})\nCrie os personagens da história, os cenários em múltiplos ângulos ("visual" e "actionVisual" com os personagens em ação no cenário) e os diálogos cheios de vida.`;

    const isValidCinemaStory = (txt) => {
      const p = extractJson(txt);
      return !!(p && Array.isArray(p.scenes) && p.scenes.length >= 2);
    };

    const res = await withRetries(() => chatWithFallback({
      system: cinemaSystem,
      user: cinemaUser,
      json: true,
      maxTokens: 4200,
      preferredModel: aiModel,
      validator: isValidCinemaStory
    }), 2);
    if (!res.error) {
      const parsed = extractJson(res.text);
      if (parsed && Array.isArray(parsed.scenes) && parsed.scenes.length) {
        const rawChars = Array.isArray(parsed.characters) && parsed.characters.length >= 1
          ? parsed.characters.slice(0, 3)
          : fallbackChars;
        if (rawChars.length === 1 && fallbackChars.length >= 2) rawChars.push(fallbackChars[1]);
        const characters = pickDistinctCastVoices(voice || 'onyx', rawChars, style);

        const lockedMasterVoice = (voice && TTS_VOICES[voice]) ? voice : 'onyx';
        const voiceBySpeaker = { narrator: lockedMasterVoice };
        const nameBySpeaker = { narrator: 'Narrador' };
        const charAppearanceSummary = characters.map(c => `${c.name} (${c.appearance})`).join(' and ');
        characters.forEach((c, idx) => {
          const key = `char${idx + 1}`;
          c.id = key;
          c.voice = lockedMasterVoice;
          voiceBySpeaker[key] = lockedMasterVoice;
          nameBySpeaker[key] = c.name;
        });

        const per = (durNum * 60) / parsed.scenes.length;
        const validMoves = ['zoomIn', 'panRight', 'zoomOut', 'panLeft', 'dollyIn', 'tiltUp'];
        const validEmotions = ['storyteller', 'excited', 'curious', 'tense', 'happy', 'sad', 'surprised', 'determined', 'warm'];
        const scenes = parsed.scenes.slice(0, nScenes).map((s, idx) => {
          const rawBeats = Array.isArray(s.beats) && s.beats.length
            ? s.beats
            : [{ speaker: 'narrator', speakerName: 'Narrador', emotion: 'storyteller', shot: 'establishing', text: String(s.narration || s.title || prompt) }];
          const beats = rawBeats
            .map((b, bIdx) => {
              let sp = String(b.speaker || 'narrator').toLowerCase();
              if (!voiceBySpeaker[sp]) {
                // Tenta casar pelo nome do personagem caso a IA tenha colocado o nome no campo speaker
                const byName = characters.find(c => c.name.toLowerCase() === String(b.speakerName || b.speaker || '').toLowerCase());
                sp = byName ? byName.id : (sp.includes('1') ? 'char1' : sp.includes('2') ? 'char2' : sp.includes('3') && voiceBySpeaker.char3 ? 'char3' : 'narrator');
              }
              const emo = validEmotions.includes(String(b.emotion || '').toLowerCase())
                ? String(b.emotion).toLowerCase()
                : (sp === 'narrator' ? 'storyteller' : (bIdx % 2 === 1 ? 'excited' : 'curious'));
              const shot = b.shot === 'action' || (sp !== 'narrator' && bIdx >= 1) ? 'action' : 'establishing';
              const move = validMoves.includes(b.cameraMove) ? b.cameraMove : validMoves[(idx + bIdx) % validMoves.length];
              return {
                speaker: sp,
                speakerName: nameBySpeaker[sp] || String(b.speakerName || 'Narrador'),
                focus: sp === 'narrator' ? 'wide' : 'dialogue',
                emotion: emo,
                shot,
                cameraMove: move,
                action: String(b.action || '').trim(),
                voice: voiceBySpeaker[sp] || voice || 'onyx',
                text: String(b.text || '').replace(/\*\*|\[.*?\]/g, '').trim()
              };
            })
            .filter(b => b.text.length > 0);

          const baseVisual = String(s.visual || `${s.locationName || s.title} with ${charAppearanceSummary} in the scene`).trim();
          const baseActionVisual = String(s.actionVisual || `Medium close-up dynamic shot in ${s.locationName || s.title}, ${charAppearanceSummary} acting with expressive emotion, ${s.title}`).trim();

          return {
            i: idx + 1,
            title: String(s.title || `Cena ${idx + 1}`),
            locationName: String(s.locationName || s.title || `Cena ${idx + 1}`),
            sceneSummaryPt: String(s.sceneSummaryPt || s.locationName || s.title || ''),
            cameraMove: validMoves.includes(s.cameraMove) ? s.cameraMove : (idx % 2 === 0 ? 'zoomIn' : 'panRight'),
            atmosphere: ['sunbeams', 'particles', 'embers', 'rain', 'cyber'].includes(s.atmosphere) ? s.atmosphere : 'particles',
            visual: `${artStylePrompt}, ${baseVisual}, cinematic scene, no text, no watermark`,
            actionVisual: `${artStylePrompt}, ${baseActionVisual}, dynamic angle, expressive characters in scene, no text, no watermark`,
            beats,
            narration: beats.map(b => b.text).join(' '),
            start: Math.round(idx * per),
            end: Math.round((idx + 1) * per)
          };
        });
        const script = formatConnectedScript(parsed.title || prompt.slice(0, 70), characters, scenes);
        return {
          data: {
            title: parsed.title || prompt.slice(0, 70),
            mood: parsed.mood || 'adventure',
            artStylePrompt,
            characters,
            script,
            scenes,
            seo: parsed.seo || {}
          },
          provider: res.provider
        };
      }
    }
    // Se algum provedor falhou no JSON, usa o construtor dinâmico de história com personagens (nunca perde os personagens!)
    const dynamicFallback = mockCreateFull({ prompt, duration, style, voice, customCharacters });
    return {
      data: dynamicFallback,
      provider: 'story-engine-fallback',
      error: res.error
    };
  }

  const dur = Math.max(1, Math.round(durNum));
  const nScenes = Math.max(4, Math.min(10, Math.round(dur / 1.5)));
  const wordsPerScene = Math.round((dur * 130) / nScenes);

  // Fase 1: plano (título + SEO + cenas com descrição visual)
  const outlineSystem = 'Você é roteirista de vídeos para YouTube. Responda APENAS JSON válido neste formato: {"title":"título do vídeo","seo":{"title":"título para YouTube (até 70 caracteres)","description":"descrição com hashtags","tags":"tag1, tag2, tag3"},"scenes":[{"title":"título curto da cena","visual":"descrição visual detalhada em inglês para gerar uma imagem da cena"}]}.';
  const outlineUser = `Crie o plano de um vídeo de ${dur} minutos sobre "${prompt}". Estilo visual: ${style}. Exatamente ${nScenes} cenas em ordem cronológica. Idioma: português brasileiro.`;
  const res = await withRetries(() => chatWithFallback({ system: outlineSystem, user: outlineUser, json: true, maxTokens: 3000 }), 2);
  if (res.error) return { error: res.error };
  const outline = extractJson(res.text);
  if (!outline || !Array.isArray(outline.scenes) || !outline.scenes.length) {
    return { error: `IA (${res.provider}) não retornou o plano de cenas válido.` };
  }
  const scenesPlan = outline.scenes.slice(0, nScenes);
  const providers = new Set([res.provider]);

  // Fase 2: narrações em lotes de 2 (menos colisão de limite) com retries profundos
  const narrations = new Array(scenesPlan.length).fill('');
  let fatal = null;
  for (let i = 0; i < scenesPlan.length && !fatal; i += 2) {
    const batch = scenesPlan.slice(i, i + 2);
    const results = await Promise.all(batch.map(async (s, j) => {
      const idx = i + j;
      if (j > 0) await new Promise(r => setTimeout(r, 1200)); // desloca o lote
      return withRetries(() => chatWithFallback({
        system: 'Você é um contador de histórias cinematográfico. Escreva APENAS o texto da narração fluida e envolvente, sem título, sem aspas, sem comentários.',
        user: `Vídeo sobre: "${prompt}". Cena ${idx + 1} de ${scenesPlan.length}: "${s.title}" (${s.visual || ''}). Escreva a narração desta cena em português brasileiro, com aproximadamente ${wordsPerScene} palavras, em tom vivo e nunca robótico.`
      }), 2);
    }));
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.error) {
        const retry = await withRetries(() => chatWithFallback({
          system: 'Escreva APENAS a narração da cena, sem comentários.',
          user: `Narre em português (~${Math.round(wordsPerScene * 0.7)} palavras) a cena "${scenesPlan[i + j].title}" do vídeo sobre "${prompt}".`
        }), 1);
        if (retry.error) { if (!fatal) fatal = `Narração da cena ${i + j + 1} falhou: ${retry.error}`; continue; }
        providers.add(retry.provider);
        narrations[i + j] = (retry.text || '').trim().replace(/^["'\s]+|["'\s]+$/g, '');
        continue;
      }
      providers.add(r.provider);
      narrations[i + j] = (r.text || '').trim().replace(/^["'\s]+|["'\s]+$/g, '');
    }
  }
  if (fatal) return { error: fatal };
  if (narrations.some(n => !n)) return { error: 'Faltou narração em alguma cena — tente novamente.' };

  const per = (dur * 60) / scenesPlan.length;
  const scenes = scenesPlan.map((s, idx) => ({
    i: idx + 1,
    title: String(s.title || `Cena ${idx + 1}`),
    narration: narrations[idx],
    visual: String(s.visual || s.title || prompt),
    actionVisual: `${String(s.visual || s.title || prompt)}, closer dramatic camera angle, detailed focus`,
    start: Math.round(idx * per),
    end: Math.round((idx + 1) * per)
  }));
  const script = (outline.title ? `**TÍTULO:** ${outline.title}\n\n` : '') + scenes.map(s => `**CENA ${s.i} — ${s.title}**\n${s.narration}`).join('\n\n');
  return { data: { script, scenes, seo: outline.seo || {}, title: outline.title || '' }, provider: [...providers].join(' + ') };
}

// Imagem de uma cena: Pollinations Flux HD (Grátis & Rápido) + OpenAI + Gemini + Unorouter
async function generateSceneImage({ prompt, style, width = 1024, height = 576 }) {
  const errors = [];
  const cleanScenePrompt = String(prompt || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 340);
  const fullPrompt = `${cleanScenePrompt}, masterpiece cinematic scene, rich lighting, no text, no watermark`.slice(0, 390);

  if (canUseOfficialOpenAI()) {
    const openai = makeOpenAI();
    const attempts = [
      { model: 'gpt-image-1', size: '1536x1024', quality: 'medium', n: 1, output_format: 'jpeg' },
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
        errors.push(`${opts.model}: ${(e.status ? 'HTTP ' + e.status + ' — ' : '')}${e.message}`);
        if (e.status === 401) { markOpenAi401(); break; }
      }
    }
  }

  // Escolha inteligente do modelo Flux gratuito conforme o estilo visual da história
  const fluxModel = style === 'animation' ? 'flux-3d'
    : (style === 'realistic' || style === 'documentary') ? 'flux-realism'
    : 'flux';

  const targetW = Math.min(1024, Math.max(512, Number(width) || 1024));
  const targetH = Math.min(1024, Math.max(512, Number(height) || 576));

  // 1) Gemini 3.1 Flash Image (Google) — alta fidelidade de personagens e cenários
  if (process.env.GEMINI_API_KEY) {
    try {
      const g = await geminiImage(fullPrompt, 9000);
      if (g) return g;
      errors.push('gemini/image: sem imagem retornada');
    } catch (e) { errors.push('gemini/image: ' + e.message); }
  }

  // 2) Unorouter Multi-IA Images (SDXL:free / Flux.2 / GPT-Image-2.5) — se houver chave fora de cooldown
  const uKey = pickReadyUniKey();
  if (uKey) {
    for (const model of UNI_IMG_MODELS) {
      try {
        const r = await fetch(uniBase() + '/images/generations', {
          method: 'POST', headers: uniHeaders(uKey),
          body: JSON.stringify({ model, prompt: fullPrompt, n: 1, size: '1024x1024', response_format: 'b64_json' }),
          signal: AbortSignal.timeout(9000)
        });
        if (r.ok) {
          const j = await r.json();
          const b64 = j && j.data && j.data[0] && j.data[0].b64_json;
          const url = j && j.data && j.data[0] && j.data[0].url;
          if (b64) return { imageBase64: b64, mime: 'image/png', model: 'unorouter/' + model };
          if (url) {
            const fr = await fetch(url, { signal: AbortSignal.timeout(8000) });
            if (fr.ok) {
              const buf = Buffer.from(await fr.arrayBuffer());
              if (buf.length > 100) return { imageBase64: buf.toString('base64'), mime: fr.headers.get('content-type') || 'image/png', model: 'unorouter/' + model };
            }
          }
          errors.push(`unorouter/${model}: resposta sem imagem`);
        } else {
          const txt = (await r.text().catch(() => '')).slice(0, 120);
          errors.push(`unorouter/${model}: HTTP ${r.status}`);
          if (r.status === 401) { _deadUniKeys.add(uKey); break; }
          if (r.status === 429 && /allows 1 request|Too many requests/i.test(txt)) { markUniRateWindow(uKey); break; }
        }
      } catch (e) { errors.push(`unorouter/${model}: ${e.message}`); }
    }
  }

  // 3) Pollinations Flux AI (Grátis, sem chave, alta fidelidade de cenário + personagens, timeout ágil)
  const ladder = [
    { model: fluxModel, w: targetW, h: targetH },
    { model: 'turbo', w: 768, h: 432 }
  ];
  for (const opt of ladder) {
    try {
      const seed = Math.floor(Math.random() * 900000) + 10000;
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${opt.w}&height=${opt.h}&nologo=true&enhance=true&safe=false&seed=${seed}` + (opt.model ? `&model=${opt.model}` : '');
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
        },
        signal: AbortSignal.timeout(8500)
      });
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length > 1500) {
          return {
            imageBase64: buf.toString('base64'),
            mime: r.headers.get('content-type') || 'image/jpeg',
            model: `pollinations/${opt.model || 'flux'}-${opt.w}x${opt.h}`
          };
        }
      } else {
        errors.push(`pollinations(${opt.model || 'std'}): HTTP ${r.status}`);
      }
    } catch (e) {
      errors.push(`pollinations(${opt.model || 'std'}): ${e.message}`);
      if (/fetch failed|ENOTFOUND|ECONNREFUSED/i.test(e.message)) break;
    }
  }
  return { error: errors.join(' | ') || 'nenhum provedor de imagem respondeu' };
}

// Busca pública de personagens da API An API of Ice and Fire para preencher o elenco de Criar.
function normalizeIceAndFireCharacter(character) {
  const value = character && typeof character === 'object' ? character : {};
  const cleanText = (text, max = 180) => String(text || '').replace(/\s+/g, ' ').trim().slice(0, max);
  const cleanList = (items, maxItems = 6) => Array.isArray(items)
    ? items.map(item => cleanText(item, 180)).filter(Boolean).slice(0, maxItems)
    : [];
  const url = cleanText(value.url, 240);
  const idMatch = url.match(/\/characters\/(\d+)\/?$/i);
  return {
    id: idMatch ? idMatch[1] : '',
    name: cleanText(value.name, 100),
    gender: cleanText(value.gender, 40),
    culture: cleanText(value.culture, 100),
    born: cleanText(value.born, 120),
    died: cleanText(value.died, 120),
    titles: cleanList(value.titles, 6),
    aliases: cleanList(value.aliases, 6),
    tvSeries: cleanList(value.tvSeries, 8),
    playedBy: cleanList(value.playedBy, 4)
  };
}

async function lookupIceAndFireCharacters({ query = '' } = {}) {
  const cleanQuery = String(query || '').trim().slice(0, 160);
  if (!cleanQuery) throw Object.assign(new Error('Digite o nome ou o ID de um personagem para buscar.'), { status: 400 });

  const base = 'https://anapioficeandfire.com/api';
  let requestUrl;
  if (/^\d{1,12}$/.test(cleanQuery)) {
    requestUrl = `${base}/characters/${cleanQuery}`;
  } else if (/^https?:\/\//i.test(cleanQuery)) {
    let candidate;
    try { candidate = new URL(cleanQuery); }
    catch (_) { throw Object.assign(new Error('O link informado não é válido.'), { status: 400 }); }
    if (candidate.protocol !== 'https:' || candidate.hostname !== 'anapioficeandfire.com' || !/^\/api\/characters\/\d+\/?$/i.test(candidate.pathname)) {
      throw Object.assign(new Error('Use o nome do personagem, um ID ou um link /api/characters/{id} da An API of Ice and Fire.'), { status: 400 });
    }
    requestUrl = `https://anapioficeandfire.com${candidate.pathname}`;
  } else {
    const url = new URL(`${base}/characters`);
    url.searchParams.set('name', cleanQuery);
    url.searchParams.set('pageSize', '10');
    requestUrl = url.href;
  }

  let response;
  try {
    response = await fetch(requestUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12000)
    });
  } catch (e) {
    throw Object.assign(new Error(`A API de personagens não respondeu: ${String(e.message || e).slice(0, 140)}`), { status: 504 });
  }
  if (response.status === 404) return { results: [] };
  if (!response.ok) {
    throw Object.assign(new Error(`A API de personagens respondeu HTTP ${response.status}.`), { status: 502 });
  }

  let payload;
  try { payload = await response.json(); }
  catch (_) { throw Object.assign(new Error('A API de personagens devolveu uma resposta inválida.'), { status: 502 }); }
  const list = Array.isArray(payload) ? payload : (payload && typeof payload === 'object' ? [payload] : []);
  return { results: list.map(normalizeIceAndFireCharacter).filter(character => character.name).slice(0, 10) };
}

// Gerador real de clipes para a aba Criar: Tencent HunyuanVideo 1.5 image-to-video.
// Requer uma chave TokenHub guardada somente no servidor.
const CREATE_SCENE_VIDEO_WINDOW_MS = 60 * 60 * 1000;
const CREATE_SCENE_VIDEO_MAX_PER_WINDOW = 10;
const _createSceneVideoRequests = new Map();
const TENCENT_HUNYUAN_VIDEO_MODEL = 'hy-video-v1.5';

function consumeCreateSceneVideoRequest(clientKey = 'unknown', now = Date.now()) {
  const key = String(clientKey || 'unknown').trim().slice(0, 120) || 'unknown';
  let entry = _createSceneVideoRequests.get(key);
  if (!entry || now - entry.startedAt >= CREATE_SCENE_VIDEO_WINDOW_MS) {
    entry = { startedAt: now, count: 0 };
  }
  if (entry.count >= CREATE_SCENE_VIDEO_MAX_PER_WINDOW) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.startedAt + CREATE_SCENE_VIDEO_WINDOW_MS - now) / 1000))
    };
  }
  entry.count += 1;
  _createSceneVideoRequests.set(key, entry);
  if (_createSceneVideoRequests.size > 5000) {
    for (const [ip, value] of _createSceneVideoRequests) {
      if (now - value.startedAt >= CREATE_SCENE_VIDEO_WINDOW_MS) _createSceneVideoRequests.delete(ip);
    }
  }
  return { ok: true, remaining: CREATE_SCENE_VIDEO_MAX_PER_WINDOW - entry.count };
}

function tokenHubVideoBase() {
  const configured = String(process.env.TENCENT_TOKENHUB_BASE_URL || 'https://tokenhub-intl.tencentcloudmaas.com/v1')
    .trim().replace(/\/+$/, '');
  return /\/v1$/i.test(configured) ? configured : `${configured}/v1`;
}

function parseTokenHubJson(raw, label) {
  try { return JSON.parse(raw || '{}'); }
  catch (_) { throw Object.assign(new Error(`HunyuanVideo retornou uma resposta inválida em ${label}.`), { status: 502 }); }
}

function tokenHubErrorMessage(result, raw) {
  return String(
    (result && result.error && (result.error.message || result.error.code)) ||
    (result && (result.message || result.msg)) || raw || 'falha no provedor'
  ).slice(0, 300);
}

function getTokenHubApiKey() {
  const apiKey = String(process.env.TENCENT_TOKENHUB_API_KEY || '').trim();
  if (!apiKey) {
    throw Object.assign(new Error('TENCENT_TOKENHUB_API_KEY não está configurada no servidor para gerar clipes HunyuanVideo.'), { status: 503 });
  }
  return apiKey;
}

const waitForCreateSceneVideo = ms => new Promise(resolve => setTimeout(resolve, ms));

async function startCreateSceneVideo({
  prompt,
  imageBase64,
  imageMime = 'image/jpeg',
  stylePrompt = '',
  clientKey = 'unknown'
} = {}) {
  const apiKey = getTokenHubApiKey();
  const cleanPrompt = String(prompt || '').replace(/\s+/g, ' ').trim().slice(0, 1200);
  if (!cleanPrompt) throw Object.assign(new Error('Descreva a ação da cena para gerar o clipe.'), { status: 400 });

  const cleanImage = String(imageBase64 || '')
    .replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '')
    .replace(/\s+/g, '');
  if (!cleanImage || !/^[a-z0-9+/]+={0,2}$/i.test(cleanImage) || cleanImage.length < 100) {
    throw Object.assign(new Error('A imagem de referência da cena está inválida.'), { status: 400 });
  }
  if (cleanImage.length > 1_600_000) {
    throw Object.assign(new Error('A imagem de referência ficou grande demais. Reduza a resolução e tente novamente.'), { status: 413 });
  }

  const safeMime = /^image\/(jpeg|png)$/i.test(String(imageMime || '')) ? String(imageMime).toLowerCase() : 'image/jpeg';
  const style = String(stylePrompt || '').replace(/\s+/g, ' ').trim().slice(0, 220);
  const quota = consumeCreateSceneVideoRequest(clientKey);
  if (!quota.ok) {
    throw Object.assign(new Error(`Limite temporário de clipes HunyuanVideo atingido. Tente novamente em ${Math.ceil(quota.retryAfterSeconds / 60)} min.`), {
      status: 429,
      retryAfterSeconds: quota.retryAfterSeconds
    });
  }

  const motionPrompt = [
    'Create one coherent, cinematic image-to-video shot based on the supplied reference image.',
    'Preserve the people, faces, clothing, setting, framing, and visual identity from the reference.',
    'Use natural, clearly visible subject movement and smooth camera motion; keep anatomy and objects stable.',
    'No cuts, transitions, written words, captions, logos, or watermarks.',
    `Action: ${cleanPrompt}`,
    style ? `Visual style: ${style}` : ''
  ].filter(Boolean).join(' ').slice(0, 2200);

  const apiBase = tokenHubVideoBase();
  let response;
  try {
    response = await fetch(`${apiBase}/wand/hunyuan-video/generation`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: TENCENT_HUNYUAN_VIDEO_MODEL,
        prompt: motionPrompt,
        negative_prompt: 'blurry, low resolution, flicker, jitter, warped face, duplicate limbs, changing identity, text, subtitles, logo, watermark, scene cuts',
        image: `data:${safeMime};base64,${cleanImage}`,
        duration: 5,
        revise: true
      }),
      signal: AbortSignal.timeout(30000)
    });
  } catch (e) {
    throw Object.assign(new Error(`Não foi possível enviar a cena ao HunyuanVideo: ${String(e.message || e).slice(0, 180)}`), { status: 504 });
  }

  const raw = await response.text().catch(() => '');
  const submitted = parseTokenHubJson(raw, 'envio');
  if (!response.ok || submitted.status === 'failed' || submitted.error) {
    throw Object.assign(new Error(`HunyuanVideo HTTP ${response.status}: ${tokenHubErrorMessage(submitted, raw)}`), {
      status: response.status >= 400 && response.status < 500 ? response.status : 502
    });
  }
  const taskId = String(submitted.task_id || '').trim();
  if (!taskId) throw Object.assign(new Error('HunyuanVideo não devolveu o identificador da tarefa.'), { status: 502 });
  return { taskId, status: 'queued', provider: `tencent/${TENCENT_HUNYUAN_VIDEO_MODEL}` };
}

async function downloadHunyuanTaskVideo(task) {
  const videoUrl = String((Array.isArray(task.videos) && task.videos[0] && task.videos[0].url) || task.video_url || '').trim();
  let parsedVideoUrl;
  try { parsedVideoUrl = new URL(videoUrl); }
  catch (_) { parsedVideoUrl = null; }
  if (!parsedVideoUrl || parsedVideoUrl.protocol !== 'https:') {
    throw Object.assign(new Error('HunyuanVideo concluiu a tarefa, mas não devolveu uma URL HTTPS válida para o MP4.'), { status: 502 });
  }

  let response;
  try {
    // A URL retornada pelo TokenHub é temporária e assinada; não encaminhe a chave TokenHub para ela.
    response = await fetch(parsedVideoUrl.href, { signal: AbortSignal.timeout(45000) });
  } catch (e) {
    throw Object.assign(new Error(`Não foi possível baixar o MP4 gerado pelo HunyuanVideo: ${String(e.message || e).slice(0, 160)}`), { status: 502 });
  }
  if (!response.ok) {
    throw Object.assign(new Error(`Falha ao baixar o clipe HunyuanVideo (HTTP ${response.status}).`), { status: 502 });
  }
  const declaredSize = Number(response.headers && response.headers.get('content-length') || 0);
  if (declaredSize > 25 * 1024 * 1024) {
    throw Object.assign(new Error('O MP4 retornado pelo HunyuanVideo excede o limite de tamanho de 25 MB.'), { status: 413 });
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > 25 * 1024 * 1024) {
    throw Object.assign(new Error('O MP4 retornado pelo HunyuanVideo excede o limite de tamanho de 25 MB.'), { status: 413 });
  }
  const isMp4 = buffer.length > 1000 && buffer.subarray(0, 64).includes(Buffer.from('ftyp'));
  if (!isMp4) {
    throw Object.assign(new Error('HunyuanVideo respondeu, mas o arquivo recebido não é um MP4 válido.'), { status: 502 });
  }
  return { done: true, buffer, mime: 'video/mp4', provider: `tencent/${TENCENT_HUNYUAN_VIDEO_MODEL}` };
}

async function pollCreateSceneVideo({ taskId } = {}) {
  const apiKey = getTokenHubApiKey();
  const safeTaskId = String(taskId || '').trim();
  if (!/^[A-Za-z0-9._-]{1,200}$/.test(safeTaskId)) {
    throw Object.assign(new Error('O identificador da tarefa HunyuanVideo está inválido.'), { status: 400 });
  }

  const apiBase = tokenHubVideoBase();
  let response;
  try {
    response = await fetch(`${apiBase}/wand/hunyuan-video/tasks/${encodeURIComponent(safeTaskId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(20000)
    });
  } catch (e) {
    throw Object.assign(new Error(`Não foi possível consultar o HunyuanVideo: ${String(e.message || e).slice(0, 160)}`), { status: 504 });
  }

  const raw = await response.text().catch(() => '');
  const task = parseTokenHubJson(raw, 'consulta');
  if (!response.ok) {
    const message = tokenHubErrorMessage(task, raw);
    throw Object.assign(new Error(`HunyuanVideo HTTP ${response.status}: ${message}`), {
      status: response.status === 429 ? 429 : response.status >= 500 ? 503 : response.status,
      retryAfterSeconds: Number(response.headers && response.headers.get('retry-after')) || undefined
    });
  }
  const state = String(task.status || '').toLowerCase();
  if (state === 'queued' || state === 'running' || state === 'pending' || state === 'processing' || state === 'in_progress') {
    return { done: false, taskId: safeTaskId, status: state, provider: `tencent/${TENCENT_HUNYUAN_VIDEO_MODEL}` };
  }
  if (state === 'failed') {
    throw Object.assign(new Error(`HunyuanVideo falhou: ${tokenHubErrorMessage(task, raw)}`), { status: 422 });
  }
  if (state !== 'succeeded' && state !== 'success' && state !== 'completed') {
    throw Object.assign(new Error(`HunyuanVideo devolveu status desconhecido${state ? `: ${state}` : ''}.`), { status: 502 });
  }
  return downloadHunyuanTaskVideo(task);
}

// Compatibilidade para usos internos que prefiram aguardar em uma única chamada;
// a rota web usa start/poll separados para não manter uma Function aberta por minutos.
async function generateCreateSceneVideo(options = {}) {
  const started = await startCreateSceneVideo(options);
  const maxWaitMs = Math.max(1000, Math.min(295000, Number(options.maxWaitMs) || 245000));
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const result = await pollCreateSceneVideo({ taskId: started.taskId });
    if (result.done) return result;
    await waitForCreateSceneVideo(Math.min(4000, Math.max(0, deadline - Date.now())));
  }
  throw Object.assign(new Error('Tempo esgotado esperando o HunyuanVideo finalizar.'), { status: 504 });
}

// Concatena múltiplos buffers de áudio sem corromper cabeçalhos RIFF/WAV (essencial em vídeos longos!)
function concatAudioBuffers(buffers) {
  const list = (buffers || []).filter(b => b && b.length > 0);
  if (!list.length) return { buffer: Buffer.alloc(0), audioMime: 'audio/wav' };
  const isWavBuf = b => b.length > 44 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WAVE';
  if (list.every(isWavBuf)) {
    const sampleRate = list[0].readUInt32LE(24) || 24000;
    const pcmParts = list.map(b => {
      // Localiza o subchunk 'data' com segurança (normalmente offset 36..44)
      let off = 12;
      while (off + 8 <= b.length) {
        const tag = b.subarray(off, off + 4).toString('ascii');
        const sz = b.readUInt32LE(off + 4);
        if (tag === 'data') return b.subarray(off + 8, Math.min(b.length, off + 8 + sz));
        off += 8 + sz + (sz % 2);
      }
      return b.subarray(44);
    });
    return { buffer: wrapPcmAsWav(Buffer.concat(pcmParts), sampleRate), audioMime: 'audio/wav' };
  }
  const firstIsWav = isWavBuf(list[0]);
  if (list.length === 1) {
    return { buffer: list[0], audioMime: firstIsWav ? 'audio/wav' : 'audio/mpeg' };
  }
  return { buffer: Buffer.concat(list), audioMime: firstIsWav ? 'audio/wav' : 'audio/mpeg' };
}

// Dublagem real para vídeos pequenos e grandes (suporta WAV, WebM/Opus, MP3, MP4, OGG + trechos musicais/silenciosos)
async function dubWithOpenAI({ audioBase64, audioMime = 'audio/wav', language, dubVoice, targetLanguage = 'pt-BR', transcription: givenText = '' }) {
  try {
    const cleanB64 = String(audioBase64 || '').replace(/^data:[^;]+;base64,/, '');
    const audioBuf = Buffer.from(cleanB64, 'base64');
    const normMime = /webm/i.test(audioMime) ? 'audio/webm'
      : /ogg|opus/i.test(audioMime) ? 'audio/ogg'
      : /mp4|m4a|aac/i.test(audioMime) ? 'audio/mp4'
      : /mpeg|mp3/i.test(audioMime) ? 'audio/mpeg'
      : 'audio/wav';
    const ext = normMime.split('/')[1] || 'wav';
    const fileLabel = `audio.${ext}`;

    // Transcrição com cadeia: Whisper OpenAI → Gemini 3.1 Multimodal → Whisper/Omni Unorouter → (ou texto local)
    let originalText = String(givenText || '').trim();
    let whisperErr = '';
    let whisperInfo = originalText ? 'navegador (Whisper local)' : '';
    let heardSilence = false;

    try {
      if (!originalText && canUseOfficialOpenAI()) {
        const OpenAI = require('openai');
        const { toFile } = OpenAI;
        const openai = makeOpenAI();
        const file = await toFile(audioBuf, fileLabel, { type: normMime });
        const transcription = await openai.audio.transcriptions.create({
          file,
          model: 'whisper-1',
          language: language || undefined
        });
        originalText = (transcription.text || '').trim();
        if (!originalText) heardSilence = true;
      }
    } catch (e) {
      if (e.status === 401) markOpenAi401();
      whisperErr = 'openai: ' + e.message;
    }

    // Gemini 3.x (multimodal) — aceita nativamente WAV, WebM/Opus, MP3, OGG, MP4!
    if (!originalText && process.env.GEMINI_API_KEY) {
      try {
        const t = await geminiTranscribe(audioBuf, language, 32000, normMime);
        if (t === '__SILENCE__') {
          heardSilence = true;
        } else if (t) {
          originalText = t;
          whisperInfo = 'gemini/' + (_gemBest && _gemBest.audio ? _gemBest.audio : gemModel());
        } else {
          whisperErr += ' | gemini: resposta vazia';
        }
      } catch (e) { whisperErr += ' | gemini: ' + e.message; }
    }

    // Unorouter Whisper — chama DIRETO sem gastar o slot de 1 req/min em GET /models
    const uniKeysForAudio = allValidUniKeys();
    if (!originalText && !heardSilence && uniKeysForAudio.length) {
      for (const uKey of uniKeysForAudio) {
        if (originalText) break;
        for (const model of UNI_WHISPER_MODELS) {
          if (originalText) break;
          try {
            const fd = new FormData();
            fd.append('file', new Blob([audioBuf], { type: normMime }), fileLabel);
            fd.append('model', model);
            if (language) fd.append('language', language);
            const r = await fetch(uniBase() + '/audio/transcriptions', {
              method: 'POST',
              headers: { Authorization: uniHeaders(uKey).Authorization },
              body: fd,
              signal: AbortSignal.timeout(30000)
            });
            if (r.ok) {
              const j = await r.json();
              originalText = (j.text || '').trim();
              if (originalText) whisperInfo = 'unorouter/' + model;
              else heardSilence = true;
            } else {
              const errBody = (await r.text().catch(() => '')).slice(0, 100);
              whisperErr += ` | unorouter/${model}: HTTP ${r.status} ${errBody}`;
              if (r.status === 401) { _deadUniKeys.add(uKey); break; }
              if (r.status === 429 && /allows 1 request|Too many requests/i.test(errBody)) {
                markUniRateWindow(uKey);
                break;
              }
            }
          } catch (e) {
            whisperErr += ` | unorouter/${model}: ${e.message}`;
          }
        }
      }
    }

    // Camada extra: modelos OMNI (aceitam áudio no chat) se houver chave pronta
    const omniKey = pickReadyUniKey();
    if (!originalText && !heardSilence && omniKey && audioBuf.length < 9_000_000) {
      for (const model of ['qwen3.8-omni-flash', 'nemotron-3-nano-omni-30b-a3b-reasoning:free']) {
        if (originalText) break;
        try {
          const r = await fetch(uniBase() + '/chat/completions', {
            method: 'POST', headers: uniHeaders(omniKey),
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: [
                { type: 'input_audio', input_audio: { data: audioBuf.toString('base64'), format: ext } },
                { type: 'text', text: 'Transcreva este áudio. Se não houver fala humana, responda [silêncio]. Responda APENAS com o texto falado.' }
              ] }],
              max_tokens: 4000
            }),
            signal: AbortSignal.timeout(30000)
          });
          if (r.ok) {
            const j = await r.json();
            const t = (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || '').trim();
            if (/^\[?sil[êe]ncio\]?$/i.test(t)) { heardSilence = true; break; }
            if (t && !/não (consigo|posso|é possível)|cannot|unable/i.test(t)) { originalText = t; whisperInfo = 'unorouter/' + model + ' (omni)'; }
          } else {
            const txt = (await r.text().catch(() => '')).slice(0, 80);
            whisperErr += ` | unorouter/${model}(omni): HTTP ${r.status}`;
            if (r.status === 429 && /allows 1 request|Too many requests/i.test(txt)) { markUniRateWindow(omniKey); break; }
          }
        } catch (e) { whisperErr += ` | unorouter/${model}(omni): ${e.message}`; }
      }
    }

    // Remove marcações de closed-captions não faladas ([Music], [Música], (risos), ♪, alucinações de silêncio do Whisper)
    if (originalText) {
      const cleanedOrig = String(originalText)
        .replace(/\[[^\]]*\]|\([^)]*\)|[♪♫♬♩]+/g, ' ')
        .replace(/^(legendas pela comunidade.*|amara\.org.*|subtitles by.*|obrigado por assistir\.?)$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!cleanedOrig || /^(sil[êe]ncio|silence|music|m[úu]sica|aplausos|applause|risos|laughter|ru[íi]do|noise|sem fala|no speech|inaud[íi]vel|[.,!?;:—\-…]+)$/i.test(cleanedOrig)) {
        originalText = '';
        heardSilence = true;
      } else {
        originalText = cleanedOrig;
      }
    }

    // Se o trecho do vídeo for apenas música/efeitos/silêncio (comum em aberturas e vídeos longos!), preserva sem erro!
    if (!originalText && heardSilence) {
      return {
        silent: true,
        transcription: '',
        translation: '',
        dubInfo: `Trecho instrumental/silencioso detectado (${whisperInfo || 'IA'}) — áudio ambiente preservado.`,
        audioMp3Base64: null,
        audioMime: 'audio/wav'
      };
    }

    if (!originalText) throw new Error('Não foi possível transcrever o áudio. ' + whisperErr);

    // Tradução natural para locução sincronizada (mesma duração aproximada da fala original!)
    let tr = await chatWithFallback({
      system: 'Você é um diretor de dublagem profissional de cinema/streaming. Traduza a fala para o idioma alvo de forma natural, fluida e com duração de fala equivalente ao original (isocronia de dublagem). Não adicione comentários, notas nem aspas extras — devolva APENAS o texto traduzido pronto para ser falado.',
      user: `Traduza para ${targetLanguage}:\n\n${originalText}`
    });
    if (tr.error || !(tr.text || '').trim()) {
      // Fallback gratuito Google Translate GTX para nunca falhar na tradução se os LLMs estiverem em rate-limit
      try {
        const tl = String(targetLanguage || 'pt-BR').split(/\s/)[0];
        const gRes = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(originalText)}`, {
          signal: AbortSignal.timeout(10000)
        });
        if (gRes.ok) {
          const gJson = await gRes.json();
          const gText = Array.isArray(gJson?.[0]) ? gJson[0].map(seg => seg?.[0] || '').join('').trim() : '';
          if (gText) tr = { text: gText, provider: 'google-translate-free' };
        }
      } catch (e) {}
    }
    if (tr.error && !(tr.text || '').trim()) throw new Error('Tradução falhou: ' + tr.error);
    const translatedText = (tr.text || originalText).replace(/\[[^\]]*\]|\([^)]*\)|[♪♫♬♩]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!translatedText) {
      return {
        silent: true,
        transcription: originalText,
        translation: '',
        dubInfo: `Trecho sem fala traduzível (${whisperInfo || 'IA'}) — áudio ambiente preservado.`,
        audioMp3Base64: null,
        audioMime: 'audio/wav'
      };
    }

    const parts = [];
    let current = '';
    for (const sentence of translatedText.split(/(?<=[.!?…])\s+/)) {
      if (current && (current + ' ' + sentence).length > 2600) { parts.push(current); current = sentence; }
      else current = current ? current + ' ' + sentence : sentence;
    }
    if (current) parts.push(current);

    // Voz com fallback automático (Edge Neural HD → OpenAI → Gemini → Unorouter → Google → StreamElements para inglês)
    const audioParts = [];
    const usedProviders = new Set();
    for (const part of parts) {
      const t = await ttsWithFallback({ text: part, voice: dubVoice, lang: targetLanguage });
      if (t.error) throw new Error('Voz falhou: ' + t.error);
      audioParts.push(t.buffer);
      usedProviders.add(t.provider);
    }

    const merged = concatAudioBuffers(audioParts);
    return {
      silent: false,
      transcription: originalText,
      translation: translatedText,
      dubInfo: `Dublagem em ${targetLanguage} • Transcrição: ${whisperInfo || 'IA'} • Tradução: ${tr.provider || 'IA'} • Voz: ${dubVoice} (${[...usedProviders].join(', ')})`,
      audioMp3Base64: merged.buffer.toString('base64'),
      audioMime: merged.audioMime
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
  // Unorouter — o que a rota do usuário suporta
  out.unorouter = {};
  if (!process.env.UNOROUTER_API_KEY) {
    out.unorouter = { ok: false, error: 'sem UNOROUTER_API_KEY' };
  } else {
    try {
      const r = await fetch(uniBase() + '/models', { headers: { Authorization: uniHeaders().Authorization }, signal: AbortSignal.timeout(15000) });
      let models = []; try { const j = await r.json(); models = (j.data || []).map(m => m.id).filter(Boolean); } catch (e) {}
      out.unorouter.models = { ok: r.ok && models.length > 0, status: r.status, count: models.length, sample: models.slice(0, 6) };
      const first = models[0] || 'gpt-4o-mini';
      try {
        const r2 = await fetch(uniBase() + '/chat/completions', {
          method: 'POST', headers: uniHeaders(),
          body: JSON.stringify({ model: first, messages: [{ role: 'user', content: 'responda apenas: ok' }] }),
          signal: AbortSignal.timeout(25000)
        });
        let sample = ''; try { const j = await r2.json(); sample = j.choices ? (j.choices[0].message.content || '').slice(0, 20) : JSON.stringify(j).slice(0, 80); } catch (e) {}
        out.unorouter.chat = { ok: r2.ok && !!sample, status: r2.status, model: first, sample };
      } catch (e) { out.unorouter.chat = { ok: false, error: e.message }; }
      try {
        const r3 = await fetch(uniBase() + '/audio/speech', {
          method: 'POST', headers: uniHeaders(),
          body: JSON.stringify({ model: 'tts-1', voice: 'alloy', input: 'olá' }),
          signal: AbortSignal.timeout(30000)
        });
        const b = r3.ok ? Buffer.from(await r3.arrayBuffer()) : Buffer.alloc(0);
        out.unorouter.tts = { ok: r3.ok && b.length > 200, status: r3.status, bytes: b.length };
      } catch (e) { out.unorouter.tts = { ok: false, error: e.message }; }
      try {
        const r4 = await fetch(uniBase() + '/images/generations', {
          method: 'POST', headers: uniHeaders(),
          body: JSON.stringify({ model: 'dall-e-3', prompt: 'a red apple', n: 1, size: '1024x1024', response_format: 'b64_json' }),
          signal: AbortSignal.timeout(60000)
        });
        let kb = 0; try { const j = await r4.json(); kb = j && j.data && j.data[0] && j.data[0].b64_json ? Math.round(j.data[0].b64_json.length * 0.75 / 1024) : 0; } catch (e) {}
        out.unorouter.image = { ok: r4.ok && kb > 0, status: r4.status, kb };
      } catch (e) { out.unorouter.image = { ok: false, error: e.message }; }
    } catch (e) { out.unorouter.error = e.message; }
  }
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

// Sonda de diagnóstico: valida todas as IAs sem desperdiçar cota de 1 req/min em GET /models
async function probeOpenAI() {
  const oaRaw = String(process.env.OPENAI_API_KEY || '').trim();
  const uniRaw = String(process.env.UNOROUTER_API_KEY || '').trim();
  const report = { keyPresent: !!(oaRaw || uniRaw || process.env.GEMINI_API_KEY) };

  // 1) OpenAI (se for chave real da OpenAI) OU detecção automática de chave sk-... da rota Unorouter
  if (oaRaw) {
    if (uniRaw && oaRaw === uniRaw) {
      markOpenAi401();
      _openAiRedirectedToUni = true;
      report.models = { ok: true, count: 'rota Unorouter', info: 'chave sk-… vinculada ao Unorouter (ativa)' };
    } else if (canUseOfficialOpenAI()) {
      try {
        const openai = makeOpenAI();
        const models = await openai.models.list();
        report.models = { ok: true, count: (models.data || []).length, info: `${(models.data || []).length} modelos OpenAI` };
      } catch (e) {
        if (e.status === 401) {
          markOpenAi401();
          // Verifica se a chave sk-… colada em OPENAI_API_KEY na verdade pertence à rota Unorouter
          const worksOnUni = await testKeyOnUnorouter(oaRaw);
          if (worksOnUni.ok) {
            _openAiRedirectedToUni = true;
            report.models = { ok: true, count: 'Unorouter', info: 'chave sk-… reconhecida na rota Unorouter (integrada ao rodízio!)' };
          } else {
            report.models = { ok: true, skipped: true, info: 'chave sk-… antiga desativada automaticamente — usando Gemini + Unorouter + IAs grátis' };
          }
        } else {
          report.models = { ok: false, status: e.status, error: e.message };
        }
      }
    } else {
      report.models = _openAiRedirectedToUni
        ? { ok: true, count: 'Unorouter', info: 'chave sk-… integrada ao rodízio Unorouter' }
        : { ok: true, skipped: true, info: 'chave sk-… antiga ignorada — usando Gemini + Unorouter + IAs grátis' };
    }
  } else {
    report.models = { ok: true, skipped: true, info: 'opcional (usando Gemini + Unorouter + IAs grátis)' };
  }

  // 2) Gemini (Google) — texto + transcrição multimodal de áudio + voz neural TTS
  if (process.env.GEMINI_API_KEY) {
    try {
      const g = await geminiChat({ user: 'responda apenas: ok', maxTokens: 20, timeout: 12000 });
      report.gemini = g ? { ok: true, model: g.provider, reply: g.text.slice(0, 20) } : { ok: false, error: 'chave rejeitada (401/403)' };
    } catch (e) { report.gemini = { ok: false, error: e.message }; }
    try {
      const t = await geminiTranscribe(makeTestWav(), '', 15000);
      report.geminiAudio = { ok: true, info: `${(_gemBest && _gemBest.audio) || 'multimodal'} • OK` + (t ? ` (“${String(t).slice(0, 20)}”)` : ' (áudio de teste validado)') };
    } catch (e) { report.geminiAudio = { ok: false, error: e.message }; }
    try {
      const v = await geminiTTS('olá', 'nova', 14000);
      report.geminiTts = v && v.buffer ? { ok: true, provider: v.provider, bytes: v.buffer.length } : { ok: false, error: (v && v.error) || 'sem áudio' };
    } catch (e) { report.geminiTts = { ok: false, error: e.message }; }
  } else {
    report.gemini = { ok: false, error: 'sem GEMINI_API_KEY' };
    report.geminiAudio = { ok: false, error: 'sem GEMINI_API_KEY' };
    report.geminiTts = { ok: false, error: 'sem GEMINI_API_KEY' };
  }

  // 3) Unorouter — NUNCA chama GET /models antes (preserva o slot de 1 req/min!)
  const uKeys = allValidUniKeys();
  if (uKeys.length) {
    if (_lastUniProbeCache && (Date.now() - _lastUniProbeCache.at) < 55000) {
      report.unorouter = _lastUniProbeCache.data;
    } else {
      let uniRes = null;
      for (const uKey of uKeys) {
        try {
          const model = UNI_CHAT_MODELS[(_uniCursor++) % UNI_CHAT_MODELS.length];
          const t = await unorouterChat({ user: 'responda apenas: ok', model, maxTokens: 16, apiKey: uKey });
          uniRes = { ok: true, model, reply: t.slice(0, 20), info: `${model} • respondendo` };
          _lastUniProbeCache = { at: Date.now(), data: uniRes };
          break;
        } catch (e) {
          if (e.status === 401) { _deadUniKeys.add(uKey); continue; }
          if (e.status === 429 && /allows 1 request|Too many requests/i.test(e.message)) {
            markUniRateWindow(uKey);
            uniRes = { ok: true, rateLimited: true, model: 'tier grátis 1 req/min', info: 'chave autenticada • janela grátis 1 req/min em rodízio com Gemini' };
          } else {
            uniRes = { ok: false, error: e.message };
          }
        }
      }
      report.unorouter = uniRes || { ok: false, error: 'chave Unorouter rejeitada (401)' };
    }
  } else {
    report.unorouter = { ok: false, error: 'sem UNOROUTER_API_KEY' };
  }

  // 4) Provedores gratuitos (fallback permanente)
  try {
    const t = await chatViaPollinations({ user: 'responda apenas: ok', json: false });
    report.pollinationsText = { ok: true, reply: t.slice(0, 30) };
  } catch (e) { report.pollinationsText = { ok: false, error: e.message }; }
  try {
    const r = await fetch('https://image.pollinations.ai/prompt/a%20red%20apple?width=256&height=256&nologo=true&seed=1', { signal: AbortSignal.timeout(20000) });
    const b = r.ok ? Buffer.from(await r.arrayBuffer()) : Buffer.alloc(0);
    report.pollinationsImage = { ok: r.ok && b.length > 0, status: r.status, bytes: b.length };
  } catch (e) { report.pollinationsImage = { ok: false, error: e.message }; }
  try {
    try {
      const e = await edgeNeuralTTS({ text: 'Olá, tudo bem?', voice: 'nova', lang: 'pt-BR' });
      report.googleTts = { ok: true, bytes: e.buffer.length, info: `${e.provider} • voz humana neural realista ativa` };
    } catch (edgeErr) {
      const b = await ttsGoogle({ text: 'olá', lang: 'pt-BR' });
      report.googleTts = { ok: true, bytes: b.length };
    }
  } catch (e) { report.googleTts = { ok: false, error: e.message }; }
  return report;
}

// ============ CADEIA DE PROVEDORES (fallback automático + pool inteligente) ============
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let _openAiDeadKey = null;
let _openAiRedirectedToUni = false;
const _deadUniKeys = new Set();
const _uniKeyCooldown = {};
const _uniModelCooldown = {};
let _lastUniProbeCache = null;

// Modelos principais do Multi-IA Router (Unorouter — 265+ IAs integradas), ordenados pelos melhores para Criar Histórias & Personagens
const UNI_CHAT_MODELS = [
  'cohere-command-a:free',
  'gemini-3.1-flash-lite:free',
  'agnes-2.5-flash:free',
  'deepseek-r1-distill-qwen-32b:free'
];
const UNI_WHISPER_MODELS = ['whisper-large-v3-turbo:free', 'whisper:free'];
const UNI_TTS_MODELS = ['gpt-4o-mini-tts:free', 'aura-1:free'];
const UNI_IMG_MODELS = ['sdxl:free', 'flux.2', 'gpt-image-2.5'];

function makeOpenAI() {
  const OpenAI = require('openai');
  return new OpenAI({
    apiKey: String(process.env.OPENAI_API_KEY || '').trim(),
    maxRetries: 0,
    timeout: 25000,
    fetch: (...args) => fetch(...args)
  });
}
function markOpenAi401() {
  const oa = String(process.env.OPENAI_API_KEY || '').trim();
  if (oa) _openAiDeadKey = oa;
}
function canUseOfficialOpenAI() {
  const oa = String(process.env.OPENAI_API_KEY || '').trim();
  if (!oa || _openAiDeadKey === oa) return false;
  const uni = String(process.env.UNOROUTER_API_KEY || '').trim();
  if (uni && oa === uni) {
    _openAiDeadKey = oa;
    _openAiRedirectedToUni = true;
    return false;
  }
  return true;
}
function allValidUniKeys() {
  const parts = String(process.env.UNOROUTER_API_KEY || '')
    .split(/[,;\s]+/)
    .map(s => s.trim())
    .filter(Boolean);
  const oa = String(process.env.OPENAI_API_KEY || '').trim();
  if (oa && (_openAiDeadKey === oa || (parts.length && parts.includes(oa)))) {
    if (!parts.includes(oa)) parts.push(oa);
  }
  return [...new Set(parts)].filter(k => !_deadUniKeys.has(k));
}
function pickReadyUniKey() {
  const keys = allValidUniKeys();
  const now = Date.now();
  return keys.find(k => (now >= (_uniKeyCooldown[k] || 0))) || null;
}
function markUniRateWindow(key) {
  if (key) _uniKeyCooldown[key] = Date.now() + 60000;
  _uniCooldownUntil = Date.now() + 60000;
}

// --- Unorouter (rota de modelos fornecida pelo usuário) ---
function uniBase() { return (process.env.UNOROUTER_BASE_URL || 'https://api.unorouter.com/v1').replace(/\/$/, ''); }
function uniHeaders(customKey) {
  const key = String(customKey || pickReadyUniKey() || process.env.UNOROUTER_API_KEY || '').trim();
  return {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + key,
    'x-api-key': key,
    'HTTP-Referer': 'https://dubai-pro.vercel.app',
    'X-Title': 'DubAI PRO'
  };
}
async function testKeyOnUnorouter(candidateKey) {
  try {
    const t = await unorouterChat({ user: 'responda apenas: ok', model: UNI_CHAT_MODELS[0], maxTokens: 12, apiKey: candidateKey });
    const data = { ok: true, model: UNI_CHAT_MODELS[0], reply: t.slice(0, 20), info: `${UNI_CHAT_MODELS[0]} • respondendo` };
    _lastUniProbeCache = { at: Date.now(), data };
    return { ok: true };
  } catch (e) {
    if (e.status === 429) {
      markUniRateWindow(candidateKey);
      return { ok: true, rateLimited: true }; // autenticou (429 = chave válida no Unorouter!)
    }
    _deadUniKeys.add(candidateKey);
    return { ok: false };
  }
}

// Probe curto do Unorouter (diagnóstico ?check=5) — chat ANTES da descoberta de modelos
// (para o GET /models não "gastar" o slot de 1 req/min do tier grátis)
async function unorouterProbe() {
  const out = {};
  if (!process.env.UNOROUTER_API_KEY) return { ok: false, error: 'sem UNOROUTER_API_KEY' };
  // 1) chat primeiro, com modelos conhecidos do catálogo (2026-10)
  try {
    const list = ['agnes-2.5-flash:free', 'cohere-command-a:free', 'gemini-3.1-flash-lite:free', 'deepseek-r1-distill-qwen-32b:free'];
    let done = null; const errs = [];
    for (const model of list) {
      try {
        const t = await unorouterChat({ user: 'responda apenas: ok', model, maxTokens: 20 });
        done = { ok: true, model, reply: t.slice(0, 20) }; break;
      } catch (e) { errs.push(model + ': ' + e.message.slice(0, 90)); }
    }
    out.chat = done || { ok: false, error: errs.join(' | ').slice(0, 240) };
    out.lastSuccess = _lastUniChatOk; // evidência de sucesso em outra invocação (prova de vida)
  } catch (e) { out.chat = { ok: false, error: e.message }; }
  // 2) descoberta do catálogo
  try {
    const r = await fetch(uniBase() + '/models', { headers: uniHeaders(), signal: AbortSignal.timeout(10000) });
    const body = await r.text();
    let ids = [];
    try { ids = (JSON.parse(body).data || []).map(m => m.id).filter(Boolean); } catch (_) {}
    out.models = { ok: r.ok && ids.length > 0, status: r.status, count: ids.length, sample: ids.slice(0, 8), body: r.ok ? undefined : body.slice(0, 160) };
    out.detected = { chat: uniPickModels(ids).slice(0, 5), image: uniImageModels(ids), tts: uniTtsModels(ids) };
    out.modelList = ids;
  } catch (e) { out.models = { ok: false, error: e.message }; }
  try {
    const ttsIds = (out.detected && out.detected.tts) || [];
    if (!ttsIds.length) out.tts = { ok: false, status: 0, error: 'sem modelo de fala no catálogo do router' };
    else {
      let done = null; const errs = [];
      for (const model of ttsIds.slice(0, 2)) {
        const r = await fetch(uniBase() + '/audio/speech', {
          method: 'POST', headers: uniHeaders(),
          body: JSON.stringify({ model, voice: 'alloy', input: 'olá', response_format: 'mp3' }),
          signal: AbortSignal.timeout(15000)
        });
        if (r.ok) { done = { ok: true, status: 200, model, bytes: (await r.arrayBuffer()).byteLength }; break; }
        errs.push(model + ': HTTP ' + r.status + ' ' + (await r.text().catch(() => '')).slice(0, 90));
      }
      out.tts = done || { ok: false, error: errs.join(' | ').slice(0, 240) };
    }
  } catch (e) { out.tts = { ok: false, error: e.message }; }
  try {
    const imgIds = (out.detected && out.detected.image) || [];
    const tries = imgIds.slice(0, 2);
    let done = null; const errs = [];
    for (const model of tries) {
      const r = await fetch(uniBase() + '/images/generations', {
        method: 'POST', headers: uniHeaders(),
        body: JSON.stringify({ model, prompt: 'gato laranja', n: 1, size: '256x256' }),
        signal: AbortSignal.timeout(30000)
      });
      if (r.ok) { done = { ok: true, status: 200, model, info: 'suportado' }; break; }
      errs.push(model + ': HTTP ' + r.status + ' ' + (await r.text().catch(() => '')).slice(0, 90));
    }
    out.image = done || { ok: false, error: errs.join(' | ').slice(0, 240) };
  } catch (e) { out.image = { ok: false, error: e.message }; }
  // whisper de verdade: 1s de WAV sintético só pra ver se o endpoint de transcrição responde
  try {
    const wav = makeTestWav();
    const fd = new FormData();
    fd.append('file', new Blob([wav], { type: 'audio/wav' }), 't.wav');
    fd.append('model', 'whisper-large-v3-turbo:free');
    const r = await fetch(uniBase() + '/audio/transcriptions', {
      method: 'POST', headers: { Authorization: uniHeaders().Authorization }, body: fd,
      signal: AbortSignal.timeout(30000)
    });
    out.whisper = { ok: r.ok, status: r.status, model: 'whisper-large-v3-turbo:free', info: r.ok ? 'endpoint de transcrição OK' : (await r.text().catch(() => '')).slice(0, 120) };
  } catch (e) { out.whisper = { ok: false, error: e.message }; }
  delete out.modelList;
  return out;
}

// 1 segundo de WAV sintético (8 kHz, seno fraco) para testar o endpoint de transcrição
function makeTestWav() {
  const rate = 8000, secs = 1, n = rate * secs;
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const v = Math.round(Math.sin(2 * Math.PI * 440 * i / rate) * 3000);
    data.writeInt16LE(v, i * 2);
  }
  const hdr = Buffer.alloc(44);
  hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVE', 8);
  hdr.write('fmt ', 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(1, 22);
  hdr.writeUInt32LE(rate, 24); hdr.writeUInt32LE(rate * 2, 28); hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34);
  hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
  return Buffer.concat([hdr, data]);
}

let _uniModels = null;
let _uniCursor = 0;
let _uniCooldownUntil = 0;
let _lastUniChatOk = null;
async function unorouterModels() {
  if (_uniModels) return _uniModels;
  _uniModels = [];
  if (!process.env.UNOROUTER_API_KEY) return _uniModels;
  try {
    const r = await fetch(uniBase() + '/models', { headers: { Authorization: uniHeaders().Authorization }, signal: AbortSignal.timeout(15000) });
    if (r.ok) {
      const j = await r.json();
      _uniModels = (j.data || []).map(m => m.id).filter(Boolean);
    }
  } catch (e) { console.warn('unorouter models:', e.message); }
  return _uniModels;
}

// Chat via Unorouter (compatível com OpenAI) — usa chave do pool sem gastar cota em GET /models
async function unorouterChat({ system, user, json, model = 'agnes-2.5-flash:free', maxTokens = 4000, apiKey }) {
  const key = apiKey || pickReadyUniKey() || allValidUniKeys()[0];
  if (!key) throw Object.assign(new Error('sem chave Unorouter disponível'), { status: 401 });
  const body = {
    model,
    messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: user }],
    temperature: 0.8,
    max_tokens: maxTokens
  };
  const call = async (b) => fetch(uniBase() + '/chat/completions', {
    method: 'POST', headers: uniHeaders(key), body: JSON.stringify(b), signal: AbortSignal.timeout(35000)
  });
  let r = await call(body);
  if (!r.ok && json && (r.status === 400 || r.status === 422)) {
    delete body.response_format;
    r = await call(body);
  }
  if (!r.ok && r.status === 429) {
    const body429 = (await r.text().catch(() => '')).slice(0, 160);
    if (/allows 1 request|Too many requests/i.test(body429)) markUniRateWindow(key);
    throw Object.assign(new Error('HTTP 429 ' + body429), { status: 429 });
  }
  if (!r.ok) {
    if (r.status === 401) _deadUniKeys.add(key);
    throw Object.assign(new Error('HTTP ' + r.status + ' ' + (await r.text().catch(() => '')).slice(0, 120)), { status: r.status });
  }
  const j = await r.json();
  const text = j && j.choices && j.choices[0] && j.choices[0].message ? String(j.choices[0].message.content || '').trim() : '';
  if (!text) throw new Error('resposta vazia');
  _lastUniChatOk = { model, at: new Date().toISOString() };
  return text;
}

// Escolhe modelos de CHAT do catálogo (muitos modelos são de imagem/difusão). Prioriza :free.
function uniPickModels(ids) {
  const bad = /xl|sdxl|diffusion|stable|flux|dall|image|img2img|albedo|anything|ampony|absolutereality|realisticvision|dreamshaper|midjourney|kandinsky|cogview|playground|kling|sora|lcm|inpaint|controlnet|lora|vae|upscal|esrgan|gfpgan|face|restore/i;
  const chat = ids.filter(id => !bad.test(id));
  const free = chat.filter(id => /free/i.test(id));
  const prefer = free.filter(id => /chat|instruct|gpt|llama|deepseek|qwen|mistral|gemini|claude|kimi|phi|command|grok|nova|flash|thinking|reason|turbo|hermes|nous|agnes/i.test(id));
  const out = [];
  for (const id of [...prefer, ...free, ...chat]) { if (!out.includes(id)) out.push(id); if (out.length >= 6) break; }
  // nomes REAIS do catálogo como reserva (gpt-4o-mini não existe nesse router)
  return out.length ? out : ['agnes-2.5-flash:free', 'cohere-command-a:free', 'deepseek-r1-distill-qwen-32b:free'];
}
function uniImageModels(ids) {
  const imgs = ids.filter(id => /xl|sdxl|diffusion|stable|flux|dall|image|albedo|anything|ampony|dreamshaper|kandinsky|cogview|playground|realistic/i.test(id));
  const free = imgs.filter(id => /free/i.test(id));
  return [...free, ...imgs.filter(id => !/free/i.test(id))].slice(0, 6);
}
function uniTtsModels(ids) {
  const tts = ids.filter(id => /tts|speech|voice|audio|bark|kokoro|orpheus/i.test(id));
  const free = tts.filter(id => /free/i.test(id));
  return [...free, ...tts.filter(id => !/free/i.test(id))].slice(0, 4);
}

// Melhoria de roteiro (paridade HeyGen: Proofread + Filler word removal)
async function enhanceScript({ text, mode = 'polish' }) {
  const systems = {
    polish: 'Você é editor de roteiros para YouTube. Melhore o texto: corrija gramática, remova palavras de preenchimento (hum, é, tipo, sabe, basicamente, né, ah), deixe frases fluidas e naturais para locução. Mantenha o significado, o idioma e o tamanho aproximado. Devolva APENAS o texto final, sem comentários.',
    shorten: 'Você é editor de roteiros. Resuma o texto em até 60% do tamanho original, mantendo as ideias principais e um tom natural para locução. Devolva APENAS o texto final.',
    hype: 'Você é roteirista de YouTube. Reescreva o texto com mais energia e ganchos, mantendo fatos e idioma. Frases curtas, tom envolvente. Devolva APENAS o texto final.'
  };
  const r = await withRetries(() => chatWithFallback({
    system: systems[mode] || systems.polish,
    user: String(text || '').slice(0, 12000)
  }), 2);
  return r;
}

// Probe de vídeo/avatar/lip-sync no router (?check=6) — informa o roadmap "estilo HeyGen"
async function unorouterVideoProbe() {
  const out = { catalog: {}, endpoints: {} };
  if (!process.env.UNOROUTER_API_KEY) return { ok: false, error: 'sem UNOROUTER_API_KEY' };
  try {
    const r = await fetch(uniBase() + '/models', { headers: uniHeaders(), signal: AbortSignal.timeout(10000) });
    const j = await r.json().catch(() => ({}));
    const ids = (j.data || []).map(m => m.id).filter(Boolean);
    out.catalog.count = ids.length;
    out.catalog.videoLike = ids.filter(id => /video|veo|sora|kling|wan|hyun|hunyuan|^hy\d|hailuo|minimax-video|runway|pika|luma|dreammachine|avatar|lip|wav2lip|sadtalker|musetalk|echomimic|hallo|liveportrait|omnihuman|sonic/i.test(id)).slice(0, 25);
    out.catalog.imageToVideo = ids.filter(id => /i2v|img2vid|image-to-video|t2v|text-to-video/i.test(id)).slice(0, 15);
    out.catalog.speechOmni = ids.filter(id => /omni|aura|speech|voice|audio/i.test(id)).slice(0, 15);
  } catch (e) { out.catalog = { ok: false, error: e.message }; }
  // endpooints de vídeo (cada router nomeia diferente)
  for (const path of ['/videos/generations', '/video/generations', '/videos']) {
    try {
      const r = await fetch(uniBase() + path, {
        method: 'POST', headers: uniHeaders(),
        body: JSON.stringify({ model: 'hy4-preview', prompt: 'a red apple on a table', n: 1, duration: 2 }),
        signal: AbortSignal.timeout(12000)
      });
      const body = (await r.text().catch(() => '')).slice(0, 140);
      out.endpoints[path] = { status: r.status, ok: r.ok, body: r.ok ? body || 'ok' : body };
    } catch (e) { out.endpoints[path] = { status: 0, error: String(e.message || e).slice(0, 100) }; }
  }
  return out;
}

// --- Google Gemini (generativelanguage.googleapis.com) — geração 3.1 / 3 + Gemma 3 ---
function gemBase() { return (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta'); }
function gemModel() {
  const m = String(process.env.GEMINI_MODEL || '').trim().replace(/^models\//, '');
  // Ignora automaticamente nomes legados aposentados (1.5 / 2.0 / 2.5) caso ainda estejam na env
  if (!m || /^gemini-(1\.0|1\.5|2\.0|2\.5)/i.test(m)) return 'gemini-3.1-flash-lite-preview';
  return m;
}
function gemHeaders() {
  return { 'Content-Type': 'application/json', 'x-goog-api-key': String(process.env.GEMINI_API_KEY || '').trim() };
}

// Adapta automaticamente o body quando o modelo escolhido é Gemma 3 (14.400 req/dia grátis!)
function adaptGemBodyForModel(body, model) {
  if (!/^gemma-/i.test(model)) return body;
  const clone = JSON.parse(JSON.stringify(body));
  let prefix = '';
  if (clone.systemInstruction && clone.systemInstruction.parts) {
    prefix += clone.systemInstruction.parts.map(p => p.text || '').join('\n').trim();
    delete clone.systemInstruction;
  }
  if (clone.generationConfig && clone.generationConfig.responseMimeType === 'application/json') {
    prefix += (prefix ? '\n\n' : '') + 'IMPORTANTE: Responda APENAS com um objeto JSON válido, sem markdown e sem texto extra.';
    delete clone.generationConfig.responseMimeType;
  }
  if (prefix && clone.contents && clone.contents[0] && Array.isArray(clone.contents[0].parts)) {
    const tPart = clone.contents[0].parts.find(p => typeof p.text === 'string');
    if (tPart) tPart.text = `${prefix}\n\n${tPart.text}`;
    else clone.contents[0].parts.unshift({ text: prefix });
  }
  return clone;
}

const _gemDead404 = new Set();
const _gemUnsupported = new Set();
const _gemModelCooldown = {};
let _gemCursor = 0;

async function geminiGenerate({ model, body, timeout = 20000 }) {
  const payload = adaptGemBodyForModel(body, model);
  const r = await fetch(`${gemBase()}/models/${model}:generateContent`, {
    method: 'POST', headers: gemHeaders(), body: JSON.stringify(payload), signal: AbortSignal.timeout(timeout)
  });
  const raw = await r.text().catch(() => '');
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status} ${raw.slice(0, 220)}`), { status: r.status });
  return JSON.parse(raw || '{}');
}

// Descobre na própria API Google os modelos ativos com generateContent (cache 10min)
let _gemList = null;
let _gemListAt = 0;
async function geminiListModels() {
  if (_gemList && _gemList.length && (Date.now() - _gemListAt) < 600000) return _gemList;
  try {
    const r = await fetch(`${gemBase()}/models?pageSize=200`, { headers: gemHeaders(), signal: AbortSignal.timeout(8000) });
    if (r.ok) {
      const j = await r.json();
      const ids = (j.models || [])
        .filter(m => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent'))
        .map(m => String(m.name || '').replace(/^models\//, ''))
        .filter(Boolean);
      if (ids.length) {
        _gemList = ids;
        _gemListAt = Date.now();
      }
    }
  } catch (e) { /* mantém lista padrão de Gemini 3.1 / Gemma 3 */ }
  return _gemList || [];
}

function gemText(j) {
  const parts = (j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
  return parts.map(p => p.text || '').join('').trim();
}

// Prioriza Gemini 3.1 / 3 + Gemma 3 (14.400 RPD grátis!) e exclui modelos 1.5/2.0/2.5 aposentados (404)
let _gemBestModel = null;
let _gemBest = {};
async function geminiGenerateTried({ body, timeout = 20000, kind = 'chat' }) {
  const discovered = await geminiListModels();
  const notSpecial = id => !/image|imagen|tts|embed|veo|aegis|robotics|computer-use|aqa|bison|gecko|learnlm/i.test(id);
  const notRetired = id => !/^gemini-(1\.0|1\.5|2\.0|2\.5)-/i.test(id) && !_gemDead404.has(id) && !_gemUnsupported.has(`${kind}:${id}`);

  let candidates = [];
  if (kind === 'tts') {
    const discTts = discovered.filter(id => /tts/i.test(id) && !_gemDead404.has(id));
    candidates = [
      _gemBest.tts,
      'gemini-3.1-flash-tts-preview',
      ...discTts.filter(id => /3\.1|3-/i.test(id)),
      ...discTts
    ].filter(Boolean);
  } else if (kind === 'image') {
    const discImg = discovered.filter(id => /image|banana/i.test(id) && !/imagen-|understand|caption/i.test(id) && !_gemDead404.has(id));
    candidates = [
      _gemBest.image,
      ...discImg.filter(id => /3\.1|3-/i.test(id)),
      'gemini-3.1-flash-image-preview',
      'gemini-3-pro-image-preview',
      ...discImg
    ].filter(Boolean);
  } else if (kind === 'audio') {
    // Transcrição multimodal de áudio: usa todos os modelos Gemini 3.x / latest ativos (Gemma é só texto)
    const discAudio = discovered.filter(id => /^gemini-/i.test(id) && notSpecial(id) && notRetired(id));
    candidates = [
      _gemBest.audio,
      gemModel(),
      'gemini-3.1-flash-lite-preview',
      'gemini-3-flash-preview',
      'gemini-flash-lite-latest',
      'gemini-3.1-pro-preview',
      'gemini-3-pro-preview',
      ...discAudio.filter(id => /3\.1|3-|flash-lite/i.test(id)),
      ...discAudio,
      'gemini-pro-latest',
      'gemini-flash-latest'
    ].filter(Boolean).filter(id => /^gemini-/i.test(id) && notSpecial(id) && notRetired(id));
  } else {
    // Chat / Roteiro / Tradução / SEO: combina Gemini 3.1/3 + Gemma 3 27B/12B (14.400 req/dia grátis!)
    const wantsNativeJson = !!(body && body.generationConfig && body.generationConfig.responseMimeType === 'application/json');
    const discChat = discovered.filter(id => (/^gemini-/i.test(id) || /^gemma-3-(27b|12b)-it$/i.test(id)) && notSpecial(id) && notRetired(id));
    if (wantsNativeJson) {
      // Quando pede JSON estruturado (Criar História & Personagens), prioriza modelos Gemini 3.x com suporte nativo a responseMimeType='application/json'
      const jsonFirst = [
        gemModel(),
        'gemini-3.1-flash-lite-preview',
        'gemini-3-flash-preview',
        'gemini-3.1-pro-preview',
        'gemini-flash-lite-latest',
        'gemini-flash-latest',
        'gemini-pro-latest',
        'gemma-3-27b-it',
        'gemma-3-12b-it',
        ...discChat
      ].filter(Boolean).filter(id => notSpecial(id) && notRetired(id));
      candidates = [...new Set(jsonFirst)];
    } else {
      const pool = [
        gemModel(),
        'gemini-3.1-flash-lite-preview',
        'gemma-3-27b-it',
        'gemini-3-flash-preview',
        'gemini-flash-lite-latest',
        'gemma-3-12b-it',
        'gemini-3.1-pro-preview',
        ...discChat,
        'gemini-pro-latest',
        'gemini-flash-latest'
      ].filter(Boolean).filter(id => notSpecial(id) && notRetired(id));
      const uniquePool = [...new Set(pool)];
      const shift = uniquePool.length > 1 ? ((_gemCursor++) % Math.min(uniquePool.length, 4)) : 0;
      const rotated = [...uniquePool.slice(shift), ...uniquePool.slice(0, shift)];
      candidates = (_gemBest.chat && rotated.includes(_gemBest.chat))
        ? [_gemBest.chat, ...rotated.filter(x => x !== _gemBest.chat)]
        : rotated;
    }
  }

  const unique = [...new Set(candidates)].filter(id => !_gemDead404.has(id) && !_gemUnsupported.has(`${kind}:${id}`));
  const now = Date.now();
  // Modelos livres vêm primeiro; modelos que acabaram de dar 429 ficam por último
  const ordered = [
    ...unique.filter(m => now >= (_gemModelCooldown[m] || 0)),
    ...unique.filter(m => now < (_gemModelCooldown[m] || 0))
  ];

  const errs = [];
  let realTries = 0;
  for (const model of ordered) {
    if (realTries >= 6) break;
    try {
      const j = await geminiGenerate({ model, body, timeout });
      _gemBest[kind] = model;
      _gemBestModel = model;
      delete _gemModelCooldown[model];
      return j;
    } catch (e) {
      if (e.status === 401 || e.status === 403 || (e.status === 400 && /API_KEY_INVALID|API key not valid/i.test(e.message))) {
        throw e;
      }
      // 404 = modelo aposentado: memoriza para nunca mais tentar e NÃO gasta tentativa!
      if (e.status === 404) {
        _gemDead404.add(model);
        continue;
      }
      // 400 = modalidade não suportada por esse modelo: memoriza kind:model e pula na hora
      if (e.status === 400) {
        _gemUnsupported.add(`${kind}:${model}`);
        continue;
      }
      realTries++;
      if (e.status === 429 || e.status === 503) {
        _gemModelCooldown[model] = Date.now() + 45000;
        errs.push(model + ': HTTP ' + e.status);
        continue;
      }
      errs.push(model + ': ' + (e.status ? 'HTTP ' + e.status : e.message).slice(0, 90));
    }
  }
  throw new Error(errs.join(' | ') || 'nenhum modelo Gemini respondeu');
}
// Texto/JSON (roteiro, tradução, SEO)
async function geminiChat({ system, user, json, maxTokens = 8000, timeout = 20000 }) {
  if (!process.env.GEMINI_API_KEY) return null;
  try {
    const body = {
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: Math.min(maxTokens || 8000, 8192) }
    };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    if (json) body.generationConfig.responseMimeType = 'application/json';
    const j = await geminiGenerateTried({ body, timeout, kind: 'chat' });
    const text = gemText(j);
    if (!text) throw new Error('resposta vazia');
    return { text, provider: 'gemini/' + (_gemBest.chat || _gemBestModel || gemModel()) };
  } catch (e) {
    if (e.status === 401 || e.status === 403) return null; // chave: não adianta insistir
    throw new Error(`gemini: ${(e.status ? 'HTTP ' + e.status + ' — ' : '')}${e.message}`);
  }
}
// Transcrição de áudio (multimodal) — suporta WAV, WebM/Opus, MP3, OGG, MP4 e sinaliza [silêncio] explicitamente
async function geminiTranscribe(audioBuf, language, timeout = 30000, audioMime = 'audio/wav') {
  if (!process.env.GEMINI_API_KEY) return null;
  const body = {
    contents: [{ role: 'user', parts: [
      { inlineData: { mimeType: audioMime || 'audio/wav', data: Buffer.from(audioBuf).toString('base64') } },
      { text: 'Transcreva fielmente a fala deste áudio' + (language ? ` no idioma ${language}` : '') + '. Se não houver fala humana audível (apenas música, ruído ou silêncio), responda exatamente: [silêncio]. Responda APENAS com o texto transcrito, sem comentários.' }
    ] }],
    generationConfig: { temperature: 0.1 }
  };
  const j = await geminiGenerateTried({ body, timeout, kind: 'audio' });
  const text = gemText(j);
  if (/^\[?sil[êe]ncio\]?$/i.test(String(text || '').trim())) return '__SILENCE__';
  return (text || '').trim();
}
// Imagem da cena (família Gemini 3 Image)
async function geminiImage(prompt, timeout = 12000) {
  if (!process.env.GEMINI_API_KEY) return null;
  try {
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
    };
    const j = await geminiGenerateTried({ body, timeout, kind: 'image' });
    const parts = (j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
    for (const p of parts) {
      if (p.inlineData && p.inlineData.data) {
        return { imageBase64: p.inlineData.data, mime: p.inlineData.mimeType || 'image/png', model: 'gemini/' + (_gemBest.image || _gemBestModel || 'image') };
      }
    }
  } catch (e) { /* segue na cadeia */ }
  return null;
}

// --- TTS via Gemini (o que faltava na cadeia de voz) ---
// O Gemini devolve PCM 24kHz; convertemos pra MP3 (lamejs) pra caber junto
// com os demais provedores de voz.
let _lameMod = undefined;
async function _loadLame() {
  if (_lameMod === undefined) {
    try { _lameMod = await import('@breezystack/lamejs'); } catch (e) { _lameMod = null; }
  }
  return _lameMod;
}
function pcmToMp3(pcmBuf) {
  const lame = _lameMod;
  if (!lame || !lame.Mp3Encoder) return null;
  try {
    const enc = new lame.Mp3Encoder(1, 24000, 128);
    const samples = new Int16Array(pcmBuf.buffer, pcmBuf.byteOffset, Math.floor(pcmBuf.length / 2));
    const chunks = [];
    for (let i = 0; i < samples.length; i += 1152) {
      const b = enc.encodeBuffer(samples.subarray(i, Math.min(i + 1152, samples.length)));
      if (b.length) chunks.push(Buffer.from(b));
    }
    const end = enc.flush();
    if (end.length) chunks.push(Buffer.from(end));
    return Buffer.concat(chunks);
  } catch (e) { return null; }
}
const GEM_TTS_VOICES = { onyx: 'Charon', nova: 'Aoede', alloy: 'Kore', echo: 'Puck', fable: 'Fenrir', shimmer: 'Leda', ash: 'Orus', coral: 'Zephyr', sage: 'Enceladus' };
const GEM_VOICE_STYLE = {
  onyx: 'com voz masculina grave de cinema, quente, pausada, respiração humana natural e presença marcante',
  nova: 'com voz feminina brasileira calorosa, simpática, entonação viva de conversa real e naturalidade absoluta',
  alloy: 'com voz executiva sofisticada, clara, serena e ritmo humano fluido de telejornal moderno',
  echo: 'com voz masculina jovem de podcast, descontraída, espontânea e super natural, como um amigo conversando',
  fable: 'com voz expressiva de contador de histórias, emoção genuína nas palavras e cadência envolvente',
  shimmer: 'com voz feminina jovem, doce, expressiva e entonação humana autêntica',
  ash: 'com voz masculina firme, confiante, articulada e timbre humano encorpado',
  coral: 'com voz feminina vibrante, carismática, sorridente e cheia de vida',
  sage: 'com voz calma de documentário, aveludada, reflexiva e perfeitamente humana'
};
async function geminiTTS(text, voice = 'onyx', timeout = 20000, lang = 'pt-BR') {
  if (!process.env.GEMINI_API_KEY) return null;
  await _loadLame();
  const voiceName = GEM_TTS_VOICES[voice] || 'Aoede';
  const cleanText = String(text || '')
    .replace(/\*\*|__|\[.*?\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 4000)
    .replace(/"/g, "'");
  const isPt = /^pt/i.test(lang || 'pt-BR');
  const styleHint = GEM_VOICE_STYLE[voice] || GEM_VOICE_STYLE.nova;
  const directorPrompt = isPt
    ? `Fale em português brasileiro nativo ${styleHint}, sem jamais soar robótico: "${cleanText}"`
    : `Speak naturally like a real human studio actor with authentic emotion and breathing (${lang}): "${cleanText}"`;

  const body = {
    contents: [{ parts: [{ text: directorPrompt }] }],
    generationConfig: {
      maxOutputTokens: 8192,
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
    }
  };
  const j = await geminiGenerateTried({ body, timeout, kind: 'tts' });
  const parts = (j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
  for (const p of parts) {
    if (p.inlineData && p.inlineData.data) {
      const pcm = Buffer.from(p.inlineData.data, 'base64');
      if (pcm.length < 1000) continue;
      const mp3 = pcmToMp3(pcm);
      if (mp3 && mp3.length > 500) return { buffer: mp3, provider: 'gemini/' + (_gemBestModel || 'tts') };
      const wav = wrapPcmAsWav(pcm, 24000);
      return { buffer: wav, provider: 'gemini/' + (_gemBestModel || 'tts') + '(wav)' };
    }
  }
  const summary = parts.map(p => Object.keys(p).join('+') + (p.inlineData ? ':' + (p.inlineData.mimeType || '?') : '')).join(', ');
  const raw = JSON.stringify(j || {}).slice(0, 280);
  return { error: `sem áudio (modelo ${_gemBestModel || '?'}, lame=${!!_lameMod}, parts: ${summary || 'nenhuma'}) raw: ${raw}` };
}

// PCM mono L16 LE → WAV (fallback quando o encoder MP3 não carrega)
function wrapPcmAsWav(pcm, rate = 24000) {
  const hdr = Buffer.alloc(44);
  hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write('WAVE', 8);
  hdr.write('fmt ', 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(1, 22);
  hdr.writeUInt32LE(rate, 24); hdr.writeUInt32LE(rate * 2, 28); hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34);
  hdr.write('data', 36); hdr.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([hdr, pcm]);
}

// Repete a cadeia em caso de falha (provedores gratuitos limitam rajadas)
async function withRetries(fn, times = 2) {
  let last = { error: 'sem tentativas' };
  for (let i = 0; i < times; i++) {
    last = await fn();
    if (!last.error) return last;
    if (/sem OPENAI_API_KEY.*sem GEMINI_API_KEY.*sem UNOROUTER_API_KEY.*fetch failed/i.test(last.error)) return last;
    if (i < times - 1) await sleep(2000);
  }
  return last;
}

function extractJson(text) {
  if (!text) return null;
  let clean = String(text)
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
  try { return JSON.parse(clean); } catch (e) {}
  const m = clean.match(/\{[\s\S]*\}/);
  if (m) {
    const rawObj = m[0];
    try { return JSON.parse(rawObj); } catch (e) {}
    // Repara vírgulas finais antes de } ou ] e quebras de linha literais
    const repaired = rawObj
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/[\u0000-\u0019]+/g, ' ');
    try { return JSON.parse(repaired); } catch (e) {}
  }
  return null;
}

// IA Gratuita 1 (Sem Chave): Pollinations OpenAI-Compatible Multi-Model (GPT-4o-large / GPT-4o-mini / DeepSeek V3 / Mistral / Llama)
async function chatViaPollinations({ system, user, json, validator = null }) {
  const sysMsg = (system ? system : 'Você é um diretor de cinema e contador de histórias.') + (json ? '\nResponda APENAS um objeto JSON válido, sem blocos markdown e sem comentários.' : '');
  let lastErr = new Error('pollinations indisponível');
  const polModels = ['openai-large', 'openai', 'deepseek', 'mistral', 'llama'];
  for (const model of polModels) {
    try {
      const seed = Math.floor(Math.random() * 900000) + 1000;
      const payload = {
        model,
        seed,
        messages: [
          { role: 'system', content: sysMsg },
          { role: 'user', content: user }
        ],
        temperature: 0.82
      };
      if (json) {
        payload.jsonMode = true;
        payload.response_format = { type: 'json_object' };
      }
      const r = await fetch('https://text.pollinations.ai/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 DubAI-Studio/2.0' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(22000)
      });
      if (r.status === 429) { lastErr = new Error('HTTP 429 (limite de uso)'); await sleep(800); continue; }
      if (!r.ok) { lastErr = new Error('HTTP ' + r.status); continue; }
      const rawTxt = await r.text().catch(() => '');
      let text = '';
      try {
        const j = JSON.parse(rawTxt);
        text = j && j.choices && j.choices[0] && j.choices[0].message ? String(j.choices[0].message.content || '').trim() : rawTxt.trim();
      } catch (_) {
        text = rawTxt.trim();
      }
      if (!text) { lastErr = new Error('resposta vazia'); continue; }
      if (validator && !validator(text)) { lastErr = new Error(`modelo ${model} retornou estrutura incompleta`); continue; }
      if (json && !extractJson(text)) { lastErr = new Error(`modelo ${model} retornou JSON inválido`); continue; }
      return text;
    } catch (e) {
      lastErr = e;
      if (/fetch failed|ENOTFOUND|ECONNREFUSED/i.test(e.message)) throw lastErr;
    }
  }
  // GET fallback para prompts curtos
  const short = ((system ? system + '\n\n' : '') + user).slice(0, 900);
  for (const url of [
    'https://text.pollinations.ai/' + encodeURIComponent(short) + '?model=openai&seed=' + Math.floor(Math.random() * 9999),
    'https://text.pollinations.ai/' + encodeURIComponent(short)
  ]) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(18000) });
      if (!r.ok) { lastErr = new Error('HTTP ' + r.status); continue; }
      const text = (await r.text()).trim();
      if (!text) { lastErr = new Error('resposta vazia'); continue; }
      if (validator && !validator(text)) continue;
      return text;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

// IA Gratuita 2 (Sem Chave): HackClub Free AI Endpoint (Llama 3.3 70B / Qwen)
async function chatViaHackClub({ system, user, json, validator = null }) {
  const sysMsg = (system ? system : 'Você é um diretor de cinema e contador de histórias.') + (json ? '\nResponda APENAS um objeto JSON válido, sem markdown.' : '');
  const r = await fetch('https://ai.hackclub.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 DubAI-Studio/2.0' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: sysMsg },
        { role: 'user', content: user }
      ],
      temperature: 0.8
    }),
    signal: AbortSignal.timeout(20000)
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  const text = j && j.choices && j.choices[0] && j.choices[0].message ? String(j.choices[0].message.content || '').trim() : '';
  if (!text) throw new Error('resposta vazia');
  if (validator && !validator(text)) throw new Error('estrutura JSON incompleta');
  return text;
}

// Orquestrador Multi-IA do Unorouter: puxa o modelo escolhido ou rotaciona entre as melhores IAs do router
async function unorouterSmartChat({ system, user, json = false, preferredModel = '', maxTokens = 4500, validator = null }) {
  const uKeys = allValidUniKeys();
  if (!uKeys.length) return { error: 'unorouter: sem UNOROUTER_API_KEY' };

  const now = Date.now();
  // Para tarefas JSON (Criar História & Personagens), mantém os modelos diretos (sem bloco <think>) no topo da rotação
  const fastJsonList = ['cohere-command-a:free', 'gemini-3.1-flash-lite:free', 'agnes-2.5-flash:free'];
  const rotIdx = (_uniCursor++) % fastJsonList.length;
  const rotatedFast = [...fastJsonList.slice(rotIdx), ...fastJsonList.slice(0, rotIdx)];
  const baseList = [...rotatedFast, 'deepseek-r1-distill-qwen-32b:free'];
  if (_uniModels && _uniModels.length) {
    for (const m of uniPickModels(_uniModels)) {
      if (!baseList.includes(m)) baseList.push(m);
    }
  }

  let orderedModels = [
    ...baseList.filter(m => now >= (_uniModelCooldown[m] || 0)),
    ...baseList.filter(m => now < (_uniModelCooldown[m] || 0))
  ];
  const cleanPref = String(preferredModel || '').trim();
  if (cleanPref && cleanPref !== 'auto-router' && cleanPref !== 'gemini-direct') {
    orderedModels = [cleanPref, ...orderedModels.filter(m => m !== cleanPref)];
  }

  const errors = [];
  for (const uKey of uKeys) {
    if (Date.now() < (_uniKeyCooldown[uKey] || 0)) {
      errors.push('unorouter: chave em janela de 1 req/min');
      continue;
    }
    let triedCount = 0;
    for (const model of orderedModels) {
      if (triedCount >= 4) break;
      triedCount++;
      try {
        const text = await unorouterChat({ system, user, json, model, maxTokens, apiKey: uKey });
        if (json && !extractJson(text)) {
          errors.push(`unorouter/${model}: JSON incompleto`);
          continue;
        }
        if (validator && !validator(text)) {
          errors.push(`unorouter/${model}: cenas incompletas`);
          continue;
        }
        delete _uniModelCooldown[model];
        return { text, provider: 'unorouter/' + model };
      } catch (e) {
        const msg = `${(e.status ? 'HTTP ' + e.status + ' — ' : '')}${e.message}`;
        errors.push(`unorouter/${model}: ${msg}`);
        if (e.status === 401) {
          _deadUniKeys.add(uKey);
          break;
        }
        if (e.status === 429) {
          _uniModelCooldown[model] = Date.now() + 45000;
          // Se o limite for global da conta (1 req/min), pula para o próximo provedor da cadeia sem travar
          if (/allows 1 request per minute/i.test(e.message)) {
            markUniRateWindow(uKey);
            break;
          }
          continue;
        }
      }
    }
  }
  return { error: errors.join(' | ') || 'unorouter indisponível' };
}

// Chat com cadeia inteligente Multi-IA: Unorouter Multi-IA (265+ modelos) ↔ Gemini 3.1 / Gemma 3 27B → OpenAI → Pollinations GPT-4o/DeepSeek → HackClub Llama 3.3 70B
async function chatWithFallback({ system, user, json = false, maxTokens = 8000, preferredModel = '', validator = null }) {
  const errors = [];
  const preferGeminiFirst = preferredModel === 'gemini-direct';

  // 1) Se o usuário não pediu Gemini direto, puxa PRIMEIRO o Multi-IA Router (Unorouter: Cohere Command-A + Gemini 3.1 + Agnes 2.5 + DeepSeek R1)
  if (!preferGeminiFirst && allValidUniKeys().length) {
    const uni = await unorouterSmartChat({ system, user, json, preferredModel, maxTokens, validator });
    if (uni && uni.text) return uni;
    if (uni && uni.error) errors.push(uni.error);
  }

  // 2) Gemini 3.1 / Gemma 3 27B — alta velocidade e suporte nativo a JSON Schema
  if (process.env.GEMINI_API_KEY) {
    try {
      const g = await geminiChat({ system, user, json, maxTokens });
      if (g && (!json || extractJson(g.text)) && (!validator || validator(g.text))) return g;
      errors.push('gemini: resposta incompleta ou chave em cooldown');
    } catch (e) { errors.push(e.message); }
  } else errors.push('gemini: sem GEMINI_API_KEY');

  // 3) Se preferGeminiFirst estava ativo e Gemini falhou, tenta o Multi-IA Router (Unorouter) agora
  if (preferGeminiFirst && allValidUniKeys().length) {
    const uni = await unorouterSmartChat({ system, user, json, preferredModel: 'auto-router', maxTokens, validator });
    if (uni && uni.text) return uni;
    if (uni && uni.error) errors.push(uni.error);
  }

  // 4) OpenAI oficial (se configurada e válida)
  if (canUseOfficialOpenAI()) {
    for (const model of ['gpt-4o-mini', 'gpt-4o']) {
      try {
        const openai = makeOpenAI();
        const body = {
          model,
          messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: user }],
          temperature: 0.8,
          max_tokens: maxTokens
        };
        if (json) body.response_format = { type: 'json_object' };
        const c = await openai.chat.completions.create(body);
        const text = (c.choices[0].message.content || '').trim();
        if (!text) throw new Error('resposta vazia');
        if (validator && !validator(text)) throw new Error('estrutura incompleta');
        return { text, provider: 'openai/' + model };
      } catch (e) {
        errors.push(`openai/${model}: ${(e.status ? 'HTTP ' + e.status + ' — ' : '')}${e.message}`);
        if (e.status === 401) { markOpenAi401(); break; }
      }
    }
  }

  // 5) Pollinations Multi-Model Free AI (GPT-4o-large / GPT-4o-mini / DeepSeek V3 / Mistral / Llama 3.3)
  try {
    const text = await chatViaPollinations({ system, user, json, validator });
    return { text, provider: 'pollinations-ai(gpt-4o/deepseek)' };
  } catch (e) {
    errors.push('pollinations: ' + e.message);
  }

  // 6) HackClub Free AI (Llama 3.3 70B)
  try {
    const text = await chatViaHackClub({ system, user, json, validator });
    return { text, provider: 'hackclub-ai(llama-70b)' };
  } catch (e) {
    errors.push('hackclub: ' + e.message);
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
      } catch (e) {
        lastErr = e;
        if (/fetch failed|ENOTFOUND|ECONNREFUSED/i.test(e.message)) throw lastErr;
        await sleep(1200);
      }
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

async function ttsStreamElementsChunks({ text, voice = 'Brian' }) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + 1100, clean.length);
    if (end < clean.length) {
      const space = clean.lastIndexOf(' ', end);
      if (space > start) end = space;
    }
    chunks.push(clean.slice(start, end).trim());
    start = end;
    while (clean[start] === ' ') start++;
  }
  const buffers = [];
  for (const chunk of chunks) buffers.push(await ttsStreamElements({ text: chunk, voice }));
  if (!buffers.length) throw new Error('texto vazio');
  return Buffer.concat(buffers);
}

async function unorouterTTS({ text, voice = 'onyx' }) {
  const keys = allValidUniKeys().filter(key => Date.now() >= (_uniKeyCooldown[key] || 0));
  if (!keys.length) throw new Error('sem chave Unorouter disponível');
  const input = String(text || '').trim().slice(0, 4096);
  if (!input) throw new Error('texto vazio');
  const voiceName = TTS_VOICES[voice] || 'alloy';
  const models = [...new Set([...UNI_TTS_MODELS, 'tts-1'])];
  const errors = [];

  for (const key of keys) {
    for (const model of models) {
      try {
        const response = await fetch(uniBase() + '/audio/speech', {
          method: 'POST',
          headers: uniHeaders(key),
          body: JSON.stringify({ model, voice: voiceName, input, response_format: 'mp3' }),
          signal: AbortSignal.timeout(25000)
        });
        if (!response.ok) {
          const detail = (await response.text().catch(() => '')).slice(0, 120);
          if (response.status === 401) {
            _deadUniKeys.add(key);
            errors.push(`${model}: HTTP 401`);
            break;
          }
          if (response.status === 429 && /allows 1 request|too many requests/i.test(detail)) {
            markUniRateWindow(key);
            errors.push(`${model}: HTTP 429 (limite temporário)`);
            break;
          }
          errors.push(`${model}: HTTP ${response.status}${detail ? ' ' + detail : ''}`);
          continue;
        }
        const contentType = response.headers && response.headers.get('content-type') || '';
        const buffer = Buffer.from(await response.arrayBuffer());
        if (/application\/(?:json|problem\+json)/i.test(contentType)) {
          errors.push(`${model}: resposta JSON inesperada`);
          continue;
        }
        if (buffer.length < 250) {
          errors.push(`${model}: áudio vazio/curto`);
          continue;
        }
        return { buffer, provider: `unorouter/${model}` };
      } catch (err) {
        errors.push(`${model}: ${String(err && err.message || err).slice(0, 120)}`);
      }
    }
  }
  throw new Error(errors.join(' | ').slice(0, 500) || 'nenhum modelo TTS do Unorouter respondeu');
}

const TTS_LANGS = { 'pt-BR': 'pt-BR', pt: 'pt-BR', en: 'en-US', es: 'es-MX', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', ja: 'ja-JP' };

// Matriz de Vozes Humanas Neurais de Estúdio HD (Microsoft Azure Neural & DragonHD Multilingual — 24kHz 96kbps MP3, zero tom robótico!)
const EDGE_VOICE_PRESETS = {
  onyx:    { voice: 'pt-BR-AntonioNeural',              rate: '+2%', pitch: '-1Hz', label: 'Antônio Cinema Neural' },
  nova:    { voice: 'pt-BR-FranciscaNeural',            rate: '+2%', pitch: '+0Hz', label: 'Francisca Natural Neural' },
  shimmer: { voice: 'pt-BR-ThalitaMultilingualNeural',  rate: '+3%', pitch: '+1Hz', label: 'Thalita HD Multilingual' },
  echo:    { voice: 'en-US-AndrewMultilingualNeural',   rate: '+3%', pitch: '+0Hz', label: 'Andrew HD Podcast' },
  coral:   { voice: 'en-US-AvaMultilingualNeural',      rate: '+3%', pitch: '+1Hz', label: 'Ava HD Expressiva' },
  fable:   { voice: 'en-US-BrianMultilingualNeural',    rate: '+2%', pitch: '+0Hz', label: 'Brian HD Narrador' },
  sage:    { voice: 'en-US-EmmaMultilingualNeural',     rate: '+1%', pitch: '+0Hz', label: 'Emma HD Documentário' },
  ash:     { voice: 'fr-FR-RemyMultilingualNeural',     rate: '+2%', pitch: '-1Hz', label: 'Remy HD Firme' },
  alloy:   { voice: 'fr-FR-VivienneMultilingualNeural', rate: '+2%', pitch: '+0Hz', label: 'Vivienne HD Estúdio' }
};

// Modulação dramática de emoção para que os personagens atuem de verdade (nunca robótico!)
const EMOTION_PROSODY_OFFSET = {
  excited:     { rateDelta: 5,  pitchDelta: 3 },
  surprised:   { rateDelta: 6,  pitchDelta: 4 },
  happy:       { rateDelta: 4,  pitchDelta: 2 },
  warm:        { rateDelta: 1,  pitchDelta: 1 },
  curious:     { rateDelta: 2,  pitchDelta: 2 },
  determined:  { rateDelta: 4,  pitchDelta: -1 },
  tense:       { rateDelta: -2, pitchDelta: -2 },
  sad:         { rateDelta: -5, pitchDelta: -3 },
  storyteller: { rateDelta: 0,  pitchDelta: -1 }
};

const EDGE_LANG_NATIVE = {
  'en-US': { male: 'en-US-AndrewMultilingualNeural', female: 'en-US-AvaMultilingualNeural' },
  'es-MX': { male: 'es-MX-JorgeNeural', female: 'es-MX-DaliaNeural' },
  'fr-FR': { male: 'fr-FR-RemyMultilingualNeural', female: 'fr-FR-VivienneMultilingualNeural' },
  'de-DE': { male: 'de-DE-FlorianMultilingualNeural', female: 'de-DE-SeraphinaMultilingualNeural' },
  'it-IT': { male: 'it-IT-GiuseppeMultilingualNeural', female: 'it-IT-IsabellaNeural' },
  'ja-JP': { male: 'ja-JP-KeitaNeural', female: 'ja-JP-NanamiNeural' }
};

function sanitizeTextForHumanSSML(raw) {
  return String(raw || '')
    .replace(/\*\*|__|`|~~/g, '')
    .replace(/^\s*[-•*]\s+/gm, '')
    // Substitui travessões e reticências por vírgula suave (nunca injeta tag <break> crua que derruba o stream!)
    .replace(/\s*(?:—|--|\.\.\.|…)\s*/g, ', ')
    .replace(/&/g, ' e ')
    .replace(/[<>]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const EDGE_TTS_HANDSHAKE_COOLDOWN_MS = 5 * 60 * 1000;
let _edgeTtsUnavailableUntil = 0;

function isEdgeTtsHandshakeFailure(err) {
  return /Unexpected server response:\s*200\b/i.test(String(err && err.message || err || ''));
}

async function edgeNeuralTTS({ text, voice = 'onyx', lang = 'pt-BR' }) {
  if (_edgeTtsUnavailableUntil > Date.now()) {
    throw new Error('Edge TTS temporariamente pausado após falha no handshake WebSocket (HTTP 200)');
  }
  const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
  const locale = TTS_LANGS[lang] || 'pt-BR';
  const preset = EDGE_VOICE_PRESETS[voice] || EDGE_VOICE_PRESETS.onyx;
  const isFemale = ['nova', 'shimmer', 'coral', 'sage', 'alloy'].includes(voice);

  // Timbre, tom e velocidade 100% travados do começo ao fim do vídeo para que o dublador seja sempre o mesmo!
  const finalRate = preset.rate || '+2%';
  const finalPitch = preset.pitch || '+0Hz';

  let lockedVoice = preset.voice;
  if (locale !== 'pt-BR' && !/Multilingual/i.test(lockedVoice) && EDGE_LANG_NATIVE[locale]) {
    lockedVoice = isFemale ? EDGE_LANG_NATIVE[locale].female : EDGE_LANG_NATIVE[locale].male;
  }

  // Divide textos grandes em segmentos de até 1500 caracteres para síntese rápida e sem cortes
  const cleanAll = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleanAll) throw new Error('texto vazio');
  const segments = [];
  let cur = '';
  for (const s of cleanAll.split(/(?<=[.!?…])\s+/)) {
    if (cur && (cur.length + s.length + 1) > 1500) { segments.push(cur); cur = s; }
    else cur = cur ? cur + ' ' + s : s;
  }
  if (cur) segments.push(cur);

  // Sintetiza CADA segmento exclusivamente com o MESMO dublador (lockedVoice), com até 4 tentativas por segmento (NUNCA muda de voz!)
  const mp3Buffers = [];
  let lastErr = null;
  const metaOpts = /Multilingual/i.test(lockedVoice) ? { voiceLocale: locale } : {};

  for (const seg of segments) {
    const ssmlSafe = sanitizeTextForHumanSSML(seg);
    if (!ssmlSafe) continue;
    let segSuccess = false;
    for (let attempt = 0; attempt < 4 && !segSuccess; attempt++) {
      const tts = new MsEdgeTTS({ connectionTimeoutMs: 10000, synthesisTimeoutMs: 24000 });
      try {
        await tts.setMetadata(lockedVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, metaOpts);
        const { audioStream } = tts.toStream(ssmlSafe, { rate: finalRate, pitch: finalPitch });
        const segBuf = await new Promise((resolve, reject) => {
          const chunks = [];
          const timer = setTimeout(() => {
            try { audioStream.destroy(); } catch (_) {}
            reject(new Error('timeout de síntese neural'));
          }, 24000);
          audioStream.on('data', d => chunks.push(Buffer.from(d)));
          audioStream.once('end', () => { clearTimeout(timer); resolve(Buffer.concat(chunks)); });
          audioStream.once('close', () => { clearTimeout(timer); resolve(Buffer.concat(chunks)); });
          audioStream.once('error', err => { clearTimeout(timer); reject(err); });
        });
        try { tts.close(); } catch (_) {}
        if (!segBuf || segBuf.length < 250) throw new Error('áudio neural curto/vazio');
        mp3Buffers.push(segBuf);
        segSuccess = true;
      } catch (err) {
        lastErr = err;
        try { tts.close(); } catch (_) {}
        if (isEdgeTtsHandshakeFailure(err)) {
          // HTTP 200 em vez de upgrade WebSocket não é transitório para esta tentativa:
          // evita repetir a mesma conexão quatro vezes e segue para os outros provedores.
          _edgeTtsUnavailableUntil = Date.now() + EDGE_TTS_HANDSHAKE_COOLDOWN_MS;
          break;
        }
        if (attempt < 3) await sleep(350 * (attempt + 1));
      }
    }
    if (!segSuccess) {
      throw lastErr || new Error('falha na síntese neural HD');
    }
    _edgeTtsUnavailableUntil = 0;
  }

  if (!mp3Buffers.length) throw lastErr || new Error('áudio neural vazio');
  return { buffer: Buffer.concat(mp3Buffers), provider: `neural-hd/${lockedVoice}` };
}

async function runTtsProviderChain(attempts = []) {
  const errors = [];
  for (const attempt of attempts) {
    const name = attempt && attempt.name || 'tts';
    try {
      const result = await attempt.run();
      if (result && result.error) throw new Error(result.error);
      let buffer = Buffer.isBuffer(result) ? result : result && result.buffer;
      if (buffer && !Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);
      if (!buffer || buffer.length < 250) throw new Error('áudio vazio/curto');
      const details = Buffer.isBuffer(result) ? {} : result;
      return { ...details, buffer, provider: details.provider || name };
    } catch (err) {
      errors.push(`${name}: ${String(err && err.message || err).slice(0, 300)}`);
    }
  }
  if (!errors.length) errors.push('nenhum provedor TTS configurado');
  return { error: errors.join(' | '), errors };
}

// Voz com fallback real: Edge HD → OpenAI → Gemini → Unorouter → Google (e StreamElements para inglês).
// Se o handshake WebSocket do Edge responder HTTP 200, ele entra em cooldown e os próximos trechos
// seguem direto para outro provedor, em vez de repetir uma conexão que já falhou.
async function ttsWithFallback({ text, voice = 'onyx', lang = 'pt-BR', emotion = '' } = {}, testProviders = null) {
  const cleanText = String(text || '').trim();
  if (!cleanText) return { error: 'texto vazio', errors: ['texto vazio'] };

  // Injeção interna para testes unitários; as rotas HTTP não encaminham dados do usuário aqui.
  if (testProviders && typeof testProviders === 'object') {
    const attempts = [];
    const injected = [
      ['neural-hd', testProviders.edge],
      ['openai/mock', testProviders.openai],
      ['gemini-tts', testProviders.gemini],
      ['unorouter-tts', testProviders.unorouter],
      ['google-translate-tts', testProviders.google],
      ['streamelements-tts', testProviders.streamElements]
    ];
    for (const [name, provider] of injected) {
      if (typeof provider === 'function') {
        attempts.push({ name, run: () => provider({ text: cleanText, voice, lang, emotion }) });
      }
    }
    return runTtsProviderChain(attempts);
  }

  const attempts = [
    { name: 'neural-hd', run: () => edgeNeuralTTS({ text: cleanText, voice, lang, emotion }) }
  ];

  // OpenAI oficial só entra quando há uma chave própria (não a chave do Unorouter).
  if (canUseOfficialOpenAI()) {
    for (const model of ['gpt-4o-mini-tts', 'tts-1-hd', 'tts-1']) {
      attempts.push({
        name: 'openai/' + model,
        run: async () => {
          if (!canUseOfficialOpenAI()) throw new Error('chave OpenAI indisponível');
          const openai = makeOpenAI();
          const opts = {
            model,
            voice: TTS_VOICES[voice] || 'onyx',
            input: cleanText.slice(0, 4096),
            response_format: 'mp3'
          };
          if (model === 'gpt-4o-mini-tts') {
            opts.instructions = 'Fale como um dublador humano brasileiro autêntico, mantendo sempre o mesmo timbre, tom e cadência do início ao fim.';
          }
          try {
            const speech = await openai.audio.speech.create(opts);
            return { buffer: Buffer.from(await speech.arrayBuffer()), provider: 'openai/' + model };
          } catch (err) {
            if (err.status === 401) markOpenAi401();
            throw err;
          }
        }
      });
    }
  }

  if (process.env.GEMINI_API_KEY) {
    attempts.push({
      name: 'gemini-tts',
      run: async () => {
        const result = await geminiTTS(cleanText, voice, 20000, lang);
        if (!result || result.error) throw new Error(result && result.error || 'sem áudio Gemini');
        return result;
      }
    });
  }

  if (allValidUniKeys().length) {
    attempts.push({ name: 'unorouter-tts', run: () => unorouterTTS({ text: cleanText, voice }) });
  }

  attempts.push({
    name: 'google-translate-tts',
    run: async () => ({
      buffer: await ttsGoogle({ text: cleanText, lang: String(lang || 'pt-BR').split(/[-_]/)[0].toLowerCase() }),
      provider: 'google-translate-tts'
    })
  });

  if (/^en(?:[-_]|$)/i.test(String(lang || ''))) {
    const streamVoice = ['nova', 'shimmer', 'coral', 'sage', 'alloy'].includes(voice) ? 'Amy' : 'Brian';
    attempts.push({
      name: 'streamelements-tts',
      run: async () => ({
        buffer: await ttsStreamElementsChunks({ text: cleanText, voice: streamVoice }),
        provider: 'streamelements/' + streamVoice
      })
    });
  }

  return runTtsProviderChain(attempts);
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

// ============ AVATAR FALANTE (estilo HeyGen — Fase 2 + ponte Fase 3) ============

// Retrato frontal de apresentador/personagem com lábios fechados/neutros — ideal para animação labial (lip-sync)
async function generateAvatarPortrait({ prompt = '', style = 'studio' }) {
  const styleDesc = {
    studio: 'photorealistic cinema character portrait, 85mm lens, soft key and rim lighting, atmospheric depth background',
    news: 'photorealistic TV news anchor portrait, broadcast newsroom studio background, crisp lighting, professional blazer',
    creator: 'photorealistic creator portrait in cozy RGB studio with soft warm lamps, natural friendly expression',
    exec: 'photorealistic executive portrait in bright modern glass office, confident approachable expression',
    pixar: '3D Pixar and Disney stylized animated character portrait, expressive eyes, warm soft illumination, rich backdrop'
  }[style] || 'photorealistic cinema character portrait, soft studio lighting';

  const subject = String(prompt || '').replace(/\s+/g, ' ').trim().slice(0, 220) || 'charismatic Brazilian story protagonist';
  const fullPrompt = `${styleDesc}, ${subject}, centered front-facing head and shoulders portrait, looking straight at camera, symmetrical face centered in frame, relaxed closed mouth, both eyes clearly visible, no hands near face, no text, no watermark`.slice(0, 380);

  const errors = [];
  if (canUseOfficialOpenAI()) {
    const openai = makeOpenAI();
    const attempts = [
      { model: 'gpt-image-1', size: '1024x1024', quality: 'medium', n: 1, output_format: 'jpeg' },
      { model: 'dall-e-3', size: '1024x1024', quality: 'standard', n: 1, response_format: 'b64_json' }
    ];
    for (const opts of attempts) {
      try {
        const img = await openai.images.generate({ prompt: fullPrompt, ...opts });
        const b64 = img.data[0].b64_json;
        if (b64) return { imageBase64: b64, mime: opts.output_format === 'jpeg' ? 'image/jpeg' : 'image/png', model: 'openai/' + opts.model };
      } catch (e) {
        errors.push(`openai/${opts.model}: ${e.message}`);
        if (e.status === 401) { markOpenAi401(); break; }
      }
    }
  }

  // 1) Pollinations Flux Portrait (Grátis, rápido e consistente com a estética do personagem)
  const fluxPortraitModel = style === 'pixar' ? 'flux-3d' : 'flux-realism';
  for (const [w, h, mdl] of [[768, 768, fluxPortraitModel], [768, 768, 'flux'], [512, 512, 'turbo']]) {
    try {
      const seed = Math.floor(Math.random() * 900000) + 10000;
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${w}&height=${h}&nologo=true&enhance=true&safe=false&seed=${seed}` + (mdl ? `&model=${mdl}` : '');
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
        },
        signal: AbortSignal.timeout(12000)
      });
      if (!r.ok) { errors.push(`pollinations ${w}x${h}: HTTP ${r.status}`); continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 1000) return { imageBase64: buf.toString('base64'), mime: r.headers.get('content-type') || 'image/jpeg', model: `pollinations/${mdl || 'flux'}-${w}x${h}` };
    } catch (e) {
      errors.push(`pollinations ${w}x${h}: ${e.message}`);
      if (/fetch failed|ENOTFOUND|ECONNREFUSED/i.test(e.message)) break;
    }
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      const g = await geminiImage(fullPrompt, 10000);
      if (g && g.imageBase64) return g;
      errors.push('gemini/image: sem imagem');
    } catch (e) { errors.push('gemini/image: ' + e.message); }
  }
  const uKey = pickReadyUniKey();
  if (uKey) {
    for (const model of UNI_IMG_MODELS) {
      try {
        const r = await fetch(uniBase() + '/images/generations', {
          method: 'POST', headers: uniHeaders(uKey),
          body: JSON.stringify({ model, prompt: fullPrompt, n: 1, size: '1024x1024', response_format: 'b64_json' }),
          signal: AbortSignal.timeout(22000)
        });
        if (r.ok) {
          const j = await r.json();
          const b64 = j && j.data && j.data[0] && j.data[0].b64_json;
          const url = j && j.data && j.data[0] && j.data[0].url;
          if (b64) return { imageBase64: b64, mime: 'image/png', model: 'unorouter/' + model };
          if (url) {
            const fr = await fetch(url, { signal: AbortSignal.timeout(18000) });
            if (fr.ok) {
              const buf = Buffer.from(await fr.arrayBuffer());
              if (buf.length > 200) return { imageBase64: buf.toString('base64'), mime: fr.headers.get('content-type') || 'image/png', model: 'unorouter/' + model };
            }
          }
        } else {
          const txt = (await r.text().catch(() => '')).slice(0, 100);
          errors.push(`unorouter/${model}: HTTP ${r.status}`);
          if (r.status === 401) { _deadUniKeys.add(uKey); break; }
          if (r.status === 429 && /allows 1 request|Too many requests/i.test(txt)) { markUniRateWindow(uKey); break; }
        }
      } catch (e) { errors.push(`unorouter/${model}: ${e.message}`); }
    }
  }
  for (const [w, h, mdl] of [[1024, 1024, 'flux'], [768, 768, ''], [512, 512, '']]) {
    try {
      const seed = Math.floor(Math.random() * 100000);
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${w}&height=${h}&nologo=true&seed=${seed}` + (mdl ? `&model=${mdl}` : '');
      const r = await fetch(url, { signal: AbortSignal.timeout(18000) });
      if (!r.ok) { errors.push(`pollinations ${w}x${h}: HTTP ${r.status}`); continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 500) return { imageBase64: buf.toString('base64'), mime: r.headers.get('content-type') || 'image/jpeg', model: `pollinations-${w}x${h}(free)` };
    } catch (e) {
      errors.push(`pollinations ${w}x${h}: ${e.message}`);
      if (/fetch failed|ENOTFOUND|ECONNREFUSED/i.test(e.message)) break;
    }
  }
  return { error: errors.join(' | ') || 'nenhum provedor de retrato respondeu' };
}

// Gera monólogo falado natural para o apresentador (sem rubricas, pronto para locução e lip-sync)
async function generateAvatarScript({ topic, durationSec = 30, tone = 'natural' }) {
  const words = Math.max(25, Math.min(650, Math.round((Number(durationSec) || 30) * 2.2)));
  const toneMap = {
    natural: 'conversacional, carismático e claro, como um ótimo apresentador falando direto para a câmera',
    sales: 'persuasivo, energético, com gancho forte nos primeiros 3 segundos, benefícios claros e chamada para ação final',
    edu: 'didático, acolhedor, com exemplo simples e fácil de entender',
    news: 'jornalístico, confiável, direto ao ponto e objetivo'
  };
  const system = `Você escreve falas para um apresentador virtual (estilo HeyGen). Escreva APENAS as palavras exatas que serão faladas em voz alta, em português brasileiro, sem títulos, sem [rubricas], sem emojis, sem asteriscos. Tom ${toneMap[tone] || toneMap.natural}. Aproximadamente ${words} palavras.`;
  const user = `Assunto da apresentação: "${String(topic || '').trim()}".`;
  const r = await withRetries(() => chatWithFallback({ system, user, maxTokens: 2500 }), 2);
  if (!r.error && r.text) {
    return {
      text: r.text.replace(/\*\*|\[.*?\]|\(.*?\)/g, '').replace(/\s{2,}/g, ' ').trim(),
      provider: r.provider,
      mode: 'openai'
    };
  }
  // Fallback local imediato se estiver em modo MOCK offline
  const cleanTopic = String(topic || 'inteligência artificial aplicada a vídeos').trim();
  return {
    text: `Olá! Seja muito bem-vindo. Hoje quero falar direto com você sobre ${cleanTopic}. Muita gente acha que produzir conteúdo profissional leva horas de gravação, iluminação e edição, mas com o DubAI PRO você transforma qualquer ideia em uma apresentação dinâmica em poucos cliques. Gostou? Então aproveite para testar sua própria voz, personalizar o cenário e baixar seu vídeo pronto para publicar!`,
    provider: 'mock-local',
    mode: 'mock',
    warning: r.error
  };
}

// Ponte Fase 3 (Image-to-Video via Unorouter hy4-preview / hy3 quando houver saldo; senão informa fallback local)
async function generateAvatarVideo({ imageBase64, prompt = '', duration = 5 }) {
  const uKey = pickReadyUniKey() || allValidUniKeys()[0];
  if (!uKey) {
    return { ok: false, fallback: 'canvas-lipsync', reason: 'sem UNOROUTER_API_KEY configurada' };
  }
  try {
    const model = 'hy4-preview';
    const motionPrompt = `Realistic talking presenter speaking naturally directly to camera, subtle head nods, natural eye blinks, lip movements, studio lighting. ${prompt}`.slice(0, 500);
    const payload = {
      model,
      prompt: motionPrompt,
      duration: Math.min(10, Math.max(3, Number(duration) || 5))
    };
    if (imageBase64) payload.image = `data:image/jpeg;base64,${String(imageBase64).replace(/^data:[^;]+;base64,/, '')}`;
    const r = await fetch(uniBase() + '/video/generations', {
      method: 'POST',
      headers: uniHeaders(uKey),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45000)
    });
    const raw = await r.text().catch(() => '');
    if (!r.ok) {
      return {
        ok: false,
        fallback: 'canvas-lipsync',
        status: r.status,
        model,
        reason: /balance|credit|insufficient/i.test(raw) ? 'saldo Unorouter zerado (usando motor Lip-Sync local)' : `HTTP ${r.status}: ${raw.slice(0, 120)}`
      };
    }
    const j = JSON.parse(raw || '{}');
    const url = (j.data && j.data[0] && j.data[0].url) || j.video_url || j.url;
    const b64 = (j.data && j.data[0] && j.data[0].b64_json) || j.b64_json;
    if (b64) return { ok: true, videoBase64: b64, mime: 'video/mp4', provider: 'unorouter/' + model };
    if (url) {
      const vr = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (vr.ok) {
        const buf = Buffer.from(await vr.arrayBuffer());
        if (buf.length > 1000) return { ok: true, videoBase64: buf.toString('base64'), mime: vr.headers.get('content-type') || 'video/mp4', provider: 'unorouter/' + model };
      }
    }
    return { ok: false, fallback: 'canvas-lipsync', model, reason: 'resposta sem vídeo direto (' + raw.slice(0, 100) + ')' };
  } catch (e) {
    return { ok: false, fallback: 'canvas-lipsync', reason: e.message };
  }
}

// Leitura Facial por Visão Computacional IA (Gemini Vision / GPT-4o Vision / Unorouter Vision)
// Detecta coordenadas normalizadas (0.000 a 1.000) de olho esquerdo, olho direito, boca, largura labial e queixo
async function detectAvatarFaceLandmarks({ imageBase64, mime = 'image/jpeg' }) {
  const cleanB64 = String(imageBase64 || '').replace(/^data:[^;]+;base64,/, '').trim();
  if (!cleanB64 || cleanB64.length < 100) {
    return { ok: false, error: 'Imagem inválida para leitura facial.' };
  }

  const visionPrompt = `Analyze this square portrait image (1:1 aspect ratio, where x=0.0 is left edge, x=1.0 is right edge, y=0.0 is top edge, y=1.0 is bottom edge).
Return ONLY a valid JSON object with the exact normalized coordinates (numbers between 0.05 and 0.95 with 3 decimal places) of the subject's face for lip-sync and eye-blink animation:
{
  "eyeLX": <x of center of the eye on the viewer's LEFT side>,
  "eyeLY": <y of center of the eye on the viewer's LEFT side>,
  "eyeRX": <x of center of the eye on the viewer's RIGHT side>,
  "eyeRY": <y of center of the eye on the viewer's RIGHT side>,
  "eyeW": <width of one eye from inner to outer corner divided by image width, typically 0.055 to 0.110>,
  "eyeH": <vertical opening height of one eye divided by image height, typically 0.024 to 0.055>,
  "mx": <x of exact center of the mouth where upper and lower lips meet>,
  "my": <y of exact center of the mouth where upper and lower lips meet>,
  "mouthW": <total horizontal width of mouth from left corner to right corner divided by image width, typically 0.085 to 0.190>,
  "chinY": <y of bottom tip of the chin>,
  "faceW": <width of the face from left cheek to right cheek divided by image width, typically 0.25 to 0.65>,
  "faceH": <height of the face from forehead hairline to chin tip divided by image height, typically 0.30 to 0.75>
}
Ensure eyeLX < eyeRX and eyeLY < my < chinY. Output JSON only.`;

  const sanitizeLandmarks = (rawObj, provider) => {
    if (!rawObj || typeof rawObj !== 'object') return null;
    const num = (v, def, min, max) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def;
    };
    let eyeLX = num(rawObj.eyeLX, 0.432, 0.15, 0.80);
    let eyeRX = num(rawObj.eyeRX, 0.568, 0.20, 0.85);
    if (eyeLX > eyeRX) { const t = eyeLX; eyeLX = eyeRX; eyeRX = t; }
    if (eyeRX - eyeLX < 0.05) {
      const mid = (eyeLX + eyeRX) * 0.5;
      eyeLX = mid - 0.06;
      eyeRX = mid + 0.06;
    }
    const eyeDist = eyeRX - eyeLX;
    const eyeLY = num(rawObj.eyeLY, 0.403, 0.12, 0.72);
    const eyeRY = num(rawObj.eyeRY, eyeLY, 0.12, 0.72);
    const meanEyeY = (eyeLY + eyeRY) * 0.5;
    const mx = num(rawObj.mx, (eyeLX + eyeRX) * 0.5, 0.18, 0.82);
    const my = num(rawObj.my, Math.min(0.84, meanEyeY + eyeDist * 1.08), meanEyeY + 0.05, 0.88);
    const faceW = num(rawObj.faceW, Math.max(0.24, eyeDist * 2.35), 0.18, 0.78);
    const faceH = num(rawObj.faceH, Math.max(0.28, (my - meanEyeY) * 2.85), 0.22, 0.85);
    const eyeW = num(rawObj.eyeW, eyeDist * 0.44, 0.035, 0.16);
    const eyeH = num(rawObj.eyeH, eyeW * 0.44, 0.018, 0.085);
    const mouthW = num(rawObj.mouthW, eyeDist * 0.82, 0.055, 0.26);
    const chinY = num(rawObj.chinY, Math.min(0.94, my + (my - meanEyeY) * 0.62), my + 0.03, 0.96);

    return {
      ok: true,
      provider,
      landmarks: { eyeLX, eyeLY, eyeRX, eyeRY, eyeW, eyeH, mx, my, mouthW, chinY, faceW, faceH }
    };
  };

  const errors = [];

  // 1) Gemini Vision (gemini-2.5-flash / gemini-2.0-flash)
  if (process.env.GEMINI_API_KEY) {
    const models = [process.env.GEMINI_MODEL || 'gemini-2.5-flash', 'gemini-2.0-flash'];
    for (const mdl of [...new Set(models)]) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${mdl}:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: visionPrompt },
                { inline_data: { mime_type: mime || 'image/jpeg', data: cleanB64 } }
              ]
            }],
            generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
          }),
          signal: AbortSignal.timeout(12000)
        });
        if (r.ok) {
          const j = await r.json();
          const txt = j?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const m = txt.match(/\{[\s\S]*\}/);
          if (m) {
            const parsed = sanitizeLandmarks(JSON.parse(m[0]), `gemini/${mdl}`);
            if (parsed) return parsed;
          }
        } else {
          errors.push(`gemini/${mdl}: HTTP ${r.status}`);
        }
      } catch (e) {
        errors.push(`gemini/${mdl}: ${e.message}`);
      }
    }
  }

  // 2) OpenAI Vision (gpt-4o-mini)
  if (canUseOfficialOpenAI()) {
    try {
      const openai = makeOpenAI();
      const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: visionPrompt },
            { type: 'image_url', image_url: { url: `data:${mime || 'image/jpeg'};base64,${cleanB64}`, detail: 'low' } }
          ]
        }]
      });
      const txt = resp.choices?.[0]?.message?.content || '';
      const m = txt.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = sanitizeLandmarks(JSON.parse(m[0]), 'openai/gpt-4o-mini');
        if (parsed) return parsed;
      }
    } catch (e) {
      errors.push('openai/vision: ' + e.message);
    }
  }

  // 3) Unorouter Vision
  const uKey = pickReadyUniKey();
  if (uKey) {
    for (const mdl of ['gpt-4o-mini', 'gemini-2.0-flash']) {
      try {
        const r = await fetch(uniBase() + '/chat/completions', {
          method: 'POST',
          headers: uniHeaders(uKey),
          body: JSON.stringify({
            model: mdl,
            temperature: 0.1,
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: visionPrompt },
                { type: 'image_url', image_url: { url: `data:${mime || 'image/jpeg'};base64,${cleanB64}` } }
              ]
            }]
          }),
          signal: AbortSignal.timeout(12000)
        });
        if (r.ok) {
          const j = await r.json();
          const txt = j?.choices?.[0]?.message?.content || '';
          const m = txt.match(/\{[\s\S]*\}/);
          if (m) {
            const parsed = sanitizeLandmarks(JSON.parse(m[0]), `unorouter/${mdl}`);
            if (parsed) return parsed;
          }
        }
      } catch (e) {
        errors.push(`unorouter/${mdl}: ${e.message}`);
      }
    }
  }

  return { ok: false, error: errors.join(' | ') || 'Visão IA indisponível no momento (usando detector neural local)' };
}

// ============================================================================
// ✂️ OPUSCLIP AI ENGINE (Engenharia Reversa: ClipAnything™ + Virality Score™)
// ============================================================================

async function transcribeClipSegment({ audioBase64, audioMime = 'audio/wav', language = '', offsetSec = 0, durationSec = 20 }) {
  if (!audioBase64) return { text: '', segments: [], silent: true, provider: 'none', timingGranularity: 'none' };
  const cleanB64 = String(audioBase64).replace(/^data:[^;]+;base64,/, '');
  const audioBuf = Buffer.from(cleanB64, 'base64');
  const normMime = /webm/i.test(audioMime) ? 'audio/webm'
    : /ogg|opus/i.test(audioMime) ? 'audio/ogg'
    : /mp4|m4a|aac/i.test(audioMime) ? 'audio/mp4'
    : /mpeg|mp3/i.test(audioMime) ? 'audio/mpeg'
    : 'audio/wav';
  const ext = normMime.split('/')[1] || 'wav';
  const fileLabel = `clip.${ext}`;
  const baseOffset = Math.max(0, Number(offsetSec) || 0);
  const segSpan = Math.max(2, Number(durationSec) || 20);
  const transcriptionTimeoutMs = Math.min(45000, Math.max(14000, 10000 + segSpan * 220));

  let text = '';
  let rawWhisperSegments = [];
  let rawWhisperWords = [];
  let provider = '';
  let heardSilence = false;
  let textOnlyFallback = '';
  let textOnlyProvider = '';

  const wordsFromSegments = (segments) => (Array.isArray(segments) ? segments : [])
    .flatMap(seg => Array.isArray(seg?.words) ? seg.words : []);
  const hasTimedEntries = (items) => Array.isArray(items) && items.some(item => {
    const start = Number(item?.start ?? item?.start_time);
    const end = Number(item?.end ?? item?.end_time);
    return Number.isFinite(start) && Number.isFinite(end) && end > start;
  });
  const textFromTimedItems = (words, segments) => {
    const wordText = (Array.isArray(words) ? words : [])
      .map(word => String(word?.word ?? word?.text ?? '').trim())
      .filter(Boolean)
      .join(' ');
    if (wordText) return wordText;
    return (Array.isArray(segments) ? segments : [])
      .map(segment => String(segment?.text || '').trim())
      .filter(Boolean)
      .join(' ');
  };

  // Tenta primeiro provedores Whisper: Gemini retorna texto, mas não fornece timestamps de palavra.
  // Sem essa ordem, o resultado do Gemini impedia a chamada ao Whisper e forçava estimativa por tamanho do texto.
  const uKey = pickReadyUniKey();
  if (!heardSilence && uKey) {
    for (const model of UNI_WHISPER_MODELS) {
      try {
        let r = null;
        for (const requestWordGranularity of [true, false]) {
          const fd = new FormData();
          fd.append('file', new Blob([audioBuf], { type: normMime }), fileLabel);
          fd.append('model', model);
          fd.append('response_format', 'verbose_json');
          if (requestWordGranularity) {
            fd.append('timestamp_granularities[]', 'word');
            fd.append('timestamp_granularities[]', 'segment');
          }
          if (language) fd.append('language', language);
          r = await fetch(uniBase() + '/audio/transcriptions', {
            method: 'POST',
            headers: { Authorization: uniHeaders(uKey).Authorization },
            body: fd,
            signal: AbortSignal.timeout(transcriptionTimeoutMs)
          });
          // Alguns endpoints OpenAI-compatíveis aceitam verbose_json, mas não o parâmetro de granularidade.
          if (r.ok || r.status === 429 || ![400, 422].includes(r.status)) break;
        }
        if (r && r.ok) {
          const j = await r.json();
          const candidateWords = Array.isArray(j.words) && j.words.length ? j.words : wordsFromSegments(j.segments);
          const candidateSegments = Array.isArray(j.segments) ? j.segments : [];
          const candidateText = String(j.text || '').trim() || textFromTimedItems(candidateWords, candidateSegments);
          if (candidateText && !textOnlyFallback) {
            textOnlyFallback = candidateText;
            textOnlyProvider = 'unorouter/' + model;
          }
          if (hasTimedEntries(candidateWords) || hasTimedEntries(candidateSegments)) {
            rawWhisperWords = candidateWords;
            rawWhisperSegments = candidateSegments;
            text = candidateText;
            provider = 'unorouter/' + model;
            break;
          }
        } else if (r && r.status === 429) {
          markUniRateWindow(uKey);
          break;
        }
      } catch (_) {}
    }
  }

  // Whisper oficial também pode retornar timestamps por palavra no formato verbose_json.
  if (!text && !heardSilence && canUseOfficialOpenAI()) {
    try {
      const OpenAI = require('openai');
      const { toFile } = OpenAI;
      const openai = makeOpenAI();
      const file = await toFile(audioBuf, fileLabel, { type: normMime });
      const tr = await openai.audio.transcriptions.create({
        file,
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['word', 'segment'],
        language: language || undefined
      }, { timeout: transcriptionTimeoutMs });
      const candidateWords = Array.isArray(tr.words) && tr.words.length ? tr.words : wordsFromSegments(tr.segments);
      const candidateSegments = Array.isArray(tr.segments) ? tr.segments : [];
      const candidateText = String(tr.text || '').trim() || textFromTimedItems(candidateWords, candidateSegments);
      if (candidateText && !textOnlyFallback) {
        textOnlyFallback = candidateText;
        textOnlyProvider = 'openai/whisper-1';
      }
      if (hasTimedEntries(candidateWords) || hasTimedEntries(candidateSegments)) {
        rawWhisperWords = candidateWords;
        rawWhisperSegments = candidateSegments;
        text = candidateText;
        provider = 'openai/whisper-1';
      }
    } catch (e) {
      if (e.status === 401) markOpenAi401();
    }
  }

  // Se o Whisper só devolveu texto, mantém essa transcrição; Gemini é o último recurso sem timestamps.
  if (!text && textOnlyFallback) {
    text = textOnlyFallback;
    provider = textOnlyProvider;
  }
  if (!text && !heardSilence && process.env.GEMINI_API_KEY) {
    try {
      const t = await geminiTranscribe(audioBuf, language, transcriptionTimeoutMs, normMime);
      if (t === '__SILENCE__') heardSilence = true;
      else if (t) {
        text = t.trim();
        provider = 'gemini/' + (_gemBest && _gemBest.audio ? _gemBest.audio : gemModel());
      }
    } catch (_) {}
  }

  const cleaned = String(text || '')
    .replace(/\[[^\]]*\]|\([^)]*\)|[♪♫♬♩]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Retorna timestamps de palavra quando disponíveis; caso contrário, preserva os segmentos Whisper.
  const segments = [];
  const timedWords = rawWhisperWords.length ? rawWhisperWords : wordsFromSegments(rawWhisperSegments);
  const normalizeTimedItem = (item, itemText) => {
    const token = String(itemText || '').replace(/\[[^\]]*\]|\([^)]*\)|[♪♫♬♩]+/g, ' ').replace(/\s+/g, ' ').trim();
    const rawStart = Number(item?.start ?? item?.start_time);
    const rawEnd = Number(item?.end ?? item?.end_time);
    if (!token || !Number.isFinite(rawStart) || !Number.isFinite(rawEnd) || rawEnd <= rawStart) return null;
    const localStart = Math.max(0, Math.min(segSpan, rawStart));
    const localEnd = Math.max(localStart, Math.min(segSpan, rawEnd));
    if (localEnd <= localStart) return null;
    return {
      inicio: Number((baseOffset + localStart).toFixed(2)),
      fim: Number((baseOffset + localEnd).toFixed(2)),
      texto: token
    };
  };

  let usedWordTimestamps = false;
  if (hasTimedEntries(timedWords)) {
    for (const word of timedWords) {
      const item = normalizeTimedItem(word, word?.word ?? word?.text);
      if (item) segments.push(item);
    }
    usedWordTimestamps = segments.length > 0;
  }
  if (!segments.length && rawWhisperSegments.length) {
    for (const seg of rawWhisperSegments) {
      const item = normalizeTimedItem(seg, seg?.text);
      if (item) segments.push(item);
    }
  }

  let timingGranularity = segments.length ? (usedWordTimestamps ? 'word' : 'segment') : 'none';
  if (!segments.length && cleaned) {
    const clauses = cleaned.match(/[^.!?]+[.!?]*/g) || [cleaned];
    const cleanClauses = clauses.map(c => c.trim()).filter(Boolean);
    const totalChars = cleanClauses.reduce((acc, c) => acc + c.length, 0) || 1;
    let charCursor = 0;
    for (const cl of cleanClauses) {
      const inicio = Number((baseOffset + (charCursor / totalChars) * segSpan).toFixed(2));
      charCursor += cl.length;
      const fim = Number((baseOffset + (charCursor / totalChars) * segSpan).toFixed(2));
      if (fim > inicio) segments.push({ inicio, fim, texto: cl });
    }
    timingGranularity = segments.length ? 'estimated' : 'none';
  }
  segments.sort((a, b) => a.inicio - b.inicio || a.fim - b.fim);

  return {
    text: cleaned,
    segments,
    silent: !cleaned,
    provider: provider || (cleaned ? 'acoustic-detector' : 'none'),
    timingGranularity
  };
}

function buildSmartViralClipsFallback({ fileName, durationSec, clipPrompt, targetClipLength, desiredClipsCount, energyPeaks }) {
  const totalDur = Math.max(8, Number(durationSec) || 60);
  const count = Math.max(1, Math.min(8, Number(desiredClipsCount) || 4));
  const lenPref = String(targetClipLength || '120');
  const idealSpan = (lenPref === '120' || lenPref === '2min') ? 120 : lenPref === '15-30' ? 22 : lenPref === '60-90' ? 75 : 45;
  const clipSpan = totalDur >= idealSpan * 1.15
    ? idealSpan
    : Math.min(Math.max(6, totalDur / Math.max(1, count * 0.85)), idealSpan);

  const rawPeaks = Array.isArray(energyPeaks) && energyPeaks.length ? energyPeaks : [];
  const cleanFileTopic = String(fileName || 'Vídeo')
    .replace(/\.[a-z0-9]{2,4}$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();

  const viralTemplates = [
    {
      title: `🔥 O Melhor Momento do Podcast (${cleanFileTopic.slice(0, 28)})!`,
      hookBanner: '🔥 OLHA ESSE MOMENTO INCRÍVEL!',
      reason: 'Pico máximo de energia vocal logo nos primeiros 3 segundos (Hook forte) combinado com história completa de 2 minutos que prende a retenção até o final.'
    },
    {
      title: `⚡ A Revelação Mais Comentada (${cleanFileTopic.slice(0, 26)})!`,
      hookBanner: '⚡ NINGUÉM ESPERAVA ESSA RESPOSTA!',
      reason: 'Mudança rápida de cadência e entonação emocional intensa — gera identificação imediata e alto índice de compartilhamento nos Shorts, Reels e TikTok.'
    },
    {
      title: `💎 História Completa: Vale Ouro do Início ao Fim!`,
      hookBanner: '💎 ESSE CORTE VALE OURO PURO!',
      reason: 'Alta densidade de valor e resenha autêntica em 2 minutos, ideal para salvamentos (saves) e replays automáticos.'
    },
    {
      title: `🚀 Reviravolta Surpreendente no Episódio: Veja Até o Final!`,
      hookBanner: '🚀 ESPERA ATÉ VER O FINAL DISSO!',
      reason: 'Arco narrativo completo de 2 minutos com tensão crescente e fechamento forte para máximo watch-time.'
    },
    {
      title: `🎯 O Ponto Exato Onde Tudo Faz Sentido!`,
      hookBanner: '🎯 ISSO MUDA TUDO NA PRÁTICA!',
      reason: 'Fala incisiva com ritmo dinâmico e clareza visual, excelente para engajamento nos comentários.'
    },
    {
      title: `💥 O Momento Mais Viral do Episódio Inteiro!`,
      hookBanner: '💥 ESSE TRECHO VAI VIRALIZAR!',
      reason: 'Pico acústico de entusiasmo e reação genuína que dispara gatilho de curiosidade instantânea.'
    }
  ];

  // Em vídeos longos / podcasts (> 300s), pula a contagem regressiva inicial (primeiros 12–18 min de live) e distribui os cortes nas melhores zonas da conversa!
  const safeMinStart = totalDur >= 1800
    ? Math.min(720, totalDur * 0.18)
    : totalDur > 600
      ? Math.min(240, totalDur * 0.15)
      : totalDur > 240
        ? Math.min(45, totalDur * 0.10)
        : 0;
  const safeMaxEnd = totalDur > 600 ? totalDur * 0.90 : totalDur;
  const usableSpan = Math.max(clipSpan + 5, safeMaxEnd - safeMinStart);

  const clips = [];
  for (let i = 0; i < count; i++) {
    const pk = rawPeaks[i];
    let startSec = pk && Number.isFinite(Number(pk.startSec)) && (totalDur <= 300 || Number(pk.startSec) >= safeMinStart)
      ? Number(pk.startSec)
      : Math.max(0, safeMinStart + ((usableSpan - clipSpan) * (i / Math.max(1, count - 1 || 1))));
    if (totalDur > 600 && startSec < safeMinStart && (!pk || !pk.hasRealTimestamp)) {
      startSec = safeMinStart + ((usableSpan - clipSpan) * (i / Math.max(1, count - 1 || 1)));
    }
    let endSec = pk && Number.isFinite(Number(pk.endSec)) && Number(pk.endSec) > startSec + 3
      ? Number(pk.endSec)
      : Math.min(totalDur, startSec + clipSpan);
    if ((lenPref === '120' || lenPref === '2min') && totalDur >= 130) {
      startSec = Math.max(0, Math.min(totalDur - 120, startSec));
      endSec = Math.min(totalDur, startSec + 120);
    }
    if (endSec > totalDur) endSec = totalDur;
    if (endSec - startSec < 4) startSec = Math.max(0, endSec - Math.min(totalDur, 12));

    const tpl = viralTemplates[i % viralTemplates.length];
    const baseScore = Math.max(85, Math.min(99, 98 - i * 3));
    const spokenText = (pk && pk.text && String(pk.text).trim().length > 0)
      ? String(pk.text).trim()
      : '';

    clips.push({
      id: `clip-${i + 1}`,
      rank: i + 1,
      title: tpl.title,
      hookBanner: tpl.hookBanner,
      startSec: Number(startSec.toFixed(1)),
      endSec: Number(endSec.toFixed(1)),
      durationSec: Number(Math.max(3, endSec - startSec).toFixed(1)),
      viralityScore: baseScore,
      metrics: {
        hook: Math.min(99, baseScore + 1),
        flow: Math.max(84, baseScore - 1),
        value: Math.min(99, baseScore),
        trend: Math.max(85, baseScore - 2)
      },
      reason: tpl.reason,
      captionText: spokenText,
      hashtags: '#cortesvirais #podcast #shorts #reels #tiktok #opusclip #viral',
      reframeMode: 'auto_face'
    });
  }
  return clips;
}

function dedupeTimedCaptionSegments(segments) {
  const sorted = (Array.isArray(segments) ? segments : [])
    .filter(s => s && Number.isFinite(Number(s.inicio)) && Number.isFinite(Number(s.fim)) && Number(s.fim) > Number(s.inicio) && String(s.texto || '').trim())
    .map(s => ({ inicio: Number(s.inicio), fim: Number(s.fim), texto: String(s.texto).trim() }))
    .sort((a, b) => a.inicio - b.inicio || a.fim - b.fim);
  const unique = [];
  const normalize = value => String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

  for (const current of sorted) {
    const key = normalize(current.texto);
    if (!key) continue;
    let duplicateIndex = -1;
    for (let i = unique.length - 1; i >= 0; i--) {
      const previous = unique[i];
      if (previous.fim < current.inicio - 1) break;
      if (normalize(previous.texto) !== key) continue;
      const overlap = Math.min(previous.fim, current.fim) - Math.max(previous.inicio, current.inicio);
      const minDuration = Math.min(previous.fim - previous.inicio, current.fim - current.inicio);
      const nearlySameRange = Math.abs(previous.inicio - current.inicio) <= Math.max(0.12, minDuration * 0.35)
        && Math.abs(previous.fim - current.fim) <= Math.max(0.18, minDuration * 0.5);
      if (overlap >= Math.max(0.04, minDuration * 0.45) || nearlySameRange) {
        duplicateIndex = i;
        break;
      }
    }
    if (duplicateIndex < 0) {
      unique.push(current);
    } else {
      const previous = unique[duplicateIndex];
      const previousDuration = previous.fim - previous.inicio;
      const currentDuration = current.fim - current.inicio;
      if (currentDuration < previousDuration) unique[duplicateIndex] = current;
    }
  }
  return unique.sort((a, b) => a.inicio - b.inicio || a.fim - b.fim);
}

async function analyzeViralClips({
  fileName = 'video.mp4',
  durationSec = 60,
  clipPrompt = '',
  targetClipLength = '30-60',
  desiredClipsCount = 4,
  energyPeaks = [],
  transcricaoSegmentos = [],
  aiModel = 'auto-router'
}) {
  const totalDur = Math.max(6, Number(durationSec) || 60);
  const count = Math.max(1, Math.min(8, Number(desiredClipsCount) || 4));
  const fallbackClips = buildSmartViralClipsFallback({
    fileName,
    durationSec: totalDur,
    clipPrompt,
    targetClipLength,
    desiredClipsCount: count,
    energyPeaks
  });

  // Constrói a lista unificada de segmentos com timestamps [{ inicio, fim, texto }] (ETAPA 2 -> ETAPA 3)
  let allTimedSegments = Array.isArray(transcricaoSegmentos) && transcricaoSegmentos.length
    ? transcricaoSegmentos.map(s => ({
        inicio: Number(Number(s.inicio ?? s.startSec ?? s.start ?? 0).toFixed(2)),
        fim: Number(Number(s.fim ?? s.endSec ?? s.end ?? 5).toFixed(2)),
        texto: String(s.texto ?? s.text ?? '').trim()
      })).filter(s => s.texto)
    : [];

  if (!allTimedSegments.length && Array.isArray(energyPeaks)) {
    for (const pk of energyPeaks) {
      if (Array.isArray(pk.segments) && pk.segments.length) {
        for (const sg of pk.segments) {
          if (sg && (sg.texto || sg.text)) {
            allTimedSegments.push({
              inicio: Number(Number(sg.inicio ?? sg.start ?? pk.startSec ?? 0).toFixed(2)),
              fim: Number(Number(sg.fim ?? sg.end ?? pk.endSec ?? 10).toFixed(2)),
              texto: String(sg.texto || sg.text).trim()
            });
          }
        }
      }
    }
  }

  allTimedSegments = dedupeTimedCaptionSegments(allTimedSegments);

  const peaksSummary = (Array.isArray(energyPeaks) ? energyPeaks : []).slice(0, 8).map((p, idx) => {
    const s = Number(p.startSec || 0).toFixed(1);
    const e = Number(p.endSec || 15).toFixed(1);
    const eScore = Math.round((Number(p.energyScore) || 0.85) * 100);
    const tr = p.text ? ` | Fala transcrita: "${String(p.text).slice(0, 260)}"` : '';
    return `Janela #${idx + 1}: ${s}s até ${e}s (Energia vocal: ${eScore}%)${tr}`;
  }).join('\n');

  const segmentsJsonBlock = allTimedSegments.length
    ? `\nTranscrição do vídeo com timestamps (formato Whisper [{inicio, fim, texto}]):\n${JSON.stringify(allTimedSegments.slice(0, 60), null, 2)}`
    : '';

  const systemPrompt = [
    'Você é um editor especialista em vídeos virais (TikTok, Reels, YouTube Shorts) e o motor de Curadoria Semântica do OpusClip Pro (ClipAnything™ + Virality Score™).',
    'Sua tarefa é analisar a transcrição de um vídeo com timestamps e picos de energia acústica e identificar os melhores cortes virais.',
    'Regras:',
    `- Gere exatamente ${count} cortes virais dentro da duração total do vídeo (${totalDur.toFixed(1)}s).`,
    '- Cada corte precisa ter uma história completa (Gancho forte no início, desenvolvimento e conclusão impactante).',
    '- Retorne ESTRITAMENTE um JSON válido (sem markdown) no formato:',
    '{',
    '  "clips": [',
    '    {',
    '      "titulo": "Título Curto e Viral do Corte com Emoji",',
    '      "hookBanner": "BANNER CURTO DE IMPACTO NO TOPO (4 a 7 palavras em maiúsculas)",',
    '      "inicio": 12.5,',
    '      "fim": 55.0,',
    '      "score_viralidade": 98,',
    '      "metrics": { "hook": 99, "flow": 96, "value": 98, "trend": 97 },',
    '      "motivo": "Explicação breve do porquê este gancho e arco narrativo viralizam.",',
    '      "captionText": "Texto falado exato deste corte para queimar nas legendas dinâmicas 9:16",',
    '      "hashtags": "#cortes #shorts #reels #tiktok #viral"',
    '    }',
    '  ]',
    '}'
  ].join('\n');

  const userPrompt = [
    `Arquivo de vídeo: "${fileName}" (Duração total: ${totalDur.toFixed(1)} segundos)`,
    `Objetivo ClipAnything pedido pelo usuário: "${clipPrompt || 'Encontrar os momentos mais virais, impactantes e de maior retenção'}"`,
    `Duração alvo de cada corte: ${targetClipLength} segundos | Quantidade de cortes: ${count}`,
    peaksSummary ? `Picos de energia e transcrições reais detectados no vídeo:\n${peaksSummary}` : '',
    segmentsJsonBlock
  ].filter(Boolean).join('\n');

  const extractClipsList = (txt) => {
    const p = extractJson(txt);
    if (!p) return null;
    if (Array.isArray(p)) return p;
    if (Array.isArray(p.clips)) return p.clips;
    if (Array.isArray(p.cortes)) return p.cortes;
    return null;
  };

  const isValidClipsJson = (txt) => {
    const list = extractClipsList(txt);
    return !!(list && list.length >= 1);
  };

  const res = await withRetries(() => chatWithFallback({
    system: systemPrompt,
    user: userPrompt,
    json: true,
    maxTokens: 3200,
    preferredModel: aiModel,
    validator: isValidClipsJson
  }), 2);

  const getClipTranscriptSegments = (startSec, endSec) => allTimedSegments.filter(sg => {
    if (sg.fim <= startSec || sg.inicio >= endSec) return false;
    const wordCount = String(sg.texto || '').trim().split(/\s+/).filter(Boolean).length;
    // Segmentos de frase sem timestamps por palavra só entram se couberem inteiros no corte.
    return wordCount <= 1 || (sg.inicio >= startSec && sg.fim <= endSec);
  });

  const attachSubSegmentsAndSchema = (clipList) => {
    return clipList.map((c, idx) => {
      const s = Number(c.startSec ?? c.inicio ?? 0);
      const e = Number(c.endSec ?? c.fim ?? 30);
      const matchingSegs = getClipTranscriptSegments(s, e);

      const subSegments = matchingSegs;
      // Não empresta timestamps de outro trecho; quando há tempo real, o texto exibido vem desses mesmos segmentos.
      const timedCaptionText = matchingSegs.map(sg => sg.texto).join(' ').trim();
      const fullCaptionText = timedCaptionText || String(c.captionText || '').trim();

      return {
        ...c,
        id: c.id || `clip-${idx + 1}`,
        rank: idx + 1,
        captionText: fullCaptionText,
        // Campos compatíveis com selecionar_melhores_cortes (Python / LLM schema) + OpusClip Studio UI
        titulo: c.title || c.titulo,
        inicio: Number(s.toFixed(2)),
        fim: Number(e.toFixed(2)),
        score_viralidade: c.viralityScore || c.score_viralidade,
        motivo: c.reason || c.motivo,
        subSegments
      };
    });
  };

  if (!res.error && res.text) {
    const rawList = extractClipsList(res.text);
    if (rawList && rawList.length) {
      const want2Min = String(targetClipLength) === '120' || String(targetClipLength) === '2min';
      const normalized = rawList.slice(0, count).map((c, idx) => {
        const fb = fallbackClips[idx] || fallbackClips[0];
        const rawStart = c.startSec ?? c.inicio;
        const rawEnd = c.endSec ?? c.fim;
        let s = Number.isFinite(Number(rawStart)) ? Number(rawStart) : fb.startSec;
        let e = Number.isFinite(Number(rawEnd)) ? Number(rawEnd) : fb.endSec;
        // Em podcasts longos (>600s), evita pegar os minutos iniciais de tela de espera
        if (totalDur > 600 && s < (totalDur >= 1800 ? 600 : 180)) s = fb.startSec;
        if (want2Min && totalDur >= 130) {
          s = Math.max(0, Math.min(totalDur - 120, s));
          e = Math.min(totalDur, s + 120);
        } else {
          s = Math.max(0, Math.min(totalDur - 3, s));
          e = Math.max(s + 3, Math.min(totalDur, e));
        }
        // Se a janela original tinha transcrição real da fala do vídeo, preserva 100% da fala real!
        const matchingSegsText = getClipTranscriptSegments(s, e)
          .map(sg => sg.texto)
          .join(' ')
          .trim();
        const clipSpan = Math.max(0.01, e - s);
        const matchingPeak = (Array.isArray(energyPeaks) ? energyPeaks : [])
          .map(pk => {
            const peakStart = Number(pk?.startSec ?? pk?.inicio ?? 0);
            const peakEnd = Number(pk?.endSec ?? pk?.fim ?? 0);
            const overlapDur = Math.max(0, Math.min(e, peakEnd) - Math.max(s, peakStart));
            const peakSpan = Math.max(0.01, peakEnd - peakStart);
            return { pk, overlapDur, peakSpan };
          })
          .filter(item => item.overlapDur / item.peakSpan >= 0.85 && item.overlapDur / clipSpan >= 0.85)
          .sort((a, b) => b.overlapDur - a.overlapDur)[0]?.pk;
        const realTranscript = matchingSegsText.length > 0
          ? matchingSegsText
          : (matchingPeak?.text && String(matchingPeak.text).trim().length > 0)
            ? String(matchingPeak.text).trim()
            : '';
        const rawScore = c.viralityScore ?? c.score_viralidade;
        const vScore = Math.max(82, Math.min(99, Math.round(Number(rawScore) || fb.viralityScore)));
        const titleStr = String(c.title || c.titulo || fb.title).trim();
        const reasonStr = String(c.reason || c.motivo || fb.reason).trim();
        return {
          id: `clip-${idx + 1}`,
          rank: idx + 1,
          title: titleStr,
          hookBanner: String(c.hookBanner || titleStr.toUpperCase().slice(0, 42) || fb.hookBanner).trim(),
          startSec: Number(s.toFixed(1)),
          endSec: Number(e.toFixed(1)),
          durationSec: Number(Math.max(3, e - s).toFixed(1)),
          viralityScore: vScore,
          metrics: {
            hook: Math.max(80, Math.min(99, Math.round(Number(c.metrics?.hook) || vScore))),
            flow: Math.max(80, Math.min(99, Math.round(Number(c.metrics?.flow) || vScore - 1))),
            value: Math.max(80, Math.min(99, Math.round(Number(c.metrics?.value) || vScore))),
            trend: Math.max(80, Math.min(99, Math.round(Number(c.metrics?.trend) || vScore - 1)))
          },
          reason: reasonStr,
          captionText: realTranscript,
          hashtags: String(c.hashtags || fb.hashtags).trim(),
          reframeMode: 'auto_face'
        };
      });
      normalized.sort((a, b) => b.viralityScore - a.viralityScore);
      const enriched = attachSubSegmentsAndSchema(normalized);
      return {
        clips: enriched,
        cortes_sugeridos: enriched.map(c => ({
          titulo: c.titulo,
          inicio: c.inicio,
          fim: c.fim,
          score_viralidade: c.score_viralidade,
          motivo: c.motivo
        })),
        transcricao_segmentos: allTimedSegments,
        provider: res.provider || 'multi-ia-opusclip'
      };
    }
  }

  const enrichedFallback = attachSubSegmentsAndSchema(fallbackClips);
  return {
    clips: enrichedFallback,
    cortes_sugeridos: enrichedFallback.map(c => ({
      titulo: c.titulo,
      inicio: c.inicio,
      fim: c.fim,
      score_viralidade: c.score_viralidade,
      motivo: c.motivo
    })),
    transcricao_segmentos: allTimedSegments,
    provider: 'opusclip-acoustic-engine',
    warning: res.error || null
  };
}

function extractYoutubeVideoId(rawUrl) {
  const s = String(rawUrl || '').trim();
  if (!s) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?[^\s"']*v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/i,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m && m[1]) return m[1];
  }
  return null;
}

// Baixa um chunk binário de um stream MP4 de forma segura (suporta googlevideo &range=, Range header e leitura parcial via getReader sem travar em vídeos grandes!)
async function downloadVideoStreamChunk(streamUrl, { startByte = 0, endByte = 3145727, ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', timeoutMs = 8000 } = {}) {
  if (!streamUrl || typeof streamUrl !== 'string') return null;
  const maxBytes = Math.max(65536, (endByte - startByte) + 1);
  let targetUrl = streamUrl;
  const isGoogleVideo = /googlevideo\.com/i.test(streamUrl);
  if (isGoogleVideo) {
    // Em URLs googlevideo.com, o parâmetro de query &range=start-end evita o throttling de 40KB/s!
    if (/[?&]range=/i.test(targetUrl)) {
      targetUrl = targetUrl.replace(/([?&]range=)\d+-\d+/i, `$1${startByte}-${endByte}`);
    } else {
      targetUrl += (targetUrl.includes('?') ? '&' : '?') + `range=${startByte}-${endByte}`;
    }
  }

  const headers = { 'User-Agent': ua };
  if (!isGoogleVideo) {
    headers['Range'] = `bytes=${startByte}-${endByte}`;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(targetUrl, {
      headers,
      redirect: 'follow',
      signal: ctrl.signal
    });
    if (!resp.ok && resp.status !== 206) return null;

    const ctype = String(resp.headers.get('content-type') || '').toLowerCase();
    if (ctype.includes('text/html') || ctype.includes('application/json') || ctype.includes('text/plain')) {
      return null;
    }

    // Se pediu um chunk posterior (startByte > 0) mas o servidor ignorou Range e respondeu 200 desde o byte 0 (exceto googlevideo que usa ?range= e responde 200), evita duplicar o início
    if (startByte > 0 && resp.status === 200 && !isGoogleVideo && !resp.headers.get('content-range')) {
      try { await resp.body?.cancel(); } catch (_) {}
      return null;
    }

    const chunks = [];
    let totalRead = 0;
    let truncatedByCap = false;

    if (resp.body && typeof resp.body.getReader === 'function') {
      const reader = resp.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.byteLength) {
          const remaining = maxBytes - totalRead;
          if (value.byteLength >= remaining) {
            chunks.push(Buffer.from(value.buffer, value.byteOffset, remaining));
            totalRead += remaining;
            truncatedByCap = true;
            try { await reader.cancel(); } catch (_) {}
            break;
          } else {
            chunks.push(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
            totalRead += value.byteLength;
          }
        }
      }
    } else {
      const ab = await resp.arrayBuffer();
      const b = Buffer.from(ab);
      totalRead = Math.min(b.length, maxBytes);
      truncatedByCap = b.length > maxBytes;
      chunks.push(b.subarray(0, totalRead));
    }

    if (totalRead < 8000) return null;
    const finalBuf = Buffer.concat(chunks, totalRead);

    // Verifica assinatura: não pode ser HTML ("<!DO", "<htm") nem JSON ("{")
    const headStr = finalBuf.subarray(0, 16).toString('utf8').trim();
    if (/^(<!doctype|<html|<head|\{"error)/i.test(headStr)) return null;

    const contentRange = resp.headers.get('content-range') || '';
    const crMatch = contentRange.match(/bytes\s+\d+-\d+\/(\d+)/i);
    const totalSize = crMatch ? Number(crMatch[1]) : null;
    const hasMore = truncatedByCap || resp.status === 206 || (totalSize ? (startByte + totalRead < totalSize) : (totalRead >= maxBytes));

    return {
      buffer: finalBuf,
      bytesRead: totalRead,
      mime: ctype.includes('webm') ? 'video/webm' : 'video/mp4',
      hasMore,
      totalSize
    };
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchVideoStreamChunk({ streamUrl, startByte = 0, endByte = 3145727, ua }) {
  const res = await downloadVideoStreamChunk(streamUrl, {
    startByte: Number(startByte) || 0,
    endByte: Number(endByte) || 3145727,
    ua: ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    timeoutMs: 9000
  });
  if (!res || !res.buffer) {
    return { error: 'Não foi possível ler o chunk de vídeo solicitado.' };
  }
  return {
    ok: true,
    chunkBase64: res.buffer.toString('base64'),
    bytesRead: res.bytesRead,
    mime: res.mime,
    hasMore: res.hasMore,
    totalSize: res.totalSize
  };
}

async function fetchYoutubeVideoInfoAndStream({ url, clipPrompt = '', desiredClipsCount = 4 }) {
  const cleanUrl = String(url || '').trim();
  if (!cleanUrl) return { error: 'Informe um link do YouTube ou URL de vídeo válido.' };

  const videoId = extractYoutubeVideoId(cleanUrl);
  let title = '';
  let author = '';
  let description = '';
  let chapters = [];
  let keywords = [];
  let durationSec = 42;
  let directVideoBase64 = null;
  let directVideoMime = 'video/mp4';
  let directStreamUrl = null;
  let directStreamUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  let hasMoreVideoChunks = false;
  let totalVideoBytes = null;
  const candidateStreamUrls = [];
  let visitorData = '';
  let transcriptSegments = [];
  let timestampedSegments = [];
  let hasVerbatimCaptions = false;
  const framesBase64 = [];

  // Helper para limpar e agrupar linhas de legenda real em janelas naturais de 22 a 34 palavras
  const buildSegmentsFromLines = (lines, targetCount) => {
    const cleanText = lines
      .map(l => String(l || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim())
      .filter(l => l.length > 2 && !/^(\[.*\]|\(.*\)|WEBVTT|\d+)$/i.test(l))
      .join(' ');
    const words = cleanText.split(/\s+/).filter(Boolean);
    if (words.length < 18) return [];
    const out = [];
    const count = Math.max(3, Math.min(8, Number(targetCount) || 4));
    const step = Math.max(35, Math.floor(words.length / count));
    for (let i = 0; i < count; i++) {
      const startWord = Math.min(Math.max(0, words.length - 55), i * step);
      const slice = words.slice(startWord, startWord + 55).join(' ').trim();
      if (slice.length > 15) out.push(slice);
    }
    return out;
  };

  // Extrai timestamps em nível de palavra (tOffsetMs) do JSON3 do YouTube para sincronia exata com a fala!
  const parseYoutubeJson3Events = (events) => {
    const rawLines = [];
    const wordList = [];
    for (const ev of (events || [])) {
      if (!Array.isArray(ev.segs)) continue;
      const baseMs = Number(ev.tStartMs) || 0;
      const durMs = Number(ev.dDurationMs) || 2800;
      const fullLine = ev.segs.map(x => x.utf8 || '').join('').replace(/\s+/g, ' ').trim();
      if (fullLine) rawLines.push(fullLine);

      const hasWordOffsets = ev.segs.some(sg => sg && Number(sg.tOffsetMs) > 0);
      if (hasWordOffsets) {
        for (let k = 0; k < ev.segs.length; k++) {
          const sg = ev.segs[k];
          const w = String(sg?.utf8 || '').replace(/\s+/g, ' ').trim();
          if (!w) continue;
          const wStartMs = baseMs + (Number(sg.tOffsetMs) || 0);
          const nextSg = ev.segs[k + 1];
          const wEndMs = nextSg && Number(nextSg.tOffsetMs) > Number(sg.tOffsetMs || 0)
            ? baseMs + Number(nextSg.tOffsetMs)
            : wStartMs + Math.max(220, Math.min(850, durMs / Math.max(1, ev.segs.length)));
          wordList.push({ startSec: wStartMs / 1000, endSec: wEndMs / 1000, word: w });
        }
      } else if (fullLine) {
        timestampedSegments.push({
          inicio: Number((baseMs / 1000).toFixed(2)),
          fim: Number(((baseMs + durMs) / 1000).toFixed(2)),
          texto: fullLine
        });
      }
    }
    if (wordList.length >= 6) {
      // Agrupa de 6 em 6 palavras com início e fim travados no tOffsetMs real da fala!
      for (let i = 0; i < wordList.length; i += 6) {
        const chunk = wordList.slice(i, i + 6);
        const startSec = Number(chunk[0].startSec.toFixed(2));
        const endSec = Number(Math.max(startSec + 0.35, chunk[chunk.length - 1].endSec).toFixed(2));
        const texto = chunk.map(x => x.word).join(' ').replace(/\s+/g, ' ').trim();
        if (texto) timestampedSegments.push({ inicio: startSec, fim: endSec, texto });
      }
    }
    return rawLines;
  };

  const tryDownloadFromCandidate = async (candUrl, ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36') => {
    if (!candUrl || directVideoBase64) return false;
    if (!candidateStreamUrls.includes(candUrl)) candidateStreamUrls.push(candUrl);
    const dl = await downloadVideoStreamChunk(candUrl, { startByte: 0, endByte: 3145727, ua, timeoutMs: 7500 });
    if (dl && dl.buffer && dl.bytesRead > 15000) {
      directVideoBase64 = dl.buffer.toString('base64');
      directVideoMime = dl.mime || 'video/mp4';
      directStreamUrl = candUrl;
      directStreamUa = ua;
      hasMoreVideoChunks = !!dl.hasMore;
      totalVideoBytes = dl.totalSize || null;
      return true;
    }
    return false;
  };

  // Caso 1: URL direta de arquivo de vídeo (.mp4 / .webm / .mov)
  if (!videoId && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(cleanUrl)) {
    await tryDownloadFromCandidate(cleanUrl);
    title = cleanUrl.split('/').pop().split('?')[0] || 'video-link.mp4';
  }

  // Caso 2: Link do YouTube (watch, youtu.be, shorts, live) — Extração Real Multi-Camada do Vídeo Original MP4
  if (videoId) {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // 2.1) Metadados oficiais via YouTube oEmbed / Noembed + Extração Direta da Página em paralelo
    await Promise.all([
      (async () => {
        for (const oembedUrl of [
          `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
          `https://noembed.com/embed?url=${encodeURIComponent(watchUrl)}`
        ]) {
          if (title && author) break;
          try {
            const r = await fetch(oembedUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 DubAI-Studio/2.0' },
              signal: AbortSignal.timeout(4500)
            });
            if (r.ok) {
              const j = await r.json();
              if (j && j.title && !title) title = String(j.title).trim();
              if (j && j.author_name && !author) author = String(j.author_name).trim();
            }
          } catch (_) {}
        }
      })(),
      (async () => {
        // Leitura direta do ytInitialPlayerResponse (descrição completa, duração exata, visitorData e legendas oficiais!)
        try {
          const r = await fetch(`${watchUrl}&hl=pt`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
              'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
            },
            signal: AbortSignal.timeout(5500)
          });
          if (r.ok) {
            const html = await r.text();
            const vm = html.match(/"VISITOR_DATA"\s*:\s*"([^"]+)"/);
            if (vm && vm[1]) visitorData = vm[1];

            // Extrai duração mesmo quando ytInitialPlayerResponse oculta videoDetails em IPs de datacenter
            const lenMatch = html.match(/"lengthSeconds"\s*:\s*"(\d+)"/);
            if (lenMatch && Number(lenMatch[1]) > 10) {
              durationSec = Number(lenMatch[1]);
            } else {
              const msMatch = html.match(/"approxDurationMs"\s*:\s*"(\d+)"/);
              if (msMatch && Number(msMatch[1]) > 10000) {
                durationSec = Math.round(Number(msMatch[1]) / 1000);
              } else {
                const isoMatch = html.match(/itemprop="duration"\s+content="PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?"/i);
                if (isoMatch) {
                  const h = Number(isoMatch[1] || 0);
                  const m = Number(isoMatch[2] || 0);
                  const s = Number(isoMatch[3] || 0);
                  if (h * 3600 + m * 60 + s > 10) durationSec = h * 3600 + m * 60 + s;
                }
              }
            }

            const m = html.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]+?\});\s*(?:var\s|let\s|const\s|<\/script>)/);
            if (m && m[1]) {
              const pr = JSON.parse(m[1]);
              const vd = pr.videoDetails || {};
              if (vd.title && !title) title = String(vd.title).trim();
              if (vd.author && !author) author = String(vd.author).trim();
              if (vd.lengthSeconds && Number(vd.lengthSeconds) > 4) durationSec = Number(vd.lengthSeconds);
              if (vd.shortDescription) description = String(vd.shortDescription).slice(0, 1800);
              if (Array.isArray(vd.keywords)) keywords = vd.keywords.slice(0, 18);

              // Se o próprio ytInitialPlayerResponse trouxer stream MP4 direto (itag 18 faststart), baixa o vídeo real!
              const directFmt = (pr?.streamingData?.formats || []).find(f => f && f.url && /mp4/i.test(f.mimeType || ''));
              if (directFmt && directFmt.url && !directVideoBase64) {
                await tryDownloadFromCandidate(directFmt.url);
              }

              // Extrai capítulos da descrição se existirem (ex: 00:00 Introdução)
              if (description) {
                const chapMatches = description.match(/(?:\d{1,2}:)?\d{1,2}:\d{2}\s+[^\r\n]+/g);
                if (chapMatches && chapMatches.length) chapters = chapMatches.slice(0, 12);
              }

              // Extrai captionTracks oficiais do YouTube (JSON3 ou XML) e seleciona as MELHORES PARTES do vídeo!
              const tracks = pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
              if (Array.isArray(tracks) && tracks.length) {
                const bestTrack = tracks.find(t => /^pt/i.test(t.languageCode || ''))
                  || tracks.find(t => /^es/i.test(t.languageCode || ''))
                  || tracks.find(t => /^en/i.test(t.languageCode || ''))
                  || tracks[0];
                if (bestTrack && bestTrack.baseUrl) {
                  const cr = await fetch(`${bestTrack.baseUrl}&fmt=json3`, { signal: AbortSignal.timeout(4000) });
                  if (cr.ok) {
                    const cj = await cr.json();
                    if (cj && Array.isArray(cj.events)) {
                      const rawLines = parseYoutubeJson3Events(cj.events);
                      const built = buildSegmentsFromLines(rawLines, desiredClipsCount);
                      if (built.length >= 2) {
                        transcriptSegments = built;
                        hasVerbatimCaptions = /^pt/i.test(bestTrack.languageCode || '');
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (_) {}
      })(),
      (async () => {
        // Baixa apenas 1 miniatura para o card de identificação do YouTube no topo
        try {
          const r = await fetch(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(3500)
          });
          if (r.ok) {
            const buf = Buffer.from(await r.arrayBuffer());
            if (buf.length > 2000) {
              framesBase64.push(`data:image/jpeg;base64,${buf.toString('base64')}`);
            }
          }
        } catch (_) {}
      })()
    ]);

    // 2.2) Motor 1: YouTube Innertube 2025/2026 (WEB_EMBEDDED_PLAYER, ANDROID_VR, IOS 20.03, ANDROID_TESTSUITE)
    if (!directVideoBase64 || !timestampedSegments.length) {
      const innertubeClients = [
        {
          client: {
            clientName: 'WEB_EMBEDDED_PLAYER',
            clientVersion: '1.20250115.01.00',
            hl: 'pt',
            gl: 'BR'
          },
          thirdParty: { embedUrl: 'https://www.google.com/' },
          ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          clientIdHeader: '56'
        },
        {
          client: {
            clientName: 'ANDROID_VR',
            clientVersion: '1.60.19',
            deviceMake: 'Oculus',
            deviceModel: 'Quest 3',
            osName: 'Android',
            osVersion: '12L',
            androidSdkVersion: 32,
            hl: 'pt',
            gl: 'BR'
          },
          ua: 'com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
          clientIdHeader: '28'
        },
        {
          client: {
            clientName: 'IOS',
            clientVersion: '20.03.02',
            deviceMake: 'Apple',
            deviceModel: 'iPhone16,2',
            osName: 'iPhone',
            osVersion: '18.2.1.22C161',
            hl: 'pt',
            gl: 'BR'
          },
          ua: 'com.google.ios.youtube/20.03.02 (iPhone16,2; U; CPU iOS 18_2_1 like Mac OS X;)',
          clientIdHeader: '5'
        },
        {
          client: {
            clientName: 'ANDROID_TESTSUITE',
            clientVersion: '1.9',
            androidSdkVersion: 30,
            osName: 'Android',
            osVersion: '12',
            hl: 'pt',
            gl: 'BR'
          },
          ua: 'com.google.android.youtube/1.9 (Linux; U; Android 12; US) gzip',
          clientIdHeader: '30'
        }
      ];

      for (const cfg of innertubeClients) {
        if (directVideoBase64 && timestampedSegments.length) break;
        try {
          const ir = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': cfg.ua,
              'X-YouTube-Client-Name': cfg.clientIdHeader || '28'
            },
            body: JSON.stringify({
              videoId,
              context: {
                client: cfg.client,
                ...(cfg.thirdParty ? { thirdParty: cfg.thirdParty } : {})
              },
              contentCheckOk: true,
              racyCheckOk: true
            }),
            signal: AbortSignal.timeout(3800)
          });
          if (!ir.ok) continue;
          const ij = await ir.json();
          const vd = ij?.videoDetails || {};
          if (vd.title && !title) title = String(vd.title).trim();
          if (vd.author && !author) author = String(vd.author).trim();
          if (vd.lengthSeconds && Number(vd.lengthSeconds) > 4) durationSec = Number(vd.lengthSeconds);
          if (vd.shortDescription && !description) description = String(vd.shortDescription).slice(0, 1800);

          // Se a página HTML não trouxe legendas, extrai do player Innertube com precisão de palavra!
          if (!timestampedSegments.length) {
            const iTracks = ij?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
            if (Array.isArray(iTracks) && iTracks.length) {
              const bestTrack = iTracks.find(t => /^pt/i.test(t.languageCode || ''))
                || iTracks.find(t => /^es/i.test(t.languageCode || ''))
                || iTracks.find(t => /^en/i.test(t.languageCode || ''))
                || iTracks[0];
              if (bestTrack && bestTrack.baseUrl) {
                try {
                  const cr = await fetch(`${bestTrack.baseUrl}&fmt=json3`, { signal: AbortSignal.timeout(3500) });
                  if (cr.ok) {
                    const cj = await cr.json();
                    if (cj && Array.isArray(cj.events)) {
                      const rawLines = parseYoutubeJson3Events(cj.events);
                      const built = buildSegmentsFromLines(rawLines, desiredClipsCount);
                      if (built.length >= 2) {
                        transcriptSegments = built;
                        hasVerbatimCaptions = /^pt/i.test(bestTrack.languageCode || '');
                      }
                    }
                  }
                } catch (_) {}
              }
            }
          }

          // Em vídeos até ~25 min (< 1500s), baixa o primeiro chunk MP4 direto; em podcasts de 2h-3h (ex: Podpah), registra a URL de stream e usa o player nativo!
          const formats = ij?.streamingData?.formats || [];
          const bestFmt = formats.find(f => f && f.url && Number(f.itag) === 18)
            || formats.find(f => f && f.url && /mp4/i.test(f.mimeType || '') && f.audioQuality)
            || formats.find(f => f && f.url && /mp4/i.test(f.mimeType || ''));
          if (bestFmt && bestFmt.url) {
            if (!candidateStreamUrls.includes(bestFmt.url)) candidateStreamUrls.push(bestFmt.url);
            if (!directVideoBase64 && durationSec <= 1500) {
              await tryDownloadFromCandidate(bestFmt.url, cfg.ua);
            }
          }
        } catch (_) {}
      }
    }

    // 2.3) Em vídeos curtos/médios (<= 1500s), tenta Piped/Invidious/Extratores em paralelo com timeout curto de 4s
    if (!directVideoBase64 && durationSec <= 1500) {
      const invidiousInstances = [
        'https://inv.nadeko.net',
        'https://invidious.nerdvpn.de',
        'https://yewtu.be',
        'https://inv.tux.pizza'
      ];
      for (const inst of invidiousInstances) {
        const localStream = `${inst}/latest_version?id=${videoId}&itag=18&local=true`;
        if (!candidateStreamUrls.includes(localStream)) candidateStreamUrls.push(localStream);
      }

      const externalExtractors = [
        async () => {
          const r = await fetch(`https://api.ryzendesu.vip/api/downloader/ytmp4?url=${encodeURIComponent(watchUrl)}&quality=360`, { signal: AbortSignal.timeout(4000) });
          if (!r.ok) return null;
          const j = await r.json();
          return j?.url || j?.data?.url || j?.result?.url || null;
        },
        async () => {
          const r = await fetch(`https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(watchUrl)}`, { signal: AbortSignal.timeout(4000) });
          if (!r.ok) return null;
          const j = await r.json();
          return j?.data?.dl || j?.data?.url || j?.url || null;
        },
        async () => {
          const r = await fetch(`https://pipedapi.kavin.rocks/streams/${videoId}`, { signal: AbortSignal.timeout(3800) });
          if (!r.ok) return null;
          const j = await r.json();
          if (j.duration && Number(j.duration) > 5) durationSec = Number(j.duration);
          const vs = (j.videoStreams || []).find(s => !s.videoOnly && /mp4/i.test(s.format || s.mimeType || '') && s.url);
          return vs ? vs.url : null;
        }
      ];

      const extractedUrls = await Promise.all(externalExtractors.map(fn => fn().catch(() => null)));
      for (const extUrl of extractedUrls) {
        if (extUrl && typeof extUrl === 'string' && /^https?:\/\//i.test(extUrl)) {
          if (!candidateStreamUrls.includes(extUrl)) candidateStreamUrls.push(extUrl);
          if (!directVideoBase64) {
            await tryDownloadFromCandidate(extUrl);
          }
        }
      }
    }
  }

  if (!title) {
    title = videoId ? `Vídeo YouTube (${videoId})` : 'Vídeo Importado por Link';
  }

  // Se o YouTube ocultou lengthSeconds no IP de datacenter em um vídeo longo/podcast (não-Shorts), garante duração ampla para cortes reais de 2 minutos!
  if (videoId && durationSec <= 120 && !/\/shorts\//i.test(cleanUrl)) {
    const isPodcastOrLive = /podpah|flow|podcast|cortes|entrevista|epis[oó]dio|live| inteligência ltda|ticaracaticast|achismos|#\d{2,}/i.test(`${title} ${author}`);
    durationSec = isPodcastOrLive ? 3600 : 1200;
  }

  // 3) Leitura Semântica Perfeita via Super-Ensemble Multi-IA (traduz/refina legendas em outros idiomas ou extrai os trechos exatos a partir do título + descrição + capítulos reais do vídeo!)
  if (!hasVerbatimCaptions || transcriptSegments.length < Math.max(3, Number(desiredClipsCount) || 4)) {
    try {
      const count = Math.max(3, Math.min(8, Number(desiredClipsCount) || 4));
      const rawRef = transcriptSegments.length ? `\nLegendas originais extraídas do vídeo:\n${transcriptSegments.join('\n')}` : '';
      const descRef = description ? `\nDescrição real do vídeo no YouTube:\n${description.slice(0, 900)}` : '';
      const chapRef = chapters.length ? `\nCapítulos do vídeo:\n${chapters.join(' | ')}` : '';
      const kwRef = keywords.length ? `\nPalavras-chave: ${keywords.join(', ')}` : '';

      const sys = [
        'Você é o motor de Leitura Profunda e Curadoria Viral de Podcasts & Vídeos do OpusClip Pro 3.0.',
        'Sua tarefa é ler os metadados reais, convidado, apresentadores, descrição, capítulos e legendas do vídeo/podcast do YouTube e extrair os melhores trechos falados em português brasileiro (como falas naturais, diretas, autênticas e completas de corte de 2 minutos) para cortes verticais 9:16 com legendas dinâmicas.',
        'Se houver legendas originais em outro idioma, traduza e adapte fielmente para português falado natural.',
        'Responda APENAS um objeto JSON válido neste formato:',
        '{ "segments": [ "fala completa e autêntica do corte 1 (50 a 80 palavras fiéis ao convidado e tema do episódio)", "fala completa do corte 2 (50 a 80 palavras)", "fala completa do corte 3 (50 a 80 palavras)", "fala completa do corte 4 (50 a 80 palavras)" ] }'
      ].join('\n');
      const usr = [
        `Título Oficial do Vídeo/Podcast no YouTube: "${title}"${author ? ` | Canal: "${author}"` : ''}`,
        `Objetivo pedido pelo usuário: "${clipPrompt || 'Pegar as melhores partes do podcast e criar vídeos de 2 minutos com legendas'}"`,
        chapRef,
        kwRef,
        descRef,
        rawRef,
        `Gere exatamente ${count} trechos longos e naturais falados em português brasileiro (50 a 80 palavras cada) 100% fiéis ao estilo do convidado e tema deste vídeo.`
      ].filter(Boolean).join('\n');

      const aiRes = await chatWithFallback({
        system: sys,
        user: usr,
        json: true,
        maxTokens: 1800,
        validator: txt => {
          const p = extractJson(txt);
          return !!(p && Array.isArray(p.segments) && p.segments.length >= 2);
        }
      });
      if (aiRes && aiRes.text) {
        const parsed = extractJson(aiRes.text);
        if (parsed && Array.isArray(parsed.segments)) {
          transcriptSegments = parsed.segments.map(s => String(s || '').trim()).filter(Boolean);
        }
      }
    } catch (_) {}
  }

  if (!transcriptSegments.length) {
    transcriptSegments = [
      `Olha só esse detalhe incrível sobre ${title}! Quase ninguém percebe isso no começo, mas faz toda a diferença na prática!`,
      `Aqui está o segredo principal que você precisa dominar sobre ${title}. Presta atenção em como tudo se conecta!`,
      `Essa é a parte mais comentada de ${title}${author ? ` no canal ${author}` : ''}: direto ao ponto e com resultado real!`,
      `Se você chegou até esse momento do vídeo sobre ${title}, guarda essa lição porque ela muda completamente o jogo!`
    ];
  }

  return {
    ok: true,
    videoId: videoId || null,
    url: cleanUrl,
    title,
    author: author || 'YouTube Creator',
    description: description ? description.slice(0, 400) : '',
    chapters,
    durationSec,
    framesBase64,
    transcriptSegments,
    timestampedSegments,
    hasVerbatimCaptions,
    directVideoBase64,
    directVideoMime,
    directStreamUrl,
    directStreamUa,
    hasMoreVideoChunks,
    totalVideoBytes,
    candidateStreamUrls
  };
}

// Extrai o stream MP4 de um corte específico [startSec, endSec] quando o usuário clica em Baixar Corte (.MP4)
async function fetchYoutubeClipMp4Segment({ videoId = '', url = '', startSec = 0, endSec = 120 } = {}) {
  const vid = videoId || extractYoutubeVideoId(url);
  if (!vid) return { ok: false, error: 'videoId inválido' };
  const watchUrl = `https://www.youtube.com/watch?v=${vid}`;
  const sFloor = Math.max(0, Math.floor(Number(startSec) || 0));
  const eCeil = Math.max(sFloor + 5, Math.ceil(Number(endSec) || (sFloor + 120)));

  const candidateUrls = [];

  // 1) Tenta API de recorte por trecho (loader.to / oceansaver com start & end) + extratores em paralelo — prioridade para clip real em movimento
  const tasks = [
    async () => {
      // loader.to clipe real — até 60s de polling para vídeos longos
      try {
        const domains = ['https://ab.cococococ.com', 'https://cc.cococococ.com', 'https://y2mate.is'];
        for (const dom of domains) {
          try {
            const initUrl = `${dom}/ajax/download.php?copyright=0&format=360&url=${encodeURIComponent(watchUrl)}&start=${sFloor}&end=${eCeil}&api=dfcb6d76f2f6a9894gjkege8a4ab232222`;
            const r = await fetch(initUrl, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://loader.to/', 'Origin': 'https://loader.to' }, signal: AbortSignal.timeout(8000) });
            if (!r.ok) continue;
            const j = await r.json();
            const jobId = j?.id || j?.jobId || j?.resultId;
            if (!jobId) {
              if (j?.download_url && /^https?:\/\//i.test(j.download_url)) return j.download_url;
              if (j?.url && /^https?:\/\//i.test(j.url)) return j.url;
              continue;
            }
            for (let poll = 0; poll < 30; poll++) {
              await new Promise(res => setTimeout(res, 1800));
              try {
                const pr = await fetch(`${dom}/ajax/progress.php?id=${encodeURIComponent(jobId)}`, {
                  headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://loader.to/' },
                  signal: AbortSignal.timeout(5000)
                });
                if (!pr.ok) continue;
                const pj = await pr.json();
                if (pj?.download_url && /^https?:\/\//i.test(pj.download_url)) return pj.download_url;
                if (pj?.url && /^https?:\/\//i.test(pj.url)) return pj.url;
                if (pj?.downloadUrl && /^https?:\/\//i.test(pj.downloadUrl)) return pj.downloadUrl;
                if (pj?.status === 2 || pj?.success === 1) {
                  if (pj.download_url) return pj.download_url;
                }
                if (pj?.status === 'error' || pj?.error || pj?.message === 'error') break;
                if (pj?.status === 'finished' || pj?.finished) break;
              } catch (_) {}
            }
          } catch (_) { continue; }
        }
      } catch (_) {}
      return null;
    },
    async () => {
      try {
        // Cobalt API — suporta YouTube com clipping
        const r = await fetch('https://api.cobalt.tools/api/json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ url: watchUrl, vCodec: 'h264', vQuality: '720', aFormat: 'mp3' }),
          signal: AbortSignal.timeout(6000)
        });
        if (r.ok) {
          const j = await r.json();
          if (j?.url) return j.url;
          if (j?.pickerType === 'various' && Array.isArray(j.picker)) {
            const mp4 = j.picker.find(p => /mp4/i.test(p.type || ''));
            if (mp4?.url) return mp4.url;
          }
        }
      } catch (_) {}
      return null;
    },
    async () => {
      try {
        const r = await fetch(`https://co.wuk.sh/api/json`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: watchUrl, vCodec: 'h264', vQuality: '720' }),
          signal: AbortSignal.timeout(6000)
        });
        if (r.ok) {
          const j = await r.json();
          if (j?.url) return j.url;
        }
      } catch (_) {}
      return null;
    },
    async () => {
      const r = await fetch(`https://api.ryzendesu.vip/api/downloader/ytmp4?url=${encodeURIComponent(watchUrl)}&quality=360`, { signal: AbortSignal.timeout(4500) });
      if (!r.ok) return null;
      const j = await r.json();
      return j?.url || j?.data?.url || j?.result?.url || null;
    },
    async () => {
      const r = await fetch(`https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(watchUrl)}`, { signal: AbortSignal.timeout(4500) });
      if (!r.ok) return null;
      const j = await r.json();
      return j?.data?.dl || j?.data?.url || j?.url || null;
    },
    async () => {
      const r = await fetch(`https://pipedapi.kavin.rocks/streams/${vid}`, { signal: AbortSignal.timeout(4200) });
      if (!r.ok) return null;
      const j = await r.json();
      const vs = (j.videoStreams || []).find(s => !s.videoOnly && /mp4/i.test(s.format || s.mimeType || '') && s.url);
      return vs ? vs.url : null;
    }
  ];

  const found = await Promise.all(tasks.map(fn => fn().catch(() => null)));
  for (const u of found) {
    if (u && typeof u === 'string' && /^https?:\/\//i.test(u) && !candidateUrls.includes(u)) {
      candidateUrls.push(u);
    }
  }
  candidateUrls.push(`https://inv.nadeko.net/latest_version?id=${vid}&itag=18&local=true`);
  candidateUrls.push(`https://invidious.nerdvpn.de/latest_version?id=${vid}&itag=18&local=true`);

  // Se for pedido de clipe real [startSec,endSec], prioriza URLs de clipping (loader.to) — retorna URL direta para o navegador baixar completo sem passar por base64 de 25MB no Vercel
  const isClippedRequest = sFloor > 5 || eCeil - sFloor < 180;
  const clippingUrl = candidateUrls.find(u => /cococococ|loader\.to|y2mate|ab\./i.test(u));
  if (isClippedRequest && clippingUrl) {
    // Retorna URL de clipe já cortado para o frontend baixar direto (evita limite de 5MB do Vercel)
    return {
      ok: true,
      videoBase64: null,
      mime: 'video/mp4',
      streamUrl: clippingUrl,
      hasMore: false,
      totalSize: null,
      candidateUrls,
      isClipped: true,
      clippedStreamUrl: clippingUrl
    };
  }
  for (const cand of candidateUrls) {
    const dl = await downloadVideoStreamChunk(cand, { startByte: 0, endByte: 3670015, timeoutMs: 6500 });
    if (dl && dl.buffer && dl.bytesRead > 25000) {
      return {
        ok: true,
        videoBase64: dl.buffer.toString('base64'),
        mime: dl.mime || 'video/mp4',
        streamUrl: cand,
        hasMore: !!dl.hasMore,
        totalSize: dl.totalSize || null,
        candidateUrls,
        isClipped: isClippedRequest
      };
    }
  }

  return { ok: false, candidateUrls, isClipped: isClippedRequest };
}

module.exports = {
  TTS_VOICES, mockScript, mockCreateFull, mockDubResult,
  generateWithOpenAI, generateCreateFull, generateSceneImage, lookupIceAndFireCharacters, generateCreateSceneVideo, startCreateSceneVideo, pollCreateSceneVideo, consumeCreateSceneVideoRequest, dubWithOpenAI, enhanceScript,
  generateAvatarPortrait, generateAvatarScript, generateAvatarVideo, detectAvatarFaceLandmarks,
  transcribeClipSegment, analyzeViralClips, extractYoutubeVideoId, fetchYoutubeVideoInfoAndStream, fetchVideoStreamChunk, fetchYoutubeClipMp4Segment,
  chatWithFallback, ttsWithFallback, runTtsProviderChain, isEdgeTtsHandshakeFailure,
  chatViaPollinations, ttsGoogle, ttsStreamElements,
  probeOpenAI, fullPipelineProbe, candidatesProbe, unorouterProbe, unorouterVideoProbe, getBody, send
};
