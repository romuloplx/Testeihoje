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

// Seleciona vozes garantidamente distintas para Narrador + Personagens da história
function pickDistinctCastVoices(narratorVoice = 'onyx', chars = []) {
  const used = new Set([narratorVoice || 'onyx']);
  const malePool = ['echo', 'fable', 'onyx', 'ash', 'alloy'];
  const femalePool = ['nova', 'shimmer', 'coral', 'sage', 'alloy'];
  const colors = ['#38bdf8', '#f472b6', '#34d399', '#c084fc'];
  return chars.map((c, idx) => {
    const isFemale = /fem|mulher|garota|menina|dra|ela|woman|girl|female/i.test(`${c.gender || ''} ${c.role || ''} ${c.appearance || ''}`);
    const pool = isFemale ? femalePool : malePool;
    const chosen = (c.voice && TTS_VOICES[c.voice] && !used.has(c.voice))
      ? c.voice
      : (pool.find(v => !used.has(v)) || Object.keys(TTS_VOICES).find(v => !used.has(v)) || (isFemale ? 'nova' : 'echo'));
    used.add(chosen);
    return {
      id: c.id || `char${idx + 1}`,
      name: String(c.name || (isFemale ? 'Helena' : 'Lucas')).trim(),
      role: String(c.role || (idx === 0 ? 'Protagonista' : 'Especialista')).trim(),
      gender: isFemale ? 'female' : 'male',
      voice: chosen,
      themeColor: c.themeColor || colors[idx % colors.length],
      portraitStyle: c.portraitStyle || 'studio',
      appearance: String(c.appearance || (isFemale
        ? ' expressive 29-year-old Brazilian woman with warm eyes, dark wavy hair, stylish modern jacket'
        : ' charismatic 32-year-old Brazilian man with short dark hair, expressive eyes, smart casual jacket')).trim()
    };
  });
}

function formatConnectedScript(title, characters, scenes) {
  const castHeader = characters && characters.length
    ? `🎭 **ELENCO & VOZES:**\n• 🎙️ Narrador (voz principal)\n` + characters.map(c => `• 🗣️ ${c.name} — ${c.role} (voz ${c.voice})`).join('\n') + '\n\n'
    : '';
  const body = scenes.map(s => {
    const loc = s.locationName ? ` (${s.locationName})` : '';
    const lines = Array.isArray(s.beats) && s.beats.length
      ? s.beats.map(b => `${b.speaker === 'narrator' ? '🎙️ Narrador' : '🗣️ ' + (b.speakerName || 'Personagem')}: "${b.text}"`).join('\n')
      : s.narration;
    return `🎬 **CENA ${s.i} — ${s.title}${loc}**\n🏞️ *Cenário:* ${s.visual}\n${lines}`;
  }).join('\n\n');
  return `${title ? `**TÍTULO:** ${title}\n\n` : ''}${castHeader}${body}`;
}

