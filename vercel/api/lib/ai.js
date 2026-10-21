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
async function generateCreateFull({ prompt, duration, style, voice, cinemaMode = 'connected', customCharacters = '' }) {
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

    const res = await withRetries(() => chatWithFallback({ system: cinemaSystem, user: cinemaUser, json: true, maxTokens: 4500 }), 2);
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

  // 1) Pollinations Flux AI (Grátis, sem chave, alta fidelidade de cenário + personagens, timeout ágil)
  const ladder = [
    { model: fluxModel, w: targetW, h: targetH },
    { model: 'flux', w: 768, h: 432 },
    { model: 'turbo', w: 768, h: 432 },
    { model: '', w: 640, h: 360 }
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
        signal: AbortSignal.timeout(12500)
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

  // 2) Gemini (Google) — imagem da cena com timeout curto para nunca travar a serverless function
  if (process.env.GEMINI_API_KEY) {
    try {
      const g = await geminiImage(fullPrompt, 10000);
      if (g) return g;
      errors.push('gemini/image: sem imagem retornada');
    } catch (e) { errors.push('gemini/image: ' + e.message); }
  }

  // 3) Unorouter images — se houver chave pronta fora de cooldown
  const uKey = pickReadyUniKey();
  if (uKey) {
    for (const model of UNI_IMG_MODELS) {
      try {
        const r = await fetch(uniBase() + '/images/generations', {
          method: 'POST', headers: uniHeaders(uKey),
          body: JSON.stringify({ model, prompt: fullPrompt, n: 1, size: '1024x1024', response_format: 'b64_json' }),
          signal: AbortSignal.timeout(10000)
        });
        if (r.ok) {
          const j = await r.json();
          const b64 = j && j.data && j.data[0] && j.data[0].b64_json;
          const url = j && j.data && j.data[0] && j.data[0].url;
          if (b64) return { imageBase64: b64, mime: 'image/png', model: 'unorouter/' + model };
          if (url) {
            const fr = await fetch(url, { signal: AbortSignal.timeout(9000) });
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
  return { error: errors.join(' | ') || 'nenhum provedor de imagem respondeu' };
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
    const tr = await chatWithFallback({
      system: 'Você é um diretor de dublagem profissional de cinema/streaming. Traduza a fala para o idioma alvo de forma natural, fluida e com duração de fala equivalente ao original (isocronia de dublagem). Não adicione comentários, notas nem aspas extras — devolva APENAS o texto traduzido pronto para ser falado.',
      user: `Traduza para ${targetLanguage}:\n\n${originalText}`
    });
    if (tr.error) throw new Error('Tradução falhou: ' + tr.error);
    const translatedText = (tr.text || '').trim();

    const parts = [];
    let current = '';
    for (const sentence of translatedText.split(/(?<=[.!?…])\s+/)) {
      if (current && (current + ' ' + sentence).length > 2600) { parts.push(current); current = sentence; }
      else current = current ? current + ' ' + sentence : sentence;
    }
    if (current) parts.push(current);

    // Voz com cadeia de provedores (OpenAI → Gemini 3.1 Neural TTS → Unorouter → Google → StreamElements)
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
let _lastUniProbeCache = null;

const UNI_CHAT_MODELS = ['agnes-2.5-flash:free', 'gemini-3.1-flash-lite:free', 'cohere-command-a:free', 'deepseek-r1-distill-qwen-32b:free'];
const UNI_WHISPER_MODELS = ['whisper-large-v3-turbo:free', 'whisper:free'];
const UNI_TTS_MODELS = ['gpt-4o-mini-tts:free', 'aura-1:free'];
const UNI_IMG_MODELS = ['sdxl:free'];

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
    const discChat = discovered.filter(id => (/^gemini-/i.test(id) || /^gemma-3-(27b|12b)-it$/i.test(id)) && notSpecial(id) && notRetired(id));
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

// IA Gratuita 1 (Sem Chave): Pollinations OpenAI-Compatible Multi-Model (GPT-4o-mini / DeepSeek / Mistral / Llama)
async function chatViaPollinations({ system, user, json }) {
  const sysMsg = (system ? system : 'Você é um diretor de cinema e contador de histórias.') + (json ? '\nResponda APENAS um objeto JSON válido, sem blocos markdown e sem comentários.' : '');
  let lastErr = new Error('pollinations indisponível');
  const polModels = ['openai', 'openai-large', 'deepseek', 'mistral', 'llama'];
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
      if (json) payload.jsonMode = true;
      const r = await fetch('https://text.pollinations.ai/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 DubAI-Studio/2.0' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(22000)
      });
      if (r.status === 429) { lastErr = new Error('HTTP 429 (limite de uso)'); await sleep(1200); continue; }
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
      const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) { lastErr = new Error('HTTP ' + r.status); continue; }
      const text = (await r.text()).trim();
      if (!text) { lastErr = new Error('resposta vazia'); continue; }
      return text;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

// IA Gratuita 2 (Sem Chave): HackClub Free AI Endpoint (Llama 3.3 70B / Qwen)
async function chatViaHackClub({ system, user, json }) {
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
  return text;
}

// Chat com cadeia: OpenAI (se válida) → Gemini 3.1 / Gemma 3 → Unorouter → Pollinations Free AI → HackClub Free AI
async function chatWithFallback({ system, user, json = false, maxTokens = 8000 }) {
  const errors = [];
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
        return { text, provider: 'openai/' + model };
      } catch (e) {
        errors.push(`openai/${model}: ${(e.status ? 'HTTP ' + e.status + ' — ' : '')}${e.message}`);
        if (e.status === 401) { markOpenAi401(); break; }
      }
    }
  }
  // Gemini 3.1 / Gemma 3 — alta velocidade e cota generosa (14.400 req/dia no Gemma 3!)
  if (process.env.GEMINI_API_KEY) {
    try {
      const g = await geminiChat({ system, user, json, maxTokens });
      if (g) return g;
      errors.push('gemini: chave rejeitada (401/403)');
    } catch (e) { errors.push(e.message); }
  } else errors.push('gemini: sem GEMINI_API_KEY');
  // Unorouter — NUNCA chama GET /models antes (preserva 100% da janela de 1 req/min para geração real!)
  const uKeys = allValidUniKeys();
  if (uKeys.length) {
    for (const uKey of uKeys) {
      if (Date.now() < (_uniKeyCooldown[uKey] || 0)) continue;
      const model = UNI_CHAT_MODELS[(_uniCursor++) % UNI_CHAT_MODELS.length];
      try {
        const text = await unorouterChat({ system, user, json, model, maxTokens, apiKey: uKey });
        return { text, provider: 'unorouter/' + model };
      } catch (e) {
        errors.push(`unorouter/${model}: ${(e.status ? 'HTTP ' + e.status + ' — ' : '')}${e.message}`);
        if (e.status === 401) { _deadUniKeys.add(uKey); continue; }
      }
    }
  } else errors.push('unorouter: sem UNOROUTER_API_KEY');
  // Pollinations Multi-Model Free AI (GPT-4o-mini / DeepSeek / Mistral)
  try {
    const text = await chatViaPollinations({ system, user, json });
    return { text, provider: 'pollinations-ai(free)' };
  } catch (e) {
    errors.push('pollinations: ' + e.message);
  }
  // HackClub Free AI (Llama 3.3 70B)
  try {
    const text = await chatViaHackClub({ system, user, json });
    return { text, provider: 'hackclub-ai(free)' };
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

async function edgeNeuralTTS({ text, voice = 'onyx', lang = 'pt-BR' }) {
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
        if (attempt < 3) await sleep(350 * (attempt + 1));
      }
    }
    if (!segSuccess) {
      throw lastErr || new Error('falha na síntese neural HD');
    }
  }

  if (!mp3Buffers.length) throw lastErr || new Error('áudio neural vazio');
  return { buffer: Buffer.concat(mp3Buffers), provider: `neural-hd/${lockedVoice}` };
}

// Voz com Dublador 100% Travado do Começo ao Fim (Microsoft Azure Neural Studio HD 24kHz na voz exata escolhida)
async function ttsWithFallback({ text, voice = 'onyx', lang = 'pt-BR', emotion = '' }) {
  const errors = [];

  // 1) Motor Principal com Dublador Travado (garante SEMPRE a mesma voz do início ao fim do vídeo, sem alternar entre provedores!)
  try {
    const edge = await edgeNeuralTTS({ text, voice, lang, emotion });
    if (edge && edge.buffer && edge.buffer.length > 250) return edge;
  } catch (e) {
    errors.push('neural-hd: ' + e.message);
  }

  // 2) OpenAI oficial apenas se configurada e caso o motor principal esteja inacessível
  if (canUseOfficialOpenAI()) {
    for (const model of ['gpt-4o-mini-tts', 'tts-1-hd', 'tts-1']) {
      try {
        const openai = makeOpenAI();
        const opts = {
          model,
          voice: TTS_VOICES[voice] || 'onyx',
          input: String(text).slice(0, 4096),
          response_format: 'mp3'
        };
        if (model === 'gpt-4o-mini-tts') {
          opts.instructions = 'Fale como um dublador humano brasileiro autêntico, mantendo sempre o mesmo timbre, tom e cadência do início ao fim.';
        }
        const s = await openai.audio.speech.create(opts);
        const b = Buffer.from(await s.arrayBuffer());
        if (!b.length) throw new Error('áudio vazio');
        return { buffer: b, provider: 'openai/' + model };
      } catch (e) {
        errors.push(`openai/${model}: ${(e.status ? 'HTTP ' + e.status + ' — ' : '')}${e.message}`);
        if (e.status === 401) { markOpenAi401(); break; }
      }
    }
  }

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

module.exports = {
  TTS_VOICES, mockScript, mockCreateFull, mockDubResult,
  generateWithOpenAI, generateCreateFull, generateSceneImage, dubWithOpenAI, enhanceScript,
  generateAvatarPortrait, generateAvatarScript, generateAvatarVideo, detectAvatarFaceLandmarks,
  chatWithFallback, ttsWithFallback, chatViaPollinations, ttsGoogle, ttsStreamElements,
  probeOpenAI, fullPipelineProbe, candidatesProbe, unorouterProbe, unorouterVideoProbe, getBody, send
};
