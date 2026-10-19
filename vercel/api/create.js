const { mockScript, generateWithOpenAI, getBody, send } = require('./lib/ai');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido. Use POST.' });
  const { prompt, duration, style, voice } = await getBody(req);
  if (!prompt || !prompt.trim()) return send(res, 400, { error: 'Descreva o vídeo primeiro.' });
  if (prompt.length > 2000) return send(res, 400, { error: 'Descrição muito longa (máx 2000 caracteres).' });

  let scriptText = null, scriptMeta = null, mode = 'mock';
  const openaiScript = await generateWithOpenAI(prompt, duration, style, voice);
  if (openaiScript) { scriptText = openaiScript; mode = 'openai'; }
  else { const m = mockScript({ prompt, duration, style, voice }); scriptText = m.script; scriptMeta = m.meta; }

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const project = {
    id, type: 'create', prompt: prompt.trim(),
    title: prompt.trim().slice(0, 80),
    duration: String(duration || '10'), style: style || 'realistic', voice: voice || 'onyx',
    script: scriptText, meta: scriptMeta, mode,
    status: 'roteiro_pronto', createdAt: new Date().toISOString(),
    thumbnail: `https://picsum.photos/seed/${id}/640/360`
  };
  send(res, 200, {
    id, script: scriptText, project,
    message: mode === 'openai' ? 'Roteiro gerado com GPT-4o' : 'Roteiro MOCK gerado (defina OPENAI_API_KEY para IA real)'
  });
};
