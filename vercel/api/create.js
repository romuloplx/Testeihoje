const { mockCreateFull, generateCreateFull, getBody, send } = require('./lib/ai');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido. Use POST.' });
  const { prompt, duration, style, voice, cinemaMode, customCharacters } = await getBody(req);
  if (!prompt || !prompt.trim()) return send(res, 400, { error: 'Descreva o vídeo primeiro.' });
  if (prompt.length > 2000) return send(res, 400, { error: 'Descrição muito longa (máx 2000 caracteres).' });

  let data = null, mode = 'mock', aiError = null, provider = 'local';
  const gen = await generateCreateFull({ prompt, duration, style, voice, cinemaMode, customCharacters });
  if (gen && gen.data) {
    data = gen.data;
    provider = gen.provider || 'ia';
    mode = provider === 'story-engine-fallback' ? 'mock' : 'openai';
    aiError = gen.error || null;
  } else {
    aiError = (gen && gen.error) || 'provedores ocupados';
    data = mockCreateFull({ prompt, duration, style, voice, customCharacters });
  }

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const project = {
    id, type: 'create', prompt: prompt.trim(),
    title: data.title || prompt.trim().slice(0, 80),
    duration: String(duration || '1'), style: style || 'realistic', voice: voice || 'onyx',
    cinemaMode: cinemaMode || 'connected',
    characters: data.characters || [],
    mood: data.mood || 'cinematic',
    artStylePrompt: data.artStylePrompt || '',
    script: data.script, scenes: data.scenes, seo: data.seo, mode, provider,
    status: 'roteiro_pronto', createdAt: new Date().toISOString(),
    thumbnail: `https://picsum.photos/seed/${id}/640/360`
  };
  send(res, 200, {
    id,
    title: data.title || project.title,
    characters: data.characters || [],
    mood: data.mood || 'cinematic',
    artStylePrompt: data.artStylePrompt || '',
    script: data.script,
    scenes: data.scenes,
    seo: data.seo,
    project,
    mode,
    provider,
    warning: mode === 'openai' ? undefined : `Roteiro de história e personagens gerados pelo motor dinâmico (${aiError}).`,
    message: mode === 'openai' ? `História e personagens criados com IA (${provider})!` : `⚡ História com personagens pronta!`
  });
};