function mockCreateFull({ prompt, duration, style, voice }) {
  const durNum = Math.max(0.5, parseFloat(duration) || 1);
  const cleanPrompt = String(prompt || 'uma descoberta extraordinária').trim();
  const characters = pickDistinctCastVoices(voice || 'onyx', [
    {
      id: 'char1',
      name: 'Lucas',
      role: 'Explorador Curioso',
      gender: 'male',
      appearance: 'charismatic 31-year-old Brazilian man wearing dark adventure jacket, short dark hair, warm expressive face'
    },
    {
      id: 'char2',
      name: 'Helena',
      role: 'Pesquisadora',
      gender: 'female',
      appearance: 'intelligent 29-year-old Brazilian woman wearing modern slate blazer, shoulder-length brown hair, bright eyes'
    }
  ]);

  const rawScenes = [
    {
      title: 'O Chamado da Descoberta',
      locationName: 'Ponto de Partida ao Amanhecer',
      cameraMove: 'zoomIn',
      atmosphere: 'sunbeams',
      visual: `Wide establishing cinema shot of ${cleanPrompt} at golden sunrise, atmospheric mist, volumetric light rays, rich environment details, no text`,
      beats: [
        { speaker: 'narrator', speakerName: 'Narrador', focus: 'wide', text: `Tudo parecia tranquilo ao amanhecer, até surgir a primeira pista real sobre ${cleanPrompt}.` },
        { speaker: 'char1', speakerName: 'Lucas', focus: 'dialogue', text: `Helena, olha este lugar! Tudo o que lemos sobre ${cleanPrompt} está acontecendo bem na nossa frente!` },
        { speaker: 'char2', speakerName: 'Helena', focus: 'dialogue', text: `Impressionante, Lucas. Os sinais mostram que isso vai muito além do que qualquer pessoa imaginava.` }
      ]
    },
    {
      title: 'A Pista Oculta no Cenário',
      locationName: 'Coração do Mistério',
      cameraMove: 'panRight',
      atmosphere: 'particles',
      visual: `Detailed wide interior/exterior environment revealing hidden clues of ${cleanPrompt}, dramatic lighting, depth of field, cinematic composition, no text`,
      beats: [
        { speaker: 'narrator', speakerName: 'Narrador', focus: 'wide', text: `Avançando pelo cenário principal, cada detalhe ao redor confirmava que as peças finalmente se encaixavam.` },
        { speaker: 'char2', speakerName: 'Helena', focus: 'dialogue', text: `Repare na estrutura aqui atrás de nós, Lucas. Cada marca conta exatamente como tudo começou.` },
        { speaker: 'char1', speakerName: 'Lucas', focus: 'dialogue', text: `Então não era lenda! Precisamos registrar isso antes que a luz mude.` }
      ]
    },
    {
      title: 'A Grande Revelação',
      locationName: 'Câmara Principal Iluminada',
      cameraMove: 'zoomIn',
      atmosphere: 'embers',
      visual: `Epic climactic wide shot showcasing the main revelation about ${cleanPrompt}, glowing golden and cyan illumination, grand scale scenery, no text`,
      beats: [
        { speaker: 'narrator', speakerName: 'Narrador', focus: 'wide', text: `Diante dos dois, o cenário se abriu por completo, revelando o verdadeiro segredo de ${cleanPrompt}.` },
        { speaker: 'char1', speakerName: 'Lucas', focus: 'dialogue', text: `Eu nunca vi nada tão grandioso na minha vida, Helena! Isso muda completamente a história!` },
        { speaker: 'char2', speakerName: 'Helena', focus: 'dialogue', text: `E o mais incrível é perceber como cada etapa nos trouxe exatamente até este momento.` }
      ]
    },
    {
      title: 'Novo Horizonte',
      locationName: 'Mirante Panorâmico ao Entardecer',
      cameraMove: 'zoomOut',
      atmosphere: 'sunbeams',
      visual: `Breathtaking panoramic sunset vista concluding the story of ${cleanPrompt}, warm horizon glow, cinematic wide angle, no text`,
      beats: [
        { speaker: 'narrator', speakerName: 'Narrador', focus: 'wide', text: `Ao cair da tarde, a jornada provou que ${cleanPrompt} guarda lições inesquecíveis para quem ousa explorar.` },
        { speaker: 'char2', speakerName: 'Helena', focus: 'dialogue', text: `Essa foi apenas a primeira porta que abrimos juntos, Lucas.` },
        { speaker: 'char1', speakerName: 'Lucas', focus: 'dialogue', text: `Com certeza! E você que acompanhou tudo com a gente, já prepare-se para o próximo capítulo!` }
      ]
    }
  ];

  const chosen = durNum <= 0.6 ? rawScenes.slice(0, 3) : rawScenes;
  const per = (durNum * 60) / chosen.length;
  const charVoiceMap = { narrator: voice || 'onyx', char1: characters[0].voice, char2: characters[1].voice };
  const scenes = chosen.map((s, idx) => {
    const beats = s.beats.map(b => ({ ...b, voice: charVoiceMap[b.speaker] || voice || 'onyx' }));
    return {
      i: idx + 1,
      title: s.title,
      locationName: s.locationName,
      cameraMove: s.cameraMove,
      atmosphere: s.atmosphere,
      narration: beats.map(b => b.text).join(' '),
      beats,
      visual: `${style || 'cinematic'} — ${s.visual}`,
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
      description: `História completa conectando narrador, cenários vivos e personagens sobre ${cleanPrompt}.\n\n#dubaipro #ia #cinema #storytelling`,
      tags: cleanPrompt.split(/\s+/).slice(0, 6).join(', ') + ', ia, história animada, youtube'
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

// Cinema Conectado (Narrador + Cenários Vivos + Diálogo Entre Personagens) + modo Clássico
async function generateCreateFull({ prompt, duration, style, voice, cinemaMode = 'connected' }) {
  const durNum = Math.max(0.5, parseFloat(duration) || 1);
  const styleAnchorMap = {
    realistic: '35mm cinema film photography, photorealistic, natural skin texture, dramatic ARRI Alexa lighting, consistent color grading',
    cinematic: 'epic anamorphic 4K cinema look, volumetric light rays, rich contrast, shallow depth of field, movie still',
    animation: '3D Pixar and Disney feature film animation style, expressive characters, vibrant warm global illumination, rich detailed environments',
    documentary: 'National Geographic 4K cinema documentary photography, authentic natural atmosphere, crisp lens detail',
    images: 'masterpiece digital concept art illustration, cohesive cinematic color palette, atmospheric depth'
  };
  const artStylePrompt = styleAnchorMap[style] || styleAnchorMap.cinematic;

  // MODO CINEMA CONECTADO (Padrão): Narrador + Cenário Dinâmico + Diálogo Entre Personagens 100% interligados
  if (cinemaMode !== 'classic') {
    const nScenes = durNum <= 0.6 ? 3 : durNum <= 1.2 ? 4 : durNum <= 2.5 ? 5 : Math.min(7, Math.round(durNum * 1.1));
    const wordsPerBeat = durNum <= 1.2 ? 18 : durNum <= 2.5 ? 24 : 32;

    const cinemaSystem = [
      'Você é um Diretor de Cinema e Showrunner especialista em vídeos onde NARRADOR, CENÁRIO e DIÁLOGO ENTRE PERSONAGENS se conectam 100%.',
      'Responda APENAS um objeto JSON válido com esta estrutura exata:',
      '{',
      '  "title": "título envolvente em português",',
      '  "mood": "epic | mystery | warm | tech | adventure",',
      '  "seo": { "title": "título YouTube até 70 chars", "description": "descrição envolvente com hashtags", "tags": "tag1, tag2, tag3" },',
      '  "characters": [',
      '    { "id": "char1", "name": "Nome curto", "role": "Papel na história", "gender": "male | female", "appearance": "detailed English description of face, hair, age, clothing for consistent studio portrait" },',
      '    { "id": "char2", "name": "Nome curto", "role": "Papel na história", "gender": "female | male", "appearance": "detailed English description of face, hair, age, clothing for consistent studio portrait" }',
      '  ],',
      '  "scenes": [',
      '    {',
      '      "title": "título curto da cena",',
      '      "locationName": "Nome exato do local em português",',
      '      "cameraMove": "zoomIn | panRight | zoomOut | panLeft",',
      '      "atmosphere": "sunbeams | particles | embers | rain | cyber",',
      '      "visual": "detailed English description of ONLY the environment/scenery matching 100% what happens and is spoken in this exact scene (objects, weather, lighting, wide shot background without people, no text)",',
      '      "beats": [',
      '        { "speaker": "narrator", "speakerName": "Narrador", "focus": "wide", "text": "narração vívida em português descrevendo exatamente o cenário que aparece na tela e a ação" },',
      '        { "speaker": "char1", "speakerName": "Nome do char1", "focus": "dialogue", "text": "fala natural em português conversando diretamente com char2 sobre o que estão vendo/vivendo neste cenário" },',
      '        { "speaker": "char2", "speakerName": "Nome do char2", "focus": "dialogue", "text": "resposta natural em português reagindo ao char1 e conectando com o próximo passo da história" }',
      '      ]',
      '    }',
      '  ]',
      '}',
      'REGRAS OBRIGATÓRIAS:',
      `1. Crie exatamente ${nScenes} cenas em continuidade direta (o final de uma cena leva logicamente à próxima).`,
      `2. Cada fala em "beats" deve ter cerca de ${wordsPerBeat} palavras em português brasileiro natural, sem rubricas entre colchetes e sem emojis.`,
      '3. O campo "visual" de cada cena DEVE retratar exatamente os elementos, lugares e clima citados pelo narrador e pelos personagens naquela cena.'
    ].join('\n');

    const cinemaUser = `Tema/pedido do vídeo: "${prompt}"\nEstilo visual: ${style} (${artStylePrompt})\nCrie elenco recorrente (2 personagens que conversam entre si) + narrador + cenários conectados do início ao fim.`;

    const res = await withRetries(() => chatWithFallback({ system: cinemaSystem, user: cinemaUser, json: true, maxTokens: 4500 }), 2);
    if (!res.error) {
      const parsed = extractJson(res.text);
      if (parsed && Array.isArray(parsed.scenes) && parsed.scenes.length) {
        const characters = pickDistinctCastVoices(voice || 'onyx', Array.isArray(parsed.characters) && parsed.characters.length >= 2
          ? parsed.characters.slice(0, 2)
          : [
              { id: 'char1', name: 'Lucas', role: 'Protagonista', gender: 'male' },
              { id: 'char2', name: 'Helena', role: 'Parceira de cena', gender: 'female' }
            ]
        );
        const voiceBySpeaker = {
          narrator: voice || 'onyx',
          char1: characters[0].voice,
          char2: characters[1].voice
        };
        const nameBySpeaker = {
          narrator: 'Narrador',
          char1: characters[0].name,
          char2: characters[1].name
        };
        const per = (durNum * 60) / parsed.scenes.length;
        const scenes = parsed.scenes.slice(0, nScenes).map((s, idx) => {
          const rawBeats = Array.isArray(s.beats) && s.beats.length
            ? s.beats
            : [{ speaker: 'narrator', speakerName: 'Narrador', focus: 'wide', text: String(s.narration || s.title || prompt) }];
          const beats = rawBeats
            .map(b => {
              const sp = (b.speaker === 'char1' || b.speaker === 'char2') ? b.speaker : 'narrator';
              return {
                speaker: sp,
                speakerName: nameBySpeaker[sp] || String(b.speakerName || 'Narrador'),
                focus: sp === 'narrator' ? 'wide' : 'dialogue',
                voice: voiceBySpeaker[sp] || voice || 'onyx',
                text: String(b.text || '').replace(/\*\*|\[.*?\]/g, '').trim()
              };
            })
            .filter(b => b.text.length > 0);
          return {
            i: idx + 1,
            title: String(s.title || `Cena ${idx + 1}`),
            locationName: String(s.locationName || s.title || `Cena ${idx + 1}`),
            cameraMove: ['zoomIn', 'panRight', 'zoomOut', 'panLeft'].includes(s.cameraMove) ? s.cameraMove : (idx % 2 === 0 ? 'zoomIn' : 'panRight'),
            atmosphere: ['sunbeams', 'particles', 'embers', 'rain', 'cyber'].includes(s.atmosphere) ? s.atmosphere : 'particles',
            visual: `${artStylePrompt}, ${String(s.visual || s.title || prompt)}, wide shot environment background, no text, no watermark`,
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
            mood: parsed.mood || 'cinematic',
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
    // Se algum modelo menor falhar no JSON completo, cai suavemente para o modo em 2 fases abaixo ou mock conectado
    if (res.error) return { error: res.error };
  }

  const dur = Math.max(1, Math.round(durNum));
  const nScenes = Math.max(4, Math.min(10, Math.round(dur / 1.5)));
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

  // Fase 2: narrações em lotes de 2 (menos colisão de limite) com retries profundos
  const narrations = new Array(scenesPlan.length).fill('');
  let fatal = null;
  for (let i = 0; i < scenesPlan.length && !fatal; i += 2) {
    const batch = scenesPlan.slice(i, i + 2);
    const results = await Promise.all(batch.map(async (s, j) => {
      const idx = i + j;
      if (j > 0) await new Promise(r => setTimeout(r, 1200)); // desloca o lote
      return withRetries(() => chatWithFallback({
        system: 'Você é narrador profissional de vídeos. Escreva APENAS o texto da narração, sem título, sem aspas, sem comentários.',
        user: `Vídeo sobre: "${prompt}". Cena ${idx + 1} de ${scenesPlan.length}: "${s.title}" (${s.visual || ''}). Escreva a narração desta cena em português brasileiro, com aproximadamente ${wordsPerScene} palavras, em tom envolvente.`
      }), 2);
    }));
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.error) {
        // segunda chance individual, depois do lote, com prompt mais curto
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
    start: Math.round(idx * per),
    end: Math.round((idx + 1) * per)
  }));
  const script = (outline.title ? `**TÍTULO:** ${outline.title}\n\n` : '') + scenes.map(s => `**CENA ${s.i} — ${s.title}**\n${s.narration}`).join('\n\n');
  return { data: { script, scenes, seo: outline.seo || {}, title: outline.title || '' }, provider: [...providers].join(' + ') };
}

// Imagem de uma cena: OpenAI (se válida) → Gemini → Unorouter → Pollinations
async function generateSceneImage({ prompt, style }) {
  const errors = [];
  const fullPrompt = `${style || 'cinematográfico'}, ${prompt}, 16:9 video scene, high quality, detailed, no text, no watermark, no captions`;
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
  // Gemini (Google) — imagem da cena
  if (process.env.GEMINI_API_KEY) {
    try {
      const g = await geminiImage(fullPrompt);
      if (g) return g;
      errors.push('gemini/image: sem imagem retornada');
    } catch (e) { errors.push('gemini/image: ' + e.message); }
  }
  // Unorouter images — direto nos modelos conhecidos sem gastar cota em GET /models
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
            const fr = await fetch(url, { signal: AbortSignal.timeout(20000) });
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
  // Fallback gratuito: Pollinations — escada de tamanhos (só o menor tier é grátis agora)
  const ladder = [
    { model: 'flux', w: 1280, h: 720 },
    { model: '', w: 1024, h: 576 },
    { model: '', w: 768, h: 432 },
    { model: '', w: 512, h: 288 },
    { model: '', w: 256, h: 256 }
  ];
  for (const opt of ladder) {
    for (let tent = 0; tent < 1; tent++) {
      try {
        const seed = Math.floor(Math.random() * 100000);
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${opt.w}&height=${opt.h}&nologo=true&seed=${seed}` + (opt.model ? `&model=${opt.model}` : '');
        const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
        if (r.status === 429 || r.status === 402) { await sleep(2000); continue; }
        if (!r.ok) { errors.push(`pollinations ${opt.w}x${opt.h}: HTTP ${r.status}`); break; }
        const buf = Buffer.from(await r.arrayBuffer());
        if (!buf.length) { await sleep(1000); continue; }
        return { imageBase64: buf.toString('base64'), mime: r.headers.get('content-type') || 'image/jpeg', model: `pollinations-${opt.w}x${opt.h}(free)` };
      } catch (e) {
        errors.push(`pollinations ${opt.w}x${opt.h}: ${e.message}`);
        if (/fetch failed|ENOTFOUND|ECONNREFUSED/i.test(e.message)) return { error: errors.join(' | ') };
        await sleep(1500);
      }
    }
  }
  return { error: errors.join(' | ') || 'nenhum provedor de imagem respondeu' };
}

// Dublagem real: Whisper (transcrição) + GPT (tradução) + TTS (voz)
async function dubWithOpenAI({ audioBase64, language, dubVoice, targetLanguage = 'pt-BR', transcription: givenText = '' }) {
  try {
    const audioBuf = Buffer.from(audioBase64, 'base64');
    // Transcrição com cadeia: Whisper OpenAI → Whisper/omni via Unorouter → (ou texto já pronto do navegador)
    let originalText = String(givenText || '').trim();
    let whisperErr = '';
    let whisperInfo = originalText ? 'navegador (Whisper local)' : '';
    if (originalText) {
      // transcrição já veio pronta (fallback local do navegador) — pula direto pra tradução
    }
    try {
      if (!originalText && canUseOfficialOpenAI()) {
        const OpenAI = require('openai');
        const { toFile } = OpenAI;
        const openai = makeOpenAI();
        const file = await toFile(audioBuf, 'audio.wav', { type: 'audio/wav' });
        const transcription = await openai.audio.transcriptions.create({
          file,
          model: 'whisper-1',
          language: language || undefined
        });
        originalText = (transcription.text || '').trim();
      }
    } catch (e) {
      if (e.status === 401) markOpenAi401();
      whisperErr = 'openai: ' + e.message;
    }
    // Gemini (multimodal) transcreve áudio com rotação automática nos modelos Gemini 3.x ativos
    if (!originalText && process.env.GEMINI_API_KEY) {
      try {
        const t = await geminiTranscribe(audioBuf, language);
        if (t) { originalText = t; whisperInfo = 'gemini/' + (_gemBest && _gemBest.audio ? _gemBest.audio : gemModel()); }
        else whisperErr += ' | gemini: resposta vazia';
      } catch (e) { whisperErr += ' | gemini: ' + e.message; }
    }
    // Unorouter Whisper — chama DIRETO sem gastar o slot de 1 req/min em GET /models
    const uniKeysForAudio = allValidUniKeys();
    if (!originalText && uniKeysForAudio.length) {
      for (const uKey of uniKeysForAudio) {
        if (originalText) break;
        for (const model of UNI_WHISPER_MODELS) {
          if (originalText) break;
          try {
            const fd = new FormData();
            fd.append('file', new Blob([audioBuf], { type: 'audio/wav' }), 'audio.wav');
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
            } else {
              const errBody = (await r.text().catch(() => '')).slice(0, 100);
              whisperErr += ` | unorouter/${model}: HTTP ${r.status} ${errBody}`;
              if (r.status === 401) { _deadUniKeys.add(uKey); break; }
              if (r.status === 429 && /allows 1 request|Too many requests/i.test(errBody)) {
                markUniRateWindow(uKey);
                break; // não gasta mais chamadas na mesma chave; tenta próxima chave ou OMNI
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
    if (!originalText && omniKey && audioBuf.length < 9_000_000) {
      for (const model of ['qwen3.8-omni-flash', 'nemotron-3-nano-omni-30b-a3b-reasoning:free']) {
        if (originalText) break;
        try {
          const r = await fetch(uniBase() + '/chat/completions', {
            method: 'POST', headers: uniHeaders(omniKey),
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: [
                { type: 'input_audio', input_audio: { data: audioBuf.toString('base64'), format: 'wav' } },
                { type: 'text', text: 'Transcreva este áudio. Responda APENAS com o texto falado, sem comentários.' }
              ] }],
              max_tokens: 4000
            }),
            signal: AbortSignal.timeout(30000)
          });
          if (r.ok) {
            const j = await r.json();
            const t = (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || '').trim();
            if (t && !/não (consigo|posso|é possível)|cannot|unable/i.test(t)) { originalText = t; whisperInfo = 'unorouter/' + model + ' (omni)'; }
          } else {
            const txt = (await r.text().catch(() => '')).slice(0, 80);
            whisperErr += ` | unorouter/${model}(omni): HTTP ${r.status}`;
            if (r.status === 429 && /allows 1 request|Too many requests/i.test(txt)) { markUniRateWindow(omniKey); break; }
          }
        } catch (e) { whisperErr += ` | unorouter/${model}(omni): ${e.message}`; }
      }
    }
    // Última chance: se tudo foi429 (cota), espera a janela ("retry in 60s") e tenta 1x no melhor modelo
    if (!originalText && /429/.test(whisperErr) && process.env.UNOROUTER_API_KEY) {
      await sleep(30000);
      const ids = await unorouterModels();
      const best = (ids.find(id => /whisper-large-v3-turbo/i.test(id)) || ids.find(id => /whisper/i.test(id)) || 'whisper-large-v3-turbo:free');
      try {
        const fd = new FormData();
        fd.append('file', new Blob([audioBuf], { type: 'audio/wav' }), 'audio.wav');
        fd.append('model', best);
        if (language) fd.append('language', language);
        const r = await fetch(uniBase() + '/audio/transcriptions', {
          method: 'POST', headers: { Authorization: uniHeaders().Authorization }, body: fd,
          signal: AbortSignal.timeout(60000)
        });
        if (r.ok) {
          const j = await r.json();
          originalText = (j.text || '').trim();
          if (originalText) whisperInfo = 'unorouter/' + best;
        } else whisperErr += ` | unorouter/${best} (após espera): HTTP ${r.status}`;
      } catch (e) { whisperErr += ` | unorouter/${best} (após espera): ${e.message}`; }
    }
    if (!originalText) throw new Error('Não foi possível transcrever o áudio. ' + whisperErr);

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
      dubInfo: `Dublagem em ${targetLanguage} gerada com IA • Transcrição: ${whisperInfo || 'openai/whisper-1'} • Tradução: ${tr.provider || 'IA'} • Voz: ${dubVoice} (${[...usedProviders].join(', ')}) • Áudio pronto para download.`,
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
    const b = await ttsGoogle({ text: 'olá', lang: 'pt-BR' });
    report.googleTts = { ok: true, bytes: b.length };
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
// Transcrição de áudio (multimodal) — usa kind: 'audio' para ir direto nos Gemini 3.x multimodais
async function geminiTranscribe(audioBuf, language, timeout = 30000) {
  if (!process.env.GEMINI_API_KEY) return null;
  const body = {
    contents: [{ role: 'user', parts: [
      { inlineData: { mimeType: 'audio/wav', data: Buffer.from(audioBuf).toString('base64') } },
      { text: 'Transcreva fielmente a fala deste áudio' + (language ? ` no idioma ${language}` : '') + '. Se não houver fala humana audível, responda exatamente: [silêncio]. Responda APENAS com o texto transcrito, sem comentários.' }
    ] }],
    generationConfig: { temperature: 0.1 }
  };
  const j = await geminiGenerateTried({ body, timeout, kind: 'audio' });
  const text = gemText(j);
  return /^\[?sil[êe]ncio\]?$/i.test(text) ? '' : (text || '');
}
// Imagem da cena (família Gemini 3 Image)
async function geminiImage(prompt) {
  if (!process.env.GEMINI_API_KEY) return null;
  try {
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
    };
    const j = await geminiGenerateTried({ body, timeout: 45000, kind: 'image' });
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
async function geminiTTS(text, voice = 'onyx', timeout = 20000) {
  if (!process.env.GEMINI_API_KEY) return null;
  await _loadLame();
  const voiceName = GEM_TTS_VOICES[voice] || 'Aoede';
  const body = {
    // formato documentado do Gemini TTS: instrução "Say ...:" + fala entre aspas, sem role
    contents: [{ parts: [{ text: 'Say in a natural narrator tone: "' + String(text).slice(0, 4000).replace(/"/g, "'") + '"' }] }],
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
      // sem lame: ainda devolve o PCM como WAV (o navegador toca; merges mais complexos caem na cadeia)
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

// Texto gratuito (sem chave): Pollinations — POST primeiro (sem limite de URL), GET como reserva
async function chatViaPollinations({ system, user, json }) {
  const prompt = (system ? system + '\n\n' : '') + user + (json ? '\n\nResponda APENAS JSON válido, sem comentários nem markdown.' : '');
  let lastErr = new Error('pollinations indisponível');
  // POST (OpenAI-compatible) — vários modelos do próprio Pollinations (se um limita, outro faz)
  const polModels = ['openai', 'mistral', 'llama'];
  for (let pass = 0; pass < 2; pass++) {
    for (const model of polModels) {
      try {
        const r = await fetch('https://text.pollinations.ai/openai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] }),
          signal: AbortSignal.timeout(25000)
        });
        if (r.status === 429) { lastErr = new Error('HTTP 429 (limite de uso)'); await sleep(2000); continue; }
        if (!r.ok) { lastErr = new Error('HTTP ' + r.status); continue; }
        const j = await r.json().catch(() => null);
        const text = j && j.choices && j.choices[0] && j.choices[0].message ? String(j.choices[0].message.content || '').trim() : '';
        if (!text) { lastErr = new Error('resposta vazia'); continue; }
        return text;
      } catch (e) {
        lastErr = e;
        if (/fetch failed|ENOTFOUND|ECONNREFUSED/i.test(e.message)) throw lastErr;
        await sleep(1500);
      }
    }
  }
  // GET (só para prompts curtos)
  const short = prompt.slice(0, 900);
  for (const url of [
    'https://text.pollinations.ai/' + encodeURIComponent(short) + '?model=openai',
    'https://text.pollinations.ai/' + encodeURIComponent(short)
  ]) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!r.ok) { lastErr = new Error('HTTP ' + r.status); continue; }
      const text = (await r.text()).trim();
      if (!text) { lastErr = new Error('resposta vazia'); continue; }
      return text;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

// Chat com cadeia: OpenAI (se válida) → Gemini 3.1 / Gemma 3 → Unorouter (direto sem /models) → Pollinations
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

const TTS_LANGS = { 'pt-BR': 'pt-BR', pt: 'pt-BR', en: 'en', es: 'es', fr: 'fr', de: 'de', it: 'it' };

// Voz com cadeia: OpenAI (se válida) → Gemini 3.1 Neural TTS (confirmado ativo!) → Unorouter → Google → StreamElements
async function ttsWithFallback({ text, voice = 'onyx', lang = 'pt-BR' }) {
  const errors = [];
  if (canUseOfficialOpenAI()) {
    for (const model of ['tts-1', 'tts-1-hd']) {
      try {
        const openai = makeOpenAI();
        const s = await openai.audio.speech.create({ model, voice: TTS_VOICES[voice] || 'onyx', input: String(text).slice(0, 4096), response_format: 'mp3' });
        const b = Buffer.from(await s.arrayBuffer());
        if (!b.length) throw new Error('áudio vazio');
        return { buffer: b, provider: 'openai/' + model };
      } catch (e) {
        errors.push(`openai/${model}: ${(e.status ? 'HTTP ' + e.status + ' — ' : '')}${e.message}`);
        if (e.status === 401) { markOpenAi401(); break; }
      }
    }
  }
  // Gemini 3.1 Flash TTS (voz neural de estúdio, rápido e não consome o slot de 1 req/min do Unorouter!)
  if (process.env.GEMINI_API_KEY) {
    try {
      const g = await geminiTTS(text, voice);
      if (g && g.buffer) return g;
      errors.push('gemini/tts: ' + (g && g.error ? g.error : 'sem áudio'));
    } catch (e) { errors.push(e.message); }
  }
  // Unorouter TTS — direto sem GET /models
  const uKey = pickReadyUniKey();
  if (uKey) {
    for (const model of UNI_TTS_MODELS) {
      try {
        const r = await fetch(uniBase() + '/audio/speech', {
          method: 'POST', headers: uniHeaders(uKey),
          body: JSON.stringify({ model, voice: TTS_VOICES[voice] || 'onyx', input: String(text).slice(0, 4096), response_format: 'mp3' }),
          signal: AbortSignal.timeout(15000)
        });
        if (r.ok) {
          const b = Buffer.from(await r.arrayBuffer());
          if (b.length > 500) return { buffer: b, provider: 'unorouter/' + model };
        } else {
          const txt = (await r.text().catch(() => '')).slice(0, 100);
          errors.push(`unorouter/${model}: HTTP ${r.status}`);
          if (r.status === 401) { _deadUniKeys.add(uKey); break; }
          if (r.status === 429 && /allows 1 request|Too many requests/i.test(txt)) { markUniRateWindow(uKey); break; }
        }
      } catch (e) { errors.push(`unorouter/${model}: ${e.message}`); break; }
    }
  }
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

// ============ AVATAR FALANTE (estilo HeyGen — Fase 2 + ponte Fase 3) ============

// Retrato frontal de apresentador com lábios fechados/neutros — ideal para animação labial (lip-sync)
async function generateAvatarPortrait({ prompt = '', style = 'studio' }) {
  const styleDesc = {
    studio: 'photorealistic studio portrait photography, 85mm lens, soft key and rim lighting, clean modern studio bokeh background',
    news: 'photorealistic TV news anchor portrait, broadcast newsroom studio background, crisp lighting, professional blazer',
    creator: 'photorealistic YouTube creator portrait in cozy RGB podcast studio with soft warm lamps, natural friendly expression',
    exec: 'photorealistic executive portrait in bright modern glass office, confident approachable expression',
    pixar: '3D Pixar / Disney stylized character portrait, expressive eyes, warm soft lighting, clean gradient studio backdrop'
  }[style] || 'photorealistic studio portrait photography, soft studio lighting';

  const subject = String(prompt || '').trim() || 'apresentador carismático brasileiro de 30 anos';
  const fullPrompt = `${styleDesc}, ${subject}, centered front-facing head and shoulders portrait, looking directly straight into the camera lens, symmetrical face centered in frame, relaxed natural closed mouth with gentle pleasant expression, both eyes clearly visible, no hands near face, no microphone covering mouth, no text, no watermark`;

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
  if (process.env.GEMINI_API_KEY) {
    try {
      const g = await geminiImage(fullPrompt);
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

module.exports = {
  TTS_VOICES, mockScript, mockCreateFull, mockDubResult,
  generateWithOpenAI, generateCreateFull, generateSceneImage, dubWithOpenAI, enhanceScript,
  generateAvatarPortrait, generateAvatarScript, generateAvatarVideo,
  chatWithFallback, ttsWithFallback, chatViaPollinations, ttsGoogle, ttsStreamElements,
  probeOpenAI, fullPipelineProbe, candidatesProbe, unorouterProbe, unorouterVideoProbe, getBody, send
};
