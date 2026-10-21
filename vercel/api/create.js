const { mockCreateFull, generateCreateFull, getBody, send } = require('./lib/ai');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido. Use POST.' });
  const { prompt, duration, style, voice, cinemaMode } = await getBody(req);
  if (!prompt || !prompt.trim()) return send(res, 400, { error: 'Descreva o vídeo primeiro.' });
  if (prompt.length > 2000) return send(res, 400, { error: 'Descrição muito longa (máx 2000 caracteres).' });

  let data = null, mode = 'mock', aiError = null;
  const gen = await generateCreateFull({ prompt, duration, style, voice, cinemaMode });
  if (gen && gen.data) { data = gen.data; mode = 'openai'; }
  else {
    aiError = (gen && gen.error) || 'sem OPENAI_API_KEY';
    data = mockCreateFull({ prompt, duration, style, voice });
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
    script: data.script, scenes: data.scenes, seo: data.seo, mode,
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
    warning: mode === 'openai' ? undefined : `A IA real não respondeu (${aiError}). O roteiro conectado abaixo foi gerado em modo local.`,
    message: mode === 'openai' ? 'Cinema Conectado gerado com IA!' : `⚠️ Modo local ativado (${aiError}).`
  });
};
